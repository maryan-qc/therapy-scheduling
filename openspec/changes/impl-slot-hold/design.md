# Design: impl-slot-hold

## Context

- Специфікація: `openspec/specs/slot-holds/spec.md` (30 AC) і `openspec/specs/clients/spec.md` (6 AC); знімок вимог PM
  2026-10-21. Усі питання до PM закрито (Sofiia-pm/therapy-scheduling-spec#3…#12), робочих припущень у специфікації не
  лишилось; власні рішення без питання — `docs/spec-reading.md`, «Власні припущення».
- Стек фіксований (`AGENTS.md`): Next.js 16 App Router без Cache Components, Supabase (Postgres + Auth + RLS),
  міграції лише через PR і `db-deploy`, Vitest. Job `app` у CI запускає `npm test` **без бази**, `db-check` лише
  застосовує міграції на одноразовій базі.

## Goals / Non-Goals

**Goals:**

- Кожен AC зрізу: код + тест з AC ID на початку назви + рядок «реалізовано» в `docs/conformance.md`.
- «Ніхто інший цей слот не займе» гарантує база, а не сторінка: перевірки й запис утримання — одна транзакція
  Postgres-функції (AC-HOLD-03, 04, 17, 25).
- Прострочення — з часу створення під час читання, без cron (Vercel Hobby — щонайбільше раз на добу).
- Права з матриці `requirements/product.md` — у базі: RLS на кожній таблиці, `revoke all` + явні GRANT, політика на
  кожну операцію, роль — з `profiles.role`.

**Non-Goals:**

- Усе з `## Non-goals` специфікації: тип сеансу, документи згоди, повна анкета, редагування доступності, повторювані
  сеанси, сповіщення, звільнення утримання раніше ніж через 24 години, показ «хто створив / хто підтвердив».
- Екран адміністратора для користувачів і ролей: у зрізі 1 користувачі — `npm run users:demo`.

## Decisions

### 1. Ролі (міграція `…_slot_hold_roles.sql`)

`admin`, `scheduler`, `therapist` замість `member`/`admin` шаблону, у порядку з `AGENTS.md`: зняти
`profiles_role_check` → `update … set role = 'therapist' where role = 'member'` → `default 'therapist'` (найменші
права для нового користувача) → новий `profiles_role_check`. `supabase/demo-users.json`: `admin@example.test`,
`scheduler1@example.test`, `scheduler2@example.test` (два планувальники — AC-HOLD-03, 04, 27, 36),
`therapist1@example.test`, `therapist2@example.test`.

### 2. Модель даних (міграція `…_slot_holds.sql`)

| Таблиця | Ключові колонки | AC |
|---|---|---|
| `therapists` | `id`, `email` (unique, `*@example.test`), `name` | 01, 09 |
| `slots` | `id`, `therapist_id`, `starts_at`, `ends_at`; unique (`therapist_id`, `starts_at`); check: 60 хвилин, початок години | 01, 07, 18, 24, 32, 33 |
| `clients` | `id`, `name` (check: не порожнє після trim), `email` (check: `email = lower(btrim(email))`, рівно один «@»), `created_by`, `created_at`; unique (`email`) | 10, 11, 15, 16, 34, 35 |
| `holds` | `id`, `slot_id`, `client_id`, `created_by`, `created_at`, `expires_at` (= `created_at` + 1440 хвилин), `confirmed_at`, `confirmed_by`, `released_at` | 02–06, 12, 13, 17, 19–23, 25–29, 36 |

- **Статус утримання не зберігаємо — його рахує читання** з `now`: `Confirmed`, якщо є `confirmed_at`; `Expired`, якщо
  `confirmed_at` порожній і `now >= expires_at`; інакше `Held` (AC-HOLD-05, 06, 12).
- **Статус слоту** (AC-HOLD-01, 32): `Confirmed` / `Held` за утриманням; без активного утримання чи сеансу — `Past`,
  якщо `now >= starts_at`, інакше `Free`.
- **Не більше одного відкритого утримання на слот** — частковий unique index `holds (slot_id) where released_at is
  null`. Обмеження не знає про 24 години, тому прострочене утримання «звільняє» (`released_at`) та сама функція, яка
  створює нове (п. 3) — як радить бриф.
- **Email нормалізує база** (AC-HOLD-34, 35): server action передає `lower(trim(email))`, а check і unique на `email`
  ловлять дублікат з іншим регістром навіть в обхід сторінки.
- Перетин в одного терапевта виключено формою слоту: слоти 60 хвилин від початку години й unique (`therapist_id`,
  `starts_at`) не мають спільної хвилини. Перетин у клієнта (AC-HOLD-25, 26) перевіряє функція п. 3.
- **Демо-дані — у тій самій міграції** (`insert … on conflict do nothing`; сид у хмарі вже виконано в день 0):
  therapist1 і therapist2, слоти пн–пт 09:00–17:00 (America/Los_Angeles) з 2026-10-19 до 2026-11-27; у therapist1
  немає слотів 2026-11-06 (AC-HOLD-24).

### 3. Утримання й підтвердження — Postgres-функції

| Функція (Data API, `security invoker`) | Внутрішня (`private`, `security definer`, `set search_path = ''`) | Коди відповіді |
|---|---|---|
| `public.hold_slot(p_slot_id, p_client_id)` | `private.hold_slot_at(…, p_now)` | `OK`, `HOLD_FORBIDDEN` (08), `SLOT_STARTED` (07), `SLOT_UNAVAILABLE` (03, 04, 17), `CLIENT_BUSY` (25), `NOT_FOUND` |
| `public.confirm_hold(p_hold_id)` | `private.confirm_hold_at(…, p_now)` | `OK`, `CONFIRM_FORBIDDEN` (14), `ALREADY_CONFIRMED` (36), `HOLD_EXPIRED` (13), `SLOT_STARTED` (22), `NOT_FOUND` |

- Публічна функція передає `now()`; внутрішня приймає `p_now`. Схема `private` не відкрита в Data API, тож клієнт не
  підставить свій час.
- `hold_slot_at`: роль (`private.current_app_role()` ∈ scheduler, admin) → `select … for update` рядка слота (два
  одночасні виклики стають у чергу) → слот почався → є відкрите утримання, ще не прострочене або підтверджене →
  `SLOT_UNAVAILABLE`; прострочене → `released_at = p_now` → у клієнта є непрострочене утримання чи сеанс на слот, що
  перетинається в часі (прострочені не рахуються, AC-HOLD-26) → `CLIENT_BUSY` → `insert` з
  `expires_at = p_now + interval '1440 minutes'`. `unique_violation` часткового індексу теж дає `SLOT_UNAVAILABLE`.
- `confirm_hold_at`: роль → `select … for update` утримання → `ALREADY_CONFIRMED` → `HOLD_EXPIRED` → `SLOT_STARTED` →
  `confirmed_at = p_now`, `confirmed_by = auth.uid()`. Будь-який планувальник чи адміністратор (AC-HOLD-27); блокування
  рядка робить друге одночасне підтвердження `ALREADY_CONFIRMED` (AC-HOLD-36).
- Коди → повідомлення PM — у `src/lib/holds/messages.ts` (тексти дослівно з AC).

### 4. Права: GRANT + RLS

| Таблиця | select | insert | update | delete |
|---|---|---|---|---|
| `therapists` | scheduler, admin — усі; therapist — свій рядок (`email` = email профілю) | — | — | — |
| `slots` | scheduler, admin — усі; therapist — власні | — | — | — |
| `clients` | scheduler, admin — усі; therapist — клієнти утримань на власних слотах | scheduler, admin (колонки `name`, `email`) | — | — |
| `holds` | scheduler, admin — усі; therapist — на власних слотах | лише через функції п. 3 | лише через функції п. 3 | — |

- Хелпер `private.current_therapist_id()` (`security definer`): терапевт за email профілю. Профіль змінює лише
  `full_name` (колонковий GRANT шаблону), тож email підмінити не можна.

### 5. Доменний модуль `src/lib/holds/` (чистий TypeScript, `now` — параметр, без бібліотек)

| Файл | Що робить | AC |
|---|---|---|
| `time.ts` | межі дня й тижня (пн–нд) у America/Los_Angeles через `Intl`; формат `РРРР-ММ-ДД ГГ:ХХ` | 02, 30, 31 |
| `status.ts` | `holdStatus`, `slotStatus` (Free / Held / Confirmed / Past) | 01, 05, 06, 12, 32 |
| `day-view.ts` | слоти дня, що можна утримати, «No free slots on this day.» | 01, 18, 24, 33 |
| `clients.ts` | `validateClient`, `normalizeEmail` | 10, 11, 15, 16, 34, 35 |
| `rules.ts` | ті самі правила, що й функції бази: `checkHold`, `checkConfirm` (роль, почався, зайнятий, клієнт зайнятий, прострочене, підтверджене) | 02–04, 07, 08, 12–14, 17, 19, 22, 23, 25–27, 36 |
| `schedule.ts` | розклад терапевта на тиждень, список утримань планувальника (прострочені до початку слоту) | 09, 20, 21, 28–31 |
| `messages.ts` | коди → повідомлення PM | 03, 07, 08, 13, 14, 16, 22, 25, 36 |

### 6. Сторінки й server actions

| Сторінка | Хто | Server action |
|---|---|---|
| `/` | усі | перенаправлення за роллю: scheduler/admin → `/slots`, therapist → `/schedule` |
| `/slots?therapist=…&date=…` | scheduler, admin | `holdSlot` → `rpc('hold_slot')`; `confirmHold` → `rpc('confirm_hold')`; `createClient` → `validateClient` → `insert clients` |
| `/holds` | scheduler, admin | список утримань (Held / Confirmed / Expired до початку слоту), `confirmHold` |
| `/schedule?week=…` | therapist | лише читання |

Роль — з `profiles`, вхід — `getClaims()`. Кнопок «Hold» і «Confirm» у терапевта немає, а прямий виклик відхиляє база.

### 7. Тести

- Юніт-тести `tests/holds/*.test.ts` з фіксованим `now` для доменного модуля (п. 5): назва кожного починається з AC ID.
- Функції бази й RLS тестами в CI не покриваємо (job `app` без бази; PGlite як нову залежність свідомо не додаємо);
  `rules.ts` повторює ті самі правила й порядок перевірок, що й функції. Що міграції застосовуються — `db-check`;
  поведінку бази — вручну на preview і проді під синтетичними користувачами (опис у PR задачі).

## Risks / Trade-offs

- **Правила в двох місцях** (`rules.ts` і функції бази): тести перевіряють TypeScript, а рішення ухвалює база. Розбіжність
  ловимо ручною перевіркою на preview; у наступних зрізах — тести бази (PGlite або `supabase test db`).
- **AC-HOLD-04 і AC-HOLD-36** (одночасні дії) у тестах — без справжньої паралельності: гарантію дають `select … for
  update` і частковий unique index у базі.
- Статус рахується з годинника сервера застосунку (сторінки) і бази (функції); різниця в секунди на межі 24 годин
  можлива лише в показі — рішення ухвалює функція бази.

## Open Questions

—
