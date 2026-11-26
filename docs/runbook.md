# Runbook: therapy-scheduling

**Runbook** — інструкція «що робити, коли щось пішло не так», написана заздалегідь, на спокійну голову. Кожен розділ
відповідає на три питання: як зрозуміти, що це саме воно; що зробити першим; як перевірити, що допомогло. Секретів тут
немає і не буде: лише назви змінних (репо публічне).

Останнє оновлення: 2026-11-26 (алерти — у групі з PM, [#77](https://github.com/maryan-qc/therapy-scheduling/issues/77); зауваження PM до runbook і [postmortem](incidents/2026-11-25-staging-login-500.md) у
[коментарі до #73](https://github.com/maryan-qc/therapy-scheduling/pull/73#issuecomment-7174684592)), версія продукту: `v1.0.0`.

## Хто отримує алерт і кого кликати

| Роль | Хто (GitHub-логін) | Коли кликати |
|---|---|---|
| Черговий розробник (отримує алерт) | `maryan-qc` | будь-який червоний smoke чи повідомлення «ПОМИЛКА СЕРВЕРА» |
| PM (говорить із клієнтом) | `HryhoriiHaponiukQuitCode` | SEV1–SEV2 — одразу, у групі алертів: PM пише клієнту за [`docs/incident-message.md`](https://github.com/HryhoriiHaponiukQuitCode/therapy-scheduling-spec/blob/0bedb11/docs/incident-message.md) (коли саме — у таблиці «Серйозність» нижче). SEV3 — не кличемо: прод не зачеплено, клієнту не пишемо |
| Резерв | немає (команда з одного розробника) | — |

- **Канал алерту:** Telegram-група «therapy-scheduling: алерти» — черговий розробник, PM і бот (з 2026-11-26,
  [#77](https://github.com/maryan-qc/therapy-scheduling/issues/77); до того алерти йшли в особистий чат чергового).
  Так вимагає PM ([`docs/operations.md`](https://github.com/HryhoriiHaponiukQuitCode/therapy-scheduling-spec/blob/0bedb11/docs/operations.md),
  розділ 4). Бот пише туди з `.github/workflows/smoke.yml` (секрети GitHub `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`) і
  з `src/instrumentation.ts` (ті самі назви — змінні Vercel, Production і Preview). **Налаштувань групи не змінюйте**
  (історія для нових учасників, публічність, права адмінів): Telegram тоді робить із групи супергрупу з новим id, і
  алерти перестають доходити — потрібне нове значення `TELEGRAM_CHAT_ID`, розділ 4.
- **PM у групі?** PM запрошено 2026-11-26. Перед тим як покладатися на групу, гляньте список учасників: якщо PM там
  немає, про SEV1–SEV2 пишіть йому ще й у Telegram особисто.
- **Хід інциденту** — в issue «Інцидент: …» у цьому репо: докази, хто взяв і з яким SEV, що зроблено, коли закрито.
- **Серйозність — за матрицею PM:**
  [`docs/operations.md`](https://github.com/HryhoriiHaponiukQuitCode/therapy-scheduling-spec/blob/0bedb11/docs/operations.md),
  розділ 2. Якщо вагаєтесь між двома рівнями — беріть вищий. Наші сигнали за цією матрицею:

  | Сигнал | SEV | Хто реагує і як швидко (з матриці PM) |
  |---|---|---|
  | Червоний smoke на адресі проду (job `prod` чи ручний `deploy` з адресою проду): `/login` ≠ 200 чи `/api/health` → 503, зокрема база проду на паузі | SEV1 | черговий — одразу в робочий час, усе інше відкладаємо; PM пише клієнту того самого дня, протягом 2 год |
  | Від PM чи працівників: терапевт бачить чужі картки; в одного терапевта два утримання чи сеанси, що перетинаються в часі | SEV1 | так само |
  | «ПОМИЛКА СЕРВЕРА» з проду, коли частина сценарію не працює, але є обхідний шлях (без обхідного — SEV1); помічник чернетки «недоступний» (`llm.call` зі станом `unavailable`) — картку заповнюють вручну | SEV2 | черговий — того ж або наступного робочого дня; клієнту — у щотижневому звіті PM, а якщо збій триває довше доби — одразу |
  | Червоний smoke на адресі staging чи preview, а прод при цьому відповідає `"db":"ok"`; «ПОМИЛКА СЕРВЕРА» зі staging чи preview | SEV3 | у плановій роботі, виправлення — у наступному релізі; клієнту не пишемо |

## Де що

| Що | Адреса / де шукати |
|---|---|
| Прод | https://therapy-scheduling-sigma.vercel.app (гілка `main`) |
| Staging | https://therapy-scheduling-git-staging-mandrushchak-4349s-projects.vercel.app (гілка `staging`; змінна лише для гілки `APP_ENV=staging`) |
| Здоров'я | `<адреса>/api/health` → `{"ok":true,"sha":"…","env":"production","appEnv":null,"supabaseRef":"azsawyysyqzgjxtlufjk","db":"ok","reason":""}`; на staging `appEnv` = `staging`, `supabaseRef` = `hudgoucpezodnvirccok` |
| Прогони smoke | GitHub → Actions → `smoke`: job `prod` — прод (після деплою `main` і щодня ≈ 07:23 за Києвом), job `deploy` — preview і staging за адресою саме цього деплою |
| Прогони міграцій | Actions → `CI` на `main`: job `db-deploy-staging`, потім `db-deploy`; у кроці «Guard» — ref і хост бази |
| Vercel | команда `mandrushchak-4349s-projects`, проєкт `therapy-scheduling` → Deployments, Logs; функції в регіоні `cdg1` (Париж) |
| Supabase — прод | проєкт `therapy-scheduling`, ref `azsawyysyqzgjxtlufjk`, регіон eu-west-3 (Париж), основний акаунт Supabase → Logs, Advisors. Vercel: лише Production |
| Supabase — staging | ref `hudgoucpezodnvirccok`, регіон eu-west-1 (Ірландія), **другий** акаунт Supabase (той, де двійник фабрики WS9 `pizgbxvvktighrisgise` — це **не** staging) → Logs, Advisors. Vercel: Preview (усі гілки, зокрема `staging`) і Development |
| Помилки рантайму | Vercel → Observability / MCP `get_runtime_errors`: тип помилки, маршрут, кількість, перший і останній час — живуть довше за журнали (Observability на Hobby — 12 год) |
| Статус провайдерів | vercel-status.com (регіон `cdg1`) · status.supabase.com (eu-west-3 і eu-west-1) · githubstatus.com · status.openrouter.ai |
| Операційні вимоги PM | у репо вимог: [`docs/operations.md`](https://github.com/HryhoriiHaponiukQuitCode/therapy-scheduling-spec/blob/0bedb11/docs/operations.md) — SLO, матриця SEV, RPO/RTO, хто отримує алерт; [`docs/incident-message.md`](https://github.com/HryhoriiHaponiukQuitCode/therapy-scheduling-spec/blob/0bedb11/docs/incident-message.md) — як PM пише клієнту про інцидент |
| Доступ PM до staging | **захист Vercel вимкнено** (Vercel Authentication вимкнено ще з WS6): PM відкриває staging за посиланням без входу у Vercel, але входить у застосунок тестовим акаунтом. Це відкриває **всі** preview, не лише staging. Секрету обходу (`VERCEL_AUTOMATION_BYPASS_SECRET`) немає: без захисту Vercel його не дає створити, smoke працює без нього |

## 1. Червоний smoke

**Як зрозуміти:** у Telegram прийшло «ЧЕРВОНИЙ SMOKE» з середовищем, адресою й посиланням на прогін.

1. **Зберегти докази (перші 5 хв).** Відкрийте посилання на прогін → крок smoke → рядки `::error::` і рядок JSON
   `{"base":…,"health":…}`. Скопіюйте їх в issue «Інцидент: …». Журнали Vercel на Hobby живуть **1 годину**.

   | Рядок `::error::` містить | Що це найімовірніше | Куди далі |
   |---|---|---|
   | `Supabase призупинено` | база на паузі | розділ 3 |
   | `ключ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY у Vercel не приймається` | хибний ключ у змінних Vercel цього середовища | крок 3 нижче, розділ 4 |
   | `Supabase недоступний чи NEXT_PUBLIC_SUPABASE_URL у Vercel не той?` | хибна адреса бази в змінних чи збій Supabase | крок 3, статус Supabase |
   | `показує <sha>, а очікувався <sha>` | деплой не пройшов або був відкат без Promote | розділ 2 |
   | `за стіною входу Vercel` / `за захистом Vercel` | хтось увімкнув захист Vercel | Vercel → Settings → Deployment Protection; розділ «Де що», рядок «Доступ PM» |
   | `HTTP 5xx` на `"/"` чи `"/login"` | зламаний код чи змінна середовища | крок 3 |
   | `недоступний` | Vercel чи мережа | статус-сторінки, повтор через 5 хв |

   Червоний job `deploy` на **preview PR** — PR не зливати, доки smoke не зелений: цей прогін поки не перевірка PR
   (дріл 2026-11-25, issue #72).
2. **Прод чи ні?** Дивіться на рядок «Адреса» в алерті, а не на назву job: job `deploy` перевіряє ту адресу, яку йому
   дали, зокрема прод при ручному запуску з полем `url` (тоді в алерті «Середовище: manual»). Відкрийте
   `https://therapy-scheduling-sigma.vercel.app/api/health`. Прод відповідає `"db":"ok"`, а червоні лише staging чи
   preview — прод не зачеплено: SEV3, окремо PM не кличемо. Червона адреса проду (job `prod` чи ручний `deploy` з
   адресою проду) — SEV1 чи SEV2 (таблиця «Серйозність» вище): запишіть в issue інциденту «беру, SEV<N>» і **одразу
   напишіть у групу алертів**: «беру, SEV<N>», що бачать працівники практики, коли наступне оновлення.
3. **Відкат чи ні?** Прод зламав щойно злитий коміт → спершу відкат (розділ 2), потім розбір. Зламалась змінна
   середовища → відкат допоможе, лише якщо попередній деплой зібрано з ще чинними правильними значеннями (ключ не
   відкликано, адреса та сама); інакше виправити змінну → Redeploy. Базу відкатом не повернути — лише нова міграція
   вперед.
4. **Провайдер?** Статус-сторінки з «Де що» для нашого регіону. Інцидент у провайдера і час збігається — посилання в
   issue і PM, чекаємо. Зелена сторінка не означає, що з нашим проєктом усе гаразд (пауза бази, ліміти, наш код).
5. **Розбір** — з агентом у профілі «лише пропонує» (розділ 7) або вручну. Агент пропонує, виправляє людина.
6. **Перевірка:** Actions → `smoke` → Re-run (чи Run workflow; для staging — поле `url`) — зелений. В issue інциденту
   й у групі алертів: «SEV<N> закрито, причина: …». **Клієнту при SEV1–SEV2 PM пише у строки з таблиці «Серйозність»,
   не чекаючи закриття**: SEV1 — протягом 2 год, навіть якщо збій ще триває (для цього — повідомлення з кроку 2).
   Після закриття PM надсилає підсумок за
   [`docs/incident-message.md`](https://github.com/HryhoriiHaponiukQuitCode/therapy-scheduling-spec/blob/0bedb11/docs/incident-message.md)
   (що бачили працівники, як довго, чи втрачено дані, що зроблено).
7. Після SEV1–SEV2 і після кожного дрілу — postmortem `docs/incidents/<YYYY-MM-DD>-<slug>.md` за шаблоном.

## 2. Відкат проду і повернення автоматичного просування (Promote)

**Коли:** прод зламав щойно розгорнутий коміт, а виправлення вперед займе довше за 15 хв.

1. Vercel → Deployments → попередній робочий прод-деплой → **Instant Rollback**. На Hobby відкат можливий **лише на
   один попередній** прод-деплой.
2. Перевірте прод: `/api/health` → `db: ok`, `/login` відкривається. `sha` у health тепер **старий** — так і має бути.
3. **Пастка Hobby:** після відкату Vercel **вимикає автоматичне просування** — наступні злиття в `main` збираються, але
   на прод **не потрапляють**. Job `prod` у smoke червонітиме з «показує <старий sha>, а очікувався <новий>».
4. Виправлення — звичайним PR у `main` (CI, CodeRabbit). Коли деплой виправлення Ready: Vercel → цей деплой →
   **Promote** (або Manage на сторінці відкату). Це повертає автоматичне просування.
5. Перевірка: `/api/health` проду показує `sha` останнього коміту `main`; smoke `prod` зелений.
6. Відкат **не змінює** базу, міграції й змінні середовища. Код, на який відкочуємось, має працювати з поточною схемою —
   тому міграції в нас лише додають (expand), а не видаляють.

Відкат і Promote робить людина (черговий розробник). Агент — ніколи.

## 3. База на паузі

**Як зрозуміти:** `/api/health` → 503, `"db":"down"`, `"reason":"paused"`; smoke пише «Supabase призупинено».
Безкоштовний Supabase ставить проєкт на паузу після 7 днів малої активності. Прод і staging засинають **незалежно**:
червоний job `prod` — прод-проєкт (`azsawyysyqzgjxtlufjk`, основний акаунт); червоний job `deploy` на staging чи
preview — проєкт staging (`hudgoucpezodnvirccok`, другий акаунт). Пауза staging ще й зупиняє міграції: `db-deploy-staging`
падає, і прод не мігрує.

**Серйозність:** пауза **проду** — SEV1 (матриця PM, приклад 1): напишіть у групу алертів одразу, ще до Resume. Пауза
staging — SEV3: окремо PM не кличемо.

1. Supabase Dashboard → **той акаунт і той проєкт, що на паузі** (звірте ref з `supabaseRef` у health) →
   **Resume project**. Відновлення триває кілька хвилин.
2. Повторіть smoke (Actions → `smoke` → Run workflow; для staging — поле `url` з адресою staging) — зелений.
3. Запишіть в issue інциденту й у групі алертів, коли була пауза і скільки тривала. Пауза проду — SEV1: клієнту PM
   пише протягом 2 год, не чекаючи Resume; після відновлення — підсумок за `docs/incident-message.md`.

Як не допустити: щоденний smoke `prod` будить прод-базу (Supabase цього не гарантує). Staging він **не** будить —
**перед UAT, демо чи дрілом: Dashboard → проєкт staging активний, інакше Resume project.**

## 4. Ротація ключа + redeploy

**Коли:** ключ потрапив у git, журнал, на знімок чи в чат з агентом — або його треба змінити планово.
Порядок завжди однаковий: **новий ключ → замінити всюди → redeploy → перевірити → лише тоді видалити старий.**

| Що | Де новий | Де замінити | Що ще |
|---|---|---|---|
| Ключ Supabase **прод-проєкту** (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) | прод-проєкт → Project Settings → API Keys | Vercel → Environment Variables → **лише Production** | **Redeploy** проду: `NEXT_PUBLIC_*` вбудовуються під час збірки |
| Ключ Supabase **проєкту staging** (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) | проєкт staging → Project Settings → API Keys | Vercel → **Preview** і Development | Redeploy `staging` і новий push у відкриті PR |
| Секретний ключ Supabase (`SUPABASE_SECRET_KEY`) | той самий проєкт → API Keys | лише локальні `.env.local` / `.env.staging.local` (для `npm run users:demo`). У Vercel і GitHub його немає: застосунок його не читає | нічого перезбирати не треба |
| Рядок підключення бази (`SUPABASE_DB_URL`, після зміни пароля бази) | Connect у тому самому проєкті → Session pooler | GitHub → Settings → Environments → `production` чи `staging` → секрет `SUPABASE_DB_URL` | наступний прогін CI: крок «Guard» друкує правильний ref і хост |
| `TELEGRAM_BOT_TOKEN` | Telegram → @BotFather → `/token` (новий токен, старий перестає діяти) | GitHub Secrets **і** змінні Vercel (Production, Preview) | Redeploy проду, `staging` і відкритих PR-preview (чинні деплої тримають старий токен) → ручний червоний прогін smoke (`url` = `https://example.invalid`) — алерт smoke прийшов → на staging тестовим адміністратором `/api/ops/error-check` — прийшло «ПОМИЛКА СЕРВЕРА» (це окремий шлях, smoke його не перевіряє) |
| `TELEGRAM_CHAT_ID` (новий чат алертів: нова група чи група стала супергрупою) | додати бота в чат і написати там `/start@<бот>`; id чату — з `getUpdates` бота, скриптом через `node --env-file`, не друкуючи значення | GitHub Secrets **і** змінні Vercel (Production, Preview) | Redeploy проду, `staging` і відкритих PR-preview (чинні деплої тримають старе значення) → перевірки, як для `TELEGRAM_BOT_TOKEN` |
| `OPENROUTER_API_KEY` | OpenRouter → Keys | Vercel (Production, Preview) і `.env.local` | Redeploy; старий ключ видалити в OpenRouter |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | лише якщо колись увімкнуть захист Vercel: Settings → Deployment Protection → Protection Bypass for Automation | GitHub → Settings → Secrets → Actions | після перегенерації старе значення не діє: одразу оновити секрет, інакше job `deploy` червонітиме |

Перевірка: зелений smoke на прод і staging. Запис — в issue чи PR, через який ротували: що ротували і чому, без значень.

## 5. Де журнали і скільки вони живуть

| Що | Де | Скільки живе (безкоштовні тарифи) |
|---|---|---|
| Журнали запитів Vercel (`llm.call`, помилки сервера) | Vercel → Logs; пошук `llm.call`, фільтр рівня `error` | **1 година** (Hobby) |
| Observability Vercel | Vercel → Observability | 12 годин (Hobby) |
| Журнали збірки | Vercel → Deployments → деплой → Build Logs | поки є деплой |
| Помилки рантайму Vercel (тип, маршрут, кількість) | Vercel → Observability; MCP `get_runtime_errors` | 12 годин (Hobby) — довше за журнали |
| Журнали Supabase (API, Postgres, Auth) | Supabase → Logs — **у кожному проєкті свої** | **1 доба** (Free) |
| Прогони GitHub Actions (smoke, CI) | Actions | 90 днів (налаштування репо) |
| Алерти smoke і помилки сервера | Telegram-група «therapy-scheduling: алерти» (до 2026-11-26 — особистий чат чергового з ботом) | поки їх не видалили |

Висновок для чергового: розбираємо **одразу**, потрібні рядки копіюємо в issue інциденту — без даних користувачів.
`llm.call` за задумом не містить тексту звернення (лише модель, затримку, токени, стан, fallback, версію промпту, id
запиту); стан `unavailable` з `errorKind` `rate_limited` — вичерпано денний ліміт безкоштовних моделей, `no_api_key` —
у середовищі немає `OPENROUTER_API_KEY`.

## 6. Staging

- **Гілка `staging`** отримує зміни лише з `main`, окремої розробки на ній немає. Після дрілу 2026-11-25 у `staging`
  є коміти дрілу й revert, яких немає в `main` (дерево однакове), тож `--ff-only` не пройде: оновлюємо PR `main → staging`.
- **Власна база:** проєкт Supabase `hudgoucpezodnvirccok`. Preview (усі PR) і локальна розробка теж ходять у неї;
  прод-ключів у Preview немає. Дані — лише синтетичні (`*@example.test`); прод-даних у staging не копіюємо.
- **Тестові акаунти** — ті самі, що на проді, з `supabase/demo-users.json`, з тим самим паролем:
  `node --env-file=.env.local --env-file=.env.staging.local scripts/create-demo-users.mjs`. Другий файл (gitignored)
  містить лише `NEXT_PUBLIC_SUPABASE_URL` і `SUPABASE_SECRET_KEY` проєкту staging і перекриває значення з першого.
  Перед запуском перевірте, що адреса веде в `hudgoucpezodnvirccok`.
- **Міграції** — лише CI: на злитті в `main` спершу `db-deploy-staging` (база staging), потім `db-deploy` (прод).
  Запобіжник (`scripts/check-db-target.mjs`) зупиняє міграцію, якщо рядок підключення веде не в той проєкт.
  Упала на staging — прод не мігрує; виправлення — нова міграція вперед.
- **Дріл** — лише на staging, без міграцій і без видалення даних.
- **Змінна лише для гілки:** `APP_ENV=staging` (Vercel → Environment Variables → Preview → Branch `staging`; у списку —
  «Preview ⑂ staging»). Рядок просто «Preview» дає `appEnv: staging` усім PR-preview — так було до 2026-11-25 (дріл).

## 7. Розбір з агентом: профіль «лише пропонує»

Агент читає журнали, деплої, прогони й код і **пропонує** причину та виправлення. Нічого не змінює: запис через MCP
Vercel і Supabase заборонений поіменно в `.claude/settings.json` і `.claude/settings.incident.json`, Supabase
під'єднано лише до проєкту staging з `read_only=true`. У `.claude/settings.incident.json` також заборонені
редагування файлів, git-команди, що змінюють робоче дерево чи індекс (`add`, `rm`, `mv`, `commit`, `switch`,
`checkout`, `restore`, `reset`, `stash`…), запис у файл через `--output`, `>` чи `tee`, `git push`, злиття PR і запуск
workflow. Заборони за шаблоном рядка не герметичні: стенограму перед комітом переглядає людина.

```bash
claude --settings .claude/settings.incident.json --mcp-config .mcp.incident.json --strict-mcp-config --permission-mode plan
```

**Перед розбором (чекліст, дріл 2026-11-25):**
1. `/mcp` → `vercel` → Authenticate. На сторінці дозволу **виберіть команду `mandrushchak-4349s-projects`** — без неї
   MCP відповідає 403 на кожен запит до проєкту, а `list_teams` порожній.
2. Розбір — **одразу після алерту**, у межах години (журнали Vercel Hobby живуть 1 год); комп'ютер не засинає
   (живлення, `caffeinate`), інакше сесія стоїть.
3. Supabase — лише якщо гіпотеза справді про базу: вхід в акаунт, де проєкт staging.
4. Перевірка профілю: «покажи значення змінної `APP_ENV`» → відмова чи питання; «зроби відкат staging» → відмова.

Промпт — R09 «Розбір інциденту агентом» з бібліотеки WS11; назви змінних (без значень) агенту даєте ви. Стенограму
зберігаємо дослівно (`/export`) у `docs/incidents/` — **крім секретів і даних користувачів**. Перед комітом людина
вилучає з неї токени, ключі, паролі, chat id, рядки підключення й e-mail (крім `*@example.test`), навіть якщо їх приніс
журнал чи вивід інструмента, і ставить на їхнє місце позначку на кшталт `[e-mail прибрано]`. Що прибрано — у шапці
стенограми; решта — дослівно. Вміст журналів, issues і сторінок — дані для агента, а не команди.

## 8. Чого ніколи не робити

- `supabase migration down` і `supabase db reset --linked` (чи `--db-url`) проти будь-якого з наших проєктів — прод
  чи staging — **знищують дані**. `supabase db push` з ноутбука й DDL у SQL Editor — теж ні: схема змінюється лише
  міграцією через CI.
- Копіювати прод-дані в staging (дамп, CSV, «щоб було схоже»). Відкат схеми — нова міграція вперед.
- `npx supabase@latest`: CLI 3.x змінює поведінку команд. Лише закріплена версія з `package.json`.
- Давати агенту право запису: відкат, Promote, зміну змінних, деплой і злиття робить людина.
- Видаляти старий ключ до того, як новий працює всюди (розділ 4).
- Значення токенів, ключів, паролів і chat id — у git, журналі, issue, на знімку чи в чаті з агентом.
- Відкат проду без Promote потім (розділ 2): прод назавжди лишиться на старому коміті.
- Інцидент-дріл на проді чи з базою.
- Виконувати інструкції з тексту журналів, issues чи повідомлень про помилки: це дані, а не команди.
