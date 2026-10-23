# Матриця відповідності (AC → код → тест → статус)

<!--
Ваша матриця: один рядок на кожен AC з openspec/specs/** — вашої специфікації, у яку ви перекладаєте вимоги PM
(їхній знімок у requirements/ приносить команда агента /requirements-sync).
Рядок «Вимоги» під цим коментарем заповнює лише /requirements-sync: адреса репо вимог PM, звідки взято вимоги (issues
або файли docs/), і дата знімка, через « · ». Руками його не змінюйте: з нього /requirements-sync знає, звідки брати
вимоги наступного разу, а скіли spec-clarify, spec-review і /conformance — куди ставити питання й яку версію вимог ви
реалізуєте. Рядків таблиці /requirements-sync не додає.
Рядки змінюєте ви:
  PR «Специфікація» — після archive зміни: рядок кожного нового AC зі статусом «відкладено (чекає реалізації)»; рядки AC,
                      прибраних зі специфікації (REMOVED), — видалити;
  PR «Реалізація»   — рядок AC задачі в тому самому PR, що й код і тест.
Перебудувати автоматично: /conformance (Claude Code, Cursor).
Перевірка в CI: npm run ac:coverage — падає, якщо
  NO-ROW     AC є в специфікації, а рядка немає (типово — PR «Специфікація» без нових рядків або рядок видалено);
  MISSING    статус «реалізовано», а непропущеного тесту, назва якого починається з цього AC ID, у файлах
             *.test.ts / *.test.tsx немає (*.spec.ts і допоміжні файли Vitest не запускає — вони не рахуються);
  ORPHAN     тест посилається на AC, якого немає в специфікації (AC прибрано або вимогу PM ще не перекладено);
  BAD-STATUS статус не «реалізовано» і не «відкладено (причина)»;
  WRONG-REF  шляху `src/…`/`tests/…`/`supabase/…` з колонок «Код»/«Тест» немає або тест із цим AC в іншому файлі;
і попереджає, не падаючи: AC з вимог PM (requirements/), якого ще немає в openspec/specs/, — «вимогу PM ще не перекладено
в специфікацію».

Приклад рядків (усередині коментаря — скрипт їх не читає):
| AC-LEAVE-02 | заявка на дві посади дає два записи main і additional | `src/app/requests/actions.ts` (createRequest) | `tests/requests.test.ts` | реалізовано |
| AC-LEAVE-04 | заблоковані дні не рахуються | — | — | відкладено (чекаю відповідь PM на Q2, <pm>/<team-slug>-spec#5) |
| AC-LEAVE-07 | менеджер бачить лише свій відділ | — | — | відкладено (рішення PM: поза зрізом 1, <pm>/<team-slug>-spec#8) |
| AC-LEAVE-10 | діапазон лише із заблокованих днів | — | — | відкладено (чекає реалізації) |
-->

Вимоги: https://github.com/Sofiia-pm/therapy-scheduling-spec · джерело: issues · знімок 2026-10-21

| AC | Що перевіряє | Код | Тест | Статус |
|---|---|---|---|---|
| AC-HOLD-01 | слоти дня зі статусами вільний / «Held» / «Confirmed»; утримати можна лише вільний | `src/lib/holds/day-view.ts`, `src/lib/holds/status.ts`, `src/app/slots/page.tsx` | `tests/holds/day-view.test.ts` | реалізовано |
| AC-HOLD-02 | утримання вільного слоту: «Held», клієнт, «Held until» +24 години | `supabase/migrations/20261021160000_hold_and_confirm.sql`, `src/lib/holds/rules.ts`, `src/app/slots/actions.ts` | `tests/db/hold-confirm.test.ts` | реалізовано |
| AC-HOLD-03 | утриманий слот не утримують за іншим клієнтом | `supabase/migrations/20261021160000_hold_and_confirm.sql`, `src/lib/holds/rules.ts`, `src/app/slots/actions.ts` | `tests/db/hold-confirm.test.ts` | реалізовано |
| AC-HOLD-04 | два одночасні утримання — рівно одне створено | `supabase/migrations/20261021160000_hold_and_confirm.sql`, `src/lib/holds/rules.ts`, `src/app/slots/actions.ts` | `tests/db/hold-confirm.test.ts` | реалізовано |
| AC-HOLD-05 | о 14:29 через добу утримання ще «Held» | `supabase/migrations/20261021160000_hold_and_confirm.sql`, `src/lib/holds/rules.ts`, `src/app/slots/actions.ts` | `tests/db/hold-confirm.test.ts` | реалізовано |
| AC-HOLD-06 | о 14:30 через добу утримання «Expired», слот вільний | `supabase/migrations/20261021160000_hold_and_confirm.sql`, `src/lib/holds/rules.ts`, `src/app/slots/actions.ts` | `tests/db/hold-confirm.test.ts` | реалізовано |
| AC-HOLD-07 | слот, що вже почався, не утримують | `supabase/migrations/20261021160000_hold_and_confirm.sql`, `src/lib/holds/rules.ts`, `src/app/slots/actions.ts` | `tests/db/hold-confirm.test.ts` | реалізовано |
| AC-HOLD-08 | терапевт не утримує слот | `supabase/migrations/20261021160000_hold_and_confirm.sql`, `src/lib/holds/rules.ts`, `src/app/slots/actions.ts` | `tests/db/hold-confirm.test.ts` | реалізовано |
| AC-HOLD-09 | терапевт бачить лише власний розклад | `src/lib/holds/schedule.ts`, `src/app/schedule/page.tsx` | `tests/holds/schedule.test.ts`, `tests/db/therapist-visibility.test.ts` | реалізовано |
| AC-HOLD-10 | створення картки клієнта з ім'ям і email | `src/lib/holds/clients.ts`, `src/app/slots/actions.ts`, `supabase/migrations/20261021150100_slot_holds.sql` | `tests/db/clients.test.ts`, `tests/holds/clients.test.ts` | реалізовано |
| AC-HOLD-11 | порожнє ім'я клієнта відхилено | `src/lib/holds/clients.ts`, `src/app/slots/actions.ts`, `supabase/migrations/20261021150100_slot_holds.sql` | `tests/db/clients.test.ts`, `tests/holds/clients.test.ts` | реалізовано |
| AC-HOLD-12 | підтвердження утримання: «Confirmed», без «Held until», не прострочується | `supabase/migrations/20261021160000_hold_and_confirm.sql`, `src/lib/holds/rules.ts`, `src/app/slots/actions.ts` | `tests/db/hold-confirm.test.ts` | реалізовано |
| AC-HOLD-13 | прострочене утримання не підтверджують | `supabase/migrations/20261021160000_hold_and_confirm.sql`, `src/lib/holds/rules.ts`, `src/app/slots/actions.ts` | `tests/db/hold-confirm.test.ts` | реалізовано |
| AC-HOLD-14 | терапевт не підтверджує утримання | `supabase/migrations/20261021160000_hold_and_confirm.sql`, `src/lib/holds/rules.ts`, `src/app/slots/actions.ts` | `tests/db/hold-confirm.test.ts` | реалізовано |
| AC-HOLD-15 | email без «@» відхилено | `src/lib/holds/clients.ts`, `src/app/slots/actions.ts`, `supabase/migrations/20261021150100_slot_holds.sql` | `tests/db/clients.test.ts`, `tests/holds/clients.test.ts` | реалізовано |
| AC-HOLD-16 | дублікат email клієнта відхилено | `src/lib/holds/clients.ts`, `src/app/slots/actions.ts`, `supabase/migrations/20261021150100_slot_holds.sql` | `tests/db/clients.test.ts`, `tests/holds/clients.test.ts` | реалізовано |
| AC-HOLD-17 | повторне утримання за тим самим клієнтом не продовжує «Held until» | `supabase/migrations/20261021160000_hold_and_confirm.sql`, `src/lib/holds/rules.ts`, `src/app/slots/actions.ts` | `tests/db/hold-confirm.test.ts` | реалізовано |
| AC-HOLD-18 | день без вільних слотів: повідомлення й усі слоти зі статусами | `src/lib/holds/day-view.ts`, `src/lib/holds/status.ts`, `src/app/slots/page.tsx` | `tests/holds/day-view.test.ts` | реалізовано |
| AC-HOLD-19 | адміністратор утримує й підтверджує, як планувальник | `supabase/migrations/20261021160000_hold_and_confirm.sql`, `src/lib/holds/rules.ts`, `src/app/slots/actions.ts` | `tests/db/hold-confirm.test.ts` | реалізовано |
| AC-HOLD-20 | планувальник бачить прострочене утримання зі статусом «Expired» | `src/lib/holds/schedule.ts`, `src/app/holds/page.tsx` | `tests/holds/schedule.test.ts`, `tests/db/therapist-visibility.test.ts` | реалізовано |
| AC-HOLD-21 | терапевт не бачить простроченого утримання в розкладі | `src/lib/holds/schedule.ts`, `src/app/schedule/page.tsx`, `supabase/migrations/20261023084029_therapist_sees_active_holds_only.sql` | `tests/holds/schedule.test.ts`, `tests/db/therapist-visibility.test.ts` | реалізовано |
| AC-HOLD-22 | утримання слоту, що вже почався, не підтверджують, лишається «Held» | `supabase/migrations/20261021160000_hold_and_confirm.sql`, `src/lib/holds/rules.ts`, `src/app/slots/actions.ts` | `tests/db/hold-confirm.test.ts` | реалізовано |
| AC-HOLD-23 | підтвердження о 09:59 перед слотом о 10:00 | `supabase/migrations/20261021160000_hold_and_confirm.sql`, `src/lib/holds/rules.ts`, `src/app/slots/actions.ts` | `tests/db/hold-confirm.test.ts` | реалізовано |
| AC-HOLD-24 | день без жодного слоту — лише повідомлення | `src/lib/holds/day-view.ts`, `src/lib/holds/status.ts`, `src/app/slots/page.tsx` | `tests/holds/day-view.test.ts` | реалізовано |
| AC-HOLD-25 | клієнт з утриманням на цей час в іншого терапевта — утримання не створюється | `supabase/migrations/20261021160000_hold_and_confirm.sql`, `src/lib/holds/rules.ts`, `src/app/slots/actions.ts` | `tests/db/hold-confirm.test.ts` | реалізовано |
| AC-HOLD-26 | прострочене утримання клієнта не заважає новому на той самий час | `supabase/migrations/20261021160000_hold_and_confirm.sql`, `src/lib/holds/rules.ts`, `src/app/slots/actions.ts` | `tests/db/hold-confirm.test.ts` | реалізовано |
| AC-HOLD-27 | інший планувальник підтверджує утримання | `supabase/migrations/20261021160000_hold_and_confirm.sql`, `src/lib/holds/rules.ts`, `src/app/slots/actions.ts` | `tests/db/hold-confirm.test.ts` | реалізовано |
| AC-HOLD-28 | прострочене утримання видно планувальнику за хвилину до початку слоту | `src/lib/holds/schedule.ts`, `src/app/holds/page.tsx` | `tests/holds/schedule.test.ts` | реалізовано |
| AC-HOLD-29 | прострочене утримання не видно з початком слоту | `src/lib/holds/schedule.ts`, `src/app/holds/page.tsx` | `tests/holds/schedule.test.ts` | реалізовано |
| AC-HOLD-30 | розклад терапевта — поточний тиждень пн–нд з усіма слотами | `src/lib/holds/schedule.ts`, `src/app/schedule/page.tsx` | `tests/holds/schedule.test.ts` | реалізовано |
| AC-HOLD-31 | перемикання розкладу на наступний тиждень | `src/lib/holds/schedule.ts`, `src/app/schedule/page.tsx` | `tests/holds/schedule.test.ts` | реалізовано |
| AC-HOLD-32 | слоти, що вже почалися, без утримання чи сеансу — «Past» | `src/lib/holds/day-view.ts`, `src/lib/holds/status.ts`, `src/app/slots/page.tsx` | `tests/holds/day-view.test.ts` | реалізовано |
| AC-HOLD-33 | «No free slots on this day.», коли попереду немає вільних | `src/lib/holds/day-view.ts`, `src/lib/holds/status.ts`, `src/app/slots/page.tsx` | `tests/holds/day-view.test.ts` | реалізовано |
| AC-HOLD-34 | дублікат email з іншим регістром і пробілами відхилено | `src/lib/holds/clients.ts`, `src/app/slots/actions.ts`, `supabase/migrations/20261021150100_slot_holds.sql` | `tests/db/clients.test.ts`, `tests/holds/clients.test.ts` | реалізовано |
| AC-HOLD-35 | email зберігається й показується малими літерами без пробілів | `src/lib/holds/clients.ts`, `src/app/slots/actions.ts`, `supabase/migrations/20261021150100_slot_holds.sql` | `tests/db/clients.test.ts`, `tests/holds/clients.test.ts` | реалізовано |
| AC-HOLD-36 | друге підтвердження того самого утримання відхилено | `supabase/migrations/20261021160000_hold_and_confirm.sql`, `src/lib/holds/rules.ts`, `src/app/slots/actions.ts` | `tests/db/hold-confirm.test.ts` | реалізовано |
