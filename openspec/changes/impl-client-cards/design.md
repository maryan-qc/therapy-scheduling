# Design: impl-client-cards

План реалізації зрізу 2 (`openspec/specs/client-cards`, AC-CARD-01…11) і уточнень зрізу 1 зі знімка 2026-10-23
(`openspec/specs/slot-holds`, `openspec/specs/clients`: AC-HOLD-01, 37…42). Робочі варіанти для питань PM Q5–Q8 —
з `docs/spec-reading.md`; після відповідей PM рішення, що від них залежать, позначено «(Q…)».

## UI і компоненти

Лише компоненти з `@/components/ui` і токени з `DESIGN.md`; тексти — дослівно з AC.

| Сторінка | Хто | Що бачить | AC |
|---|---|---|---|
| `/clients` | `scheduler`, `admin` | заголовок «Clients»; `Table` усіх карток (Name, Type, Date of birth, Language, Contact — email дорослого або ім'я та email опікуна) за ім'ям за абеткою; посилання на картку; одна основна кнопка «New client card» | AC-CARD-10 |
| `/clients` | `therapist` | заголовок «My clients»; та сама `Table`, але лише свої клієнти (рядки фільтрує RLS); порожньо — `<p className="text-muted-foreground">` «No clients yet. Clients appear here when a scheduler holds a slot with you.» без таблиці | AC-CARD-04, AC-CARD-08, AC-CARD-09 |
| `/clients/new` | `scheduler`, `admin` | `Card` з формою: `NativeSelect` «Client type» (Adult / Child), `Input` «Name», `Input type="date"` «Date of birth» (`max` — сьогодні в America/Los_Angeles), `NativeSelect` «Session language» (English / Spanish); для Adult — `Input` «Email»; для Child — «Guardian name», «Guardian email». У кожного поля `Label`. Помилки — `Alert` `destructive` угорі (`role="alert"`), поля з помилкою — `aria-invalid`; введені дані лишаються у формі (`useActionState`) | AC-CARD-01, AC-CARD-02, AC-CARD-03, Q5 |
| `/clients/new` | `therapist` | лише `Alert` `destructive` «Only schedulers and admins can create client cards.», без форми | AC-CARD-06 |
| `/clients/[id]` | `scheduler`, `admin`, свій `therapist` | `Card`: тип, ім'я, дата народження, мова; email (дорослий) або «Guardian» з ім'ям та email (дитина). Відсутнє поле картки зрізу 1 — «Not provided» у `text-muted-foreground`; успіх створення — `Alert` `role="status"` «Client created.» | AC-CARD-01, AC-CARD-02, AC-CARD-04, AC-CARD-10 |
| `/clients/[id]` | `therapist`, клієнт не свій або картки немає | лише `Alert` `destructive` «You don't have access to this client.», жодних даних | AC-CARD-05, AC-CARD-08, Q7 |
| `/clients/[id]` | `scheduler`, `admin`, картки немає | `Alert` `destructive` «Client not found.» | Q7 |
| `/slots` (вибір клієнта для утримання) | `scheduler`, `admin` | дорослий — «Name (email)»; дитина — «Name (guardian: email опікуна)» | AC-CARD-01, AC-CARD-02 |
| `/` та будь-яка сторінка | увійшов без ролі | лише «Your account has no access yet. Contact an administrator.» і «Sign out» | AC-CARD-11 |
| будь-яка сторінка | не увійшов | `/login` (proxy й `requireViewer` перенаправляють) | AC-CARD-07 |
| `/holds` | `scheduler`, `admin` | лише «Held» і «Expired», слот яких ще не почався, за часом слоту; без «Confirmed»; прострочене утримання клієнта зникає, коли за ним знову утримали той самий слот | AC-HOLD-37, AC-HOLD-38, AC-HOLD-42 |
| `/schedule` | `therapist` | в утриманні — ім'я клієнта без email (як і зараз) | AC-HOLD-40 |

Навігація (`nav.tsx`): «Clients» для `scheduler` і `admin`, «My clients» для `therapist`. Швидка форма нового клієнта
(ім'я та email) на `/slots` лишається до відповіді PM на Q8; картка з неї — тип «Adult», інші поля «Not provided».

## Дані й RLS

### Таблиця `clients` (нова міграція `…_client_cards.sql`, задача 1)

Застосовані міграції не змінюємо: `alter table`, нові constraint-и, `create or replace`.

- Нові колонки: `client_type text not null default 'adult'` (`check in ('adult', 'child')`; наявні картки зрізу 1 стають
  «Adult», як у припущенні PM), `date_of_birth date`, `session_language text` (`check in ('English', 'Spanish')`),
  `guardian_name text`, `guardian_email text`; `email` — `drop not null` (у дитини власного email немає).
- `clients_contact_by_type`: дорослий — `email is not null`, полів опікуна немає; дитина — `email is null`, а
  `guardian_name`, `guardian_email`, `date_of_birth`, `session_language` — `not null` (AC-CARD-02, AC-CARD-03). Для
  дорослого дату й мову вимагає дія повної форми, а не база: швидка форма зрізу 1 (Q8) їх не має.
- Email: `clients_email_format` замінюємо правилом PM — рівно один «@», непорожня частина до нього, крапка в частині
  після «@», без пробілів (AC-HOLD-39); те саме правило й нормалізація (`lower(btrim())`) для `guardian_email`. Ім'я та
  ім'я опікуна — `= btrim(…)` і не порожні (AC-HOLD-41). Наявні 4 картки на проді цим правилам відповідають (перевірено
  читанням від імені scheduler1).
- Дата народження не пізніше за сьогодні (America/Los_Angeles) — тригер `before insert or update`
  `private.clients_birth_date_not_in_future()` (`security invoker`, `set search_path = ''`): check-обмеження з `now()`
  не переоцінюється, тож — тригер; помилка `23514`, як у check.

| Операція | `authenticated` (GRANT) | Політика | AC |
|---|---|---|---|
| select | `select` (було) | `clients_select` (було, оновлено в `20261023084029`): `is_staff()` або `is_client_of_current_therapist(id)` — свій клієнт: «Held» до прострочення або «Confirmed» на слоті терапевта | AC-CARD-04, 05, 08, 09, 10 |
| insert | `insert (name, email, client_type, date_of_birth, session_language, guardian_name, guardian_email)` — без `id`, `created_by`, `created_at` | `clients_insert_staff` (було): `with check (is_staff())` | AC-CARD-01, 02, 06 |
| update | немає GRANT | немає політики — редагування картки поза зрізом (після WS11) | AC-CARD-05, 07, 11 («картка не змінилася») |
| delete | немає GRANT | немає політики | AC-CARD-05, 07, 11 |

`anon` — `revoke all` (було): відвідувач без входу не читає й не пише (AC-CARD-07).

### Ролі (нова міграція `…_users_without_role.sql`, задача 2)

Порядок drop-first із заголовка `20261012000000_profiles_and_roles.sql`:

1. `alter table public.profiles drop constraint profiles_role_check`;
2. дані — без змін (наявні ролі лишаються);
3. `role` — `drop not null`, `drop default`: новий користувач Auth без ролі отримує `null`, а не `therapist`
   (AC-CARD-11; раніше `default 'therapist'` дав би йому розклад терапевта);
4. `add constraint profiles_role_check check (role is null or role in ('admin', 'scheduler', 'therapist'))`.

`private.current_therapist_id()` — `create or replace` з умовою `p.role = 'therapist'`: користувач без ролі, чий email
збігся б з email терапевта, нічого не бачить. `is_staff()` для `null` уже дає `false`. Роль змінює лише service_role
(колонковий GRANT `update (full_name)` не змінюємо — без самопідвищення).

### Демо-дані

`supabase/demo-users.json`: + `admin1` (сид PM), `newuser1` (`"role": null`), `pm-admin`, `pm-scheduler`,
`pm-therapist`; `scripts/create-demo-users.mjs` приймає `"role": null`. Для `pm-therapist` — рядок у `therapists` і слоти
окремою міграцією (`…_pm_therapist_seed.sql`, як сид зрізу 1).

### Функції бази

Нових привілейованих дій немає: картку створює `insert` під RLS і GRANT (одна операція, транзакція не потрібна).
Утримання — наявні `hold_slot` / `confirm_hold`; AC-HOLD-37 база вже дозволяє (прострочене не враховується), змінюється
лише список.

## Auth

- `src/proxy.ts` лише оновлює сесію й перенаправляє на `/login` (UX), не захищає (AC-CARD-07).
- Кожна сторінка й Server Action — `requireViewer()` з `src/lib/supabase/viewer.ts`: `getClaims()` (не `getSession()`),
  без claims — `/login`; роль — з `public.profiles` за `claims.sub`, ніколи з `user_metadata`. Нове: роль `null` →
  перенаправлення на `/`, де лише повідомлення AC-CARD-11 (головна викликає варіант без цього перенаправлення).
- `createClientCard(prevState, formData)` (`src/app/clients/actions.ts`): 1) `requireViewer()`; 2) не `scheduler` чи
  `admin` → помилка «Only schedulers and admins can create client cards.» без запису (AC-CARD-06); 3) чиста функція
  `validateClientCard` (`src/lib/clients/card.ts`) → помилки з текстами AC-CARD-03, AC-HOLD-11/39/41 і Q5 разом із
  введеними значеннями; 4) `insert` серверним клієнтом користувача (діють RLS і GRANT); `23505` — «A client with this
  email already exists.», `42501` — відмова ролі. Дії `addClient`, `holdSlot`, `confirmHold` — без змін.
- Admin-клієнт (`SUPABASE_SECRET_KEY`) не потрібен: запрошень і зміни ролей у зрізі немає, користувачі — сид через
  `npm run users:demo` локально. `check:boundary` (CI `architecture.yml`) не пускає admin-клієнт у сторінки й
  клієнтські компоненти.

## Кандидати в ADR

- **Доступ терапевта до карток — RLS із функцією «свій клієнт» у базі**, а не фільтр у Server Action чи окрема view
  (AC-CARD-04, 05, 08): `docs/decisions/0001-client-access-by-rls.md`, «Як перевіряємо» — тести PGlite з AC ID і
  `check:boundary` (admin-клієнт, що обійшов би RLS, не потрапляє в сторінки).
- Користувач без ролі — `profiles.role = null`, а не окрема роль чи відсутній профіль (AC-CARD-11).
