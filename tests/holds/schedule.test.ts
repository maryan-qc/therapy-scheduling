import { describe, expect, it } from "vitest";
import { buildDayView } from "@/lib/holds/day-view";
import { buildHoldsList, buildSchedule } from "@/lib/holds/schedule";
import { addDays, formatPracticeDateTime, practiceWeekRange } from "@/lib/holds/time";
import type { TherapistRow } from "@/lib/holds/types";
import { at, client1, client2, client3, client4, hold, now, slot } from "./fixtures";

const therapists: TherapistRow[] = [
  { id: "therapist-1", name: "Therapist One", email: "therapist1@example.test" },
  { id: "therapist-2", name: "Therapist Two", email: "therapist2@example.test" },
];

// Слот therapist1 2026-11-05 о 10:00, утриманий за client1 2026-11-02 о 14:30 і не підтверджений.
const expiredCase = () => ({
  slots: [slot("s", "2026-11-05", "10:00")],
  holds: [hold("h", "s", at("2026-11-02", "14:30"))],
});

describe("розклад терапевта (openspec/specs/slot-holds)", () => {
  it("AC-HOLD-09: therapist1 бачить своє утримання з client1 і «Held until», а не розклад therapist2", () => {
    const slots = [slot("t1", "2026-11-05", "10:00", "therapist-1"), slot("t2", "2026-11-05", "11:00", "therapist-2")];
    const holds = [
      hold("h1", "t1", at("2026-11-04", "08:00"), { clientId: client1.id }),
      hold("h2", "t2", at("2026-11-04", "08:00"), { clientId: client2.id }),
    ];

    const days = buildSchedule("therapist-1", "2026-11-02", slots, holds, [client1, client2], now("2026-11-04", "09:00"));
    const all = days.flatMap((day) => day.slots);

    expect(all).toHaveLength(1);
    expect(all[0].hold?.clientName).toBe("client1");
    expect(formatPracticeDateTime(all[0].hold!.heldUntil!)).toBe("2026-11-05 08:00");
    expect(all.some((s) => s.id === "t2")).toBe(false);
  });

  it("AC-HOLD-40: в утриманні therapist1 показано ім'я client1, але не його email", () => {
    const slots = [slot("t1", "2026-11-05", "10:00")];
    const holds = [hold("h1", "t1", at("2026-11-04", "08:00"))];

    // Навіть якщо email потрапив у вхідні дані, розклад його не віддає; сторінка /schedule читає лише id і name.
    const days = buildSchedule("therapist-1", "2026-11-02", slots, holds, [client1], now("2026-11-04", "09:00"));
    const shown = days.flatMap((day) => day.slots).find((s) => s.id === "t1")!;

    expect(shown.status).toBe("Held");
    expect(shown.hold?.clientName).toBe("client1");
    expect(shown.hold).not.toHaveProperty("clientContact");
    expect(JSON.stringify(days)).not.toContain(client1.email);
  });

  it("AC-HOLD-21: 2026-11-03 о 15:00 прострочене утримання за client1 у розкладі не показано, слот вільний", () => {
    const { slots, holds } = expiredCase();

    const days = buildSchedule("therapist-1", "2026-11-02", slots, holds, [client1], now("2026-11-03", "15:00"));
    const nov5 = days.find((day) => day.date === "2026-11-05")!;

    expect(nov5.slots[0].status).toBe("Free");
    expect(nov5.slots[0].hold).toBeUndefined();
  });

  it("AC-HOLD-30: середа 2026-11-04 — тиждень 2026-11-02 – 2026-11-08 з усіма слотами й статусами, без сеансу 2026-11-12", () => {
    const slots = [
      slot("m", "2026-11-02", "10:00"),
      slot("f10", "2026-11-06", "10:00"),
      slot("f11", "2026-11-06", "11:00"),
      slot("f12", "2026-11-06", "12:00"),
      slot("next", "2026-11-12", "10:00"),
    ];
    const holds = [
      hold("hm", "m", at("2026-10-30", "10:00"), { confirmedAt: at("2026-10-30", "11:00") }),
      hold("hf", "f10", at("2026-11-04", "08:00")),
      hold("hn", "next", at("2026-11-03", "10:00"), { confirmedAt: at("2026-11-03", "11:00") }),
    ];
    const week = practiceWeekRange("2026-11-04");

    const days = buildSchedule("therapist-1", week.monday, slots, holds, [client1], now("2026-11-04", "12:00"));

    expect([week.monday, week.sunday]).toEqual(["2026-11-02", "2026-11-08"]);
    expect(days.map((day) => day.date)).toEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
    ]);
    expect(days[0].slots.map((s) => s.status)).toEqual(["Confirmed"]);
    expect(days[4].slots.map((s) => s.status)).toEqual(["Held", "Free", "Free"]);
    expect(days.flatMap((day) => day.slots).some((s) => s.id === "next")).toBe(false);
  });

  it("AC-HOLD-31: наступний тиждень — 2026-11-09 – 2026-11-15 і сеанс 2026-11-12 о 10:00 «Confirmed»", () => {
    const slots = [slot("next", "2026-11-12", "10:00")];
    const holds = [hold("hn", "next", at("2026-11-03", "10:00"), { confirmedAt: at("2026-11-03", "11:00") })];
    const nextMonday = addDays(practiceWeekRange("2026-11-04").monday, 7);
    const week = practiceWeekRange(nextMonday);

    const days = buildSchedule("therapist-1", week.monday, slots, holds, [client1], now("2026-11-04", "12:00"));

    expect([week.monday, week.sunday]).toEqual(["2026-11-09", "2026-11-15"]);
    expect(days.find((day) => day.date === "2026-11-12")!.slots.map((s) => s.status)).toEqual(["Confirmed"]);
  });
});

describe("список утримань планувальника (openspec/specs/slot-holds)", () => {
  it("AC-HOLD-20: 2026-11-03 о 15:00 планувальник бачить утримання client1 «Expired», а слот вільний", () => {
    const { slots, holds } = expiredCase();
    const moment = now("2026-11-03", "15:00");

    const list = buildHoldsList(holds, slots, [client1], therapists, moment);

    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ clientName: "client1", status: "Expired" });
    expect(buildDayView(slots, holds, [client1], moment).slots[0].status).toBe("Free");
  });

  it("AC-HOLD-28: 2026-11-05 о 09:59 прострочене утримання ще видно", () => {
    const { slots, holds } = expiredCase();

    const list = buildHoldsList(holds, slots, [client1], therapists, now("2026-11-05", "09:59"));

    expect(list.map((item) => [item.clientName, item.status])).toEqual([["client1", "Expired"]]);
  });

  it("AC-HOLD-29: з 2026-11-05 10:00 прострочене утримання в списку не показано", () => {
    const { slots, holds } = expiredCase();

    expect(buildHoldsList(holds, slots, [client1], therapists, now("2026-11-05", "10:00"))).toEqual([]);
    expect(buildHoldsList(holds, slots, [client1], therapists, now("2026-11-05", "12:00"))).toEqual([]);
  });

  it("AC-HOLD-37: 2026-11-03 о 15:00 слот знову утримано за client1 — у списку нове «Held» до 2026-11-04 15:00, без старого «Expired»", () => {
    const slots = [slot("s", "2026-11-05", "10:00")];
    // Функція бази звільняє прострочене утримання (released_at) і створює нове в ту саму мить.
    const holds = [
      hold("old", "s", at("2026-11-02", "14:30"), { releasedAt: at("2026-11-03", "15:00") }),
      hold("new", "s", at("2026-11-03", "15:00")),
    ];

    const list = buildHoldsList(holds, slots, [client1], therapists, now("2026-11-03", "15:00"));

    expect(list.map((item) => [item.holdId, item.clientName, item.status])).toEqual([["new", "client1", "Held"]]);
    expect(formatPracticeDateTime(list[0].heldUntil!)).toBe("2026-11-04 15:00");
  });

  it("AC-HOLD-38: 2026-11-03 о 15:00 — лише client2 («Held», 2026-11-04 11:00), потім client1 («Expired», 2026-11-05 10:00)", () => {
    const slots = [
      slot("c1", "2026-11-05", "10:00", "therapist-1"),
      slot("c2", "2026-11-04", "11:00", "therapist-2"),
      slot("c3", "2026-11-04", "12:00", "therapist-1"),
      slot("c4", "2026-11-02", "10:00", "therapist-2"),
    ];
    const holds = [
      hold("h1", "c1", at("2026-11-02", "14:30"), { clientId: client1.id }),
      hold("h2", "c2", at("2026-11-03", "10:00"), { clientId: client2.id }),
      hold("h3", "c3", at("2026-11-03", "09:00"), { clientId: client3.id, confirmedAt: at("2026-11-03", "09:30") }),
      hold("h4", "c4", at("2026-11-01", "09:00"), { clientId: client4.id, confirmedAt: at("2026-11-01", "09:30") }),
    ];

    const list = buildHoldsList(holds, slots, [client1, client2, client3, client4], therapists, now("2026-11-03", "15:00"));

    expect(list.map((item) => [item.clientName, formatPracticeDateTime(item.slotStartsAt), item.status])).toEqual([
      ["client2", "2026-11-04 11:00", "Held"],
      ["client1", "2026-11-05 10:00", "Expired"],
    ]);
  });

  it("AC-HOLD-42: о 09:59 «Held» client2 на слот 10:00 у списку, з 10:00 — уже ні", () => {
    const slots = [slot("s", "2026-11-03", "10:00")];
    const holds = [hold("h", "s", at("2026-11-02", "14:30"), { clientId: client2.id })];
    const list = (time: string) => buildHoldsList(holds, slots, [client2], therapists, now("2026-11-03", time));

    expect(list("09:59").map((item) => [item.clientName, item.status])).toEqual([["client2", "Held"]]);
    expect(list("10:00")).toEqual([]);
    expect(list("10:30")).toEqual([]);
  });
});
