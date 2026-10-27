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

Вимоги: https://github.com/Sofiia-pm/therapy-scheduling-spec · джерело: issues · знімок 2026-10-27

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
| AC-HOLD-10 | створення картки клієнта з ім'ям і email | `src/lib/holds/clients.ts`, `src/lib/clients/card.ts`, `src/app/clients/actions.ts`, `supabase/migrations/20261021150100_slot_holds.sql` | `tests/db/clients.test.ts`, `tests/holds/clients.test.ts` | реалізовано |
| AC-HOLD-11 | порожнє ім'я клієнта відхилено | `src/lib/holds/clients.ts`, `src/lib/clients/card.ts`, `src/app/clients/actions.ts`, `supabase/migrations/20261021150100_slot_holds.sql` | `tests/db/clients.test.ts`, `tests/holds/clients.test.ts` | реалізовано |
| AC-HOLD-12 | підтвердження утримання: «Confirmed», без «Held until», не прострочується | `supabase/migrations/20261021160000_hold_and_confirm.sql`, `src/lib/holds/rules.ts`, `src/app/slots/actions.ts` | `tests/db/hold-confirm.test.ts` | реалізовано |
| AC-HOLD-13 | прострочене утримання не підтверджують | `supabase/migrations/20261021160000_hold_and_confirm.sql`, `src/lib/holds/rules.ts`, `src/app/slots/actions.ts` | `tests/db/hold-confirm.test.ts` | реалізовано |
| AC-HOLD-14 | терапевт не підтверджує утримання | `supabase/migrations/20261021160000_hold_and_confirm.sql`, `src/lib/holds/rules.ts`, `src/app/slots/actions.ts` | `tests/db/hold-confirm.test.ts` | реалізовано |
| AC-HOLD-15 | email без «@» відхилено | `src/lib/holds/clients.ts`, `src/lib/clients/card.ts`, `src/app/clients/actions.ts`, `supabase/migrations/20261021150100_slot_holds.sql` | `tests/db/clients.test.ts`, `tests/holds/clients.test.ts` | реалізовано |
| AC-HOLD-16 | дублікат email клієнта відхилено | `src/lib/holds/clients.ts`, `src/lib/clients/card.ts`, `src/app/clients/actions.ts`, `supabase/migrations/20261021150100_slot_holds.sql` | `tests/db/clients.test.ts`, `tests/holds/clients.test.ts` | реалізовано |
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
| AC-HOLD-34 | дублікат email з іншим регістром і пробілами відхилено | `src/lib/holds/clients.ts`, `src/lib/clients/card.ts`, `src/app/clients/actions.ts`, `supabase/migrations/20261021150100_slot_holds.sql` | `tests/db/clients.test.ts`, `tests/holds/clients.test.ts` | реалізовано |
| AC-HOLD-35 | email зберігається й показується малими літерами без пробілів | `src/lib/holds/clients.ts`, `src/lib/clients/card.ts`, `src/app/clients/actions.ts`, `supabase/migrations/20261021150100_slot_holds.sql` | `tests/db/clients.test.ts`, `tests/holds/clients.test.ts` | реалізовано |
| AC-HOLD-36 | друге підтвердження того самого утримання відхилено | `supabase/migrations/20261021160000_hold_and_confirm.sql`, `src/lib/holds/rules.ts`, `src/app/slots/actions.ts` | `tests/db/hold-confirm.test.ts` | реалізовано |
| AC-HOLD-37 | прострочене утримання знову утримують за тим самим клієнтом, старий «Expired» зникає зі списку | `src/lib/holds/schedule.ts` (`buildHoldsList`), `src/app/holds/page.tsx`, `supabase/migrations/20261021160000_hold_and_confirm.sql` | `tests/holds/schedule.test.ts`, `tests/db/hold-confirm.test.ts` | реалізовано |
| AC-HOLD-38 | у списку утримань лише «Held» і «Expired» за часом слоту | `src/lib/holds/schedule.ts` (`buildHoldsList`), `src/app/holds/page.tsx` | `tests/holds/schedule.test.ts` | реалізовано |
| AC-HOLD-39 | інші некоректні email відхилено (без крапки після «@», два «@», порожня частина, пробіл) | `src/lib/holds/clients.ts`, `src/lib/clients/card.ts`, `src/app/clients/actions.ts`, `supabase/migrations/20261023104436_client_cards.sql` (`clients_email_format`) | `tests/holds/clients.test.ts`, `tests/db/clients.test.ts` | реалізовано |
| AC-HOLD-40 | у розкладі терапевта ім'я клієнта без email | `src/lib/holds/schedule.ts` (`buildSchedule`), `src/app/schedule/page.tsx` | `tests/holds/schedule.test.ts` | реалізовано |
| AC-HOLD-41 | ім'я лише з пробілів відхилено, пробіли по краях прибрано | `src/lib/holds/clients.ts`, `src/lib/clients/card.ts`, `src/app/clients/actions.ts`, `supabase/migrations/20261023104436_client_cards.sql` (`clients_name_trimmed`) | `tests/holds/clients.test.ts`, `tests/db/clients.test.ts`, `tests/clients/card.test.ts` | реалізовано |
| AC-HOLD-42 | утримання «Held» зникає зі списку з початком слоту | `src/lib/holds/schedule.ts` (`buildHoldsList`), `src/app/holds/page.tsx` | `tests/holds/schedule.test.ts` | реалізовано |
| AC-HOLD-43 | «Expired» лишається до початку слоту, навіть коли слот утримали за іншим клієнтом | `src/lib/holds/schedule.ts` (`buildHoldsList`), `src/app/holds/page.tsx` | `tests/holds/schedule.test.ts` | реалізовано |
| AC-HOLD-44 | сторінки слотів і утримань планувальника недоступні терапевту | `src/lib/holds/types.ts` (`staffPageError`), `src/app/slots/page.tsx`, `src/app/holds/page.tsx`, `src/app/_components/nav.tsx` | `tests/clients/search.test.ts`, `tests/db/client-access.test.ts`, `tests/clients/pages.test.tsx` | реалізовано |
| AC-CARD-01 | картка дорослого: тип «Adult», ім'я, email, дата народження, мова; клієнта можна вибрати під час утримання | `src/lib/clients/card.ts`, `src/app/clients/actions.ts`, `src/app/clients/new/card-form.tsx`, `src/app/clients/[id]/page.tsx`, `supabase/migrations/20261023104436_client_cards.sql` | `tests/clients/card.test.ts`, `tests/db/client-cards.test.ts` | реалізовано |
| AC-CARD-02 | картка дитини з опікуном; під час утримання дитину знаходять за email опікуна, поруч — email опікуна | `src/lib/clients/card.ts`, `src/app/clients/actions.ts`, `src/lib/clients/search.ts`, `src/app/slots/page.tsx`, `src/lib/holds/types.ts` (`clientContact`) | `tests/clients/card.test.ts`, `tests/clients/search.test.ts`, `tests/db/client-cards.test.ts` | реалізовано |
| AC-CARD-03 | порожнє ім'я чи email опікуна — картку не створено, дані лишаються у формі | `src/lib/clients/card.ts`, `src/app/clients/new/card-form.tsx`, `supabase/migrations/20261023104436_client_cards.sql` (`clients_contact_by_type`) | `tests/clients/card.test.ts`, `tests/db/client-cards.test.ts` | реалізовано |
| AC-CARD-04 | терапевт бачить картки лише своїх клієнтів («Held» або «Confirmed») | `src/app/clients/page.tsx`, `supabase/migrations/20261023084029_therapist_sees_active_holds_only.sql` (`clients_select`) | `tests/db/client-access.test.ts` | реалізовано |
| AC-CARD-05 | терапевт не бачить картки чужого клієнта й не змінює її | `src/app/clients/[id]/page.tsx`, `supabase/migrations/20261023084029_therapist_sees_active_holds_only.sql` (`clients_select`), `supabase/migrations/20261023104436_client_cards.sql` (без GRANT update/delete) | `tests/db/client-access.test.ts` | реалізовано |
| AC-CARD-06 | терапевт не створює картку клієнта | `src/lib/clients/card.ts` (`cardRoleError`), `src/app/clients/actions.ts`, `src/app/clients/new/page.tsx`, `supabase/migrations/20261021150100_slot_holds.sql` (`clients_insert_staff`) | `tests/clients/card.test.ts`, `tests/db/client-cards.test.ts` | реалізовано |
| AC-CARD-07 | без входу — лише сторінка входу, без даних клієнтів і утримань | `src/proxy.ts`, `src/lib/supabase/viewer.ts`, `supabase/migrations/20261021150100_slot_holds.sql` (`revoke all … from anon`) | `tests/db/client-access.test.ts` | реалізовано |
| AC-CARD-08 | після прострочення утримання клієнт більше не свій для терапевта | `src/app/clients/page.tsx`, `src/app/clients/[id]/page.tsx`, `supabase/migrations/20261023084029_therapist_sees_active_holds_only.sql` (`clients_select`) | `tests/db/client-access.test.ts` | реалізовано |
| AC-CARD-09 | порожній список своїх клієнтів терапевта — повідомлення | `src/app/clients/page.tsx`, `src/lib/clients/card.ts` (`NO_CLIENTS_YET`), `supabase/migrations/20261023084029_therapist_sees_active_holds_only.sql` (`clients_select`) | `tests/db/client-access.test.ts`, `tests/clients/pages.test.tsx` | реалізовано |
| AC-CARD-10 | планувальник і адміністратор бачать усі картки й дані опікуна | `src/app/clients/page.tsx`, `supabase/migrations/20261023084029_therapist_sees_active_holds_only.sql` (`clients_select`) | `tests/db/client-cards.test.ts` | реалізовано |
| AC-CARD-11 | користувач без ролі бачить лише повідомлення про відсутність доступу | `src/lib/supabase/viewer.ts`, `src/app/page.tsx`, `supabase/migrations/20261023105250_users_without_role.sql` | `tests/db/client-access.test.ts` | реалізовано |
| AC-CARD-12 | усі помилки форми картки одразу, біля полів | `src/lib/clients/card.ts` (`validateClientCard`), `src/app/clients/new/card-form.tsx` | `tests/clients/card.test.ts`, `tests/clients/actions.test.ts` | реалізовано |
| AC-CARD-13 | дублікат картки дитини — «A client with these details already exists.» | `supabase/migrations/20261027073004_client_cards_clarify.sql` (`clients_child_card_key`), `src/lib/clients/card.ts` (`cardErrorCode`) | `tests/db/client-cards.test.ts`, `tests/clients/card.test.ts` | реалізовано |
| AC-CARD-14 | «Held» робить клієнта своїм лише до початку слоту, минулий «Confirmed» — без обмеження | `supabase/migrations/20261027073004_client_cards_clarify.sql` (`is_client_of_current_therapist`), `src/app/clients/page.tsx`, `src/app/clients/[id]/page.tsx` | `tests/db/client-access.test.ts` | реалізовано |
| AC-CARD-15 | порожній список клієнтів для планувальника й адміністратора | `src/app/clients/page.tsx`, `src/lib/clients/card.ts` (`NO_CARDS_YET`) | `tests/db/client-cards.test.ts`, `tests/clients/card.test.ts`, `tests/clients/pages.test.tsx` | реалізовано |
| AC-CARD-16 | картка, якої немає: «This client card doesn't exist.» / як для чужої | `src/app/clients/[id]/page.tsx`, `src/lib/clients/card.ts` (`CARD_NOT_FOUND`) | `tests/db/client-access.test.ts`, `tests/clients/card.test.ts`, `tests/clients/pages.test.tsx` | реалізовано |
