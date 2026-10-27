// Ім'я та email клієнта (openspec/specs/clients). Після зрізу 2 клієнта створюють лише повною формою картки
// (src/lib/clients/card.ts, Sofiia-pm/therapy-scheduling-spec#20); ті самі правила тримає база (check і unique на clients).

export const INVALID_CLIENT_MESSAGE = "Enter the client's name and a valid email.";
export const DUPLICATE_CLIENT_MESSAGE = "A client with this email already exists.";

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
