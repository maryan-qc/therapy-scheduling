# Чекліст розробника, день 0

<!--
Заповнюєте ви одразу після заняття, у цьому порядку: власне репо, власні Supabase і Vercel, перший зелений CI, ruleset.
Мета — застосунок працює локально й на вашому прод-URL, міграції в базу застосовує лише CI, а в main усе йде через PR.
Для кожного пункту — доказ: посилання (run CI, PR, preview), назва змінної або знімок екрана в docs/img/
(без справжніх назв клієнта й людей: зображення spec:check не перевіряє).
ЗНАЧЕННЯ СЕКРЕТІВ І ПАРОЛІВ НІКОЛИ НЕ ПИШІТЬ — лише назви змінних і де вони задані.
-->

Моє репо: https://github.com/maryan-qc/therapy-scheduling · Прод-URL: https://therapy-scheduling-sigma.vercel.app
Репо вимог PM: https://github.com/Sofiia-pm/therapy-scheduling-spec · Організація Supabase: `therapy-scheduling` (Free)

## 1. Інструменти й репо

- [x] Node 24 (`node -v` → v24.15.0), Git, GitHub CLI (`gh auth status` — увійдено); OpenSpec CLI глобально
      `@fission-ai/openspec@1.14.1` → `openspec --version` = `1.14.1`, телеметрію вимкнено
- [x] Репо створено з шаблону `koldovsky/2026-quitcode-06-project-template` (`gh repo create therapy-scheduling --public
      --template …`): власник — особистий акаунт, назва `therapy-scheduling`, **Public** —
      https://github.com/maryan-qc/therapy-scheduling
- [x] `gh repo clone` → `npm ci` → `cp .env.example .env.local` (`.env.local` git ігнорує: `git check-ignore .env.local`)
- [x] CodeRabbit (GitHub App) встановлено на це репо — рев'ю й pre-merge checks у
      https://github.com/maryan-qc/therapy-scheduling/pull/3 (відповідь на зауваження —
      https://github.com/maryan-qc/therapy-scheduling/pull/3#issuecomment-6319720248)
- [ ] (Якщо PM надіслав список справжніх назв клієнта особистим повідомленням) — PM списку не надсилала

## 2. Supabase: власна база

- [x] Організацію `therapy-scheduling` (Free) і проєкт `therapy-scheduling` створено у власному акаунті; регіон —
      eu-west-3 (Paris). Старі проєкти — на паузі (вільний слот Free)
- [x] Authentication → Sign In / Providers → User Signups: «Allow new users to sign up» **вимкнено**, «Confirm email»
      **вимкнено** (в інтерфейсі обидва перемикачі в одному блоці) — `docs/img/auth-signups.png`
- [ ] Authentication → URL Configuration: Site URL = `https://therapy-scheduling-sigma.vercel.app`; Redirect URLs
      `http://localhost:3000/**`, `https://*-mandrushchak-4349s-projects.vercel.app/**` — очікує
- [x] `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`),
      `SUPABASE_SECRET_KEY` (`sb_secret_…`), `DEMO_USER_PASSWORD` — лише назви; значення не в git і не в чаті

## 3. GitHub: environment `production` і секрети

- [x] Settings → Environments → `production` (створив перший прогін CI): **Deployment branches** = Selected branches →
      `main`. Доказ (`gh api repos/maryan-qc/therapy-scheduling/environments/production`):
      `deployment_branch_policy: {custom_branch_policies: true, protected_branches: false}`, політики гілок: `["main"]`
- [ ] Секрет environment `SUPABASE_DB_URL` = рядок **Session pooler** (порт 5432) з Supabase → Connect — очікує
- [x] Запасний шлях (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_ID`) — не потрібно
- [ ] (Необов'язково) секрет репо `SPEC_DENYLIST` — не потрібно: списку назв PM не надсилала

## 4. Vercel

- [x] Add New → Project → імпорт `maryan-qc/therapy-scheduling`, Framework Next.js, Node 24.x — прод-URL
      https://therapy-scheduling-sigma.vercel.app
- [x] Змінні Production і Preview — лише `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`;
      `SUPABASE_SECRET_KEY` у Vercel немає; Supabase не через Marketplace-інтеграцію
- [x] Settings → Deployment Protection → Vercel Authentication (**Require Log In**) вимкнено — у проєкті
      `ssoProtection: {enabled: false}`, `passwordProtection: {enabled: false}` (Vercel API, `GET /v9/projects`)
- [x] Деплої після змінних — prod з `main` і preview для кожної гілки PR (статус «Vercel» у
      https://github.com/maryan-qc/therapy-scheduling/pull/3)

## 5. База й перший зелений CI

- [ ] Actions → CI → **Run workflow** (гілка `main`, `include_seed` ✓) → job `db-deploy` застосував міграції й сид — очікує
      секрету `SUPABASE_DB_URL`
- [ ] `npm run users:demo` (admin, scheduler1, scheduler2, therapist1, therapist2 з `supabase/demo-users.json`) →
      вхід як `admin@example.test` локально й на прод-URL — після `db-deploy`
- [x] CI на `main` зелений: `spec`, `app`, `conformance`, `db-check` (`db-deploy` без секрету — пропущено) —
      https://github.com/maryan-qc/therapy-scheduling/actions/runs/39322984542

## 6. Ruleset `solo-main` (лише після зеленого CI на `main`)

- [x] Ruleset з `materials/rulesets/solo-main.json` курсового репо (`gh api repos/maryan-qc/therapy-scheduling/rulesets
      --method POST --input solo-main.json`), id 25434433. Доказ (`gh api …/rulesets/25434433`): `enforcement: active`,
      `bypass_actors: []`, target — default branch; правила `deletion`, `non_fast_forward`, `pull_request`
      (`required_approving_review_count: 0`, `allowed_merge_methods: [squash, merge]`), `required_status_checks`
      (`spec`, `app`, `conformance`, `db-check`; `strict_required_status_checks_policy: false`). Rebase merging у
      Settings → General вимкнено

## 7. Перший PR (перевірка ruleset-у)

- [x] Перший PR під ruleset-ом — «Оновлення вимог» https://github.com/maryan-qc/therapy-scheduling/pull/1 (тип
      «Оновлення вимог», `@coderabbitai review`); цей PR `setup/bootstrap` — тип «Реалізація»
- [x] Поки перевірки не зелені, merge заблоковано: у https://github.com/maryan-qc/therapy-scheduling/pull/3 job `app`
      завис у стані «in_progress», і PR не зливався до перезапуску job; push у `main` напряму ruleset відхиляє
- [x] Vercel створює preview для кожного PR (статус «Vercel Preview» у PR)
- [x] **Squash and merge** → прод-деплой Vercel з `main` пройшов (Production, READY)
- [ ] (З першою задачею, що має міграцію) `db-check` зелений — https://github.com/maryan-qc/therapy-scheduling/pull/6;
      після merge `db-deploy` застосує міграції, щойно буде секрет — очікує

## 8. Вимоги PM і специфікація

- [x] Адресу репо вимог PM узято з чату команди
- [x] PM написала «вимоги оновлено» → `/requirements-sync Sofiia-pm/therapy-scheduling-spec` → PR «Оновлення вимог»
      https://github.com/maryan-qc/therapy-scheduling/pull/1 (знімок 2026-10-19) і після уточнень
      https://github.com/maryan-qc/therapy-scheduling/pull/3 (знімок 2026-10-21) злито
- [x] Читання вимог: питання через вебформу — Sofiia-pm/therapy-scheduling-spec#10, #11, #12 і коментар у #9;
      журнал `docs/spec-reading.md`
- [x] Переклад у специфікацію: `add-slot-hold` — https://github.com/maryan-qc/therapy-scheduling/pull/2, уточнення
      `clarify-slot-hold` — https://github.com/maryan-qc/therapy-scheduling/pull/4; `npm run ac:coverage` без
      «вимогу PM ще не перекладено»
