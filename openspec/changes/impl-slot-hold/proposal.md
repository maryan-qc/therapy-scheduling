# Пропозиція: план реалізації зрізу 1 — утримання слоту терапевта

## Why

Реалізуємо зріз 1 (WS6): планувальник утримує вільний слот терапевта за клієнтом на 24 години й підтверджує
утримання як сеанс. Специфікація — `openspec/specs/slot-holds/spec.md` і `openspec/specs/clients/spec.md` (зміни
`add-slot-hold` і `clarify-slot-hold`), знімок вимог PM 2026-10-21 (шапка `docs/conformance.md`).

## What Changes

Ця зміна не змінює специфікацію (`skip_specs: true`); вона покриває всі 36 AC з `openspec/specs/`:

- `slot-holds`: AC-HOLD-01…09, AC-HOLD-12…14, AC-HOLD-17…33, AC-HOLD-36;
- `clients`: AC-HOLD-10, AC-HOLD-11, AC-HOLD-15, AC-HOLD-16, AC-HOLD-34, AC-HOLD-35.
