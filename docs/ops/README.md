# Докази експлуатації: знімки

Ці знімки потрібні, щоб перевірити сигнали без доступу до Telegram і Vercel. Токенів, chat id, паролів і даних
користувачів на знімках немає. Час на знімках Telegram — київський (UTC+2).

| Знімок | Що доводить | Звідки |
|---|---|---|
| [alert-red-smoke-telegram.png](alert-red-smoke-telegram.png) | Алерт людині з червоного smoke: workflow і job, середовище, адреса, посилання на прогін | Навмисно червоний ручний прогін [45603275036](https://github.com/maryan-qc/therapy-scheduling/actions/runs/45603275036) з `url` = `https://example.invalid`, 2026-11-25 ≈11:19 UTC |
| [error-tracker-staging-telegram.png](error-tracker-staging-telegram.png) | Трекер помилок (`src/instrumentation.ts` → `src/lib/error-alert.ts` → Telegram): середовище, маршрут, тип помилки, деплой і коміт, верхні рядки стеку. Тексту запиту, заголовків і cookie немає | Навмисна помилка: тестовий адміністратор відкрив `/api/ops/error-check` на staging, 2026-11-25 ≈11:25 UTC |
| [llm-call-vercel-log.png](llm-call-vercel-log.png) | Рядок журналу `llm.call` у Vercel Logs: модель, затримка, токени, стан, fallback, версія промпту, id запиту. Тексту звернення немає | Одна чернетка картки на staging, 2026-11-25 11:25:45 UTC |

До 2026-11-26 алерти йшли в особистий чат розробника з ботом. З 2026-11-26 вони йдуть у Telegram-групу з PM: див.
[#77](https://github.com/maryan-qc/therapy-scheduling/issues/77) і [`docs/runbook.md`](../runbook.md), «Канал алерту».
