import { describe, expect, it } from "vitest";
import { CARD_MESSAGES, cardErrorCode, validateClientCard, type CardForm } from "@/lib/clients/card";
import { normalizeEmail } from "@/lib/holds/clients";

// Ім'я та email клієнта після зрізу 2 перевіряються в повній формі картки, де решта полів заповнена правильно
// (Sofiia-pm/therapy-scheduling-spec#20). Запис, дублікат і check-обмеження бази — tests/db/clients.test.ts.
const TODAY = "2026-11-03";
const adult = (name: string, email: string): CardForm => ({
  type: "adult",
  name,
  email,
  dateOfBirth: "1990-05-14",
  language: "English",
  guardianName: "",
  guardianEmail: "",
});
const check = (name: string, email: string) => validateClientCard(adult(name, email), TODAY);
const saved = (name: string, email: string) => {
  const input = check(name, email);
  return input.ok ? { name: input.row.name, email: input.row.email } : input;
};

describe("ім'я та email клієнта в повній формі картки (openspec/specs/clients)", () => {
  it("AC-HOLD-10: «Client Three» з client3@example.test — форма приймає", () => {
    expect(saved("Client Three", "client3@example.test")).toEqual({ name: "Client Three", email: "client3@example.test" });
  });

  it("AC-HOLD-11: порожнє ім'я — клієнта не створено, повідомлення про ім'я та email", () => {
    expect(check("", "client3@example.test")).toEqual({ ok: false, errors: ["CLIENT_INVALID"] });
    expect(CARD_MESSAGES.CLIENT_INVALID).toBe("Enter the client's name and a valid email.");
  });

  it("AC-HOLD-15: email без знака @ — клієнта не створено", () => {
    expect(check("Client Three", "client3example.test")).toEqual({ ok: false, errors: ["CLIENT_INVALID"] });
  });

  it("AC-HOLD-16: дублікат client1@example.test — unique бази (23505) дає «A client with this email already exists.»", () => {
    const message = 'duplicate key value violates unique constraint "clients_email_key"';
    expect(CARD_MESSAGES[cardErrorCode("23505", message)]).toBe("A client with this email already exists.");
  });

  it("AC-HOLD-34: « Client1@Example.TEST » нормалізується до client1@example.test перед записом", () => {
    expect(saved("Client One", " Client1@Example.TEST ")).toEqual({ name: "Client One", email: "client1@example.test" });
  });

  it("AC-HOLD-39: client3@example, client3@@example.test, @example.test, «client 3@example.test» — клієнта не створено", () => {
    for (const email of ["client3@example", "client3@@example.test", "@example.test", "client 3@example.test"]) {
      expect(check("Client Three", email)).toEqual({ ok: false, errors: ["CLIENT_INVALID"] });
    }
    expect(CARD_MESSAGES.CLIENT_INVALID).toBe("Enter the client's name and a valid email.");
  });

  it("AC-HOLD-41: ім'я «   » — не створено; « Client Four » — створено як «Client Four»", () => {
    expect(check("   ", "client5@example.test")).toEqual({ ok: false, errors: ["CLIENT_INVALID"] });
    expect(saved(" Client Four ", "client4@example.test")).toEqual({ name: "Client Four", email: "client4@example.test" });
  });

  it("AC-HOLD-35: « Client3@Example.TEST » зберігається й показується як client3@example.test", () => {
    expect(normalizeEmail(" Client3@Example.TEST ")).toBe("client3@example.test");
    expect(saved("Client Three", " Client3@Example.TEST ")).toEqual({
      name: "Client Three",
      email: "client3@example.test",
    });
  });
});
