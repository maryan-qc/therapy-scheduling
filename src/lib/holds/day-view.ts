// Слоти терапевта на день для планувальника (openspec/specs/slot-holds: «Перегляд слотів дня», «День без вільних слотів»).
import { activeHold, slotStatus, type SlotStatus } from "./status";
import type { ClientName, ClientRow, HoldRow, SlotRow } from "./types";

export const NO_FREE_SLOTS = "No free slots on this day.";

export interface DaySlot {
  id: string;
  startsAt: string;
  endsAt: string;
  status: SlotStatus;
  /** Утримати можна лише вільний слот. */
  canHold: boolean;
  hold?: {
    id: string;
    clientName: string;
    clientEmail: string;
    /** «Held until» — лише для «Held»; у «Confirmed» його більше не показано. */
    heldUntil: string | null;
  };
}

export interface DayView {
  slots: DaySlot[];
  /** «No free slots on this day.», якщо вільних слотів немає (слоти «Past» не вільні). */
  message: string | null;
}

export function buildDayView(
  slots: readonly SlotRow[],
  holds: readonly HoldRow[],
  // Розклад терапевта передає клієнтів без email (AC-HOLD-40).
  clients: readonly (ClientName & Partial<Pick<ClientRow, "email">>)[],
  now: Date,
): DayView {
  const clientById = new Map(clients.map((client) => [client.id, client]));
  const views = [...slots]
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    .map((slot): DaySlot => {
      const slotHolds = holds.filter((hold) => hold.slot_id === slot.id);
      const status = slotStatus(slot, slotHolds, now);
      const active = activeHold(slotHolds, now);
      const client = active ? clientById.get(active.client_id) : undefined;
      return {
        id: slot.id,
        startsAt: slot.starts_at,
        endsAt: slot.ends_at,
        status,
        canHold: status === "Free",
        hold: active
          ? {
              id: active.id,
              clientName: client?.name ?? "—",
              clientEmail: client?.email ?? "",
              heldUntil: status === "Held" ? active.expires_at : null,
            }
          : undefined,
      };
    });
  return {
    slots: views,
    message: views.some((slot) => slot.status === "Free") ? null : NO_FREE_SLOTS,
  };
}
