// Картка клієнта з анкети — дорослий або дитина з опікуном (openspec/specs/client-cards). Ті самі правила тримає база
// (supabase/migrations/20261023104436_client_cards.sql): check-обмеження, тригер дати народження й RLS.
import {
  DUPLICATE_CLIENT_MESSAGE,
  INVALID_CLIENT_MESSAGE,
  isValidEmail,
  normalizeEmail,
} from "@/lib/holds/clients";
import { isStaff, type Role } from "@/lib/holds/types";

export type ClientType = "adult" | "child";
export const CLIENT_TYPE_LABEL: Record<ClientType, string> = { adult: "Adult", child: "Child" };
export const SESSION_LANGUAGES = ["English", "Spanish"] as const;
export type SessionLanguage = (typeof SESSION_LANGUAGES)[number];

/** Поле картки зрізу 1, якого немає (тип «Adult», лише ім'я та email), — припущення PM. */
export const NOT_PROVIDED = "Not provided";

export type CardErrorCode =
  | "CARD_FORBIDDEN"
  | "TYPE_INVALID"
  | "CLIENT_INVALID"
  | "CHILD_NAME"
  | "BIRTH_DATE"
  | "LANGUAGE"
  | "GUARDIAN_INVALID"
  | "CLIENT_DUPLICATE"
  | "CHILD_DUPLICATE"
  | "CARD_DATA_INVALID"
  | "SAVE_FAILED";

export const CARD_MESSAGES: Record<CardErrorCode, string> = {
  CARD_FORBIDDEN: "Only schedulers and admins can create client cards.", // AC-CARD-06
  TYPE_INVALID: "Select a client type.", // тип не вибрано — припущення PM (#19)
  CLIENT_INVALID: INVALID_CLIENT_MESSAGE, // ім'я та email дорослого (AC-HOLD-11, 15, 39, 41)
  CHILD_NAME: "Enter the client's name.", // ім'я дитини чи ім'я, коли тип ще не вибрано (AC-CARD-12)
  BIRTH_DATE: "Enter a date of birth that is not in the future.", // AC-CARD-12
  LANGUAGE: "Select a session language.", // AC-CARD-12
  GUARDIAN_INVALID: "Enter the guardian's name and a valid email.", // AC-CARD-03
  CLIENT_DUPLICATE: DUPLICATE_CLIENT_MESSAGE, // AC-HOLD-16, AC-HOLD-34
  CHILD_DUPLICATE: "A client with these details already exists.", // AC-CARD-13
  // Власні тексти: форма вже перевірила поля, тож ці відповіді бази — рідкісний випадок, і PM текстів для них не дала.
  CARD_DATA_INVALID: "Check the client card fields and try again.", // 23514 — check-обмеження чи тригер дати
  SAVE_FAILED: "The client card was not saved. Try again.", // інша помилка запиту
};

export const CARD_NOT_FOUND = "This client card doesn't exist."; // AC-CARD-16 — планувальник і адміністратор
export const NO_ACCESS_TO_CLIENT = "You don't have access to this client."; // AC-CARD-05, 08, 14, 16 — терапевт
export const NO_CLIENTS_YET = "No clients yet. Clients appear here when a scheduler holds a slot with you."; // AC-CARD-09
export const NO_CARDS_YET = "No clients yet. Create a client card from an intake form."; // AC-CARD-15

/** Картка так, як її читають сторінки /clients і /clients/[id] (рядки фільтрує RLS clients_select). */
export const CARD_COLUMNS =
  "id, name, client_type, date_of_birth, session_language, email, guardian_name, guardian_email" as const;

export interface ClientCardRow {
  id: string;
  name: string;
  client_type: string;
  date_of_birth: string | null;
  session_language: string | null;
  email: string | null;
  guardian_name: string | null;
  guardian_email: string | null;
}

export function clientTypeLabel(type: string): string {
  return type === "child" ? CLIENT_TYPE_LABEL.child : CLIENT_TYPE_LABEL.adult;
}

/** Поля форми так, як їх увів планувальник: повертаються у форму, якщо картку не створено (AC-CARD-03). */
export interface CardForm {
  type: string;
  name: string;
  dateOfBirth: string;
  language: string;
  email: string;
  guardianName: string;
  guardianEmail: string;
}

// Тип вибирає планувальник: за замовчуванням не вибрано (припущення PM, «Select a client type.»).
export const EMPTY_CARD_FORM: CardForm = {
  type: "",
  name: "",
  dateOfBirth: "",
  language: "",
  email: "",
  guardianName: "",
  guardianEmail: "",
};

/** Рядок для insert у public.clients — лише колонки з колонкового GRANT. */
export interface CardRow {
  client_type: ClientType;
  name: string;
  date_of_birth: string;
  session_language: SessionLanguage;
  email: string | null;
  guardian_name: string | null;
  guardian_email: string | null;
}

export type CardInput = { ok: true; row: CardRow } | { ok: false; errors: CardErrorCode[] };

/** Перша перевірка дії: картки створюють лише планувальник і адміністратор (AC-CARD-06). */
export function cardRoleError(role: Role | null): CardErrorCode | null {
  return isStaff(role) ? null : "CARD_FORBIDDEN";
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Справжня дата РРРР-ММ-ДД, не пізніша за `today` (сьогодні в America/Los_Angeles, включно). */
function isBirthDate(value: string, today: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value && value <= today;
}

/**
 * Перевірка картки на сервері. Помилки — у порядку полів форми, усі одразу (AC-CARD-12). Ім'я та імена опікуна — без
 * пробілів по краях, email — малими літерами без пробілів (AC-HOLD-35, AC-HOLD-41). Тип не вибрано — «Select a client
 * type.» разом з помилками спільних полів (ім'я, дата народження, мова).
 */
export function validateClientCard(form: CardForm, today: string): CardInput {
  const name = form.name.trim();
  if (form.type !== "adult" && form.type !== "child") {
    const errors: CardErrorCode[] = ["TYPE_INVALID"];
    if (!name) errors.push("CHILD_NAME");
    if (!isBirthDate(form.dateOfBirth, today)) errors.push("BIRTH_DATE");
    if (!SESSION_LANGUAGES.some((candidate) => candidate === form.language)) errors.push("LANGUAGE");
    return { ok: false, errors };
  }
  const type: ClientType = form.type;
  const email = normalizeEmail(form.email);
  const guardianName = form.guardianName.trim();
  const guardianEmail = normalizeEmail(form.guardianEmail);
  const language = SESSION_LANGUAGES.find((candidate) => candidate === form.language);

  const errors: CardErrorCode[] = [];
  if (type === "adult" && (!name || !isValidEmail(email))) errors.push("CLIENT_INVALID");
  if (type === "child" && !name) errors.push("CHILD_NAME");
  if (!isBirthDate(form.dateOfBirth, today)) errors.push("BIRTH_DATE");
  if (!language) errors.push("LANGUAGE");
  if (type === "child" && (!guardianName || !isValidEmail(guardianEmail))) errors.push("GUARDIAN_INVALID");
  if (errors.length > 0 || !language) return { ok: false, errors };

  return {
    ok: true,
    row: {
      client_type: type,
      name,
      date_of_birth: form.dateOfBirth,
      session_language: language,
      email: type === "adult" ? email : null,
      guardian_name: type === "child" ? guardianName : null,
      guardian_email: type === "child" ? guardianEmail : null,
    },
  };
}

/**
 * Помилка Postgres під час insert → код: 23505 — дублікат (індекс clients_child_card_key — картка дитини, AC-CARD-13;
 * інакше email дорослого, AC-HOLD-16), 42501 — RLS чи GRANT (AC-CARD-06), 23514 — check-обмеження чи тригер дати
 * народження (дані картки), інше — збій збереження.
 */
export function cardErrorCode(postgresCode: string | undefined, message = ""): CardErrorCode {
  if (postgresCode === "23505") return message.includes("clients_child_card_key") ? "CHILD_DUPLICATE" : "CLIENT_DUPLICATE";
  if (postgresCode === "42501") return "CARD_FORBIDDEN";
  if (postgresCode === "23514") return "CARD_DATA_INVALID";
  return "SAVE_FAILED";
}
