// Коди відповідей функцій бази утримання й підтвердження (supabase/migrations/20261021160000_hold_and_confirm.sql).
// Рішення ухвалює лише база — копії правил на TypeScript немає; функції перевіряють тести tests/db/*.test.ts на PGlite.

export type HoldCode = "OK" | "HOLD_FORBIDDEN" | "SLOT_STARTED" | "SLOT_UNAVAILABLE" | "CLIENT_BUSY" | "NOT_FOUND";
export type ConfirmCode =
  | "OK"
  | "CONFIRM_FORBIDDEN"
  | "ALREADY_CONFIRMED"
  | "HOLD_EXPIRED"
  | "SLOT_STARTED"
  | "NOT_FOUND";

/** Код із відповіді функції бази ({ code: … }); незрозуміла відповідь — NOT_FOUND. */
export function readCode<T extends string>(data: unknown, known: readonly T[], fallback: T): T {
  const code = typeof data === "object" && data !== null ? (data as { code?: unknown }).code : undefined;
  return known.find((candidate) => candidate === code) ?? fallback;
}
