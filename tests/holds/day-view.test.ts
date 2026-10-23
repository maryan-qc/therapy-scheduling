import { describe, expect, it } from "vitest";
import { buildDayView, NO_FREE_SLOTS } from "@/lib/holds/day-view";
import { at, client1, client2, hold, now, slot } from "./fixtures";

describe("слоти дня (openspec/specs/slot-holds)", () => {
  it("AC-HOLD-01: зараз 2026-11-02 09:00 — 10:00 вільний, 11:00 «Held», 12:00 «Confirmed», утримати можна лише 10:00", () => {
    const slots = [slot("s10", "2026-11-03", "10:00"), slot("s11", "2026-11-03", "11:00"), slot("s12", "2026-11-03", "12:00")];
    const holds = [
      hold("h11", "s11", at("2026-11-01", "14:30")),
      hold("h12", "s12", at("2026-11-01", "14:00"), { clientId: client2.id, confirmedAt: at("2026-11-01", "14:10") }),
    ];

    const view = buildDayView(slots, holds, [client1, client2], now("2026-11-02", "09:00"));

    expect(view.slots.map((s) => s.status)).toEqual(["Free", "Held", "Confirmed"]);
    expect(view.slots.map((s) => s.canHold)).toEqual([true, false, false]);
    expect(view.message).toBeNull();
  });

  it("AC-HOLD-18: усі слоти дня утримані або підтверджені — повідомлення й обидва слоти зі статусами", () => {
    const slots = [slot("s10", "2026-11-04", "10:00"), slot("s11", "2026-11-04", "11:00")];
    const holds = [
      hold("h10", "s10", at("2026-11-03", "14:30")),
      hold("h11", "s11", at("2026-11-03", "09:00"), { confirmedAt: at("2026-11-03", "09:30") }),
    ];

    const view = buildDayView(slots, holds, [client1], now("2026-11-03", "15:00"));

    expect(view.message).toBe("No free slots on this day.");
    expect(view.slots.map((s) => s.status)).toEqual(["Held", "Confirmed"]);
  });

  it("AC-HOLD-24: день без жодного слоту — лише повідомлення", () => {
    const view = buildDayView([], [], [], now("2026-11-05", "09:00"));

    expect(view.message).toBe(NO_FREE_SLOTS);
    expect(view.slots).toEqual([]);
  });

  it("AC-HOLD-32: о 12:30 вільний слот 10:00 і слот 11:00 з простроченим утриманням — «Past», утримати не можна", () => {
    const slots = [slot("s10", "2026-11-03", "10:00"), slot("s11", "2026-11-03", "11:00")];
    // Утримання 11:00 створене 2026-11-02 о 10:00 — прострочене з 2026-11-03 10:00.
    const holds = [hold("h11", "s11", at("2026-11-02", "10:00"))];

    const view = buildDayView(slots, holds, [client1], now("2026-11-03", "12:30"));

    expect(view.slots.map((s) => s.status)).toEqual(["Past", "Past"]);
    expect(view.slots.every((s) => !s.canHold)).toBe(true);
  });

  it("AC-HOLD-33: попереду немає вільних — повідомлення й усі чотири слоти зі статусами", () => {
    const slots = [
      slot("s10", "2026-11-03", "10:00"),
      slot("s11", "2026-11-03", "11:00"),
      slot("s13", "2026-11-03", "13:00"),
      slot("s14", "2026-11-03", "14:00"),
    ];
    const holds = [
      hold("h13", "s13", at("2026-11-02", "14:30")),
      hold("h14", "s14", at("2026-11-02", "16:00"), { confirmedAt: at("2026-11-02", "16:30") }),
    ];

    const view = buildDayView(slots, holds, [client1], now("2026-11-03", "12:30"));

    expect(view.message).toBe(NO_FREE_SLOTS);
    expect(view.slots.map((s) => s.status)).toEqual(["Past", "Past", "Held", "Confirmed"]);
  });
});
