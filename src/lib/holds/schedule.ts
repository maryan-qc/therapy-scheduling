// Розклад терапевта на тиждень і список утримань планувальника
// (openspec/specs/slot-holds: «Розклад терапевта», «Видимість простроченого утримання»).
import { buildDayView, type DaySlot } from "./day-view";
import { hasStarted, holdStatus, type HoldStatus } from "./status";
import { addDays, practiceDate } from "./time";
import type { ClientRow, HoldRow, SlotRow, TherapistRow } from "./types";

export interface ScheduleDay {
  date: string;
  slots: DaySlot[];
}

/**
 * Тиждень терапевта з понеділка по неділю: усі його слоти зі статусами Free / Held / Confirmed / Past.
 * Прострочені утримання не показано — їхній слот вільний (AC-HOLD-21). Чужі слоти відкидаємо (AC-HOLD-09), як і RLS.
 */
export function buildSchedule(
  therapistId: string,
  monday: string,
  slots: readonly SlotRow[],
  holds: readonly HoldRow[],
  clients: readonly ClientRow[],
  now: Date,
): ScheduleDay[] {
  const own = slots.filter((slot) => slot.therapist_id === therapistId);
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(monday, index);
    const daySlots = own.filter((slot) => practiceDate(new Date(slot.starts_at)) === date);
    return { date, slots: buildDayView(daySlots, holds, clients, now).slots };
  });
}

export interface HoldListItem {
  holdId: string;
  status: HoldStatus;
  clientName: string;
  clientEmail: string;
  therapistName: string;
  slotStartsAt: string;
  heldUntil: string | null;
}

/**
 * Утримання для планувальника й адміністратора: «Held», «Confirmed» і «Expired»; прострочене — лише до початку його
 * слоту, з моменту початку (включно) його не показано (AC-HOLD-20, AC-HOLD-28, AC-HOLD-29).
 */
export function buildHoldsList(
  holds: readonly HoldRow[],
  slots: readonly SlotRow[],
  clients: readonly ClientRow[],
  therapists: readonly TherapistRow[],
  now: Date,
): HoldListItem[] {
  const slotById = new Map(slots.map((slot) => [slot.id, slot]));
  const clientById = new Map(clients.map((client) => [client.id, client]));
  const therapistById = new Map(therapists.map((therapist) => [therapist.id, therapist]));
  return holds
    .flatMap((hold): HoldListItem[] => {
      const slot = slotById.get(hold.slot_id);
      if (!slot) return [];
      const status = hold.released_at ? "Expired" : holdStatus(hold, now);
      if (status === "Expired" && hasStarted(slot, now)) return [];
      const client = clientById.get(hold.client_id);
      return [
        {
          holdId: hold.id,
          status,
          clientName: client?.name ?? "—",
          clientEmail: client?.email ?? "",
          therapistName: therapistById.get(slot.therapist_id)?.name ?? "—",
          slotStartsAt: slot.starts_at,
          heldUntil: status === "Held" ? hold.expires_at : null,
        },
      ];
    })
    .sort((a, b) => new Date(a.slotStartsAt).getTime() - new Date(b.slotStartsAt).getTime());
}
