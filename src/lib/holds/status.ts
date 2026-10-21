// Статуси рахує читання з поточного часу — без фонової задачі (openspec/specs/slot-holds: «Прострочення утримання»).
import type { HoldRow, SlotRow } from "./types";

export type HoldStatus = "Held" | "Confirmed" | "Expired";
/** «Free» — англійська назва статусу «вільний» в інтерфейсі (власне припущення, docs/spec-reading.md). */
export type SlotStatus = "Free" | "Held" | "Confirmed" | "Past";

const time = (iso: string) => new Date(iso).getTime();

/** Підтверджене — «Confirmed»; непідтверджене — «Held» до expires_at (created_at + 1440 хвилин), з цієї миті — «Expired». */
export function holdStatus(hold: Pick<HoldRow, "confirmed_at" | "expires_at">, now: Date): HoldStatus {
  if (hold.confirmed_at) return "Confirmed";
  return now.getTime() >= time(hold.expires_at) ? "Expired" : "Held";
}

/** Активне утримання слоту — «Held» або «Confirmed»; прострочені не займають слот. */
export function activeHold<T extends Pick<HoldRow, "confirmed_at" | "expires_at">>(
  holds: readonly T[],
  now: Date,
): T | undefined {
  return holds.find((hold) => holdStatus(hold, now) !== "Expired");
}

export function hasStarted(slot: Pick<SlotRow, "starts_at">, now: Date): boolean {
  return now.getTime() >= time(slot.starts_at);
}

/**
 * Статус слоту: за активним утриманням — «Held» / «Confirmed»; без нього — «Past», якщо слот уже почався
 * (з моменту початку включно), інакше «Free».
 */
export function slotStatus(
  slot: Pick<SlotRow, "starts_at">,
  holds: readonly Pick<HoldRow, "confirmed_at" | "expires_at">[],
  now: Date,
): SlotStatus {
  const active = activeHold(holds, now);
  if (active) return holdStatus(active, now) === "Confirmed" ? "Confirmed" : "Held";
  return hasStarted(slot, now) ? "Past" : "Free";
}
