# Пропозиція: impl-client-cards — реалізація зрізу 2 і уточнень зрізу 1

## Why

Реалізуємо зріз 2 — картку клієнта з анкети й доступ терапевта лише до своїх клієнтів (`openspec/specs/client-cards`,
Sofiia-pm/therapy-scheduling-spec#19) — і уточнення зрізу 1 зі знімка 2026-10-23 (`openspec/specs/slot-holds`,
`openspec/specs/clients`, Sofiia-pm/therapy-scheduling-spec#2).

## What Changes

План покриває AC з `openspec/specs/`:

- `client-cards`: AC-CARD-01, AC-CARD-02, AC-CARD-03, AC-CARD-04, AC-CARD-05, AC-CARD-06, AC-CARD-07, AC-CARD-08,
  AC-CARD-09, AC-CARD-10, AC-CARD-11;
- `clients`: AC-HOLD-39, AC-HOLD-41;
- `slot-holds`: AC-HOLD-37, AC-HOLD-38, AC-HOLD-40, AC-HOLD-42; AC-HOLD-01 — дані тесту за новим текстом.

Рішення — `design.md` (UI і компоненти, дані й RLS, Auth), задачі — `tasks.md`.
