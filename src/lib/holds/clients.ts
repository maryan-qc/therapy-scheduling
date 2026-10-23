// Картка клієнта: ім'я та email (openspec/specs/clients). Ті самі правила тримає база (check і unique на clients).

export const INVALID_CLIENT_MESSAGE = "Enter the client's name and a valid email.";
export const DUPLICATE_CLIENT_MESSAGE = "A client with this email already exists.";

export type ClientErrorCode = "CLIENT_INVALID" | "CLIENT_DUPLICATE";

/** Email зберігається й показується малими літерами без пробілів на початку й у кінці (AC-HOLD-35). */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

// Правило PM (AC-HOLD-39): рівно один «@», непорожня частина до нього, крапка в частині після «@», без пробілів.
// Те саме правило — check-обмеження clients_email_format і clients_guardian_email_format у базі.
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]*\.[^@\s]*$/;

/** Email після normalizeEmail коректний за правилом PM (і для email опікуна, AC-CARD-03). */
export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}

export type ClientInput =
  | { ok: true; name: string; email: string }
  | { ok: false; code: ClientErrorCode };

export function validateClient(rawName: string, rawEmail: string): ClientInput {
  const name = rawName.trim();
  const email = normalizeEmail(rawEmail);
  if (!name || !isValidEmail(email)) return { ok: false, code: "CLIENT_INVALID" };
  return { ok: true, name, email };
}

/**
 * Помилка Postgres під час insert → код повідомлення: 23505 — unique (дублікат, AC-HOLD-16, AC-HOLD-34: email уже
 * нормалізовано, тож регістр і пробіли не допоможуть), 23514 — check.
 */
export function clientErrorCode(postgresCode: string | undefined): ClientErrorCode {
  return postgresCode === "23505" ? "CLIENT_DUPLICATE" : "CLIENT_INVALID";
}

export const CLIENT_MESSAGES: Record<ClientErrorCode, string> = {
  CLIENT_INVALID: INVALID_CLIENT_MESSAGE,
  CLIENT_DUPLICATE: DUPLICATE_CLIENT_MESSAGE,
};
