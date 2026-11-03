# QA proof pack: Планувальник заповнює картку клієнта з анкети, а терапевт бачить картки лише своїх клієнтів

<!--
Шаблон з koldovsky/2026-quitcode-08-quality-hw/materials/templates/proof-pack.template.md.
Покладіть у docs/qa/proof-pack.md вашого репо й заповнюйте по кроках WS8 (A → B → C → D).
Посилання — на файли на коміті (…/blob/<sha>/…#L<N>), на PR (…/pull/N) і на прогони (…/actions/runs/N).
Жодних паролів і пароля від accounts.zip. Акаунти — лише адреси *@example.test.
Цей файл — вхід для конвеєра WS9: на кожен AC видно, чим він доведений.
-->

- Прод-URL: https://therapy-scheduling-sigma.vercel.app
- Вимоги: https://github.com/Sofiia-pm/therapy-scheduling-spec · джерело: issues · знімок 2026-10-27
- `/api/health` на момент UAT: <!-- sha і db, напр. «sha 1a2b3c4, db ok, 01.11.2026» -->

## 3 AC

Вимога PM: https://github.com/Sofiia-pm/therapy-scheduling-spec/issues/19 (знімок — `requirements/19-planuvalnyk-zapovniuie-kartku-klienta.md`).

| AC | Вид | «Тоді» (дослівно з вимоги PM) |
|---|---|---|
| AC-CARD-05 | відмова в браузері: чужі дані за прямим посиланням (картка клієнта іншого терапевта) | therapist1 бачить повідомлення «You don't have access to this client.», жодних даних client9 не показано, і картка client9 не змінилася. |
| AC-CARD-12 | стан інтерфейсу: помилки форми нової картки з дослівним текстом | картку не створено, scheduler1 одразу бачить три повідомлення біля відповідних полів — «Enter the client's name.», «Enter a date of birth that is not in the future.» і «Select a session language.», а всі введені дані лишаються у формі. |
| AC-CARD-11 | відмова в браузері: користувач без ролі | він бачить лише повідомлення «Your account has no access yet. Contact an administrator.» і дію «Sign out», жодних даних клієнтів не показано, і жодна картка не змінилася. |

Усі три — лише читання на проді: AC-CARD-12 картки не створює, тож прибирати після UAT нічого.

## A. Ворота

- PR воріт: https://github.com/maryan-qc/therapy-scheduling/pull/33
- Зелений `quality` на `main` (07b01cf): https://github.com/maryan-qc/therapy-scheduling/actions/runs/41624326257
- Обов'язкові перевірки в `solo-main` з 03.11.2026: «Ворота: fallow audit», «Покриття: доменна підлога» (поруч зі `spec`, `app`, `conformance`, `db-check`); «Порада: вразливі залежності» — дорадча, не обов'язкова

Розбір першого повного прогону `fallow` 3.35.0 (`npx fallow --no-cache` на `main` e6f5641 з конфігом із materials, без
файлу покриття — як у CI; той самий — в описі PR воріт). До розбору: 4 невикористані файли, 1 невикористаний експорт,
5 груп дублів, 15 складних і 5 великих функцій. Після: мертвого коду 0, `fallow audit` на PR — «No issues».

| # | Група знахідок | Скільки | Справжня / навмисна / хибна | Дія і причина |
|---|---|---|---|---|
| 1 | невикористані файли `src/components/ui/dialog.tsx`, `src/components/ui/select.tsx` | 2 | справжня | **видалено**: додано з дизайн-системою (#10), але жодна сторінка їх не імпортує. Випадні списки — `NativeSelect` (рідний `<select>`), діалогів у зрізах 1–2 немає. `DESIGN.md` оновлено, повернути — `npx shadcn@4.22.1 add dialog` |
| 2 | невикористаний файл `src/lib/supabase/client.ts` | 1 | навмисна | `ignoreFindings` з причиною: браузерний клієнт шаблону курсу (лише публічний ключ) — готова точка для майбутніх Client Components; сьогодні всі запити серверні |
| 3 | невикористаний файл `src/lib/utils.ts` | 1 | навмисна | `ignoreFindings` з причиною: на нього вказує `aliases.utils` у `components.json`, і `npx shadcn add` вписує в нові компоненти імпорт `@/lib/utils`; наявні компоненти імпортують `cn` напряму |
| 4 | невикористаний експорт `AC_ID_GLOBAL` (`scripts/lib/spec-lib.mjs:10`) | 1 | навмисна | `ignoreExports` лише на це ім'я: спільна бібліотека скриптів шаблону, тримаємо її як у шаблоні — WS8 оновлює сусідні `test-titles.mjs` і `check-ac-coverage.mjs` з `materials/` |
| 5 | дублі `scripts/check-design-tokens.mjs` ↔ `scripts/check-server-boundary.mjs` | 3 групи, 42 рядки | навмисна | лишено: два скрипти WS7 без залежностей, кожен — окремий job `architecture.yml`; спільний модуль зв'язав би два незалежні правила |
| 6 | дубль `src/app/clients/page.tsx:46-60` ↔ `src/app/holds/page.tsx:92-106` | 15 рядків | хибна | лишено: спільна лише структура розмітки shadcn (`Card` → `Table` → `TableHeader`), колонки й тексти різні — fallow порівнює послідовність токенів, а не зміст |
| 7 | дубль `src/app/schedule/page.tsx:110-121` ↔ `src/app/slots/page.tsx:186-199` | 14 рядків | справжня, дрібна | лишено: однакові дві клітинки рядка слота (час і статус), а третя різна — терапевт бачить ім'я клієнта, планувальник — ім'я й контакт. Спільний рядок — у рефакторі сторінок (рядок 9) |
| 8 | складність скриптів шаблону й WS7: `check-spec` (3), `check-design-tokens` (3), `check-server-boundary` (2), `create-demo-users` (1) | 9 функцій | навмисна | `health.ignore` з причиною: розбір markdown і обхід файлів; поведінку тримають `tests/scripts/` і jobs `architecture.yml`. Мертвий код у цих файлах fallow перевіряє й далі |
| 9 | `SlotsPage` (`src/app/slots/page.tsx:46`): цикломатична 21, когнітивна 18, 204 рядки | 1 | справжня | лишено: сторінка з трьома станами й формою утримання. Дробити — окремим рефакторинг-PR під e2e, щоб не змінити тексти «Тоді» зрізу 1 |
| 10 | `validateClientCard` (`src/lib/clients/card.ts:125`): цикломатична 21, когнітивна 23 | 1 | справжня, виправдана | лишено: AC-CARD-12 вимагає всі помилки одразу, тож кожне поле перевіряється окремою незалежною гілкою. Силу тестів доводить Stryker у треку B |
| 11 | лише CRAP (оцінка): `SchedulePage`, `schedule/page.tsx:110`, `holds/schedule.ts:73`, `GET /api/health` | 4 | хибна (оцінка) | лишено: без файлу покриття fallow оцінює CRAP з графа експортів. З `coverage-final.json` `holds/schedule.ts` має 100 % рядків і нижче порогу. Сторінки й Route Handler Vitest не рендерить — їх доводять e2e і `smoke`. `complexity-crap` — `warn`, як у materials |
| 12 | великі функції (> 60 рядків): `SlotsPage` 204, `HoldsPage` 122, `SchedulePage` 112, `ClientCardForm` 109, `ClientsPage` 75 | 5 | справжня (розмір), прийнятна | лишено: це JSX серверних сторінок і форми — таблиця чи форма з дослівними текстами AC. `SlotsPage` — у тому самому рефакторі, що й рядок 9 |

Тестові правила лінтера (`@vitest/eslint-plugin` 1.6.27, усі `error`): одна знахідка —
`tests/clients/pages.test.tsx:33`, `no-restricted-syntax` (`vi.mock` власного модуля `@/app/_components/nav`).
**Виправлено**: мок прибрано, тест рендерить справжню навігацію, тверджень не поменшало (5 з 5 зелені).

Покриття (`vitest.coverage.config.mts`): підлога 90/85/90/90 на файл — для 7 доменних модулів, що вже її тримають:
`health`, `clients/search`, `holds/clients`, `holds/messages`, `holds/schedule`, `holds/status`, `holds/types`. Нижче
підлоги й поза списком: `clients/card` (функції 85,7 %), `holds/day-view` (гілки 83 %), `holds/time`, `holds/rules`
(правило утримання живе в SQL — його доводять тести бази).

Ще в цьому PR (відгук викладача до WS7, п. 4): крок «ADR 0001: admin-клієнта немає» в `architecture.yml` (job «Секретний
ключ лише на сервері»). `check:boundary` дозволяє `src/lib/supabase/admin.ts` за правилами шаблону, а ADR 0001
admin-клієнт відкинув — тепер його поява червонить прогін (доказ — червоний прогін з тимчасовим `admin.ts`:
https://github.com/maryan-qc/therapy-scheduling/actions/runs/41618304612/job/125857212718).

## B. Якість тестів

- PR якості тестів: https://github.com/maryan-qc/therapy-scheduling/pull/34 (вивід Stryker і `mutation:sql` «до / після» — в описі)
- Взято з `koldovsky/2026-quitcode-08-quality-hw/materials/testing`: `stryker.config.json`, `vitest.stryker.config.mts`,
  `scripts/mutation-check.mjs`, формат `scripts/mutants.mjs`. Гарнес `tests/db/supabase-pglite.ts` — наш з WS6.

### Рівень для кожного AC

| AC | Де живе правило | Рівень | Чому | Тест |
|---|---|---|---|---|
| AC-CARD-05 | **SQL:** RLS `clients_select` + `private.is_client_of_current_therapist` (міграції `20261021150100`, `20261027073004`); немає GRANT `update`/`delete` на `clients` (`20261023104436`); email профілю змінити не можна — колонковий grant лише `full_name` (`20261012000000`). **Сторінка** `/clients/[id]`: порожня відповідь бази → «You don't have access to this client.» | база (PGlite) + e2e | «не бачить і не змінює» тримає SQL: це доводить лише справжній Postgres з усіма міграціями й RLS, TS-копії правила немає. Дослівний текст і «даних не показано» — сторінка, асинхронний серверний компонент, тож e2e | [client-access.test.ts#L122](https://github.com/maryan-qc/therapy-scheduling/blob/061c836607b73ad77fd14e8ee112068ff2901e4b/tests/db/client-access.test.ts#L122), [#L255](https://github.com/maryan-qc/therapy-scheduling/blob/061c836607b73ad77fd14e8ee112068ff2901e4b/tests/db/client-access.test.ts#L255) (email терапевта), e2e — розділ C |
| AC-CARD-11 | **SQL:** `private.current_therapist_id()` — лише для `role = 'therapist'` (`20261023105250`), `is_staff()` для `null` → `false`, `clients_insert_staff`, колонковий grant `profiles` (роль і email собі не змінити). **Сторінки:** `requireViewer` без ролі перенаправляє на «/», «/» показує лише повідомлення й «Sign out» | база (PGlite) + e2e | «без ролі — жодних даних і змін» тримає SQL. Що людина бачить лише повідомлення й «Sign out» (зокрема за посиланням на картку — редірект) — сторінка: Vitest серверних сторінок з `redirect` не рендерить, тож e2e | [client-access.test.ts#L207](https://github.com/maryan-qc/therapy-scheduling/blob/061c836607b73ad77fd14e8ee112068ff2901e4b/tests/db/client-access.test.ts#L207), [#L236](https://github.com/maryan-qc/therapy-scheduling/blob/061c836607b73ad77fd14e8ee112068ff2901e4b/tests/db/client-access.test.ts#L236) (роль і email собі не видати), [#L266](https://github.com/maryan-qc/therapy-scheduling/blob/061c836607b73ad77fd14e8ee112068ff2901e4b/tests/db/client-access.test.ts#L266), e2e — розділ C |
| AC-CARD-12 | **TS:** `validateClientCard` + `isBirthDate` (`src/lib/clients/card.ts`) — три помилки одразу, межа дати «сьогодні — коректно»; дія `createClientCard` повертає помилки й рівно введені значення. **SQL — та сама межа:** `clients_name_not_blank`, тригер дати народження, `clients_contact_by_type` (мова дитини). **Сторінка:** `card-form.tsx` — повідомлення біля полів | unit + дія + база + e2e | правило двічі: TS дає повідомлення PM, SQL — остання лінія для запиту в обхід форми, і кожен шар може втратити правило окремо. Межі — unit і база. «Біля відповідних полів» і «дані лишаються у формі» видно лише на сторінці (Client Component) — e2e | [card.test.ts#L117](https://github.com/maryan-qc/therapy-scheduling/blob/061c836607b73ad77fd14e8ee112068ff2901e4b/tests/clients/card.test.ts#L117), [#L129](https://github.com/maryan-qc/therapy-scheduling/blob/061c836607b73ad77fd14e8ee112068ff2901e4b/tests/clients/card.test.ts#L129), [actions.test.ts#L88](https://github.com/maryan-qc/therapy-scheduling/blob/061c836607b73ad77fd14e8ee112068ff2901e4b/tests/clients/actions.test.ts#L88), [client-cards.test.ts#L223](https://github.com/maryan-qc/therapy-scheduling/blob/061c836607b73ad77fd14e8ee112068ff2901e4b/tests/db/client-cards.test.ts#L223), [#L228](https://github.com/maryan-qc/therapy-scheduling/blob/061c836607b73ad77fd14e8ee112068ff2901e4b/tests/db/client-cards.test.ts#L228), [#L237](https://github.com/maryan-qc/therapy-scheduling/blob/061c836607b73ad77fd14e8ee112068ff2901e4b/tests/db/client-cards.test.ts#L237), e2e — розділ C |

### Покриття

`npm run test:coverage` (v8): разом рядки 57,64 % (230 з 399) — і до, і після нових тестів: тести, що вбили мутантів,
не додали жодного виконаного рядка. Цифри — з `coverage/coverage-summary.json`.

| Файл за AC | Рядки | Гілки | Чим доведено, якщо 0 % |
|---|---|---|---|
| `src/lib/clients/card.ts` (AC-CARD-12) | 92,5 % | 91,07 % | — (функції 85,71 %: не покрито `clientTypeLabel` — тип у картці, AC-CARD-01/02, поза 3 AC) |
| `src/app/clients/actions.ts` (AC-CARD-12) | 100 % | 90 % | — |
| `src/lib/holds/types.ts` (`isStaff`, текст без ролі — AC-CARD-11) | 100 % | 87,5 % | — |
| `src/app/clients/[id]/page.tsx` (AC-CARD-05) | 88,88 % | 43,75 % | гілки сторінки — `tests/clients/pages.test.tsx` (AC-CARD-16); відмова терапевта на справжній базі — e2e AC-CARD-05 |
| `src/app/clients/new/card-form.tsx` (AC-CARD-12) | 0 % | 0 % | Client Component: e2e AC-CARD-12 (повідомлення біля полів, дані у формі) |
| `src/app/clients/new/page.tsx` (AC-CARD-12) | 0 % | 0 % | e2e AC-CARD-12 |
| `src/app/page.tsx` (AC-CARD-11) | 0 % | 0 % | e2e AC-CARD-11 (лише повідомлення й «Sign out») |
| `src/lib/supabase/viewer.ts` (AC-CARD-11) | 0 % | 0 % | адаптер Supabase (`getClaims`, роль з `profiles`): редірект без ролі — e2e AC-CARD-11; правило ролі — тести бази (`current_therapist_id`, `is_staff`) |
| SQL: RLS, GRANT, тригер, check (AC-CARD-05, 11, 12) | — | — | JS-покриття SQL не бачить: SQL-мутації C1–C9 нижче |

### Доказ мутацією

Вижилі мутанти на рядках 3 AC → тест, посилений з тексту AC → повторний прогін:

| Мутант (файл:рядок, що змінено) | AC під загрозою | До | Тест, посилений з тексту AC | Після |
|---|---|---|---|---|
| C5 · `supabase/migrations/20261012000000_profiles_and_roles.sql:45` `grant update (full_name)` → `grant update (full_name, role, email)` | AC-CARD-11 (і AC-CARD-05) | вижив | [client-access.test.ts#L236](https://github.com/maryan-qc/therapy-scheduling/blob/061c836607b73ad77fd14e8ee112068ff2901e4b/tests/db/client-access.test.ts#L236): newuser1 не видає собі роль і email терапевта, профіль без змін, даних клієнтів немає; [#L255](https://github.com/maryan-qc/therapy-scheduling/blob/061c836607b73ad77fd14e8ee112068ff2901e4b/tests/db/client-access.test.ts#L255): therapist1 не бере собі email therapist2 | убитий |
| C7 · `20261023104436_client_cards.sql:62` тригер дати `>` → `>=` | AC-CARD-12 (межа: «дата, що дорівнює сьогоднішній, коректна») | вижив | [client-cards.test.ts#L228](https://github.com/maryan-qc/therapy-scheduling/blob/061c836607b73ad77fd14e8ee112068ff2901e4b/tests/db/client-cards.test.ts#L228): завтра — 23514, сьогодні — картку створено | убитий |
| C8 · `20261023104436_client_cards.sql:43` `clients_contact_by_type` без `session_language is not null` | AC-CARD-12 («Select a session language.») | вижив | [client-cards.test.ts#L237](https://github.com/maryan-qc/therapy-scheduling/blob/061c836607b73ad77fd14e8ee112068ff2901e4b/tests/db/client-cards.test.ts#L237): дитина без мови — 23514, карток не додалося | убитий |
| C9 · `20261021150100_slot_holds.sql:47` `clients_name_not_blank` → `check (true)` | AC-CARD-12 («Enter the client's name.») | вижив | [client-cards.test.ts#L223](https://github.com/maryan-qc/therapy-scheduling/blob/061c836607b73ad77fd14e8ee112068ff2901e4b/tests/db/client-cards.test.ts#L223): порожнє ім'я дитини — 23514, карток не додалося | убитий |
| Stryker · `src/app/clients/actions.ts:22` `field("guardian_name")` → `field("")` | AC-CARD-12 (рівно три повідомлення; «всі введені дані лишаються у формі») | вижив | [actions.test.ts#L88](https://github.com/maryan-qc/therapy-scheduling/blob/061c836607b73ad77fd14e8ee112068ff2901e4b/tests/clients/actions.test.ts#L88): рівно три тексти з «Тоді» і рівно введені значення | убитий |
| Stryker · `src/app/clients/actions.ts:15` `?? ""` → `?? "Stryker was here!"` | AC-CARD-12 (у форму не повертається email, якого не вводили) | вижив | той самий [actions.test.ts#L88](https://github.com/maryan-qc/therapy-scheduling/blob/061c836607b73ad77fd14e8ee112068ff2901e4b/tests/clients/actions.test.ts#L88) | убитий |

- **Stryker** (`npm run mutation:ts -- --mutate <файл>`, 10.1.1):
  - `src/app/clients/actions.ts`: 67,65 % → **73,53 %** (вижило 7 → 5). Лишились поза 3 AC: шлях помилки бази після
    успішної форми (`:39`, два мутанти — це AC-CARD-06/13, їх доводять тести бази через той самий шлях),
    `revalidatePath` (`:41`, `:42` — кеш сторінок, AC-CARD-01) і `select("id")` (`:38` — мок не перевіряє колонок; потрібен
    для переходу на нову картку, AC-CARD-01).
  - `src/lib/clients/card.ts`: 85,56 % (154 убито, 15 вижило, 11 без покриття) і до, і після. На рядках AC-CARD-12
    (`validateClientCard`, `isBirthDate`, 114–160) вижили лише 3 еквівалентні (нижче). Решта 12 поза 3 AC: підписи типу
    `CLIENT_TYPE_LABEL` (AC-CARD-01/02/10), `NOT_PROVIDED` (картки зрізу 1), власні тексти `CARD_DATA_INVALID` і
    `SAVE_FAILED` (PM текстів не дала), початкові значення `EMPTY_CARD_FORM` (чотири — порожня форма до введення),
    типовий `message` і `42501` у `cardErrorCode` (мапа кодів бази AC-CARD-06/13).
  - Ручні TS-мутанти на межах AC-CARD-12 (`node scripts/mutation-check.mjs --kind ts`): T1 `value <= today` → `<` —
    KILLED тестом [card.test.ts#L129](https://github.com/maryan-qc/therapy-scheduling/blob/061c836607b73ad77fd14e8ee112068ff2901e4b/tests/clients/card.test.ts#L129); T2 «зупинитись після першої помилки» — KILLED тестом
    [card.test.ts#L117](https://github.com/maryan-qc/therapy-scheduling/blob/061c836607b73ad77fd14e8ee112068ff2901e4b/tests/clients/card.test.ts#L117).
- **SQL-мутації** (`npm run mutation:sql`, `scripts/mutants.mjs`): до — **7 з 11 вбито (64 %)**, вижили C5, C7, C8, C9;
  після — **11 з 11 (100 %)**, ≈11 с. Таблиця `--markdown` — в описі PR.

  | Мутант | AC | Що зламано | До | Після |
  |---|---|---|---|---|
  | C1 | AC-CARD-05 | `clients_select` → `using (true)` | KILLED | KILLED |
  | C2 | AC-CARD-05 | «свій клієнт» без умови терапевта | KILLED | KILLED |
  | C3 | AC-CARD-05 | `grant update` + політика `using (true)` на `clients` | KILLED | KILLED |
  | C4 | AC-CARD-11 | `current_therapist_id()` без `role = 'therapist'` | KILLED | KILLED |
  | C5 | AC-CARD-11 | колонковий grant `profiles` + `role`, `email` | SURVIVED | KILLED |
  | C6 | AC-CARD-11 | `clients_insert_staff` → `with check (true)` | KILLED | KILLED |
  | C7 | AC-CARD-12 | тригер дати `>` → `>=` | SURVIVED | KILLED |
  | C8 | AC-CARD-12 | дитина без мови сеансів | SURVIVED | KILLED |
  | C9 | AC-CARD-12 | `clients_name_not_blank` → `true` | SURVIVED | KILLED |
  | T1 | AC-CARD-12 | `isBirthDate`: `<=` → `<` | KILLED | KILLED |
  | T2 | AC-CARD-12 | не всі помилки одразу | KILLED | KILLED |

- **Еквівалентні мутанти:** Stryker на `src/lib/clients/card.ts` — `:115` `if (!ISO_DATE.test(value))` → `if (false)` і два
  мутанти якорів регексу `ISO_DATE` (`:111`). Еквівалентні через рядок 117: `parsed.toISOString().slice(0, 10) === value`
  приймає лише рядок рівно у вигляді РРРР-ММ-ДД, тож без регексу результат той самий. `Stryker disable` не ставили — пояснення тут.
- Ще з відгуку викладача до WS7: з тестів бази прибрано перевірки, що порівнювали TS-константу з її ж текстом
  (`client-access.test.ts`: AC-CARD-05, 09, 11, 16, AC-HOLD-44; `client-cards.test.ts`: AC-CARD-15). Вони нічого не
  доводили про базу, а текст на сторінці доводять `tests/clients/pages.test.tsx` і UAT.

## C. UAT на проді

| AC | Специфікація | Тест (твердження) | Агент | Вердикт | Кадр |
|---|---|---|---|---|---|
| AC-CARD-05 | <!-- …/blob/<sha>/tests/e2e/….spec.ts --> | <!-- passed / failed --> | <!-- Haiku: PASS / FAIL / NEEDS-HUMAN (+ Sonnet, якщо була суперечка) --> | <!-- PASS / FAIL / NEEDS-HUMAN і правило (R1–R6) --> | <!-- …/blob/<sha>/docs/qa/uat/<дата>/frames/AC-…-then-1.png --> |
| AC-CARD-12 | | | | | |
| AC-CARD-11 | | | | | |

- Звіт: <!-- …/blob/<sha>/docs/qa/uat/<YYYY-MM-DD>/report.md -->
- Відео: <!-- вкладення в описі PR …/pull/N -->
- Рецензент: <!-- моделі зі звіту (claude-haiku-5-5; суперечки — claude-sonnet-5-5) і вартість прогону -->
- Негативний контроль: <!-- NC-… (npm run uat:nc): що навмисно хибне, вердикт (FAIL / NEEDS-HUMAN), …/pull/N -->
- Дані: лише читання

### Приймання PM

| AC | Рішення PM | Посилання |
|---|---|---|
| AC-CARD-05 | <!-- ✅ / ❌ / NEEDS-HUMAN → … --> | <!-- коментар-підпис або issue «Відхилення від вимог» --> |
| AC-CARD-12 | | |
| AC-CARD-11 | | |

## D. Eval рецензента

- PR з вадами (не злитий): <!-- …/pull/N -->
- Ключ і таблиця: <!-- …/pull/N#issuecomment-M -->

| # | Вада (ключ) | CodeRabbit | `/code-review high` |
|---|---|---|---|
| 1 | <!-- категорія і файл:рядок --> | <!-- знайшов / пропустив + цитата --> | <!-- знайшов / пропустив + цитата --> |
| 2 | … | … | … |
| 3 | … | … | … |
| П | приманка: <!-- що --> | <!-- хибна тривога? цитата --> | <!-- хибна тривога? цитата --> |

- Інші знахідки: <!-- слушна / шум, по рядку на кожну -->
- Правило, що закриває пропуск: <!-- рядок в AGENTS.md чи path instruction, …/commit/<sha> -->
- Повторний прогін: <!-- хто, результат, цитата, …/pull/N#issuecomment-M -->
