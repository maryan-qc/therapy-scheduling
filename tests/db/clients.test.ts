// Ім'я та email клієнта тим самим шляхом, що й дія createClientCard (src/app/clients/actions.ts): після зрізу 2 —
// лише повна форма картки (Sofiia-pm/therapy-scheduling-spec#20), решта полів заповнена правильно. validateClientCard →
// insert у public.clients від імені планувальника (RLS, колонковий grant) → код помилки Postgres → повідомлення PM.
// Дублікат ловить unique на clients.email, а формат — check-обмеження таблиці (друга лінія після форми).
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CARD_MESSAGES, cardErrorCode, validateClientCard } from "@/lib/clients/card";
import { createTestDb, type TestDb } from "./supabase-pglite";

let t: TestDb;
let scheduler1: string;

/** Як createClientCard для дорослого: форма, потім insert планувальником; повідомлення PM або null при успіху. */
async function addClient(name: string, email: string): Promise<string | null> {
  const form = { type: "adult", name, email, dateOfBirth: "1990-05-14", language: "English", guardianName: "", guardianEmail: "" };
  const input = validateClientCard(form, "2026-11-03");
  if (!input.ok) return input.errors.map((code) => CARD_MESSAGES[code]).join(" ");
  const r = input.row;
  try {
    await t.asUser(
      scheduler1,
      "insert into public.clients (client_type, name, email, date_of_birth, session_language) values ($1, $2, $3, $4, $5)",
      [r.client_type, r.name, r.email, r.date_of_birth, r.session_language],
    );
    return null;
  } catch (error) {
    const { code, message } = error as { code?: string; message?: string };
    return CARD_MESSAGES[cardErrorCode(code, message)];
  }
}

const emails = async () =>
  (await t.asService<{ email: string }>("select email from public.clients order by email")).map((r) => r.email);

beforeAll(async () => {
  t = await createTestDb();
  scheduler1 = t.users["scheduler1@example.test"];
}, 60_000);

beforeEach(async () => {
  await t.asService("delete from public.holds");
  await t.asService("delete from public.clients");
  await t.asService("insert into public.clients (name, email) values ('Client One', 'client1@example.test')");
});

describe("картка клієнта в базі (openspec/specs/clients)", () => {
  it("AC-HOLD-10: «Client Three» з client3@example.test — картку створено, її можна вибрати під час утримання", async () => {
    expect(await addClient("Client Three", "client3@example.test")).toBeNull();

    const visible = await t.asUser<{ name: string; created_by: string }>(
      scheduler1,
      "select name, created_by from public.clients where email = 'client3@example.test'",
    );
    expect(visible).toEqual([{ name: "Client Three", created_by: scheduler1 }]);
  });

  it("AC-HOLD-11: порожнє ім'я — клієнта не створено, «Enter the client's name and a valid email.»", async () => {
    expect(await addClient("", "client3@example.test")).toBe("Enter the client's name and a valid email.");
    // І база не прийме порожнє ім'я в обхід форми: check clients_name_not_blank.
    await expect(
      t.asUser(scheduler1, "insert into public.clients (name, email) values ('  ', 'client3@example.test')"),
    ).rejects.toThrow(/clients_name_not_blank/);
    expect(await emails()).toEqual(["client1@example.test"]);
  });

  it("AC-HOLD-15: email без знака @ — клієнта не створено", async () => {
    expect(await addClient("Client Three", "client3example.test")).toBe("Enter the client's name and a valid email.");
    await expect(
      t.asUser(scheduler1, "insert into public.clients (name, email) values ('Client Three', 'client3example.test')"),
    ).rejects.toThrow(/clients_email_format/);
    expect(await emails()).toEqual(["client1@example.test"]);
  });

  it("AC-HOLD-16: дублікат client1@example.test — «A client with this email already exists.»", async () => {
    expect(await addClient("Client One Again", "client1@example.test")).toBe("A client with this email already exists.");
    expect(await emails()).toEqual(["client1@example.test"]);
  });

  it("AC-HOLD-34: « Client1@Example.TEST » — дублікат client1@example.test", async () => {
    expect(await addClient("Client One", " Client1@Example.TEST ")).toBe("A client with this email already exists.");
    expect(await emails()).toEqual(["client1@example.test"]);
  });

  it("AC-HOLD-39: client3@example, client3@@example.test, @example.test, «client 3@example.test» — клієнта не створено", async () => {
    for (const email of ["client3@example", "client3@@example.test", "@example.test", "client 3@example.test"]) {
      expect(await addClient("Client Three", email)).toBe("Enter the client's name and a valid email.");
      // Друга лінія — check clients_email_format з тим самим правилом PM.
      await expect(
        t.asUser(scheduler1, "insert into public.clients (name, email) values ('Client Three', $1)", [email]),
      ).rejects.toThrow(/clients_email_format/);
    }
    expect(await emails()).toEqual(["client1@example.test"]);
  });

  it("AC-HOLD-41: «   » — не створено; « Client Four » — у картці «Client Four»", async () => {
    expect(await addClient("   ", "client5@example.test")).toBe("Enter the client's name and a valid email.");
    expect(await addClient(" Client Four ", "client4@example.test")).toBeNull();

    const [row] = await t.asUser<{ name: string }>(
      scheduler1,
      "select name from public.clients where email = 'client4@example.test'",
    );
    expect(row.name).toBe("Client Four");
    expect(await emails()).toEqual(["client1@example.test", "client4@example.test"]);
    // База не прийме ім'я з пробілами по краях в обхід форми: check clients_name_trimmed.
    await expect(
      t.asUser(scheduler1, "insert into public.clients (name, email) values (' Client Five ', 'client5@example.test')"),
    ).rejects.toThrow(/clients_name_trimmed/);
  });

  it("AC-HOLD-35: « Client3@Example.TEST » зберігається й показується як client3@example.test", async () => {
    expect(await addClient("Client Three", " Client3@Example.TEST ")).toBeNull();
    expect(await emails()).toEqual(["client1@example.test", "client3@example.test"]);
    // База сама не прийме ненормалізований email: check clients_email_normalized.
    await expect(
      t.asUser(scheduler1, "insert into public.clients (name, email) values ('Client Four', 'Client4@Example.test')"),
    ).rejects.toThrow(/clients_email_normalized/);
  });
});
