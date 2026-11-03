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
- `/api/health` на момент UAT: sha 07b01cf, db ok, 03.11.2026

## 3 AC

Вимога PM: https://github.com/Sofiia-pm/therapy-scheduling-spec/issues/19 (знімок — `requirements/19-planuvalnyk-zapovniuie-kartku-klienta.md`).

| AC | Вид | «Тоді» (дослівно з вимоги PM) |
|---|---|---|
| AC-CARD-05 | відмова в браузері: чужі дані за прямим посиланням (картка клієнта іншого терапевта) | therapist1 бачить повідомлення «You don't have access to this client.», жодних даних client9 не показано, і картка client9 не змінилася. |
| AC-CARD-12 | стан інтерфейсу: помилки форми нової картки з дослівним текстом | картку не створено, scheduler1 одразу бачить три повідомлення біля відповідних полів — «Enter the client's name.», «Enter a date of birth that is not in the future.» і «Select a session language.», а всі введені дані лишаються у формі. |
| AC-CARD-11 | відмова в браузері: користувач без ролі | він бачить лише повідомлення «Your account has no access yet. Contact an administrator.» і дію «Sign out», жодних даних клієнтів не показано, і жодна картка не змінилася. |

Усі три — лише читання на проді: AC-CARD-12 картки не створює, тож прибирати після UAT нічого.

## A. Ворота

- PR воріт: <!-- …/pull/N -->
- Зелений `quality` на `main`: <!-- …/actions/runs/N -->
- Обов'язкові перевірки в `solo-main` з <!-- дата -->: <!-- назви jobs -->

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
admin-клієнт відкинув — тепер його поява червонить прогін.

## B. Якість тестів

### Рівень для кожного AC

| AC | Де живе правило | Рівень | Чому | Тест |
|---|---|---|---|---|
| AC-…-NN | <!-- політика / функція бази / TS-модуль / сторінка --> | <!-- unit / база (PGlite) / e2e --> | … | <!-- …/blob/<sha>/tests/…#L<N> --> |

### Покриття

| Файл за AC | Рядки | Гілки | Чим доведено, якщо 0 % |
|---|---|---|---|
| <!-- src/lib/<модуль>.ts --> | … % | … % | — |
| <!-- src/app/<сторінка>/page.tsx --> | 0 % | 0 % | <!-- e2e: tests/e2e/….spec.ts --> |

### Доказ мутацією

| Мутант (файл:рядок, що змінено) | AC під загрозою | До | Тест, посилений з тексту AC | Після |
|---|---|---|---|---|
| <!-- src/lib/…/x.ts:14 `<=` → `<` --> | AC-…-NN | вижив | <!-- …/blob/<sha>/tests/…#L<N>: межа «…» з AC --> | убитий |

- Stryker: <!-- score до → після, посилання на PR з виводом -->
- SQL-мутації (`npm run mutation:sql`): <!-- таблиця з npm run mutation:sql -- --markdown (KILLED / SURVIVED / ERROR) з PR або «немає PGlite-гарнесу» -->
- Еквівалентні мутанти: <!-- який і чому (рядок міграції чи коду, що робить його еквівалентним) або «немає» -->

## C. UAT на проді

| AC | Специфікація | Тест (твердження) | Агент | Вердикт | Кадр |
|---|---|---|---|---|---|
| AC-CARD-05 | [client-cards.spec.ts#L61](https://github.com/maryan-qc/therapy-scheduling/blob/1ce54de85e64c95d91867971be607807007d3581/tests/e2e/client-cards.spec.ts#L61) | passed | Haiku: PASS | **PASS** — R6 | [AC-CARD-05-then-1.png](https://github.com/maryan-qc/therapy-scheduling/blob/1ce54de85e64c95d91867971be607807007d3581/docs/qa/uat/2026-11-03/frames/AC-CARD-05-then-1.png) |
| AC-CARD-11 | [client-cards.spec.ts#L130](https://github.com/maryan-qc/therapy-scheduling/blob/1ce54de85e64c95d91867971be607807007d3581/tests/e2e/client-cards.spec.ts#L130) | passed | Haiku: PASS | **PASS** — R6 | [then-1](https://github.com/maryan-qc/therapy-scheduling/blob/1ce54de85e64c95d91867971be607807007d3581/docs/qa/uat/2026-11-03/frames/AC-CARD-11-then-1.png) (застосунок), [then-2](https://github.com/maryan-qc/therapy-scheduling/blob/1ce54de85e64c95d91867971be607807007d3581/docs/qa/uat/2026-11-03/frames/AC-CARD-11-then-2.png) (картка client6 за посиланням) |
| AC-CARD-12 | [client-cards.spec.ts#L183](https://github.com/maryan-qc/therapy-scheduling/blob/1ce54de85e64c95d91867971be607807007d3581/tests/e2e/client-cards.spec.ts#L183) | passed | Haiku: PASS | **PASS** — R6 | [AC-CARD-12-then-1.png](https://github.com/maryan-qc/therapy-scheduling/blob/1ce54de85e64c95d91867971be607807007d3581/docs/qa/uat/2026-11-03/frames/AC-CARD-12-then-1.png) |

- Звіт: [docs/qa/uat/2026-11-03/report.md](https://github.com/maryan-qc/therapy-scheduling/blob/1ce54de85e64c95d91867971be607807007d3581/docs/qa/uat/2026-11-03/report.md) (+ `manifest.json`, `frames/`);
  код тестів `task/uat` @ `fc5f9e0`, прод `07b01cf`, прогін 03.11.2026 13:08 (Київ), Playwright 23,4 с.
- Відео: вкладення в описі PR UAT. Файли — ассети pre-release `uat-2026-11-03`, у git їх немає: [AC-CARD-05](https://github.com/maryan-qc/therapy-scheduling/releases/download/uat-2026-11-03/AC-CARD-05.webm),
  [AC-CARD-11](https://github.com/maryan-qc/therapy-scheduling/releases/download/uat-2026-11-03/AC-CARD-11.webm), [AC-CARD-12](https://github.com/maryan-qc/therapy-scheduling/releases/download/uat-2026-11-03/AC-CARD-12.webm).
- Рецензент: `claude-haiku-5-5` на кожен AC, суперечок не було, тож до `claude-sonnet-5-5` не дійшло. Промпт і схема — з
  materials без змін. Разом за розбір — $0,0066 (ціни API; прогін — за підпискою). Конвеєр запускав агент: змінні
  `CLAUDECODE` / `CLAUDE_*` прибрано, `SUPABASE_SECRET_KEY` порожній.
- Негативний контроль (`npm run uat:nc`, [negative-controls.spec.ts](https://github.com/maryan-qc/therapy-scheduling/blob/1ce54de85e64c95d91867971be607807007d3581/tests/e2e/negative-controls.spec.ts)), обидва на AC-CARD-05:
  - **NC-1** — у твердженні «You do not have access to this client.» замість тексту AC: перевірки впали, Haiku сказав
    PASS → **FAIL** (R1, агент не перекриває впале твердження);
  - **NC-2** — анотація `ac-text` з іншим «Тоді» («This client card is private.»), тест і застосунок без змін: перевірки
    пройшли, Haiku й Sonnet — FAIL → **NEEDS-HUMAN** (R3).

  Рядки звіту — в описі PR UAT.
- Дані: **лише читання**. UAT нічого не створює (прибирання не запускалось: прогін без секретного ключа). «Дано» на проді —
  синтетичні дані, створені один раз 03.11 через застосунок під scheduler1 (з RLS) і залишені для приймання PM:
  - картки «Client Six» (client6@example.test, дані AC-CARD-01) і «Client Nine» (client9@example.test);
  - сеанс «Confirmed» Client Nine у Therapist Two 2026-11-05 о 11:00 — тож client9 лишається своїм лише для therapist2.

  Специфікація щоразу перевіряє «Дано»: картку бачить scheduler1, вона є в «My clients» therapist2 і її немає в therapist1.
- `docs/conformance.md`: AC-CARD-05, AC-CARD-11, AC-CARD-12 — `реалізовано` зі шляхом `tests/e2e/client-cards.spec.ts`.
  Рядків `відкладено (e2e — WS8)` у матриці немає: усі 60 AC зрізів 1–2 «реалізовано» ще з WS7.

### Приймання PM

| AC | Рішення PM | Посилання |
|---|---|---|
| AC-CARD-05 | очікує приймання PM (звіт подано 03.11.2026) | — |
| AC-CARD-12 | очікує приймання PM (звіт подано 03.11.2026) | — |
| AC-CARD-11 | очікує приймання PM (звіт подано 03.11.2026) | — |

Оцінки 0–3 PM ставить у таблиці приймання курсу; підпис і issues «Відхилення від вимог» (форма
`.github/ISSUE_TEMPLATE/deviation.yml`, мітка `відхилення`) — у цьому репо. Виправлення — до кінця Сб 07.11.

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
