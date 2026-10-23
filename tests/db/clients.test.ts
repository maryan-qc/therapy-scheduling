// Картка клієнта тим самим шляхом, що й дія addClient (src/app/slots/actions.ts): validateClient → insert у
// public.clients від імені планувальника (RLS, колонковий grant) → код помилки Postgres → повідомлення PM.
// Дублікат ловить unique на clients.email, а формат — check-обмеження таблиці (друга лінія після validateClient).
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CLIENT_MESSAGES, clientErrorCode, validateClient } from "@/lib/holds/clients";
import { createTestDb, type TestDb } from "./supabase-pglite";

let t: TestDb;
let scheduler1: string;

/** Як addClient: перевірка форми, потім insert планувальником; повертає повідомлення PM або null при успіху. */
async function addClient(name: string, email: string): Promise<string | null> {
  const input = validateClient(name, email);
  if (!input.ok) return CLIENT_MESSAGES[input.code];
  try {
    await t.asUser(scheduler1, "insert into public.clients (name, email) values ($1, $2)", [input.name, input.email]);
    return null;
  } catch (error) {
    return CLIENT_MESSAGES[clientErrorCode((error as { code?: string }).code)];
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

  it("AC-HOLD-35: « Client3@Example.TEST » зберігається й показується як client3@example.test", async () => {
    expect(await addClient("Client Three", " Client3@Example.TEST ")).toBeNull();
    expect(await emails()).toEqual(["client1@example.test", "client3@example.test"]);
    // База сама не прийме ненормалізований email: check clients_email_normalized.
    await expect(
      t.asUser(scheduler1, "insert into public.clients (name, email) values ('Client Four', 'Client4@Example.test')"),
    ).rejects.toThrow(/clients_email_normalized/);
  });
});
