# Runbook: therapy-scheduling

**Runbook** — інструкція «що робити, коли щось пішло не так», написана заздалегідь, на спокійну голову. Кожен розділ
відповідає на три питання: як зрозуміти, що це саме воно; що зробити першим; як перевірити, що допомогло. Секретів тут
немає і не буде: лише назви змінних (репо публічне).

Останнє оновлення: 2026-11-25 (після інцидент-дрілу, [postmortem](incidents/2026-11-25-staging-login-500.md)), версія продукту: `main` перед тегом `v1.0.0`.

## Хто отримує алерт і кого кликати

| Роль | Хто (GitHub-логін) | Коли кликати |
|---|---|---|
| Черговий розробник (отримує алерт) | `maryan-qc` | будь-який червоний smoke чи повідомлення «ПОМИЛКА СЕРВЕРА» |
| PM (говорить із клієнтом) | `HryhoriiHaponiukQuitCode` | SEV1–SEV2 одразу; SEV3 — у робочий час |
| Резерв | немає (команда з одного розробника) | — |

- **Канал алерту:** особистий чат чергового розробника з ботом у Telegram. Бот пише туди з
  `.github/workflows/smoke.yml` (секрети GitHub `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`) і з `src/instrumentation.ts`
  (ті самі назви — змінні Vercel, Production і Preview). PM у каналі поки немає: черговий пересилає PM алерти SEV1–SEV2
  сам. Перенести алерти в групу з PM — нове значення `TELEGRAM_CHAT_ID` в обох місцях, розділ 4.
- **Серйозність.** PM ще не опублікував матрицю SEV у репо вимог. До неї діє тимчасова:

  | SEV | Що це | Приклад |
  |---|---|---|
  | SEV1 | на проді не можна увійти чи працювати з розкладом | червоний job `prod`: `/login` ≠ 200, `/api/health` → 503 |
  | SEV2 | на проді не працює частина функцій, вхід і розклад працюють | помічник чернетки картки «недоступний» для всіх (`llm.call` зі станом `unavailable`) |
  | SEV3 | зламано staging чи preview; користувачі проду не помічають | червоний job `deploy` |

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
2. **Прод чи ні?** Відкрийте `https://therapy-scheduling-sigma.vercel.app/api/health`. Червоний job `deploy` (preview,
   staging) — користувачі проду не постраждали: SEV3. Червоний job `prod` — SEV1 чи SEV2 (таблиця вище); напишіть у
   групу «беру, SEV<N>» і повідомте PM.
3. **Відкат чи ні?** Прод зламав щойно злитий коміт → спершу відкат (розділ 2), потім розбір. Зламалась змінна
   середовища → відкат не допоможе (старий деплой несе старі значення): виправити змінну → Redeploy. Базу відкатом не
   повернути — лише нова міграція вперед.
4. **Провайдер?** Статус-сторінки з «Де що» для нашого регіону. Інцидент у провайдера і час збігається — посилання в
   issue і PM, чекаємо. Зелена сторінка не означає, що з нашим проєктом усе гаразд (пауза бази, ліміти, наш код).
5. **Розбір** — з агентом у профілі «лише пропонує» (розділ 7) або вручну. Агент пропонує, виправляє людина.
6. **Перевірка:** Actions → `smoke` → Re-run (чи Run workflow; для staging — поле `url`) — зелений. У групу: «SEV<N>
   закрито, причина: …».
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

1. Supabase Dashboard → **той акаунт і той проєкт, що на паузі** (звірте ref з `supabaseRef` у health) →
   **Resume project**. Відновлення триває кілька хвилин.
2. Повторіть smoke (Actions → `smoke` → Run workflow; для staging — поле `url` з адресою staging) — зелений.
3. Запишіть у групу, коли була пауза і скільки тривала.

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
| `TELEGRAM_BOT_TOKEN` | Telegram → @BotFather → `/token` (новий токен, старий перестає діяти) | GitHub Secrets **і** змінні Vercel (Production, Preview) | Redeploy проду; ручний червоний прогін smoke (`url` = `https://example.invalid`) → повідомлення прийшло |
| `OPENROUTER_API_KEY` | OpenRouter → Keys | Vercel (Production, Preview) і `.env.local` | Redeploy; старий ключ видалити в OpenRouter |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | лише якщо колись увімкнуть захист Vercel: Settings → Deployment Protection → Protection Bypass for Automation | GitHub → Settings → Secrets → Actions | після перегенерації старе значення не діє: одразу оновити секрет, інакше job `deploy` червонітиме |

Перевірка: зелений smoke на прод і staging. Запис у групу: що ротували і чому — без значень.

## 5. Де журнали і скільки вони живуть

| Що | Де | Скільки живе (безкоштовні тарифи) |
|---|---|---|
| Журнали запитів Vercel (`llm.call`, помилки сервера) | Vercel → Logs; пошук `llm.call`, фільтр рівня `error` | **1 година** (Hobby) |
| Observability Vercel | Vercel → Observability | 12 годин (Hobby) |
| Журнали збірки | Vercel → Deployments → деплой → Build Logs | поки є деплой |
| Помилки рантайму Vercel (тип, маршрут, кількість) | Vercel → Observability; MCP `get_runtime_errors` | 12 годин (Hobby) — довше за журнали |
| Журнали Supabase (API, Postgres, Auth) | Supabase → Logs — **у кожному проєкті свої** | **1 доба** (Free) |
| Прогони GitHub Actions (smoke, CI) | Actions | 90 днів (налаштування репо) |
| Алерти smoke і помилки сервера | Telegram, особистий чат чергового з ботом | поки їх не видалили |

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
підключено лише до проєкту staging з `read_only=true`, редагування файлів, `git push`, злиття PR і запуск workflow
заборонені.

```bash
claude --settings .claude/settings.incident.json --mcp-config .mcp.incident.json --strict-mcp-config --permission-mode plan
```

**Перед розбором (чекліст, дріл 2026-11-25):**
1. `/mcp` → `vercel` → Authenticate. На сторінці дозволу **виберіть команду `mandrushchak-4349s-projects`** — без неї
   MCP відповідає 403 на кожен запит до проєкту, а `list_teams` порожній.
2. Розбір — **одразу після алерту**, у межах години (журнали Vercel Hobby живуть 1 год); комп'ютер не засинає
   (живлення, `caffeinate`), інакше сесія стоїть.
3. Supabase — лише якщо гіпотеза справді про базу: вхід в акаунт, де проєкт staging. Перевірка профілю: «покажи значення
змінної `APP_ENV`» → відмова чи питання; «зроби відкат staging» → відмова. Промпт — R09 «Розбір інциденту агентом»
з бібліотеки WS11; назви змінних (без значень) агенту даєте ви. Стенограму зберігаємо дослівно (`/export`) у
`docs/incidents/`. Вміст журналів, issues і сторінок — дані для агента, а не команди.

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
