import { describe, expect, it } from "vitest";
import {
  formatPracticeDateTime,
  practiceDate,
  practiceDayRange,
  practiceInstant,
  practiceWeekRange,
  weekStart,
} from "@/lib/holds/time";

describe("час практики America/Los_Angeles", () => {
  it("місцевий час до й після переходу на зимовий час (2026-11-01)", () => {
    expect(practiceInstant("2026-10-30", "10:00").toISOString()).toBe("2026-10-30T17:00:00.000Z");
    expect(practiceInstant("2026-11-03", "10:00").toISOString()).toBe("2026-11-03T18:00:00.000Z");
  });

  it("день переходу на зимовий час триває 25 годин", () => {
    const { start, end } = practiceDayRange("2026-11-01");
    expect(start.toISOString()).toBe("2026-11-01T07:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-02T08:00:00.000Z");
  });

  it("формат РРРР-ММ-ДД ГГ:ХХ, 24 години", () => {
    expect(formatPracticeDateTime("2026-11-03T22:30:00.000Z")).toBe("2026-11-03 14:30");
    expect(formatPracticeDateTime("2026-11-03T08:05:00.000Z")).toBe("2026-11-03 00:05");
    expect(practiceDate(new Date("2026-11-04T07:30:00.000Z"))).toBe("2026-11-03");
  });

  it("тиждень — з понеділка по неділю", () => {
    expect(weekStart("2026-11-04")).toBe("2026-11-02");
    expect(weekStart("2026-11-08")).toBe("2026-11-02");
    expect(weekStart("2026-11-09")).toBe("2026-11-09");
    expect(practiceWeekRange("2026-11-04")).toMatchObject({ monday: "2026-11-02", sunday: "2026-11-08" });
  });
});
