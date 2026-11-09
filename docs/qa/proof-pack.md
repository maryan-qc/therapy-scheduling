# QA proof pack: зріз 3 — статус перевірки страхування в картці клієнта

<!-- Шаблон — koldovsky/2026-quitcode-09-software-factory-hw/materials/templates/proof-pack.template.md.
     Proof pack WS8 (зріз 2) — docs/qa/proof-pack-ws8.md. Посилання на файли — відносні: читаються на SHA здачі. -->

- Прод-URL: https://therapy-scheduling-sigma.vercel.app
- Зріз 3: планувальник або адміністратор позначає в картці клієнта статус перевірки страхування («Verified», «Not
  accepted», «Private pay»), а кожен, хто бачить картку, бачить «Insurance: <статус>» (roadmap PM, рядок «WS8» →
  «WS9 — конвеєр (зріз 3)»).
- Вимоги: https://github.com/HryhoriiHaponiukQuitCode/therapy-scheduling-spec · джерело: issues · знімок 2026-11-08
  (HryhoriiHaponiukQuitCode/therapy-scheduling-spec#33). Вимогу #34 (документи згоди, AC-DOC-01…11) PM 2026-11-06
  переніс на пізніший зріз — у WS9 її не реалізуємо (рядки матриці — «відкладено (рішення PM…)»).
- Спека: [`openspec/specs/insurance-status/spec.md`](../../openspec/specs/insurance-status/spec.md)
- `/api/health` на момент UAT: sha `60b0bc0`, db ok, 09.11.2026 11:02 (Київ).

## Доказ на кожен AC зрізу 3

| AC | Вид | Тест (рівень, посилання) | Здатен упасти | Специфікація UAT | Вердикт UAT і кадр | PR і SHA злиття |
|---|---|---|---|---|---|---|
| AC-INS-01 | стан: картка без позначки | база: [`insurance-status.test.ts#L66`](../../tests/db/insurance-status.test.ts#L66); unit: [`insurance.test.tsx#L13`](../../tests/clients/insurance.test.tsx#L13) | негативний контроль NC-3 → FAIL (R1) | [`insurance.spec.ts#L80`](../../tests/e2e/insurance.spec.ts#L80) | PASS (R6), [кадр](uat/2026-11-09/frames/AC-INS-01-then-1.png) | [#45](https://github.com/maryan-qc/therapy-scheduling/pull/45), `60b0bc0` |
| AC-INS-02 | основний сценарій | база: [`#L76`](../../tests/db/insurance-status.test.ts#L76); дія: [`insurance-action.test.ts#L37`](../../tests/clients/insurance-action.test.ts#L37); unit: [`insurance.test.tsx#L18`](../../tests/clients/insurance.test.tsx#L18) | — | [`insurance.spec.ts#L102`](../../tests/e2e/insurance.spec.ts#L102) | PASS (R6), [кадр 1](uat/2026-11-09/frames/AC-INS-02-then-1.png), [кадр 2](uat/2026-11-09/frames/AC-INS-02-then-2.png) | #45, `60b0bc0` |
| AC-INS-03 | основний сценарій (інша роль змінює, третя бачить) | база: [`#L81`](../../tests/db/insurance-status.test.ts#L81); unit: [`insurance.test.tsx#L25`](../../tests/clients/insurance.test.tsx#L25) | — | [`insurance.spec.ts#L145`](../../tests/e2e/insurance.spec.ts#L145) | PASS (R6), [кадр 1](uat/2026-11-09/frames/AC-INS-03-then-1.png), [кадр 2](uat/2026-11-09/frames/AC-INS-03-then-2.png) | #45, `60b0bc0` |
| AC-INS-04 | відмова в інтерфейсі (терапевт лише бачить) | база (RLS — свій і чужий клієнт): [`#L88`](../../tests/db/insurance-status.test.ts#L88); unit (форми немає): [`insurance.test.tsx#L29`](../../tests/clients/insurance.test.tsx#L29) | — | [`insurance.spec.ts#L210`](../../tests/e2e/insurance.spec.ts#L210) | PASS (R6), [кадр](uat/2026-11-09/frames/AC-INS-04-then-1.png) | #45, `60b0bc0` |
| AC-INS-05 | відмова: заборонена роль, напряму, оминаючи сторінки | база: [`#L95`](../../tests/db/insurance-status.test.ts#L95), [`#L110`](../../tests/db/insurance-status.test.ts#L110), [`#L117`](../../tests/db/insurance-status.test.ts#L117); дія: [`insurance-action.test.ts#L45`](../../tests/clients/insurance-action.test.ts#L45) | SQL-мутанти C10, C11, C12 — KILLED ([`scripts/mutants.mjs#L90`](../../scripts/mutants.mjs#L90)) | [`insurance.spec.ts#L237`](../../tests/e2e/insurance.spec.ts#L237) — «напряму» через Data API з входом therapist1, «що не змінилося» — кадр scheduler1 | PASS (R6), [кадр](uat/2026-11-09/frames/AC-INS-05-then-1.png) | #45, `60b0bc0` |
| AC-INS-06 | відмова: не увійшов | база (`anon`): [`#L123`](../../tests/db/insurance-status.test.ts#L123); дія: [`insurance-action.test.ts#L61`](../../tests/clients/insurance-action.test.ts#L61) | SQL-мутант C13 — KILLED ([`scripts/mutants.mjs#L111`](../../scripts/mutants.mjs#L111)) | [`insurance.spec.ts#L290`](../../tests/e2e/insurance.spec.ts#L290) | PASS (R6), [кадр 1](uat/2026-11-09/frames/AC-INS-06-then-1.png), [кадр 2](uat/2026-11-09/frames/AC-INS-06-then-2.png) | #45, `60b0bc0` |

Специфікацію UAT, звіт і мутанти злито PR «UAT зрізу 3» (номер і SHA злиття — у файлі здачі).

## Не перевірено

| AC чи частина | Чому не перевірено | Що зроблено замість | Ризик на проді |
|---|---|---|---|
| Порядок «тест до коду» (maker ≠ checker) для AC-INS-01…06 | тести бази й unit написано в тій самій сесії агента, що й код, після міграції, а не окремою сесією чи до коду | сила тестів відмов доведена SQL-мутантами C10–C13 (4 з 4 KILLED) і негативним контролем NC-3; UAT-специфікації писались з тексту AC (дослівне «Тоді») | низький: правила відмов ловлять мутанти; основні сценарії — UAT на проді |
| AC-DOC-01…11 (#34) | не входять у зріз 3: рішення PM 2026-11-06 — «у WS9 не реалізуємо» | реалізацію збережено в гілці `task/consent-documents` (PR #46 закрито без злиття) | немає: на проді документів згоди немає, підтвердження — як у зрізі 1 |

## A. Вимоги й спека

- `/requirements-sync` — PR «Оновлення вимог»: [#42](https://github.com/maryan-qc/therapy-scheduling/pull/42)
  (2026-11-06) і після уточнень PM — [#47](https://github.com/maryan-qc/therapy-scheduling/pull/47) (2026-11-08:
  #34 перенесено на пізніший зріз, AC не змінено).
- Спека `add-insurance-consent` — PR «Специфікація»: [#43](https://github.com/maryan-qc/therapy-scheduling/pull/43)
  (3 знахідки CodeRabbit — виправлено з тексту PM); план `impl-insurance-consent` —
  [#44](https://github.com/maryan-qc/therapy-scheduling/pull/44).
- Зміна `clarify-<зріз3>`: не потрібна — PM AC не змінював (лише переніс #34).
- Питання PM: питань не було — вимоги #33 і #34 PM перевірив за чеклістом, тексти й межі задано; обидва «Відкриті
  питання» #34 PM сам закрив «не в цьому зрізі».

## B. Реалізація

| PR «Реалізація» | Задача з `tasks.md` | AC | Відповіді на знахідки CodeRabbit | `db-deploy` |
|---|---|---|---|---|
| [#45](https://github.com/maryan-qc/therapy-scheduling/pull/45) | 1. Статус перевірки страхування | AC-INS-01…06 | 4 знахідки: 3 виправлено (тести дії, тест без ролі, тест без залежності від дати сиду), 1 — аргумент у треді (структура плану) | [run 42527688004](https://github.com/maryan-qc/therapy-scheduling/actions/runs/42527688004) — success |
| PR «UAT зрізу 3» | 3. UAT і archive плану | AC-INS-01…06 | — | міграцій немає |

- Ворота на `main` (`quality`): [run 42527687997](https://github.com/maryan-qc/therapy-scheduling/actions/runs/42527687997)
  — success; `src/lib/clients/insurance.ts` під підлогою покриття (рядки 100 %, гілки 85,7 %).
- Мутації: `npm run mutation:sql` — C10–C13 на `20261106170000_insurance_status.sql`: 4 з 4 KILLED
  (C10 — без перевірки ролі, C11 — прямий update дозволено, C12 — «Not set» повертається, C13 — anon має доступ до
  функції).

## C. UAT на проді

- Звіт: [`docs/qa/uat/2026-11-09/report.md`](uat/2026-11-09/report.md) — 6 AC, PASS 6, FAIL 0, NEEDS-HUMAN 0; код тестів
  `5964158`, без незакомічених змін.
- Відео: ассети pre-release [uat-2026-11-09](https://github.com/maryan-qc/therapy-scheduling/releases/tag/uat-2026-11-09) (у git відео не кладемо), посилання — в описі PR «UAT зрізу 3».
- Рецензент: `claude-haiku-5-5`, суперечки → `claude-sonnet-5-5`; розбір — $0.0129 (ціни API); негативні контролі — ще $0.0377.
- Негативний контроль (`npm run uat:nc`): NC-1 (AC-CARD-05, хибний текст) → **FAIL** (R1); NC-2 (уточнений «Тоді») →
  **NEEDS-HUMAN** (R3); NC-3 (AC-INS-01, тест чекає «Verified» на свіжій картці) → **FAIL** (R1). Агент Haiku на NC-1 і
  NC-3 сказав PASS — R1 його перекрив, і саме це контроль і перевіряє.
- Дані: `@writes` — тести створюють синтетичні картки «Client Six/Seven <прогін>-<n>» з адресами
  `uat-<прогін>-…@example.test` і утримання «Held» у Therapist One (прострочуються за 24 години). Прибирання (видаляє
  лише користувачів Auth `uat-*`) не запускалось: прогін без `SUPABASE_SECRET_KEY`, користувачів тести не створюють.

### Приймання PM

| AC | Рішення PM | Посилання |
|---|---|---|
| AC-INS-01…06 | чекає PM | таблиця приймання PM; issues «Відхилення від вимог» — у цьому репо |

## D. Прод і ретро

- `/api/health` після злиття всіх задач: sha `main` (у файлі здачі), db ok.
- Нові ролі й акаунти: нових ролей зріз 3 не додає; ролі зрізів 1–3 — admin1, scheduler1, scheduler2, therapist1,
  therapist2 (`*@example.test`) — уже в [`accounts.zip`](../../accounts.zip).
- `docs/conformance.md`: [рядки AC-INS-01…06](../conformance.md) — «реалізовано» з кодом, тестом і UAT; AC-DOC-01…11 —
  «відкладено (рішення PM: пізніший зріз, …#34)».

### Ретро: що б ми взяли з фабрики у свій звичайний процес

- Допуск: уже є — PM перевіряє вимогу за чеклістом, у нас `/requirements-sync` → `spec-review` до коду.
- Захищені тести: візьмемо — червоні тести AC окремим PR перед «Реалізацією» (гілка `tests/<зріз>`), щоб тест писала не
  та сесія, що код (у WS9 це не дотримано — див. «Не перевірено»).
- Приховані сценарії: не потрібно в соло-репо — ховати нема від кого; ту саму роль грають мутанти.
- Мутації й повтор: уже є (`scripts/mutants.mjs`, C1–C13); візьмемо — job `mutation:sql` у `.github/workflows/quality.yml`
  на PR, що змінює `supabase/migrations/**`, а не ручний запуск.
- Рев'ю-спростування: уже є — CodeRabbit і відповідь у треді; візьмемо — його ліміт закладати в план (одна рецензія
  ~раз на 30–60 хв), бо черга рецензій у WS9 забрала більше часу, ніж код.
- Пакет доказів з «Не перевірено»: уже є — цей proof pack і `manifest.json` звіту UAT.
- Рівні автономії й автозлиття: не потрібно для основного проду — міграції йдуть через `db-deploy` після рішення людини.
- Бюджети: візьмемо — підсумок вартості рецензента зі звіту UAT у PR, щоб бачити ціну доказу (тут $0.013 на 6 AC).
