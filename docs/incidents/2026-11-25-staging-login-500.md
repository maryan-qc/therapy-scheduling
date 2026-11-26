# Postmortem: на staging не відкривалася сторінка входу (навчальний дріл)

**Blameless (без пошуку винних).** Шукаємо, *що в системі* дозволило помилці дійти до staging, а не *хто* винен.

| | |
|---|---|
| Дата інциденту | 2026-11-25 |
| Автори | черговий розробник (чернетку склав основний асистент Claude Code розробника, перевірив розробник) |
| Статус | перевірено PM 2026-11-25; [зауваження](https://github.com/maryan-qc/therapy-scheduling/pull/73#issuecomment-7174684592) внесено 2026-11-26 — див. «Журнал змін» |
| Серйозність | SEV3 за матрицею PM ([`docs/operations.md`](https://github.com/HryhoriiHaponiukQuitCode/therapy-scheduling-spec/blob/0bedb11/docs/operations.md), розділ 2): зламано лише staging, прод і користувачі не постраждали. Цей дріл — приклад 1 рівня SEV3 у самій матриці |
| Середовище | staging (дріл: прод і база проду не постраждали, міграцій і змін даних не було) |
| Прогноз до поломки | [issue #68](https://github.com/maryan-qc/therapy-scheduling/issues/68) |
| Стенограма розбору агентом | [`2026-11-25-staging-login-500-rca.md`](2026-11-25-staging-login-500-rca.md) |

## Коротко

Навчальний дріл (варіант «коміт, що ламає сторінку»): зміна в сторінці входу пройшла CI зеленою і після злиття в
`staging` зламала `/login` (помилка сервера). Smoke кожного деплою помітив це **за 13 секунд** після деплою і
надіслав алерт у Telegram, а на preview PR — ще до злиття. Агент у профілі «лише пропонує» знайшов причину з
доказами; людина повернула зміну revert-PR. Staging працював знову через 2 год 28 хв, з них ≈2 год розбір стояв.

## Вплив (мовою користувача)

- На тестовому стенді staging **не відкривалася сторінка входу** — 2 год 28 хв (11:37–14:05 UTC). PM чи тестувальник
  не змогли б увійти на staging і перевіряти функції, а без входу не відкривається жодна сторінка застосунку.
- **Прод і реальні користувачі не постраждали**: прод весь час був на попередній версії й проходив smoke.
- **Даних не втрачено й не змінено**: зміна торкалася лише показу сторінки входу.
- Серед помилок рантайму Vercel — лише **3 запити** до зламаної сторінки, усі перевірочні (smoke preview, smoke
  staging, ручна перевірка). Інших відвідувань окремо не перевіряли. PM підтвердив, що 25.11 до 14:05 UTC staging не
  відкривав ([коментар до #73](https://github.com/maryan-qc/therapy-scheduling/pull/73#issuecomment-7174684592)).

## Хронологія

Час — UTC, 2026-11-25. Кожен рядок — з джерелом доказу.

| Час | Подія | Доказ |
|---|---|---|
| 11:24:29 | Норма: smoke staging зелений (`login: 200`, `appEnv: staging`, база staging) | [прогін 45604130622](https://github.com/maryan-qc/therapy-scheduling/actions/runs/45604130622) |
| 11:33:39 | Відкрито PR дрілу #69 у `staging`, Vercel почав деплой preview (`dpl_ErUzQosS…`, коміт `b2ada52`) | статус Vercel на `b2ada52`; `list_deployments` у стенограмі, частина 3 |
| 11:33:58 | Preview PR #69 Ready | статус Vercel на `b2ada52` |
| 11:34:10 | Перша помилка рантайму `TypeError … reading 'toLowerCase'` на `/login` (preview) | `get_runtime_errors`, стенограма, частина 3 |
| **11:34:11** | **Перший сигнал:** smoke preview `"/login": HTTP 500` → алерт у Telegram | [прогін 45605627003](https://github.com/maryan-qc/therapy-scheduling/actions/runs/45605627003) |
| 11:35:42 | CI PR #69 зелений (`spec`, `app`, `conformance`, `db-check`) — жоден тест не рендерить `/login` | [PR #69](https://github.com/maryan-qc/therapy-scheduling/pull/69), checks |
| 11:36:31 | PR #69 злито в `staging` (коміт `fa5e6d5`). Червоний smoke preview злиттю не завадив: це не перевірка PR | PR #69 |
| **11:37:00** | **T0:** деплой staging `dpl_F7jbpvBw9FVaviRMuLbt9C4U7CKR` (`fa5e6d5`) Ready | статус Vercel на `fa5e6d5`; `get_deployment` у стенограмі |
| 11:37:12 | Smoke staging: `root: 307`, `login: 500`, health 200, `db: ok`, `sha fa5e6d5` | [прогін 45606096374](https://github.com/maryan-qc/therapy-scheduling/actions/runs/45606096374) |
| **11:37:13** | **T1:** алерт «ЧЕРВОНИЙ SMOKE» у Telegram (staging) | той самий прогін: «Алерт надіслано в Telegram» |
| 11:37:28 | Ручна перевірка `GET /login` → 500 (третя й остання помилка рантайму) | `get_runtime_errors`; [коментар #68](https://github.com/maryan-qc/therapy-scheduling/issues/68#issuecomment-7161295726) |
| 11:43:20 | Почали розбір: Claude Code у профілі «лише пропонує» | стенограма, частина 1 |
| ≈11:46 – 13:46 | Розбір стояв: комп'ютер чергового «спав»; MCP Vercel відповідав 403 (OAuth без доступу до команди) | стенограма, частини 1–2 |
| 14:01:22 | Висновок агента: причина — `fa5e6d5`, варіант А — revert-PR | стенограма, частина 2 |
| 14:02:37 | Людина прийняла варіант А: відкрито revert-PR #70 у `staging` | [PR #70](https://github.com/maryan-qc/therapy-scheduling/pull/70) |
| 14:03:01 | Smoke preview revert-гілки зелений (`login: 200`) | [прогін 45629833421](https://github.com/maryan-qc/therapy-scheduling/actions/runs/45629833421) |
| 14:04:23 | PR #70 злито (коміт `b724299`) | PR #70 |
| **14:04:45** | **T2:** виправлений деплой staging `dpl_MGGx6x5rBer3krGpoNMPhfvqeg5s` Ready | `get_deployment` у стенограмі, частина 3 |
| 14:05:01 | Smoke staging зелений — інцидент закрито | [прогін 45630153635](https://github.com/maryan-qc/therapy-scheduling/actions/runs/45630153635) |
| 14:15 – 14:28 | За знахідкою агента виправлено область `APP_ENV` у Vercel: лише Preview, гілка `staging` (було — усі Preview). Точніше, ніж дають знімки, час невідомий | знімки Vercel → Environment Variables, значення приховане: [до](img/2026-11-25-app-env-before.png) — «Preview», «Added 3h ago» (знімок надіслано в сесію Claude Code о 14:15:20); [після](img/2026-11-25-app-env-after.png) — «Preview ⑂ staging», «Updated just now» (надіслано о 14:28:44). Що до виправлення `APP_ENV` діяв на всі preview — health preview інших гілок `appEnv: "staging"` (стенограма, частина 2) |
| 14:27:37 | Редеплой проду без зміни коду (той самий `60048e4`) після зміни змінних; smoke проду зелений о 14:28:37 | `list_deployments` у стенограмі, частина 3 |
| 14:30 – 14:34 | Після перелогіну MCP Vercel агент підтвердив причину помилками рантайму. Перевірка профілю: `get_project_env`, `request_rollback`, `request_promote` агенту недоступні (`deny`); `filter_project_envs` (`ask`) агент сам не викликав, тож читання значень через нього цим не перевірено | стенограма, частини 3–4 |

## Виявлення

- **Сигнал:** червоний smoke job `deploy` (подія Vercel `repository_dispatch`) → крок алерту → Telegram. Перший сигнал —
  ще на preview PR, о 11:34:11, за 2 хв 20 с до злиття.
- **Час до виявлення (T1 − T0):** 11:37:00 → 11:37:13 = **13 с** (прогноз в #68 — до 3 хв).
- **Час до відновлення (T2 − T0):** 11:37:00 → 14:04:45 = **2 год 27 хв 45 с**. Самі дії людини після висновку
  агента — 3 хв 23 с (14:01:22 → 14:04:45); решта — розбір, що стояв (див. «Що не спрацювало»).
- Без сигналу поломку помітив би лише той, хто відкрив би staging, — найпізніше на наступному UAT, тобто із
  запізненням у дні.

## Першопричина

| Твердження | Доказ |
|---|---|
| Між останнім зеленим (`60048e4`) і червоним (`fa5e6d5`) деплоєм staging змінено лише один файл, `src/app/login/page.tsx` (+2 −1) | `git diff --stat 60048e4 fa5e6d5`, стенограма, частина 1 |
| Новий рядок `ERRORS[(error as string).toLowerCase()]` викликає `toLowerCase()` на `undefined`, коли `/login` відкрито без `?error=` | коміт `fa5e6d5`, рядок 19 `src/app/login/page.tsx` |
| Саме це кидає сервер: `TypeError: Cannot read properties of undefined (reading 'toLowerCase')` на `/login`, 3 випадки 11:34:10–11:37:28, останній деплой — `dpl_F7jbpvBw9…` | `get_runtime_errors`, стенограма, частина 3 |
| Приведення `as string` сховало від `tsc` справжній тип `string \| string[] \| undefined`, тож typecheck був зелений | `npm run typecheck` на PR #69 — зелений; стенограма, частина 2 |
| Жоден тест не рендерить сторінку входу, тож CI був зелений | 393 з 393 тестів пройшли з цим комітом (локально й у CI PR #69) |

**Тригер:** злиття PR #69 у `staging` о 11:36:31 (зміна була навмисною — це дріл).
**Механізм, який дозволив дійти до staging:** CI не рендерить сторінки, а червоний smoke preview не є перевіркою PR.

## Що НЕ було причиною

| Гіпотеза | Як перевірили | Чому відкинули |
|---|---|---|
| База staging (пауза, ключ, адреса) | `/api/health` у червоному прогоні staging | health 200, `db: ok`, `reason: ""`, `supabaseRef: hudgoucpezodnvirccok` — як у нормі. Health проду тут нічого не доводить: у проду своя база |
| Змінні середовища staging | час останньої зміни змінних і норма; preview іншої гілки | змінні змінювали до зеленого smoke о 11:24:29; та сама 500 на окремому деплої іншої гілки (`b2ada52`) з тими самими змінними |
| Платформа Vercel / регіон `cdg1` | `get_deployment` і відповіді smoke | обидва деплої READY без `aliasError`; на тому самому деплої `"/"` → 307, health → 200; у відповіді 500 немає `x-vercel-error` |
| Не той коміт на staging чи відкат без Promote | `sha` у health проти очікуваного | `health.sha` = `fa5e6d5` = очікуваний; помилки «показує …, а очікувався …» немає |
| Інцидент провайдера | статус-сторінки | невідомо: інструментів для них у профілі немає, стан не вставляли; але прямі ознаки вище вказують на наш код |

## Усунення

- **Зупинили шкоду й виправили причину:** revert-PR [#70](https://github.com/maryan-qc/therapy-scheduling/pull/70) у
  `staging` (14:04:23), деплой Ready 14:04:45, smoke зелений 14:05:01. Instant Rollback не підходить: на Vercel він
  лише для проду.
- Після дрілу в `staging` два коміти (дріл і revert), яких немає в `main`; дерево `staging` збігається з `main`.
  Далі `staging` оновлюємо з `main` через PR `main → staging`.

## Що спрацювало, що ні, де пощастило

- **Спрацювало:**
  - smoke кожного деплою зловив поломку за 13 с на staging і ще раніше на preview PR;
  - алерт дійшов у Telegram;
  - прогноз з #68 справдився: сигнал, тип помилки, зелений CI;
  - агент знайшов причину з доказами, не викликав жодного інструмента запису, а `authorize_team_access` правильно не обійшов;
  - агент знайшов ще й окрему проблему: `APP_ENV=staging` діяв на всі preview.
- **Не спрацювало:**
  - CI пропустив зламану сторінку: тест її не рендерить, а `as string` сховав тип;
  - червоний smoke preview не заблокував злиття, бо він не перевірка PR;
  - розбір почали лише через 6 хв після алерту, а потім він стояв ≈2 год: комп'ютер чергового заснув посеред сесії, і MCP Vercel був авторизований без доступу до команди;
  - журнали рантайму Vercel (Hobby — 1 год) за T0 зникли раніше, ніж агент зміг їх прочитати. Причину підтвердили через помилки рантайму, які живуть довше;
  - алерт отримав лише черговий: канал — його особистий чат із ботом, PM у ньому немає. Для SEV3 це не важило, але при SEV1 PM дізнався б про збій лише від чергового, а за вимогою PM ([`docs/operations.md`](https://github.com/HryhoriiHaponiukQuitCode/therapy-scheduling-spec/blob/0bedb11/docs/operations.md), розділ 4) алерт проду отримують розробник і PM.
- **Пощастило:** це staging і навмисний дріл. Серед помилок — лише 3 перевірочні запити (інших відвідувань окремо не перевіряли), а PM staging у цей час не відкривав.

## Дії

| Дія | Тип | Власник | Перевірка, якою вона стала | Посилання |
|---|---|---|---|---|
| Тест рендерить `/login` без параметрів і з будь-яким `?error=` | запобігти | розробник | `tests/login-page.test.tsx` у CI (job `app`): на коді `fa5e6d5` 2 з 3 тестів червоні з тим самим `TypeError`, на виправленому 3 з 3 зелені | [PR #73](https://github.com/maryan-qc/therapy-scheduling/pull/73) |
| Область `APP_ENV` — лише Preview, гілка `staging` | виявити | розробник | зроблено у Vercel між 14:15 і 14:28 (знімки в «Хронології»); health preview інших гілок має показувати `appEnv: null`. Перевірку в smoke (гілка `staging` ⇔ `appEnv: staging`, база ≠ прод) — окремим PR | [#71](https://github.com/maryan-qc/therapy-scheduling/issues/71) |
| Червоний smoke preview блокує злиття: статус `smoke` на коміті PR, обов'язковий для `staging` | запобігти | розробник | новий commit status від job `deploy`; ruleset для `staging` | [#72](https://github.com/maryan-qc/therapy-scheduling/issues/72) |
| Перед дрілом чи розбором: `/mcp` → Vercel → `list_teams` показує `mandrushchak-4349s-projects`; розбір — одразу, у межах години; комп'ютер не засинає | зменшити шкоду | черговий розробник | чекліст у [`docs/runbook.md`](../runbook.md), розділ 7 | [PR #73](https://github.com/maryan-qc/therapy-scheduling/pull/73) |
| Заборонити приведення типу `as` для `searchParams` | запобігти | розробник | правило ESLint: `npm run lint` червоний на рядку з `fa5e6d5` | [#76](https://github.com/maryan-qc/therapy-scheduling/issues/76) |
| Перенести алерти в групу Telegram з PM (вимога PM, [`docs/operations.md`](https://github.com/HryhoriiHaponiukQuitCode/therapy-scheduling-spec/blob/0bedb11/docs/operations.md), розділ 4) | зменшити шкоду | розробник; PM — учасник групи | ручний червоний прогін smoke і `/api/ops/error-check` на staging: обидва алерти в групі, PM їх бачить | [#77](https://github.com/maryan-qc/therapy-scheduling/issues/77) |

## Додатки

- Прогноз до поломки, докази й хронологія: [issue #68](https://github.com/maryan-qc/therapy-scheduling/issues/68) і коментарі до нього.
- Рядок помилки smoke: `##[error] "/login": HTTP 500` (прогони 45605627003 і 45606096374).
- Помилка рантайму Vercel: `TypeError: Cannot read properties of undefined (reading 'toLowerCase')`, `count=3`, `routes=/login`, `first=11:34:10Z`, `last=11:37:28Z`.
- Алерти в Telegram — знімки без токена й id чату (у здачі).

## Журнал змін

| Дата | Що змінено | Чому |
|---|---|---|
| 2026-11-25 | Перша версія | дріл; [PR #73](https://github.com/maryan-qc/therapy-scheduling/pull/73) |
| 2026-11-26 | Серйозність — за матрицею PM; у «Впливі», «Виявленні» й «Пощастило» прибрано твердження, яких не перевіряли; доказ часу зміни `APP_ENV` (знімки); у «Діях» — PR #73, окреме issue #76 для `as`, нова дія «алерти в групу з PM» (#77) | [зауваження PM до #73](https://github.com/maryan-qc/therapy-scheduling/pull/73#issuecomment-7174684592), пункти 1–6; PR #78 |
