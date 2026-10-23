# Tasks

Вертикальні задачі: міграція/RLS + доменна функція + server action/сторінка + тести. Одна задача — одна гілка
`task/<коротко>` і один PR «Реалізація» з `@coderabbitai review` і зеленим CI. Перевірка кожної — `npm run lint`,
`npm run typecheck`, `npm test`, `npm run build`, `npm run ac:coverage`, `npm run spec:check`, `npm run check:design`,
`npm run check:boundary`; рядки AC задачі в `docs/conformance.md` — «реалізовано».

Мутаційний коміт у CI живе лише в гілці PR: тест падає в job `app` (PGlite), міграцію застосовує лише `db-check` на
одноразовій базі. `db-deploy` працює тільки з `main` після squash-merge, коли мутацію вже відкочено (`git revert`), тож
послаблена політика до робочої бази не потрапляє. Застосованих міграцій мутація не торкається.

## 1. Картка клієнта з анкети (`task/client-cards`)

- [x] 1.1 Міграція `…_client_cards.sql`: колонки картки, `clients_contact_by_type`, правило email PM (і для опікуна),
  ім'я без пробілів по краях, тригер дати народження, колонковий `grant insert`; `database.types.ts`.
  Done when: `db-check` зелений; після merge — зелений `db-deploy`.
- [x] 1.2 `src/lib/clients/card.ts` (`validateClientCard`, повідомлення), дія `createClientCard`, сторінки `/clients`
  («Clients» для планувальника й адміністратора, «My clients» з порожнім станом для терапевта), `/clients/new`,
  `/clients/[id]` (з відмовою для чужого й неіснуючого клієнта); вибір клієнта на `/slots` з email опікуна; пункт у
  навігації.
  Done when: AC-CARD-01, AC-CARD-02, AC-CARD-10, AC-HOLD-39, AC-HOLD-41.
- [x] 1.3 Тести відмов: AC-CARD-03 (чиста функція + check бази для дитини без опікуна), AC-CARD-06 (перевірка ролі в
  дії + RLS `insert` від therapist1: відмова й кількість карток та сама), AC-HOLD-39, AC-HOLD-41 (функція + check бази).
  Done when: AC-CARD-03, AC-CARD-06.
- [ ] 1.4 Мутаційна перевірка: локально — кожен відмовний AC задачі (таблиця в описі PR); у CI — червоний прогін для
  AC-CARD-06 (`clients_insert_staff` тимчасово `with check (true)` у новій міграції), потім revert.
  Done when: AC-CARD-01, AC-CARD-02, AC-CARD-03, AC-CARD-06, AC-CARD-10, AC-HOLD-39, AC-HOLD-41 — «реалізовано», червоний
  прогін AC-CARD-06 — в описі PR.

## 2. Доступ терапевта до своїх клієнтів і користувач без ролі (`task/client-access`)

- [ ] 2.1 Міграція `…_users_without_role.sql` (drop-first: constraint → дані → default → constraint; `role` може бути
  `null`; `current_therapist_id()` лише для ролі `therapist`); `…_pm_therapist_seed.sql`; `demo-users.json` (admin1,
  newuser1 без ролі, pm-admin, pm-scheduler, pm-therapist) і `create-demo-users.mjs` з `"role": null`.
  Done when: `db-check` і `db-deploy` зелені; `npm run users:demo` створює акаунти.
- [ ] 2.2 `requireViewer` без ролі → `/` лише з повідомленням AC-CARD-11; тести бази для списку й картки терапевта
  (свої клієнти, порожній стан).
  Done when: AC-CARD-04, AC-CARD-09, AC-CARD-11.
- [ ] 2.3 Тести відмов (PGlite, `asUser` / `asAnon`, дані не змінились — `asService`): AC-CARD-05 (чужий клієнт: 0
  рядків, `update` — permission denied), AC-CARD-07 (`anon`: permission denied на `select` і `insert`), AC-CARD-08
  (прострочене утримання — клієнт зникає), AC-CARD-11 (без ролі: 0 рядків, `insert` відхилено, терапевтом не стає).
  Done when: AC-CARD-05, AC-CARD-07, AC-CARD-08, AC-CARD-11.
- [ ] 2.4 Мутаційна перевірка: локально — кожен відмовний AC; у CI — червоний прогін для AC-CARD-11 (без умови ролі в
  `current_therapist_id()` у новій міграції), потім revert.
  Done when: AC-CARD-04, AC-CARD-05, AC-CARD-07, AC-CARD-08, AC-CARD-09, AC-CARD-11 — «реалізовано», червоний прогін
  AC-CARD-11 — в описі PR.

## 3. Список утримань і розклад за уточненнями PM (`task/holds-list`)

- [x] 3.1 `buildHoldsList`: без «Confirmed», без утримань, слот яких уже почався, без простроченого утримання клієнта,
  за яким знову утримали той самий слот; тест бази повторного утримання того самого клієнта; дані тесту AC-HOLD-01 —
  «зараз» 2026-11-02 09:00.
  Done when: AC-HOLD-37, AC-HOLD-38, AC-HOLD-42.
- [x] 3.2 Розклад терапевта: тест, що в утриманні є ім'я, але немає email.
  Done when: AC-HOLD-40.

## 4. Завершення зрізу (в останньому PR задачі)

- [ ] 4.1 ADR `docs/decisions/0001-client-access-by-rls.md` з розділом «Як перевіряємо»; доказ `check:boundary` —
  червоний прогін job «Секретний ключ лише на сервері» з навмисним порушенням, потім revert.
- [ ] 4.2 Знімки за ролями `docs/img/ws7-role-<роль>-<сторінка>.png` (головна сторінка зрізу й одна відмова на роль);
  рядки `docs/conformance.md` для всіх AC зрізу; archive `impl-client-cards`.
  Done when: AC-CARD-01…AC-CARD-11, AC-HOLD-37…AC-HOLD-42 — «реалізовано» в `docs/conformance.md` (`npm run ac:coverage`
  — 53 AC без «відкладено» без причини).
