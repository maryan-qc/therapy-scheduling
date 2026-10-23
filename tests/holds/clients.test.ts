import { describe, expect, it } from "vitest";
import { CLIENT_MESSAGES, clientErrorCode, normalizeEmail, validateClient } from "@/lib/holds/clients";

// Перевірка форми в дії addClient. Запис, дублікат і check-обмеження бази — tests/db/clients.test.ts.
describe("картка клієнта — перевірка форми (openspec/specs/clients)", () => {
  it("AC-HOLD-10: «Client Three» з client3@example.test — форма приймає", () => {
    const input = validateClient("Client Three", "client3@example.test");

    expect(input).toEqual({ ok: true, name: "Client Three", email: "client3@example.test" });
  });

  it("AC-HOLD-11: порожнє ім'я — клієнта не створено, повідомлення про ім'я та email", () => {
    const input = validateClient("", "client3@example.test");

    expect(input).toEqual({ ok: false, code: "CLIENT_INVALID" });
    expect(CLIENT_MESSAGES.CLIENT_INVALID).toBe("Enter the client's name and a valid email.");
  });

  it("AC-HOLD-15: email без знака @ — клієнта не створено", () => {
    expect(validateClient("Client Three", "client3example.test")).toEqual({ ok: false, code: "CLIENT_INVALID" });
  });

  it("AC-HOLD-16: дублікат client1@example.test — unique бази (23505) дає «A client with this email already exists.»", () => {
    expect(CLIENT_MESSAGES[clientErrorCode("23505")]).toBe("A client with this email already exists.");
  });

  it("AC-HOLD-34: « Client1@Example.TEST » нормалізується до client1@example.test перед записом", () => {
    const input = validateClient("Client One", " Client1@Example.TEST ");

    expect(input).toEqual({ ok: true, name: "Client One", email: "client1@example.test" });
  });

  it("AC-HOLD-35: « Client3@Example.TEST » зберігається й показується як client3@example.test", () => {
    expect(normalizeEmail(" Client3@Example.TEST ")).toBe("client3@example.test");
    expect(validateClient("Client Three", " Client3@Example.TEST ")).toEqual({
      ok: true,
      name: "Client Three",
      email: "client3@example.test",
    });
  });
});
