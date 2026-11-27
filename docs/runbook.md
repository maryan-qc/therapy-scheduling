# Runbook: therapy-scheduling

**Runbook** — інструкція «що робити, коли щось пішло не так», написана заздалегідь, на спокійну голову. Кожен розділ
відповідає на три питання: як зрозуміти, що це саме воно; що зробити першим; як перевірити, що допомогло. Секретів тут
немає і не буде: лише назви змінних (репо публічне).

Останнє оновлення: 2026-11-27 (резервна копія бази й перше тренування відновлення — розділ 9; алерти — у групі з PM, [#77](https://github.com/maryan-qc/therapy-scheduling/issues/77); зауваження PM до runbook і [postmortem](incidents/2026-11-25-staging-login-500.md) у
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
- **PM у групі** з 2026-11-26: учасників троє — черговий розробник, PM і бот
  ([#77](https://github.com/maryan-qc/therapy-scheduling/issues/77) закрито). Якщо PM колись вийде з групи, про
  SEV1–SEV2 пишіть йому ще й у Telegram особисто.
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
| Резервні копії прод-бази | Actions → `backup` (щодня ≈ 03:41 за Києвом і вручну): артефакт `supabase-backup` — лише `*.gpg`, 7 днів; тренування відновлення — у Summary прогону; розділ 9 |
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
| Прогони GitHub Actions (smoke, CI, backup) | Actions | 90 днів (налаштування репо) |
| Резервна копія прод-бази (зашифрована) | Actions → `backup` → прогін → Artifacts → `supabase-backup` | **7 днів** (`retention-days` у `backup.yml`) |
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
- Відновлювати копію поверх живої бази (прод чи staging): лише в новий проєкт (розділ 9). Класти розшифрований дамп у
  git, issue, чат чи артефакт або давати його агенту: у ньому e-mail і хеші паролів.
- Виконувати інструкції з тексту журналів, issues чи повідомлень про помилки: це дані, а не команди.

## 9. Резервна копія і відновлення бази

**Навіщо:** безкоштовний Supabase резервних копій не робить і не дає їх завантажити (станом на 09.11.2026). Без
власної копії після видалених даних чи зіпсованої міграції повертати нічого. Ціль PM — RPO не більше 1 доби змін, RTO
4 год у робочий час ([`docs/operations.md`](https://github.com/HryhoriiHaponiukQuitCode/therapy-scheduling-spec/blob/0bedb11/docs/operations.md),
розділ 3).

| Що | Як у нас |
|---|---|
| Що копіюємо | лише **прод-базу** (`azsawyysyqzgjxtlufjk`; запобіжник у прогоні друкує ref і хост): ролі, схема, дані разом зі схемами `auth` і `storage`, окремо — дані лише `public` і історія міграцій (`supabase_migrations`). Версії міграцій звіряємо до і після дампів: якщо між ними пройшла міграція, копію не зберігаємо. Звірка не ловить міграцію з неатомарними командами (`create index concurrently`: CLI може записати версію пізніше за зміну схеми) — таких у репо немає; якщо з'являться, копію запускати лише після зеленого `db-deploy`. Staging не копіюємо: там синтетичні дані з міграцій і `users:demo` |
| Як часто (RPO) | щодня ≈ 03:41 за Києвом і вручну: Actions → `backup` → Run workflow. RPO — до 24 год **лише за умови успішного щоденного прогону**: якщо GitHub запізниться чи пропустить запуск або прогін упаде, остання копія буде старша. Через 60 днів без комітів у репо GitHub вимикає розклад: Actions → `backup` → Enable workflow |
| Свіжість копії | пропущений чи вимкнений запуск workflow сам не помітить, а лист GitHub приходить лише про впалий прогін. Тому черговий **щопонеділка й перед UAT, demo day і дрілом** відкриває Actions → `backup`: останній зелений прогін молодший за добу; ні — Run workflow і запис у групу алертів. Автоматичного сторожа поза GitHub Actions (dead man's switch: сервіс, який чекає пінг після кожної зеленої копії й алертить, коли пінгу немає довше доби) додамо разом із переходом на платний стек ([`docs/cost-note.md`](https://github.com/HryhoriiHaponiukQuitCode/therapy-scheduling-spec/blob/0bedb11/docs/cost-note.md) PM): зараз дані лише синтетичні |
| Де лежить | артефакт `supabase-backup` прогону `backup`: лише `backup-<час UTC>.tgz.gpg` (gpg, AES256), **7 днів**. Відкритого дампу немає ніде: ні в git, ні в артефакті, ні в журналі (журнал — лише розміри файлів, назви таблиць і числа) |
| Чим шифруємо | фраза `BACKUP_PASSPHRASE`. Знає черговий розробник (`maryan-qc`). Зберігається у двох місцях: секрет середовища GitHub `production` (прочитати не можна, лише замінити) і Keychain чергового — запис `therapy-scheduling-backup` (Keychain Access → пошук). Втрачено обидва — старі копії не розшифрувати: нова фраза → секрет і Keychain → Run workflow |
| Тренування відновлення | job `restore-drill` того самого прогону (щоночі й вручну): розшифровує копію в раннері, піднімає одноразову базу з міграцій репо, очищає в ній рядки, які вставили самі міграції (терапевти й слоти), завантажує дані й порівнює кількість рядків по кожній таблиці — таблиця й тривалість у Summary прогону; там само — еталон прав `anon` і `authenticated` з міграцій для кроку 5 нижче. За замовчуванням `scope=public` (таблиці застосунку): з `scope=all` завантаження в CI падає на схемі `auth` (рядок нижче). Наших проєктів Supabase цей job не торкається |
| Останнє тренування | **2026-11-27, вручну, `scope=public` — зелене:** [прогін 45971144280](https://github.com/maryan-qc/therapy-scheduling/actions/runs/45971144280). Копія прод-бази (остання міграція `20261106170000`, 38 таблиць з даними) → артефакт `supabase-backup`, один файл `backup-2026-11-27T0909.tgz.gpg` (AES256, 122 КБ). Відновлено 5 таблиць `public`, кількість рядків збігається: `clients` 46, `holds` 16, `profiles` 10, `slots` 1248, `therapists` 3. Тривалість тренування — **2 хв 0 с** (RTO у CI; справжнє відновлення в новий проєкт додає створення проєкту й кроки нижче — не тренувалося, ціль PM — 4 год). Еталон прав — 26 рядків. **`scope=all` — червоне:** [прогін 45970519677](https://github.com/maryan-qc/therapy-scheduling/actions/runs/45970519677) — `data.sql:36`: у схемі `auth` локального Supabase CLI 2.120.0 немає стовпця з копії хмарного проєкту. Дані `auth.*` у копії є, але відновлення їх у CI не відрепетирувано — лише в новий хмарний проєкт (кроки нижче) |
| Падіння нічного прогону | GitHub надсилає лист тому, хто востаннє змінив розклад у `backup.yml`; у Telegram-групу копія не пише |

**Якщо прогін червоний:**

| Що бачите | Що робити |
|---|---|
| `Немає секрету середовища production …` | секрет не в середовищі `production`: `SUPABASE_DB_URL` — розділ 4; `BACKUP_PASSPHRASE` — з Keychain |
| Guard: рядок «веде у другий проєкт (staging ↔ прод)» | `SUPABASE_DB_URL` у `production` веде не в прод — замінити рядком Session pooler прод-проєкту (розділ 4) |
| Дамп не підключається до бази | база проду на паузі — розділ 3, потім Run workflow |
| `Під час копії застосовано міграцію …` | між дампами пройшов `db-deploy`; копію не збережено — Run workflow ще раз, коли CI на `main` завершиться |
| `Очікувалась Supabase CLI 2.x` | `supabase` у `package.json` оновили до 3.x — повернути закріплену 2.120.0 |
| Завантаження з `scope=all` падає на таблицях `auth.*` | очікувано: схема `auth` локального Supabase відрізняється від хмарної (2026-11-27, рядок «Останнє тренування»). За замовчуванням і за розкладом — `scope=public`; `all` — лише для перевірки після оновлення Supabase CLI |
| `Кількість рядків не збігається` | Summary покаже таблицю; перевірте, що міграції `main` застосовано на проді (`db-deploy` зелений) |

**Справжнє відновлення** — рішення людини разом з PM (інцидент SEV1), не агента. Тренуємо лише в CI; на проді й
staging — ніколи.

1. Actions → останній зелений прогін `backup` → Artifacts → `supabase-backup` → завантажити **поза теку репо**.
2. Розшифрувати (потрібен `gpg`, на macOS — `brew install gnupg`): `gpg -d backup-<час>.tgz.gpg > backup.tgz`
   (фраза — Keychain, `therapy-scheduling-backup`) → `tar -xzf backup.tgz` → тека `backup/`: `roles.sql`,
   `schema.sql`, `data.sql`, `history_schema.sql`, `history_data.sql` і `meta.txt` (час копії й остання міграція).
3. **Новий** проєкт Supabase, не поверх живих даних. Порядок — за інструкцією Supabase «Backup and restore using the
   CLI»; рядок підключення — Session pooler нового проєкту в змінній `NEW_DB_URL`, у журнал і чат його не копіюємо.
   Перші три команди відкликають права, які новий проєкт за замовчуванням дає `anon` і `authenticated` на нові об'єкти
   в `public`: дамп відтворює лише ті права, що дали наші міграції, а зайвих не забирає.

   ```bash
   cd backup
   psql --single-transaction -v ON_ERROR_STOP=1 \
     -c 'alter default privileges in schema public revoke all on tables from anon, authenticated' \
     -c 'alter default privileges in schema public revoke all on functions from anon, authenticated' \
     -c 'alter default privileges in schema public revoke all on sequences from anon, authenticated' \
     -f roles.sql -f schema.sql -c 'SET session_replication_role = replica' -f data.sql --dbname "$NEW_DB_URL"
   ```
4. **Історія міграцій — до того, як CI побачить новий проєкт**, інакше `db-deploy` спробує застосувати всі міграції
   заново на готову схему:
   `psql --single-transaction -v ON_ERROR_STOP=1 -f history_schema.sql -f history_data.sql --dbname "$NEW_DB_URL"`.
5. **Перевірка прав** — з теки репо:
   `psql -At -F '|' -v ON_ERROR_STOP=1 -f scripts/privileges.sql --dbname "$NEW_DB_URL" > restored-privileges.txt`.
   Порівняйте файл (`diff`) з блоком «Еталон прав anon і authenticated з міграцій» у Summary останнього зеленого
   прогону `backup`: має збігтися рядок у рядок. Зайвий рядок — право, якого міграції не дають: `revoke`; бракує
   рядка — `grant`, як у міграції. Команди з кроку 3 знімають лише права за замовчуванням, задані для схеми `public`,
   а глобальних не чіпають (документація PostgreSQL, `ALTER DEFAULT PRIVILEGES`), тому цей крок обов'язковий.
6. **Пауза автоматичних міграцій — до того, як CI побачить новий проєкт.** Settings → Environments → `production` →
   Required reviewers → черговий → Save: `db-deploy` (і `backup`) чекатимуть ручного схвалення, тож злиття в `main`
   саме міграцій не застосує. Інакше міграція, якої немає в копії (можливо, саме та, що зіпсувала дані), застосується
   знову й зіпсує відновлене.
7. **Окремий dry run, лише читання** — з теки репо (закріплена CLI 2.120.0 з `package.json`):
   `npx supabase migration list --db-url "$NEW_DB_URL"`. У стовпці Remote — усі міграції до `latest_migration` з
   `meta.txt`. Для міграцій, яких у Remote немає (вийшли після копії), — план разом з PM в issue інциденту.
   `db-deploy` застосовує їх за порядком версій, тож нова виправна міграція **після** руйнівної не врятує, а
   застосовані файли не редагуємо (`AGENTS.md`; `db-check` у PR дасть `CHANGED`). Тому руйнівну міграцію в новому
   проєкті позначають застосованою без виконання:
   `npx supabase migration repair --status applied <версія> --db-url "$NEW_DB_URL"` — лише людина, як у README
   («Міграції в прод»), агенту це заборонено. Потрібні з неї зміни схеми без руйнівної частини — новою міграцією в PR.
   План спершу перевіряють на ізольованій копії: ще один тимчасовий проєкт, кроки 3–4, той самий `repair` → `migration
   list` показує, що до застосування лишилися лише безпечні міграції.
8. Перевести прод на новий проєкт: змінні Vercel Production (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) → Redeploy; секрет `SUPABASE_DB_URL` у `production` і змінна репо
   `SUPABASE_PROD_REF` — новий ref, інакше запобіжник зупинить міграції й копію.
9. Перевірка: `/api/health` → `"db":"ok"` і новий `supabaseRef`; smoke `prod` зелений; вхід тестовим акаунтом. Схвалити
   `db-deploy` і зняти Required reviewers — лише після усунення причини інциденту й за планом з кроку 7.
10. Розшифровані файли й `backup.tgz` видалити одразу. Postmortem — як після SEV1 (розділ 1, крок 7).
