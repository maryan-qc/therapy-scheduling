# Пропозиція: impl-insurance-consent — реалізація зрізу 3

## Why

Реалізуємо зріз 3: статус перевірки страхування й документи згоди клієнта (`openspec/specs/insurance-status`,
`openspec/specs/consent-documents`; вимоги PM HryhoriiHaponiukQuitCode/therapy-scheduling-spec#33 і #34, знімок
2026-11-06).

## What Changes

- `insurance-status`: AC-INS-01, AC-INS-02, AC-INS-03, AC-INS-04, AC-INS-05, AC-INS-06.
- UAT на проді для кожного AC зрізу 3 (запис, кадри «Тоді», вердикт агента, звіт `docs/qa/uat/`).

`consent-documents` (AC-DOC-01…11) у цьому зрізі не реалізуємо: рішення PM 2026-11-06 — вимогу
HryhoriiHaponiukQuitCode/therapy-scheduling-spec#34 перенесено на пізніший зріз. Дизайн документів у `design.md`
лишається для того зрізу.
