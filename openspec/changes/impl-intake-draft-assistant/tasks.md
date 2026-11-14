# Tasks

Вертикальні задачі. Одна задача — одна гілка й один PR «Реалізація» з `@coderabbitai review`, відповіддю на кожну
знахідку й зеленим CI. Перевірка кожної — `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`,
`npm run ac:coverage`, `npm run spec:check`, `npm run check:design`, `npm run check:boundary`, `npm run gates`; рядки AC
задачі в `docs/conformance.md` — «реалізовано».

**Maker ≠ checker** (зауваження викладача до WS9, п. 2): тести задачі 1 пише **окрема сесія агента** за специфікацією
`openspec/specs/intake-draft`, golden cases і контрактом з `design.md` — до коду. Спершу гілка `tests/intake-draft` з
червоним прогоном CI (посилання — в описі PR), потім коміти реалізації в ту саму гілку роблять тести зеленими, **не
змінюючи їх**.

## 1. Чернетка картки з тексту звернення (`tests/intake-draft` → PR «Реалізація»)

- [x] 1.1 Червоні тести окремою сесією: `tests/clients/intake.test.ts`, `tests/clients/intake-draft.test.ts`,
  `tests/clients/intake-panel.test.tsx`, `tests/golden.test.ts` (реплей, записи-заглушки до 2.1), `tests/ai-key.test.ts`
  (набір). Червоний прогін CI на `main` + тести.
  Done when: усі тести з AC ID у назвах, CI червоний лише через відсутній код.
- [x] 1.2 Залежності за ADR 0002 (точні версії), `.env.example` (`OPENROUTER_API_KEY=` без значення), скрипти `eval`,
  `ai:models`, `ai:quota`; файли набору `src/lib/ai/*`, `evals/`, `scripts/`, `vitest.eval.config.mts`.
  Done when: `npm run ai:models` — усі моделі ланцюжка є; `tests/ai-key.test.ts` зелений.
- [x] 1.3 Схема, промпт, `proposeDraft`, домен `src/lib/clients/intake.ts`, оркестрація `src/lib/clients/intake-draft.ts`.
  Done when: AC-INTAKE-04, AC-INTAKE-05, AC-INTAKE-06, AC-INTAKE-07, AC-INTAKE-08 (unit) зелені.
- [x] 1.4 Дія `requestIntakeDraft`, панель чернетки у формі `/clients/new`, без панелі для терапевта.
  Done when: AC-INTAKE-01, AC-INTAKE-02, AC-INTAKE-03, AC-INTAKE-09; без ключа сторінка показує стан AC-INTAKE-08, а
  форма працює вручну.

## 2. Живий eval і записи (`eval/intake-draft`)

- [x] 2.1 `RECORD=1 npm run eval` (запускає людина зі своїм ключем, не в добу приймання PM) → `recorded.json` без
  заглушок, звіт `evals/reports/<дата й час>.md`, розбір кожного FAIL.
  Done when: офлайн-реплей golden cases зелений на справжніх записах; звіт з моделлю на кожен кейс, pass rate, датою й
  версією промпту.

## 3. Прод, UAT, conformance (`uat/intake-draft`)

- [ ] 3.1 `OPENROUTER_API_KEY` у Vercel Production; прод `/api/health` = SHA `main`; руками — один кейс, що проходить,
  одна відмова.
- [ ] 3.2 UAT на проді: AC-INTAKE-03 і AC-INTAKE-06 (`tests/e2e/intake-draft.spec.ts`, `npm run uat`), звіт
  `docs/qa/uat/<дата>/`; рядки AC-INTAKE у `docs/conformance.md` з чесним статусом; archive `impl-intake-draft-assistant`.
  Done when: UAT на 2 AC, `npm run ac:coverage` зелений; у чаті команди — «eval готовий».
