// Розклад терапевта на тиждень і список утримань планувальника (openspec/specs/slot-holds: «Розклад терапевта»,
// «Видимість простроченого утримання», «Список утримань планувальника», «Прострочення утримання»).
import { buildDayView, type DaySlot } from "./day-view";
import { hasStarted, holdStatus, type HoldStatus } from "./status";
import { addDays, practiceDate } from "./time";
import type { ClientName, ClientRow, HoldRow, SlotRow, TherapistRow } from "./types";

/** Слот у розкладі терапевта: в утриманні — ім'я клієнта без email (AC-HOLD-40). */
export type ScheduleSlot = Omit<DaySlot, "hold"> & { hold?: Omit<NonNullable<DaySlot["hold"]>, "clientEmail"> };

export interface ScheduleDay {
  date: string;
  slots: ScheduleSlot[];
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
  clients: readonly ClientName[],
  now: Date,
): ScheduleDay[] {
  const own = slots.filter((slot) => slot.therapist_id === therapistId);
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(monday, index);
    const daySlots = own.filter((slot) => practiceDate(new Date(slot.starts_at)) === date);
    const view = buildDayView(daySlots, holds, clients, now).slots.map(({ hold, ...slot }): ScheduleSlot =>
      hold ? { ...slot, hold: { id: hold.id, clientName: hold.clientName, heldUntil: hold.heldUntil } } : slot,
    );
    return { date, slots: view };
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
 * Список утримань планувальника й адміністратора — лише «Held» і «Expired», слот яких ще не почався (з моменту
 * початку включно не показано), за часом слоту від найближчого; підтверджених сеансів у ньому немає (AC-HOLD-38,
 * AC-HOLD-42, AC-HOLD-20, AC-HOLD-28, AC-HOLD-29). Прострочене утримання клієнта зникає, щойно за тим самим клієнтом
 * знову утримали той самий слот (AC-HOLD-37).
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
  const heldAgain = (expired: HoldRow) =>
    holds.some(
      (other) =>
        other.slot_id === expired.slot_id &&
        other.client_id === expired.client_id &&
        new Date(other.created_at).getTime() > new Date(expired.created_at).getTime(),
    );
  return holds
    .flatMap((hold): HoldListItem[] => {
      const slot = slotById.get(hold.slot_id);
      if (!slot || hasStarted(slot, now)) return [];
      const status = hold.released_at ? "Expired" : holdStatus(hold, now);
      if (status === "Confirmed" || (status === "Expired" && heldAgain(hold))) return [];
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
