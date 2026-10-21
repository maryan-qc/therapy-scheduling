import { describe, expect, it } from "vitest";
import { CONFIRM_MESSAGES, HOLD_MESSAGES } from "@/lib/holds/messages";
import { holdStatus } from "@/lib/holds/status";
import { formatPracticeDateTime } from "@/lib/holds/time";
import { client1, client2, now, slot } from "./fixtures";
import { Practice } from "./practice";

const slot10 = () => slot("s10", "2026-11-03", "10:00");

describe("утримання слоту (openspec/specs/slot-holds)", () => {
  it("AC-HOLD-02: утримання 2026-11-02 14:30 — «Held», client1, «Held until 2026-11-03 14:30», слот ніхто не бачить вільним", () => {
    const practice = new Practice([slot10()], [client1, client2]);

    expect(practice.hold("scheduler", "s10", client1.id, now("2026-11-02", "14:30"))).toBe("OK");

    const [view] = practice.day(now("2026-11-02", "14:31")).slots;
    expect(view.status).toBe("Held");
    expect(view.hold?.clientName).toBe("client1");
    expect(`Held until ${formatPracticeDateTime(view.hold!.heldUntil!)}`).toBe("Held until 2026-11-03 14:30");
    expect(view.canHold).toBe(false);
  });

  it("AC-HOLD-03: слот уже утримано за client1 — інший планувальник не утримає його за client2", () => {
    const practice = new Practice([slot10()], [client1, client2]);
    practice.hold("scheduler", "s10", client1.id, now("2026-11-02", "14:30"));

    const code = practice.hold("scheduler", "s10", client2.id, now("2026-11-02", "15:00"));

    expect(code).toBe("SLOT_UNAVAILABLE");
    expect(HOLD_MESSAGES[code]).toBe("This slot is no longer available.");
    expect(practice.holds).toHaveLength(1);
  });

  it("AC-HOLD-04: двоє планувальників одночасно — рівно одне утримання, другий бачить відмову", () => {
    const practice = new Practice([slot10()], [client1, client2]);
    const moment = now("2026-11-02", "14:30");

    // База серіалізує виклики блокуванням рядка слота (select … for update): другий бачить перше утримання.
    const codes = [practice.hold("scheduler", "s10", client1.id, moment), practice.hold("scheduler", "s10", client2.id, moment)];

    expect(codes).toEqual(["OK", "SLOT_UNAVAILABLE"]);
    expect(practice.holds).toHaveLength(1);
    expect(HOLD_MESSAGES[codes[1]]).toBe("This slot is no longer available.");
  });

  it("AC-HOLD-05: о 2026-11-03 14:29 утримання від 2026-11-02 14:30 досі «Held»", () => {
    const practice = new Practice([slot("s", "2026-11-05", "10:00")], [client1]);
    practice.hold("scheduler", "s", client1.id, now("2026-11-02", "14:30"));

    expect(practice.day(now("2026-11-03", "14:29")).slots[0].status).toBe("Held");
  });

  it("AC-HOLD-06: о 2026-11-03 14:30 утримання «Expired», слот вільний і його можна утримати за іншим клієнтом", () => {
    const practice = new Practice([slot("s", "2026-11-05", "10:00")], [client1, client2]);
    practice.hold("scheduler", "s", client1.id, now("2026-11-02", "14:30"));
    const at1430 = now("2026-11-03", "14:30");

    expect(holdStatus(practice.holdOf("s")!, at1430)).toBe("Expired");
    expect(practice.day(at1430).slots[0].status).toBe("Free");
    expect(practice.hold("scheduler", "s", client2.id, at1430)).toBe("OK");
    expect(practice.holdOf("s")?.client_id).toBe(client2.id);
  });

  it("AC-HOLD-07: слот 10:00 о 10:05 — «This slot has already started and cannot be held.»", () => {
    const practice = new Practice([slot10()], [client1]);

    const code = practice.hold("scheduler", "s10", client1.id, now("2026-11-03", "10:05"));

    expect(code).toBe("SLOT_STARTED");
    expect(HOLD_MESSAGES[code]).toBe("This slot has already started and cannot be held.");
    expect(practice.holds).toHaveLength(0);
  });

  it("AC-HOLD-08: терапевт не утримує — «Only schedulers and admins can hold slots.»", () => {
    const practice = new Practice([slot10()], [client1]);

    const code = practice.hold("therapist", "s10", client1.id, now("2026-11-02", "14:30"));

    expect(code).toBe("HOLD_FORBIDDEN");
    expect(HOLD_MESSAGES[code]).toBe("Only schedulers and admins can hold slots.");
    expect(practice.holds).toHaveLength(0);
  });

  it("AC-HOLD-17: повторне утримання за client1 о 18:00 — нового немає, «Held until 2026-11-03 14:30» не змінено", () => {
    const practice = new Practice([slot10()], [client1]);
    practice.hold("scheduler", "s10", client1.id, now("2026-11-02", "14:30"));

    const code = practice.hold("scheduler", "s10", client1.id, now("2026-11-02", "18:00"));

    expect(code).toBe("SLOT_UNAVAILABLE");
    expect(HOLD_MESSAGES[code]).toBe("This slot is no longer available.");
    expect(practice.holds).toHaveLength(1);
    expect(formatPracticeDateTime(practice.holdOf("s10")!.expires_at)).toBe("2026-11-03 14:30");
  });

  it("AC-HOLD-25: client1 уже «Held» у therapist1 о 10:00 — слот therapist2 о 10:00 за ним не утримати", () => {
    const practice = new Practice(
      [slot("t1", "2026-11-03", "10:00", "therapist-1"), slot("t2", "2026-11-03", "10:00", "therapist-2")],
      [client1],
    );
    practice.hold("scheduler", "t1", client1.id, now("2026-11-02", "14:30"));

    const code = practice.hold("scheduler", "t2", client1.id, now("2026-11-02", "15:00"));

    expect(code).toBe("CLIENT_BUSY");
    expect(HOLD_MESSAGES[code]).toBe("This client already has a hold or session at this time.");
  });

  it("AC-HOLD-26: прострочене утримання client1 у therapist1 не заважає утримати слот therapist2 на той самий час", () => {
    const practice = new Practice(
      [slot("t1", "2026-11-05", "10:00", "therapist-1"), slot("t2", "2026-11-05", "10:00", "therapist-2")],
      [client1],
    );
    practice.hold("scheduler", "t1", client1.id, now("2026-11-02", "14:30"));
    const later = now("2026-11-03", "15:00");

    expect(practice.hold("scheduler", "t2", client1.id, later)).toBe("OK");
    expect(holdStatus(practice.holdOf("t2")!, later)).toBe("Held");
  });
});

describe("підтвердження утримання (openspec/specs/slot-holds)", () => {
  it("AC-HOLD-12: підтверджене утримання — «Confirmed», без «Held until», недоступне й після 24 годин", () => {
    const practice = new Practice([slot("s", "2026-11-05", "10:00")], [client1, client2]);
    practice.hold("scheduler", "s", client1.id, now("2026-11-02", "14:30"));

    expect(practice.confirm("scheduler", practice.holdOf("s")!.id, now("2026-11-03", "09:00"))).toBe("OK");

    const [view] = practice.day(now("2026-11-04", "09:00")).slots;
    expect(view.status).toBe("Confirmed");
    expect(view.hold?.heldUntil).toBeNull();
    expect(practice.hold("scheduler", "s", client2.id, now("2026-11-04", "09:00"))).toBe("SLOT_UNAVAILABLE");
  });

  it("AC-HOLD-13: прострочене утримання не підтверджується — «This hold has expired. Hold the slot again.»", () => {
    const practice = new Practice([slot("s", "2026-11-05", "10:00")], [client1]);
    practice.hold("scheduler", "s", client1.id, now("2026-11-02", "14:30"));

    const code = practice.confirm("scheduler", practice.holdOf("s")!.id, now("2026-11-03", "14:30"));

    expect(code).toBe("HOLD_EXPIRED");
    expect(CONFIRM_MESSAGES[code]).toBe("This hold has expired. Hold the slot again.");
  });

  it("AC-HOLD-14: терапевт не підтверджує — «Only schedulers and admins can confirm holds.»", () => {
    const practice = new Practice([slot("s", "2026-11-05", "10:00")], [client1]);
    practice.hold("scheduler", "s", client1.id, now("2026-11-02", "14:30"));

    const code = practice.confirm("therapist", practice.holdOf("s")!.id, now("2026-11-02", "15:00"));

    expect(code).toBe("CONFIRM_FORBIDDEN");
    expect(CONFIRM_MESSAGES[code]).toBe("Only schedulers and admins can confirm holds.");
    expect(practice.holdOf("s")?.confirmed_at).toBeNull();
  });

  it("AC-HOLD-19: адміністратор утримує й підтверджує — «Confirmed», як у планувальника", () => {
    const practice = new Practice([slot("s", "2026-11-05", "10:00")], [client1]);

    expect(practice.hold("admin", "s", client1.id, now("2026-11-02", "14:30"))).toBe("OK");
    expect(practice.confirm("admin", practice.holdOf("s")!.id, now("2026-11-02", "14:40"))).toBe("OK");
    expect(practice.day(now("2026-11-02", "14:41")).slots[0].status).toBe("Confirmed");
  });

  it("AC-HOLD-22: о 10:00 слоту 10:00–11:00 не підтверджується, лишається «Held» до прострочення", () => {
    const practice = new Practice([slot10()], [client1]);
    practice.hold("scheduler", "s10", client1.id, now("2026-11-02", "14:30"));

    const code = practice.confirm("scheduler", practice.holdOf("s10")!.id, now("2026-11-03", "10:00"));

    expect(code).toBe("SLOT_STARTED");
    expect(CONFIRM_MESSAGES[code]).toBe("This slot has already started and cannot be confirmed.");
    expect(practice.day(now("2026-11-03", "10:30")).slots[0].status).toBe("Held");
  });

  it("AC-HOLD-23: о 09:59 підтверджується — «Confirmed»", () => {
    const practice = new Practice([slot10()], [client1]);
    practice.hold("scheduler", "s10", client1.id, now("2026-11-02", "14:30"));

    expect(practice.confirm("scheduler", practice.holdOf("s10")!.id, now("2026-11-03", "09:59"))).toBe("OK");
    expect(practice.day(now("2026-11-03", "09:59")).slots[0].status).toBe("Confirmed");
  });

  it("AC-HOLD-27: утримання scheduler1 підтверджує scheduler2 — «Confirmed»", () => {
    const practice = new Practice([slot("s", "2026-11-05", "10:00")], [client1]);
    // Хто створив утримання, підтвердження не перевіряє: будь-який планувальник чи адміністратор.
    practice.hold("scheduler", "s", client1.id, now("2026-11-02", "14:30"));

    expect(practice.confirm("scheduler", practice.holdOf("s")!.id, now("2026-11-03", "09:00"))).toBe("OK");
    expect(practice.day(now("2026-11-03", "09:01")).slots[0].status).toBe("Confirmed");
  });

  it("AC-HOLD-36: друге підтвердження того самого утримання — «This hold is already confirmed.»", () => {
    const practice = new Practice([slot("s", "2026-11-05", "10:00")], [client1]);
    practice.hold("scheduler", "s", client1.id, now("2026-11-02", "14:30"));
    const holdId = practice.holdOf("s")!.id;
    practice.confirm("scheduler", holdId, now("2026-11-03", "09:00"));
    const confirmedAt = practice.holdOf("s")!.confirmed_at;

    const code = practice.confirm("scheduler", holdId, now("2026-11-03", "09:01"));

    expect(code).toBe("ALREADY_CONFIRMED");
    expect(CONFIRM_MESSAGES[code]).toBe("This hold is already confirmed.");
    expect(practice.holdOf("s")!.confirmed_at).toBe(confirmedAt);
    expect(practice.day(now("2026-11-03", "09:02")).slots[0].status).toBe("Confirmed");
  });
});
