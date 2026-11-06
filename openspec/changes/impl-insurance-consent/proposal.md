# Пропозиція: impl-insurance-consent — реалізація зрізу 3

## Why

Реалізуємо зріз 3: статус перевірки страхування й документи згоди клієнта (`openspec/specs/insurance-status`,
`openspec/specs/consent-documents`; вимоги PM HryhoriiHaponiukQuitCode/therapy-scheduling-spec#33 і #34, знімок
2026-11-06).

## What Changes

- `insurance-status`: AC-INS-01, AC-INS-02, AC-INS-03, AC-INS-04, AC-INS-05, AC-INS-06.
- `consent-documents`: AC-DOC-01, AC-DOC-02, AC-DOC-03, AC-DOC-04, AC-DOC-05, AC-DOC-06, AC-DOC-07, AC-DOC-08,
  AC-DOC-09, AC-DOC-10, AC-DOC-11.
- UAT на проді для кожного AC зрізу 3 (запис, кадри «Тоді», вердикт агента, звіт `docs/qa/uat/`).
