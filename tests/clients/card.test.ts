import { describe, expect, it } from "vitest";
import {
  CARD_MESSAGES,
  CARD_NOT_FOUND,
  cardErrorCode,
  cardRoleError,
  EMPTY_CARD_FORM,
  NO_ACCESS_TO_CLIENT,
  NO_CARDS_YET,
  NO_CLIENTS_YET,
  validateClientCard,
  type CardForm,
} from "@/lib/clients/card";
import { clientContact } from "@/lib/holds/types";

// Перевірка форми в дії createClientCard (src/app/clients/actions.ts). Запис, RLS і check-обмеження бази —
// tests/db/client-cards.test.ts. «Сьогодні» в America/Los_Angeles — параметр.
const TODAY = "2026-11-03";
const form = (values: Partial<CardForm>): CardForm => ({ ...EMPTY_CARD_FORM, ...values });

const clientSix = form({
  type: "adult",
  name: "Client Six",
  email: "client6@example.test",
  dateOfBirth: "1990-05-14",
  language: "English",
});
const clientSeven = form({
  type: "child",
  name: "Client Seven",
  dateOfBirth: "2015-03-02",
  language: "Spanish",
  guardianName: "Guardian Seven",
  guardianEmail: "guardian7@example.test",
});
const clientEight = form({ type: "child", name: "Client Eight", dateOfBirth: "2016-01-10", language: "English" });

describe("картка клієнта — перевірка форми (openspec/specs/client-cards)", () => {
  it("AC-CARD-01: «Adult», «Client Six», client6@example.test, 1990-05-14, «English» — форма приймає всі дані", () => {
    expect(validateClientCard(clientSix, TODAY)).toEqual({
      ok: true,
      row: {
        client_type: "adult",
        name: "Client Six",
        email: "client6@example.test",
        date_of_birth: "1990-05-14",
        session_language: "English",
        guardian_name: null,
        guardian_email: null,
      },
    });
  });

  it("AC-CARD-02: «Child» «Client Seven» з опікуном — без власного email; під час утримання біля дитини email опікуна", () => {
    const input = validateClientCard(clientSeven, TODAY);

    expect(input).toEqual({
      ok: true,
      row: {
        client_type: "child",
        name: "Client Seven",
        email: null,
        date_of_birth: "2015-03-02",
        session_language: "Spanish",
        guardian_name: "Guardian Seven",
        guardian_email: "guardian7@example.test",
      },
    });
    expect(input.ok && clientContact(input.row)).toBe("guardian: guardian7@example.test");
  });

  it("AC-CARD-03: порожнє ім'я або email опікуна — картку не створено, «Enter the guardian's name and a valid email.»", () => {
    const emptyName = validateClientCard({ ...clientEight, guardianEmail: "guardian8@example.test" }, TODAY);
    const emptyEmail = validateClientCard({ ...clientEight, guardianName: "Guardian Eight" }, TODAY);

    expect(emptyName).toEqual({ ok: false, errors: ["GUARDIAN_INVALID"] });
    expect(emptyEmail).toEqual({ ok: false, errors: ["GUARDIAN_INVALID"] });
    expect(CARD_MESSAGES.GUARDIAN_INVALID).toBe("Enter the guardian's name and a valid email.");
  });

  it("AC-CARD-03: некоректний email опікуна (правило PM) — та сама відмова", () => {
    const input = validateClientCard({ ...clientEight, guardianName: "Guardian Eight", guardianEmail: "guardian8@example" }, TODAY);

    expect(input).toEqual({ ok: false, errors: ["GUARDIAN_INVALID"] });
  });

  it("AC-CARD-06: терапевт — «Only schedulers and admins can create client cards.» ще до перевірки форми", () => {
    expect(cardRoleError("therapist")).toBe("CARD_FORBIDDEN");
    expect(cardRoleError(null)).toBe("CARD_FORBIDDEN");
    expect(cardRoleError("scheduler")).toBeNull();
    expect(cardRoleError("admin")).toBeNull();
    expect(CARD_MESSAGES.CARD_FORBIDDEN).toBe("Only schedulers and admins can create client cards.");
    // Якщо запит обійде дію, відмовить RLS (42501) — той самий текст.
    expect(cardErrorCode("42501")).toBe("CARD_FORBIDDEN");
  });

  it("AC-HOLD-16: дублікат email дорослого в повній формі — «A client with this email already exists.»", () => {
    expect(CARD_MESSAGES[cardErrorCode("23505")]).toBe("A client with this email already exists.");
  });

  it("AC-HOLD-41: ім'я, ім'я та email опікуна — без пробілів по краях, email опікуна малими літерами", () => {
    const input = validateClientCard(
      { ...clientSeven, name: " Client Seven ", guardianName: " Guardian Seven ", guardianEmail: " Guardian7@Example.TEST " },
      TODAY,
    );

    expect(input.ok && [input.row.name, input.row.guardian_name, input.row.guardian_email]).toEqual([
      "Client Seven",
      "Guardian Seven",
      "guardian7@example.test",
    ]);
  });
});

// Рішення PM на Q5 (Sofiia-pm/therapy-scheduling-spec#21): окреме повідомлення на кожну проблему, усі одразу.
describe("картка клієнта — обов'язкові поля (openspec/specs/client-cards)", () => {
  it("AC-CARD-12: сьогодні 2026-11-03 — дитина без імені, з датою 2026-11-04, без мови: три повідомлення одразу", () => {
    const input = validateClientCard(
      { ...clientSeven, name: "   ", dateOfBirth: "2026-11-04", language: "" },
      TODAY,
    );

    expect(input).toEqual({ ok: false, errors: ["CHILD_NAME", "BIRTH_DATE", "LANGUAGE"] });
    expect(CARD_MESSAGES.CHILD_NAME).toBe("Enter the client's name.");
    expect(CARD_MESSAGES.BIRTH_DATE).toBe("Enter a date of birth that is not in the future.");
    expect(CARD_MESSAGES.LANGUAGE).toBe("Select a session language.");
  });

  it("AC-CARD-12: дата народження, що дорівнює сьогоднішній, коректна; неіснуюча чи порожня — ні", () => {
    expect(validateClientCard({ ...clientSix, dateOfBirth: TODAY }, TODAY).ok).toBe(true);
    expect(validateClientCard({ ...clientSix, dateOfBirth: "2026-02-30" }, TODAY)).toEqual({
      ok: false,
      errors: ["BIRTH_DATE"],
    });
    expect(validateClientCard({ ...clientSix, dateOfBirth: "" }, TODAY)).toEqual({ ok: false, errors: ["BIRTH_DATE"] });
  });

  it("AC-CARD-12: тип клієнта не вибрано — «Select a client type.» разом з іншими помилками спільних полів", () => {
    expect(validateClientCard({ ...clientSix, type: "couple" }, TODAY)).toEqual({ ok: false, errors: ["TYPE_INVALID"] });
    expect(validateClientCard({ ...EMPTY_CARD_FORM }, TODAY)).toEqual({
      ok: false,
      errors: ["TYPE_INVALID", "CHILD_NAME", "BIRTH_DATE", "LANGUAGE"],
    });
    expect(EMPTY_CARD_FORM.type).toBe(""); // тип вибирає планувальник, за замовчуванням не вибрано
    expect(CARD_MESSAGES.TYPE_INVALID).toBe("Select a client type.");
  });

  it("AC-CARD-13: дублікат картки дитини (індекс clients_child_card_key) — «A client with these details already exists.»", () => {
    const message = 'duplicate key value violates unique constraint "clients_child_card_key"';
    expect(cardErrorCode("23505", message)).toBe("CHILD_DUPLICATE");
    expect(CARD_MESSAGES.CHILD_DUPLICATE).toBe("A client with these details already exists.");
    // ім'я дублікату порівнюється без пробілів по краях і регістру: форма обрізає, індекс — lower(name)
    const input = validateClientCard({ ...clientSeven, name: " client seven ", language: "English" }, TODAY);
    expect(input.ok && input.row.name).toBe("client seven");
  });

  it("AC-CARD-15: карток ще немає — для планувальника й адміністратора свій текст, для терапевта — AC-CARD-09", () => {
    expect(NO_CARDS_YET).toBe("No clients yet. Create a client card from an intake form.");
    expect(NO_CLIENTS_YET).toBe("No clients yet. Clients appear here when a scheduler holds a slot with you.");
  });

  it("AC-CARD-16: картки немає — планувальник «This client card doesn't exist.», терапевт — як для чужої", () => {
    expect(CARD_NOT_FOUND).toBe("This client card doesn't exist.");
    expect(NO_ACCESS_TO_CLIENT).toBe("You don't have access to this client.");
  });
});
