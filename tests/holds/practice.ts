// Модель бази для тестів: ті самі кроки, що й private.hold_slot_at / private.confirm_hold_at
// (supabase/migrations/20261021160000_hold_and_confirm.sql), поверх правил src/lib/holds/rules.ts.
import { buildDayView } from "@/lib/holds/day-view";
import { checkConfirm, checkHold, newHold, type ConfirmCode, type HoldCode } from "@/lib/holds/rules";
import type { ClientRow, HoldRow, Role, SlotRow } from "@/lib/holds/types";

export class Practice {
  holds: HoldRow[] = [];
  private seq = 0;

  constructor(
    public slots: SlotRow[],
    public clients: ClientRow[],
  ) {}

  private open() {
    return this.holds.filter((hold) => hold.released_at === null);
  }

  hold(role: Role, slotId: string, clientId: string, now: Date): HoldCode {
    const slot = this.slots.find((candidate) => candidate.id === slotId);
    if (!slot || !this.clients.some((client) => client.id === clientId)) return "NOT_FOUND";
    const open = this.open();
    const code = checkHold({
      role,
      slot,
      slotHolds: open.filter((hold) => hold.slot_id === slotId),
      clientHolds: open
        .filter((hold) => hold.client_id === clientId)
        .map((hold) => ({ hold, slot: this.slots.find((s) => s.id === hold.slot_id)! })),
      now,
    });
    if (code !== "OK") return code;
    // Прострочене відкрите утримання слоту звільняє та сама дія.
    for (const hold of open) if (hold.slot_id === slotId) hold.released_at = now.toISOString();
    this.seq += 1;
    this.holds.push(newHold(`h${this.seq}`, slotId, clientId, now));
    return "OK";
  }

  confirm(role: Role, holdId: string, now: Date): ConfirmCode {
    const hold = this.holds.find((candidate) => candidate.id === holdId);
    const slot = hold && this.slots.find((candidate) => candidate.id === hold.slot_id);
    if (!hold || !slot) return "NOT_FOUND";
    const code = checkConfirm({ role, hold, slot, now });
    if (code === "OK") hold.confirmed_at = now.toISOString();
    return code;
  }

  /** Останнє утримання слоту (те, що бачить сторінка). */
  holdOf(slotId: string): HoldRow | undefined {
    return this.open().find((hold) => hold.slot_id === slotId);
  }

  day(now: Date) {
    return buildDayView(this.slots, this.open(), this.clients, now);
  }
}
