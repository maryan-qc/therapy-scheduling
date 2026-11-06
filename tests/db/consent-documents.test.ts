// Документи згоди напряму через базу (Data API з токеном користувача), а не лише на сторінках: формує й позначає підпис
// лише персонал функціями бази; прямого insert / update немає ні в кого; терапевт бачить документи лише своїх клієнтів;
// anon — нічого; підтвердження утримання з несформованими чи непідписаними документами (міграція
// 20261106180000_consent_documents.sql).
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";

let t: TestDb;
let scheduler1: string;
let scheduler2: string;
let therapist1: string;
let therapist2: string;
let client6: string;
let client7: string;
let client9: string;

type Doc = { kind: string; signed: boolean };
const DOCS_SQL = `select kind, signed_at is not null as signed from public.consent_documents where client_id = $1 order by position`;
const docsSeenBy = (userId: string, clientId: string) => t.asUser<Doc>(userId, DOCS_SQL, [clientId]);
const docsInDb = (clientId: string) => t.asService<Doc>(DOCS_SQL, [clientId]);
const docId = async (clientId: string, kind: string) =>
  (
    await t.asService<{ id: string }>("select id from public.consent_documents where client_id = $1 and kind = $2", [
      clientId,
      kind,
    ])
  )[0].id;

const code = async (userId: string, sql: string, params: unknown[]) =>
  (await t.asUser<{ result: { code: string } }>(userId, `select ${sql} as result`, params))[0].result.code;
const prepare = (userId: string, clientId: string) => code(userId, "public.prepare_consent_documents($1)", [clientId]);
const sign = (userId: string, documentId: string) => code(userId, "public.sign_consent_document($1)", [documentId]);
const confirm = (userId: string, holdId: string) => code(userId, "public.confirm_hold($1)", [holdId]);

/** Утримання «Held» клієнта на майбутньому слоті терапевта (свій клієнт для терапевта); повертає id утримання. */
async function heldFor(therapistEmail: string, clientId: string): Promise<string> {
  const [row] = await t.asService<{ id: string }>(
    `insert into public.holds (slot_id, client_id, created_at, expires_at)
     select s.id, $2, now(), now() + interval '24 hours'
     from public.slots as s join public.therapists as th on th.id = s.therapist_id
     where th.email = $1 and s.starts_at > now() + interval '2 days'
       and not exists (select 1 from public.holds as h where h.slot_id = s.id and h.released_at is null)
     order by s.starts_at limit 1
     returning id`,
    [therapistEmail, clientId],
  );
  return row.id;
}
const holdState = async (holdId: string) =>
  (
    await t.asService<{ confirmed: boolean; expires_at: string }>(
      "select confirmed_at is not null as confirmed, expires_at::text from public.holds where id = $1",
      [holdId],
    )
  )[0];

beforeAll(async () => {
  t = await createTestDb();
  scheduler1 = t.users["scheduler1@example.test"];
  scheduler2 = t.users["scheduler2@example.test"];
  therapist1 = t.users["therapist1@example.test"];
  therapist2 = t.users["therapist2@example.test"];
  [{ id: client6 }, { id: client7 }, { id: client9 }] = await t.asService<{ id: string }>(
    `insert into public.clients
       (client_type, name, date_of_birth, session_language, email, guardian_name, guardian_email) values
       ('adult', 'Client Six', '1990-05-14', 'English', 'client6@example.test', null, null),
       ('child', 'Client Seven', '2015-03-02', 'Spanish', null, 'Guardian Seven', 'guardian7@example.test'),
       ('adult', 'Client Nine', '1985-07-01', 'English', 'client9@example.test', null, null)
     returning id`,
  );
}, 60_000);

beforeEach(async () => {
  await t.asService("delete from public.holds");
  await t.asService("delete from public.consent_documents");
});

describe("формування документів згоди (prepare_consent_documents)", () => {
  it("AC-DOC-01: документів ще не формували — для client6 жодного документа", async () => {
    expect(await docsSeenBy(scheduler1, client6)).toEqual([]);
  });

  it("AC-DOC-02: scheduler1 формує для client6 (Adult) рівно два документи «Not signed» у порядку набору", async () => {
    expect(await prepare(scheduler1, client6)).toBe("OK");
    expect(await docsSeenBy(scheduler1, client6)).toEqual([
      { kind: "consent_to_treatment", signed: false },
      { kind: "cancellation_policy", signed: false },
    ]);
  });

  it("AC-DOC-03: для client7 (Child) — рівно три документи «Not signed»; повторне формування не створює другого набору", async () => {
    expect(await prepare(scheduler1, client7)).toBe("OK");
    expect(await prepare(scheduler2, client7)).toBe("ALREADY_PREPARED");
    expect(await docsInDb(client7)).toEqual([
      { kind: "consent_to_treatment", signed: false },
      { kind: "cancellation_policy", signed: false },
      { kind: "release_of_information", signed: false },
    ]);
  });

  it("AC-DOC-03: два одночасні формування — один набір (блокування рядка клієнта й unique)", async () => {
    const results = await Promise.all([prepare(scheduler1, client7), prepare(scheduler2, client7)]);
    expect(results.sort()).toEqual(["ALREADY_PREPARED", "OK"]);
    expect(await docsInDb(client7)).toHaveLength(3);
  });

  it("AC-DOC-04: дата формування — дата практики (2026-11-04 о 23:30 у Лос-Анджелесі)", async () => {
    await code(scheduler1, "private.prepare_consent_documents_at($1, $2)", [client7, "2026-11-05T07:30:00Z"]);
    const [{ prepared }] = await t.asService<{ prepared: string }>(
      `select to_char(prepared_at at time zone 'America/Los_Angeles', 'YYYY-MM-DD') as prepared
       from public.consent_documents where client_id = $1 and kind = 'release_of_information'`,
      [client7],
    );
    expect(prepared).toBe("2026-11-04");
  });
});

describe("позначення підпису (sign_consent_document)", () => {
  it("AC-DOC-05: scheduler1 2026-11-04 о 10:15 позначає «Consent to treatment» — підписано саме тоді, інший — ні", async () => {
    await prepare(scheduler1, client6);
    const consent = await docId(client6, "consent_to_treatment");
    expect(await code(scheduler1, "private.sign_consent_document_at($1, $2)", [consent, "2026-11-04T18:15:00Z"])).toBe(
      "OK",
    );
    const [{ signed }] = await t.asService<{ signed: string }>(
      `select to_char(signed_at at time zone 'America/Los_Angeles', 'YYYY-MM-DD HH24:MI') as signed
       from public.consent_documents where id = $1`,
      [consent],
    );
    expect(signed).toBe("2026-11-04 10:15");
    expect(await docsSeenBy(scheduler1, client6)).toEqual([
      { kind: "consent_to_treatment", signed: true },
      { kind: "cancellation_policy", signed: false },
    ]);
  });

  it("AC-DOC-06: scheduler2 позначає другий документ — підписано всі; повторна позначка нічого не змінює", async () => {
    await prepare(scheduler1, client6);
    await sign(scheduler1, await docId(client6, "consent_to_treatment"));
    const policy = await docId(client6, "cancellation_policy");
    expect(await sign(scheduler2, policy)).toBe("OK");
    expect(await sign(scheduler1, policy)).toBe("ALREADY_SIGNED");
    expect(await docsSeenBy(scheduler2, client6)).toEqual([
      { kind: "consent_to_treatment", signed: true },
      { kind: "cancellation_policy", signed: true },
    ]);
  });
});

describe("підтвердження утримання з документами (confirm_hold)", () => {
  it("AC-DOC-07: «Cancellation policy acknowledgement» не підписано — UNSIGNED_DOCUMENTS, утримання «Held» з тим самим «Held until»", async () => {
    const hold = await heldFor("therapist1@example.test", client6);
    await prepare(scheduler1, client6);
    await sign(scheduler1, await docId(client6, "consent_to_treatment"));
    const before = await holdState(hold);

    expect(await confirm(scheduler1, hold)).toBe("UNSIGNED_DOCUMENTS");
    expect(await holdState(hold)).toEqual({ ...before, confirmed: false });
  });

  it("AC-DOC-08: усі документи підписано — утримання підтверджено («Confirmed»)", async () => {
    const hold = await heldFor("therapist1@example.test", client6);
    await prepare(scheduler1, client6);
    await sign(scheduler1, await docId(client6, "consent_to_treatment"));
    await sign(scheduler1, await docId(client6, "cancellation_policy"));

    expect(await confirm(scheduler1, hold)).toBe("OK");
    expect((await holdState(hold)).confirmed).toBe(true);
  });

  it("AC-HOLD-12: документів для клієнта не формували — підтвердження як у зрізі 1", async () => {
    const hold = await heldFor("therapist1@example.test", client9);
    expect(await confirm(scheduler1, hold)).toBe("OK");
    expect((await holdState(hold)).confirmed).toBe(true);
  });

  it("AC-DOC-07: правила зрізу 1 — раніше за документи: терапевт отримує CONFIRM_FORBIDDEN, а не UNSIGNED_DOCUMENTS", async () => {
    const hold = await heldFor("therapist1@example.test", client6);
    await prepare(scheduler1, client6);
    expect(await confirm(therapist1, hold)).toBe("CONFIRM_FORBIDDEN");
    expect((await holdState(hold)).confirmed).toBe(false);
  });
});

describe("документи згоди за ролями (RLS consent_documents_select, без GRANT insert / update)", () => {
  it("AC-DOC-09: therapist1 бачить документи свого client6, але не позначає підпис ні функцією, ні напряму", async () => {
    await heldFor("therapist1@example.test", client6);
    await prepare(scheduler1, client6);
    const consent = await docId(client6, "consent_to_treatment");

    expect(await docsSeenBy(therapist1, client6)).toEqual([
      { kind: "consent_to_treatment", signed: false },
      { kind: "cancellation_policy", signed: false },
    ]);
    expect(await sign(therapist1, consent)).toBe("SIGN_FORBIDDEN");
    await expect(
      t.asUser(therapist1, "update public.consent_documents set signed_at = now() where id = $1", [consent]),
    ).rejects.toThrow(/permission denied/);
    // І персонал напряму, повз функції, не пише: GRANT insert / update немає ні в кого.
    await expect(
      t.asUser(scheduler1, "update public.consent_documents set signed_at = now() where id = $1", [consent]),
    ).rejects.toThrow(/permission denied/);
    expect(await docsSeenBy(scheduler1, client6)).toEqual([
      { kind: "consent_to_treatment", signed: false },
      { kind: "cancellation_policy", signed: false },
    ]);
  });

  it("AC-DOC-09: therapist1 не формує документи свого клієнта", async () => {
    await heldFor("therapist1@example.test", client6);
    expect(await prepare(therapist1, client6)).toBe("PREPARE_FORBIDDEN");
    await expect(
      t.asUser(
        therapist1,
        "insert into public.consent_documents (client_id, kind, position, prepared_at) values ($1, 'consent_to_treatment', 1, now())",
        [client6],
      ),
    ).rejects.toThrow(/permission denied/);
    expect(await docsInDb(client6)).toEqual([]);
  });

  it("AC-DOC-10: client9 — свій лише для therapist2: therapist1 не отримує документів client9, стан не змінився", async () => {
    await heldFor("therapist2@example.test", client9);
    await prepare(scheduler1, client9);
    const consent = await docId(client9, "consent_to_treatment");

    expect(await docsSeenBy(therapist2, client9)).toHaveLength(2);
    expect(await docsSeenBy(therapist1, client9)).toEqual([]);
    expect(
      await t.asUser(therapist1, "select id from public.consent_documents where id = $1", [consent]),
    ).toEqual([]);
    expect(await sign(therapist1, consent)).toBe("SIGN_FORBIDDEN");
    expect(await docsInDb(client9)).toEqual([
      { kind: "consent_to_treatment", signed: false },
      { kind: "cancellation_policy", signed: false },
    ]);
  });

  it("AC-DOC-11: без входу (anon) ні читання документів, ні позначки — стан не змінився", async () => {
    await prepare(scheduler1, client6);
    const consent = await docId(client6, "consent_to_treatment");
    await expect(t.asAnon("select id from public.consent_documents where id = $1", [consent])).rejects.toThrow(
      /permission denied/,
    );
    await expect(t.asAnon("select public.sign_consent_document($1)", [consent])).rejects.toThrow(/permission denied/);
    await expect(t.asAnon("select public.prepare_consent_documents($1)", [client7])).rejects.toThrow(
      /permission denied/,
    );
    expect(await docsInDb(client6)).toEqual([
      { kind: "consent_to_treatment", signed: false },
      { kind: "cancellation_policy", signed: false },
    ]);
    expect(await docsInDb(client7)).toEqual([]);
  });
});
