// Картка клієнта з анкети (openspec/specs/client-cards) тим самим шляхом, що й дія createClientCard
// (src/app/clients/actions.ts): validateClientCard → insert у public.clients від імені користувача (RLS
// clients_insert_staff, колонковий grant, check-обмеження й тригер міграції 20261023104436_client_cards.sql) →
// код помилки Postgres → повідомлення. Читання — під RLS clients_select того, хто відкриває список.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  CARD_MESSAGES,
  cardErrorCode,
  cardRoleError,
  NO_CARDS_YET,
  validateClientCard,
  type CardForm,
} from "@/lib/clients/card";
import type { Role } from "@/lib/holds/types";
import { at } from "../holds/fixtures";
import { createTestDb, type TestDb } from "./supabase-pglite";

let t: TestDb;
let scheduler1: string;
let scheduler2: string;
let admin: string;
let therapist1: string;

const TODAY = "2026-11-03";
// Без returning: RETURNING ще й перевіряє політику select, а тест відмови має ловити саме політику insert.
const INSERT_ROW = `insert into public.clients
  (client_type, name, date_of_birth, session_language, email, guardian_name, guardian_email)
  values ($1, $2, $3, $4, $5, $6, $7)`;
const INSERT = `${INSERT_ROW} returning id`;

const clientSix: CardForm = {
  type: "adult",
  name: "Client Six",
  email: "client6@example.test",
  dateOfBirth: "1990-05-14",
  language: "English",
  guardianName: "",
  guardianEmail: "",
};
const clientSeven: CardForm = {
  type: "child",
  name: "Client Seven",
  email: "",
  dateOfBirth: "2015-03-02",
  language: "Spanish",
  guardianName: "Guardian Seven",
  guardianEmail: "guardian7@example.test",
};
const clientNine: CardForm = { ...clientSix, name: "Client Nine", email: "client9@example.test" };

/** Як createClientCard: роль → форма → insert від імені користувача; повертає id картки або повідомлення. */
async function createCard(userId: string, role: Role, form: CardForm): Promise<{ id?: string; message?: string }> {
  const roleError = cardRoleError(role);
  if (roleError) return { message: CARD_MESSAGES[roleError] };
  const input = validateClientCard(form, TODAY);
  if (!input.ok) return { message: input.errors.map((code) => CARD_MESSAGES[code]).join(" ") };
  const r = input.row;
  try {
    const [row] = await t.asUser<{ id: string }>(userId, INSERT, [
      r.client_type,
      r.name,
      r.date_of_birth,
      r.session_language,
      r.email,
      r.guardian_name,
      r.guardian_email,
    ]);
    return { id: row.id };
  } catch (error) {
    const { code, message } = error as { code?: string; message?: string };
    return { message: CARD_MESSAGES[cardErrorCode(code, message)] };
  }
}

const cardCount = async () => Number((await t.asService<{ n: number }>("select count(*)::int as n from public.clients"))[0].n);

type CardView = { name: string; client_type: string; email: string | null; guardian_name: string | null; guardian_email: string | null };
const cardsSeenBy = (userId: string) =>
  t.asUser<CardView>(
    userId,
    "select name, client_type, email, guardian_name, guardian_email from public.clients order by name",
  );

beforeAll(async () => {
  t = await createTestDb();
  scheduler1 = t.users["scheduler1@example.test"];
  scheduler2 = t.users["scheduler2@example.test"];
  admin = t.users["admin@example.test"];
  therapist1 = t.users["therapist1@example.test"];
}, 60_000);

beforeEach(async () => {
  await t.asService("delete from public.holds");
  await t.asService("delete from public.clients");
});

describe("картка клієнта з анкети в базі (openspec/specs/client-cards)", () => {
  it("AC-CARD-01: scheduler1 створює картку «Adult» Client Six — усі дані збережено, client6 можна утримати", async () => {
    const { id, message } = await createCard(scheduler1, "scheduler", clientSix);
    expect(message).toBeUndefined();

    const [card] = await t.asUser<Record<string, unknown>>(
      scheduler1,
      "select client_type, name, email, to_char(date_of_birth, 'YYYY-MM-DD') as dob, session_language from public.clients where id = $1",
      [id],
    );
    expect(card).toEqual({
      client_type: "adult",
      name: "Client Six",
      email: "client6@example.test",
      dob: "1990-05-14",
      session_language: "English",
    });
    const [slot] = await t.asService<{ id: string }>(
      `select s.id from public.slots as s join public.therapists as th on th.id = s.therapist_id
       where th.email = 'therapist1@example.test' and s.starts_at = $1`,
      [at("2026-11-05", "10:00")],
    );
    const [held] = await t.asUser<{ r: { code: string } }>(scheduler1, "select private.hold_slot_at($1, $2, $3) as r", [
      slot.id,
      id,
      at("2026-11-02", "14:30"),
    ]);
    expect(held.r.code).toBe("OK");
  });

  it("AC-CARD-02: картка «Child» Client Seven — дані дитини й опікуна, власного email немає", async () => {
    const { id } = await createCard(scheduler1, "scheduler", clientSeven);

    const [card] = await t.asUser<Record<string, unknown>>(
      scheduler1,
      "select client_type, name, email, session_language, guardian_name, guardian_email from public.clients where id = $1",
      [id],
    );
    expect(card).toEqual({
      client_type: "child",
      name: "Client Seven",
      email: null,
      session_language: "Spanish",
      guardian_name: "Guardian Seven",
      guardian_email: "guardian7@example.test",
    });
  });

  it("AC-CARD-03: дитина без імені чи email опікуна — картку не створено (форма й check бази), карток не додалось", async () => {
    const noGuardian = await createCard(scheduler1, "scheduler", { ...clientSeven, name: "Client Eight", guardianName: "" });
    expect(noGuardian.message).toBe("Enter the guardian's name and a valid email.");

    // Друга лінія — запит в обхід форми: check clients_contact_by_type.
    await expect(
      t.asUser(scheduler1, INSERT, ["child", "Client Eight", "2016-01-10", "English", null, null, null]),
    ).rejects.toThrow(/clients_contact_by_type/);
    await expect(
      t.asUser(scheduler1, INSERT, ["child", "Client Eight", "2016-01-10", "English", null, "Guardian Eight", "guardian8"]),
    ).rejects.toThrow(/clients_guardian_email_format/);
    expect(await cardCount()).toBe(0);
  });

  it("AC-CARD-06: therapist1 пробує створити картку — відмова дії й RLS, кількість карток та сама", async () => {
    await createCard(scheduler1, "scheduler", clientSix);

    expect((await createCard(therapist1, "therapist", clientNine)).message).toBe(
      "Only schedulers and admins can create client cards.",
    );
    // Запит в обхід дії: RLS clients_insert_staff (лише scheduler і admin) — 42501, той самий текст.
    let code: string | undefined;
    await t
      .asUser(therapist1, INSERT_ROW, ["adult", "Client Nine", "1985-01-01", "English", "client9@example.test", null, null])
      .catch((error: { code?: string }) => (code = error.code));
    expect(code).toBe("42501");
    expect(CARD_MESSAGES[cardErrorCode(code)]).toBe("Only schedulers and admins can create client cards.");
    expect(await cardCount()).toBe(1);
  });

  it("AC-CARD-10: scheduler2 і адміністратор бачать усі три картки, у картці client7 — дані опікуна", async () => {
    await createCard(scheduler1, "scheduler", clientSix);
    await createCard(scheduler1, "scheduler", clientSeven);
    await createCard(scheduler1, "scheduler", clientNine);

    for (const viewer of [scheduler2, admin]) {
      const cards = await cardsSeenBy(viewer);
      expect(cards.map((c) => c.name)).toEqual(["Client Nine", "Client Seven", "Client Six"]);
      expect(cards.find((c) => c.name === "Client Seven")).toMatchObject({
        guardian_name: "Guardian Seven",
        guardian_email: "guardian7@example.test",
      });
    }
  });
});

describe("уточнення PM 26.10 (openspec/specs/client-cards)", () => {
  it("AC-CARD-13: scheduler2 створює дитину « client seven » з тією ж датою й email опікуна — дублікат, картку не створено", async () => {
    await createCard(scheduler1, "scheduler", clientSeven);

    const again = await createCard(scheduler2, "scheduler", { ...clientSeven, name: " client seven ", language: "English" });
    expect(again.message).toBe("A client with these details already exists.");
    expect(await cardCount()).toBe(1);
    // Близнюки з тим самим опікуном і датою, але з іншим ім'ям — створюються.
    expect((await createCard(scheduler2, "scheduler", { ...clientSeven, name: "Client Seventeen" })).id).toBeDefined();
    expect(await cardCount()).toBe(2);
  });

  it("AC-CARD-15: карток ще немає — планувальник і адміністратор отримують порожній список (сторінка — NO_CARDS_YET)", async () => {
    expect(await cardsSeenBy(scheduler1)).toEqual([]);
    expect(await cardsSeenBy(admin)).toEqual([]);
    expect(NO_CARDS_YET).toBe("No clients yet. Create a client card from an intake form.");
  });
});

describe("правила картки в базі — друга лінія після форми", () => {
  it("дата народження пізніше за сьогодні — тригер відхиляє (23514), картку не створено", async () => {
    await expect(
      t.asUser(scheduler1, INSERT, ["adult", "Client Six", "2999-01-01", "English", "client6@example.test", null, null]),
    ).rejects.toMatchObject({ code: "23514" });
    expect(await cardCount()).toBe(0);
  });

  it("користувач не передає created_by: колонковий grant", async () => {
    await expect(
      t.asUser(scheduler1, "insert into public.clients (name, email, created_by) values ('Client Six', 'client6@example.test', $1)", [
        therapist1,
      ]),
    ).rejects.toThrow(/permission denied/);
  });
});
