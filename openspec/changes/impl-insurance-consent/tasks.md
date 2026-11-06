# Tasks

Вертикальні задачі: міграція/RLS + доменна функція + server action/сторінка + тести. Одна задача — одна гілка
`task/<коротко>` і один PR «Реалізація» з `@coderabbitai review` і зеленим CI. Перевірка кожної — `npm run lint`,
`npm run typecheck`, `npm test`, `npm run build`, `npm run ac:coverage`, `npm run spec:check`, `npm run check:design`,
`npm run check:boundary`, `npm run gates`; рядки AC задачі в `docs/conformance.md` — «реалізовано».

## 1. Статус перевірки страхування (`task/insurance-status`)

- [x] 1.1 Міграція `…_insurance_status.sql`: колонка з default і check, `set_insurance_status` (private + public),
  права; `database.types.ts`.
  Done when: `db-check` зелений; після merge — зелений `db-deploy`.
- [x] 1.2 `src/lib/clients/insurance.ts`, дія `setInsuranceStatus`, рядок і форма на `/clients/[id]`.
  Done when: AC-INS-01, AC-INS-02, AC-INS-03, AC-INS-04.
- [x] 1.3 Тести відмов (PGlite): терапевт через RPC і прямий `update` — відмова, статус той самий; `anon` — permission
  denied; «Not set» повернути не можна.
  Done when: AC-INS-05, AC-INS-06.

## 2. Документи згоди (`task/consent-documents`)

- [x] 2.1 Міграція `…_consent_documents.sql`: таблиця, RLS, `prepare_consent_documents`, `sign_consent_document`,
  `confirm_hold_at` з `UNSIGNED_DOCUMENTS`; `database.types.ts`.
  Done when: `db-check` зелений; після merge — зелений `db-deploy`.
- [x] 2.2 `src/lib/clients/consent.ts`, дії `prepareConsentDocuments` і `signConsentDocument`, розділ «Consent
  documents» на `/clients/[id]`, сторінка документа.
  Done when: AC-DOC-01, AC-DOC-02, AC-DOC-03, AC-DOC-04, AC-DOC-05, AC-DOC-06.
- [x] 2.3 Підтвердження утримання з документами: повідомлення, тести бази для обох гілок і для клієнта без документів
  (зріз 1 без змін).
  Done when: AC-DOC-07, AC-DOC-08.
- [x] 2.4 Тести відмов: терапевт бачить документ свого клієнта й не позначає підпис; чужий клієнт — 0 рядків; `anon` —
  permission denied; стан не змінився.
  Done when: AC-DOC-09, AC-DOC-10, AC-DOC-11.

## 3. UAT зрізу 3 на проді (`task/uat-slice-3`)

- [ ] 3.1 e2e-специфікації кожного AC зрізу 3 (`tests/e2e/`), прогін `npm run uat` на проді, звіт і кадри в
  `docs/qa/uat/<дата>/`, рядки матриці з посиланням на UAT.
  Done when: AC-INS-01, AC-INS-02, AC-INS-03, AC-INS-04, AC-INS-05, AC-INS-06, AC-DOC-01, AC-DOC-02, AC-DOC-03,
  AC-DOC-04, AC-DOC-05, AC-DOC-06, AC-DOC-07, AC-DOC-08, AC-DOC-09, AC-DOC-10, AC-DOC-11 — вердикт агента «PASS».
- [ ] 3.2 archive `impl-insurance-consent`.
  Done when: `npx openspec archive impl-insurance-consent -y`, `npm run spec:validate` зелений.
