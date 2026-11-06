# Design: impl-insurance-consent

План реалізації зрізу 3 (`openspec/specs/insurance-status`, AC-INS-01…06; `openspec/specs/consent-documents`,
AC-DOC-01…11). Питань до PM немає; власні припущення розробника — у `proposal.md` архівованої зміни
`add-insurance-consent`.

## Дані й RLS

Дві міграції (по одній на задачу). Застосовані міграції не змінюємо: нові колонки, таблиця, функції, GRANT і політики.

### Статус перевірки страхування (`…_insurance_status.sql`)

- `clients.insurance_status text not null default 'not_set'`, `check (insurance_status in ('not_set', 'verified',
  'not_accepted', 'private_pay'))`. Наявні картки зрізів 1–2 отримують `not_set` з default (AC-INS-01).
- Колонкового `grant update` немає й політики `update` на `clients` немає: напряму (Data API, `update`) статус не
  змінює ніхто, зокрема терапевт (AC-INS-05).
- `private.set_insurance_status(p_client_id uuid, p_status text) returns jsonb`, `security definer`,
  `set search_path = ''`: не `is_staff()` → `INSURANCE_FORBIDDEN` (AC-INS-05); `p_status` не з трьох значень (зокрема
  `not_set`) → `INVALID_STATUS` (припущення PM: повернути «Not set» не можна); клієнта немає → `NOT_FOUND`; інакше
  `update` → `OK` (AC-INS-02, AC-INS-03). Обгортка `public.set_insurance_status` (`security invoker`). `execute` —
  лише `authenticated`; `anon` — revoke (AC-INS-06).
- Читання — наявна політика `clients_select`: персонал — усі, терапевт — свої клієнти (AC-INS-04).

### Документи згоди (`…_consent_documents.sql`)

- Таблиця `public.consent_documents`: `id uuid pk default gen_random_uuid()`, `client_id uuid not null references
  public.clients on delete cascade`, `kind text not null check (kind in ('consent_to_treatment', 'cancellation_policy',
  'release_of_information'))`, `position smallint not null`, `prepared_at timestamptz not null`, `signed_at
  timestamptz`, `signed_by uuid references auth.users`, `unique (client_id, kind)`.
- RLS: `enable`; `revoke all … from anon, authenticated`; `grant select … to authenticated`; політика
  `consent_documents_select` — `is_staff()` або `is_client_of_current_therapist(client_id)` (AC-DOC-09, AC-DOC-10).
  `insert` / `update` / `delete` — без GRANT і без політик: пишуть лише функції (AC-DOC-09, AC-DOC-11).
- `private.prepare_consent_documents_at(p_client_id uuid, p_now timestamptz)`: не персонал → `PREPARE_FORBIDDEN`;
  рядок клієнта — `for update` (два одночасні формування чекають одне одного); клієнта немає → `NOT_FOUND`; документи
  вже є → `ALREADY_PREPARED`; інакше вставити набір за `client_type`: `adult` — 2, `child` — 3, `position` 1…3,
  `prepared_at = p_now` (AC-DOC-02, AC-DOC-03; один набір — припущення PM). `unique (client_id, kind)` — друга межа.
- `private.sign_consent_document_at(p_document_id uuid, p_now timestamptz)`: не персонал → `SIGN_FORBIDDEN`
  (AC-DOC-09); документа немає → `NOT_FOUND`; уже підписано → `ALREADY_SIGNED` (без змін; скасування й повтор — поза
  зрізом); інакше `signed_at = p_now`, `signed_by = auth.uid()` (AC-DOC-05, AC-DOC-06).
- `private.confirm_hold_at` — `create or replace` з тим самим порядком перевірок зрізу 1 (роль, не знайдено, уже
  підтверджено, прострочено, слот почався), а **після** них: є документи клієнта утримання й хоч один без `signed_at`
  → `UNSIGNED_DOCUMENTS`, утримання не змінюється (AC-DOC-07); документів немає або всі підписані → як у зрізі 1
  (AC-DOC-08, AC-HOLD-12).
- Обгортки `public.prepare_consent_documents`, `public.sign_consent_document` (`security invoker`, `now()`);
  `execute` — лише `authenticated`.

## Домен (`src/lib/clients/`)

- `insurance.ts`: `INSURANCE_LABEL` (`not_set` → «Not set», …), `INSURANCE_CHOICES` (три значення без «Not set»),
  `insuranceLine(status)` → «Insurance: <статус>», повідомлення: «Insurance status saved.» (AC-INS-02).
- `consent.ts`: `CONSENT_TITLE` за `kind`, `consentSetFor(clientType)` (порядок набору), `documentState(doc)` → «Not
  signed» / «Signed РРРР-ММ-ДД ГГ:ХХ» (час практики, AC-DOC-05), `signaturesLine(docs)` → «No consent documents yet.» /
  «Missing signatures: …» / «All consent documents signed.» (AC-DOC-01, 02, 05, 06), `documentText(doc, client)` —
  заголовок, «Client: …», для дитини «Guardian: …», «Prepared: РРРР-ММ-ДД», сталий синтетичний текст (AC-DOC-04);
  повідомлення «Only schedulers and admins can mark documents as signed.» (AC-DOC-09).
- `src/lib/holds/messages.ts`: `UNSIGNED_DOCUMENTS` → «Sign all consent documents before confirming.» (AC-DOC-07).

## UI

Лише компоненти з `@/components/ui`, токени й тексти AC дослівно.

| Сторінка | Хто | Що бачить | AC |
|---|---|---|---|
| `/clients/[id]` | персонал | у `dl` картки — рядок «Insurance: <статус>»; форма: `NativeSelect` «Insurance status» (Verified / Not accepted / Private pay) і `SubmitButton` «Save insurance status»; успіх — `Alert` `role="status"` «Insurance status saved.» | AC-INS-01, 02, 03 |
| `/clients/[id]` | свій терапевт | рядок «Insurance: …» без форми | AC-INS-04 |
| `/clients/[id]` | персонал | `Card` «Consent documents»: без документів — «No consent documents yet.» і `SubmitButton` «Prepare consent documents»; з документами — список (назва-посилання на документ, стан, у непідписаного — `SubmitButton` «Mark as signed») і рядок «Missing signatures: …» / «All consent documents signed.» | AC-DOC-01, 02, 03, 05, 06 |
| `/clients/[id]` | свій терапевт | той самий список і рядок без кнопок | AC-DOC-09 |
| `/clients/[id]/documents/[documentId]` | персонал | текст документа (`Card`): заголовок, «Client: …», «Guardian: …» (дитина), «Prepared: …», сталий текст, «Status: <стан>»; у непідписаного — «Mark as signed» | AC-DOC-04, 05 |
| `/clients/[id]/documents/[documentId]` | свій терапевт | той самий текст і стан; замість кнопки — `Alert` «Only schedulers and admins can mark documents as signed.» | AC-DOC-09 |
| `/clients/[id]/documents/[documentId]` | терапевт, клієнт не свій | лише «You don't have access to this client.» (RLS не віддає ні документа, ні картки) | AC-DOC-10 |
| `/clients/[id]`, документ | не увійшов | `/login` (proxy й `requireViewer`) | AC-INS-06, AC-DOC-11 |
| `/slots`, `/holds` (Confirm) | персонал | при непідписаних документах — `Alert` `destructive` «Sign all consent documents before confirming.», утримання «Held» з тим самим «Held until» | AC-DOC-07, 08 |

Дії (`src/app/clients/actions.ts`): `setInsuranceStatus`, `prepareConsentDocuments`, `signConsentDocument` — RPC, код
результату → `?ok=` / `?error=` на картці чи документі. Перевірку ролі робить база; сторінка лише не пропонує дій
терапевту.

## Як доводимо (розділ «Як доводимо» PM)

- База (PGlite, `tests/db/`): межі ролей і даних — AC-INS-02, 03, 05, 06; AC-DOC-02, 03 (і одночасне формування — один
  набір), 05, 06, 07, 08, 09, 10, 11. Відмовні випадки перевіряють і що нічого не змінилося (AGENTS.md).
- Unit (`tests/clients/`): рядки й стани — AC-INS-01, AC-DOC-01, 02, 04, 05, 06.
- Сторінки (`tests/clients/pages.test.tsx`): що бачить кожна роль — AC-INS-04, AC-DOC-09.
- e2e на проді (`tests/e2e/*.spec.ts`, `npm run uat`): кожен AC зрізу 3 — запис, кадри «Тоді», вердикт агента.
