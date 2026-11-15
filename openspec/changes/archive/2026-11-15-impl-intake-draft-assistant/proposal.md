# Пропозиція: impl-intake-draft-assistant — реалізація зрізу 4

## Why

Реалізуємо зріз 4 (WS10, AI-функція): чернетка картки клієнта з тексту звернення (`openspec/specs/intake-draft`,
AC-INTAKE-01…09; вимога PM HryhoriiHaponiukQuitCode/therapy-scheduling-spec#36, знімок 2026-11-14) і доводимо її 10
golden cases PM — офлайн у CI та живим прогоном.

## What Changes

- `intake-draft`: AC-INTAKE-01…09 — схема й стани, ключ лише на сервері, людина створює картку сама, збої → стан
  AC-INTAKE-08, промпт з даними в межах.
- Нові залежності — ADR `docs/decisions/0002-ai-feature-openrouter.md`.
- Evals: офлайн-реплей golden cases у `npm test` (CI) і звіт живого прогону `npm run eval` у `evals/reports/`.
- UAT на проді щонайменше на AC-INTAKE-03 (людина підтверджує) і AC-INTAKE-06 (відмова), звіт `docs/qa/uat/`.

Міграцій немає: картку створює наявна дія `createClientCard` з RLS `clients_insert_staff`; помічник у базу не пише.
