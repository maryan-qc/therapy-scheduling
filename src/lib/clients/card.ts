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
  | "CLIENT_DUPLICATE";

export const CARD_MESSAGES: Record<CardErrorCode, string> = {
  CARD_FORBIDDEN: "Only schedulers and admins can create client cards.", // AC-CARD-06
  TYPE_INVALID: "Select a client type.", // власне: форма завжди надсилає тип, лише підроблений запит — без нього
  CLIENT_INVALID: INVALID_CLIENT_MESSAGE, // ім'я та email дорослого (AC-HOLD-11, 15, 39, 41)
  CHILD_NAME: "Enter the client's name.", // Q5, робочий варіант A
  BIRTH_DATE: "Enter a date of birth that is not in the future.", // Q5, робочий варіант A
  LANGUAGE: "Select a session language.", // Q5, робочий варіант A
  GUARDIAN_INVALID: "Enter the guardian's name and a valid email.", // AC-CARD-03
  CLIENT_DUPLICATE: DUPLICATE_CLIENT_MESSAGE, // AC-HOLD-16, AC-HOLD-34
};

export const CLIENT_NOT_FOUND = "Client not found."; // Q7, робочий варіант A
export const NO_ACCESS_TO_CLIENT = "You don't have access to this client."; // AC-CARD-05, AC-CARD-08
export const NO_CLIENTS_YET = "No clients yet. Clients appear here when a scheduler holds a slot with you."; // AC-CARD-09

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

export const EMPTY_CARD_FORM: CardForm = {
  type: "adult",
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
 * Перевірка картки на сервері. Помилки — у порядку полів форми, усі одразу (Q5, робочий варіант A). Ім'я та імена
 * опікуна — без пробілів по краях, email — малими літерами без пробілів (AC-HOLD-35, AC-HOLD-41).
 */
export function validateClientCard(form: CardForm, today: string): CardInput {
  if (form.type !== "adult" && form.type !== "child") return { ok: false, errors: ["TYPE_INVALID"] };
  const type: ClientType = form.type;
  const name = form.name.trim();
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

/** Помилка Postgres під час insert → код: 23505 — дублікат email (AC-HOLD-16), 42501 — RLS чи GRANT (AC-CARD-06). */
export function cardErrorCode(postgresCode: string | undefined): CardErrorCode {
  if (postgresCode === "23505") return "CLIENT_DUPLICATE";
  if (postgresCode === "42501") return "CARD_FORBIDDEN";
  return "CLIENT_INVALID";
}
