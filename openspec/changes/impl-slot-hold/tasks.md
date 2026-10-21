# Tasks

Вертикальні задачі: кожна — міграція/RLS + доменна функція + server action/сторінка + тест. Одна задача — одна
гілка `task/<коротко>` і один PR «Реалізація». Перевірка кожної — `npm run lint`, `npm run typecheck`, `npm test`,
`npm run build`, `npm run ac:coverage`, `npm run spec:check`; рядки AC задачі в `docs/conformance.md` — «реалізовано».

## 1. Дані, слоти дня й картка клієнта (`task/day-slots`)

- [x] 1.1 Міграція ролей `admin` / `scheduler` / `therapist` (дані → default → constraint); `supabase/demo-users.json`
  з п'ятьма синтетичними користувачами.
  Done when: `db-check` зелений; після merge `db-deploy` зелений і `npm run users:demo` ставить п'ять ролей.
- [x] 1.2 Міграція `therapists`, `slots`, `clients`, `holds` з RLS, `revoke all` + GRANT, політиками й демо-даними;
  `database.types.ts` за новою схемою.
  Done when: `db-check` зелений; `npm run typecheck` зелений з новими типами.
- [x] 1.3 `time.ts`, `status.ts`, `day-view.ts`; сторінка `/slots` (терапевт, дата, слоти дня зі статусами Free / Held /
  Confirmed / Past); перенаправлення з `/` за роллю; тести.
  Done when: AC-HOLD-01, AC-HOLD-18, AC-HOLD-24, AC-HOLD-32, AC-HOLD-33.
- [x] 1.4 `clients.ts` (`validateClient`, `normalizeEmail`), server action `createClient`, форма нового клієнта на
  `/slots`; тести.
  Done when: AC-HOLD-10, AC-HOLD-11, AC-HOLD-15, AC-HOLD-16, AC-HOLD-34, AC-HOLD-35.

## 2. Утримання й підтвердження (`task/hold-confirm`)

- [ ] 2.1 Міграція `public.hold_slot` / `private.hold_slot_at` і `public.confirm_hold` / `private.confirm_hold_at`;
  `rules.ts`, `messages.ts`; server actions `holdSlot`, `confirmHold`, кнопки «Hold» і «Confirm» на `/slots`; тести.
  Done when: AC-HOLD-02, AC-HOLD-03, AC-HOLD-04, AC-HOLD-05, AC-HOLD-06, AC-HOLD-07, AC-HOLD-08, AC-HOLD-12,
  AC-HOLD-13, AC-HOLD-14, AC-HOLD-17, AC-HOLD-19, AC-HOLD-22, AC-HOLD-23, AC-HOLD-25, AC-HOLD-26, AC-HOLD-27,
  AC-HOLD-36.

## 3. Розклад терапевта й список утримань (`task/schedule`)

- [ ] 3.1 `schedule.ts`; сторінка `/schedule` (тиждень пн–нд, перемикання тижнів, без прострочених утримань) для
  терапевта; сторінка `/holds` (утримання зі статусами, прострочені — до початку слоту) для планувальника й
  адміністратора; тести.
  Done when: AC-HOLD-09, AC-HOLD-20, AC-HOLD-21, AC-HOLD-28, AC-HOLD-29, AC-HOLD-30, AC-HOLD-31.
- [ ] 3.2 Запис екрана 1–2 хв на прод-URL (вхід scheduler1 → утримання → підтвердження → розклад therapist1).
  Done when: запис — коментарем в останньому PR задачі; головний сценарій AC-HOLD-02 → AC-HOLD-12 → AC-HOLD-09
  працює на проді.

## Workflow follow-up

- `npx openspec archive impl-slot-hold -y` в останньому PR задачі зрізу, до merge; потім `git add openspec/changes`.
