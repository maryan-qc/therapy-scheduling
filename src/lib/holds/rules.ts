// Правила утримання й підтвердження — у тому самому порядку, що й функції бази
// (supabase/migrations/20261021160000_hold_and_confirm.sql). Рішення ухвалює база; тут — для тестів і сторінок.
import { activeHold, hasStarted, holdStatus } from "./status";
import { isStaff, type HoldRow, type Role, type SlotRow } from "./types";

export type HoldCode = "OK" | "HOLD_FORBIDDEN" | "SLOT_STARTED" | "SLOT_UNAVAILABLE" | "CLIENT_BUSY" | "NOT_FOUND";
export type ConfirmCode =
  | "OK"
  | "CONFIRM_FORBIDDEN"
  | "ALREADY_CONFIRMED"
  | "HOLD_EXPIRED"
  | "SLOT_STARTED"
  | "NOT_FOUND";

export const HOLD_MINUTES = 1440;

const overlaps = (a: Pick<SlotRow, "starts_at" | "ends_at">, b: Pick<SlotRow, "starts_at" | "ends_at">) =>
  new Date(a.starts_at).getTime() < new Date(b.ends_at).getTime() &&
  new Date(a.ends_at).getTime() > new Date(b.starts_at).getTime();

export interface HoldAttempt {
  role: Role | null;
  slot: SlotRow;
  /** Відкриті (released_at is null) утримання цього слоту. */
  slotHolds: readonly HoldRow[];
  /** Відкриті утримання й сеанси клієнта разом з їхніми слотами. */
  clientHolds: readonly { hold: HoldRow; slot: SlotRow }[];
  now: Date;
}

export function checkHold({ role, slot, slotHolds, clientHolds, now }: HoldAttempt): HoldCode {
  if (!isStaff(role)) return "HOLD_FORBIDDEN";
  if (hasStarted(slot, now)) return "SLOT_STARTED";
  if (activeHold(slotHolds, now)) return "SLOT_UNAVAILABLE";
  const busy = clientHolds.some(
    ({ hold, slot: other }) => holdStatus(hold, now) !== "Expired" && overlaps(other, slot),
  );
  return busy ? "CLIENT_BUSY" : "OK";
}

/** Нове утримання, як його вставляє функція бази: діє 1440 хвилин від миті створення. */
export function newHold(id: string, slotId: string, clientId: string, now: Date): HoldRow {
  return {
    id,
    slot_id: slotId,
    client_id: clientId,
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + HOLD_MINUTES * 60_000).toISOString(),
    confirmed_at: null,
    released_at: null,
  };
}

export interface ConfirmAttempt {
  role: Role | null;
  hold: HoldRow;
  slot: Pick<SlotRow, "starts_at">;
  now: Date;
}

export function checkConfirm({ role, hold, slot, now }: ConfirmAttempt): ConfirmCode {
  if (!isStaff(role)) return "CONFIRM_FORBIDDEN";
  if (hold.confirmed_at) return "ALREADY_CONFIRMED";
  if (hold.released_at || holdStatus(hold, now) === "Expired") return "HOLD_EXPIRED";
  if (hasStarted(slot, now)) return "SLOT_STARTED";
  return "OK";
}

/** Код із відповіді функції бази ({ code: … }); незрозуміла відповідь — NOT_FOUND. */
export function readCode<T extends string>(data: unknown, known: readonly T[], fallback: T): T {
  const code = typeof data === "object" && data !== null ? (data as { code?: unknown }).code : undefined;
  return known.find((candidate) => candidate === code) ?? fallback;
}
