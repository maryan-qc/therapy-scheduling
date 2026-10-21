// Дані для тестів зрізу 1: час — America/Los_Angeles, як у критеріях PM.
import { practiceInstant } from "@/lib/holds/time";
import type { ClientRow, HoldRow, SlotRow } from "@/lib/holds/types";

/** ISO-мить для «РРРР-ММ-ДД ГГ:ХХ» часу практики. */
export const at = (date: string, time: string) => practiceInstant(date, time).toISOString();
export const now = (date: string, time: string) => practiceInstant(date, time);

export const client1: ClientRow = { id: "client-1", name: "client1", email: "client1@example.test" };
export const client2: ClientRow = { id: "client-2", name: "client2", email: "client2@example.test" };

export function slot(id: string, date: string, time: string, therapistId = "therapist-1"): SlotRow {
  const startsAt = practiceInstant(date, time);
  return {
    id,
    therapist_id: therapistId,
    starts_at: startsAt.toISOString(),
    ends_at: new Date(startsAt.getTime() + 60 * 60_000).toISOString(),
  };
}

/** Утримання, створене в мить `createdAt` (ISO): діє 1440 хвилин. */
export function hold(
  id: string,
  slotId: string,
  createdAt: string,
  options: { clientId?: string; confirmedAt?: string } = {},
): HoldRow {
  return {
    id,
    slot_id: slotId,
    client_id: options.clientId ?? client1.id,
    created_at: createdAt,
    expires_at: new Date(new Date(createdAt).getTime() + 1440 * 60_000).toISOString(),
    confirmed_at: options.confirmedAt ?? null,
    released_at: null,
  };
}
