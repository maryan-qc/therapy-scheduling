// Час практики — America/Los_Angeles з точністю до хвилини; показ — «РРРР-ММ-ДД ГГ:ХХ», 24 години (припущення PM).
// Лише Intl, без бібліотек: межі дня й тижня рахуємо від місцевого часу практики, з переходом на зимовий час.

export const PRACTICE_TIME_ZONE = "America/Los_Angeles";

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: PRACTICE_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function wallClock(instant: Date): WallClock {
  const parts = partsFormatter.formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Зсув часу практики від UTC у хвилинах у вказану мить (−420 влітку, −480 взимку). */
function offsetMinutes(instant: Date): number {
  const w = wallClock(instant);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

const pad = (value: number) => String(value).padStart(2, "0");

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Мить, коли в практиці настає дата `date` (РРРР-ММ-ДД) і час `time` (ГГ:ХХ). */
export function practiceInstant(date: string, time = "00:00"): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wallAsUtc = Date.UTC(y, m - 1, d, hh, mm);
  let instant = wallAsUtc - offsetMinutes(new Date(wallAsUtc)) * 60_000;
  // Поруч із переходом на літній / зимовий час зсув у шуканій миті може відрізнятися від першої оцінки.
  const corrected = wallAsUtc - offsetMinutes(new Date(instant)) * 60_000;
  if (corrected !== instant) instant = corrected;
  return new Date(instant);
}

/** Дата практики (РРРР-ММ-ДД) для миті. */
export function practiceDate(instant: Date): string {
  const w = wallClock(instant);
  return `${w.year}-${pad(w.month)}-${pad(w.day)}`;
}

/** «РРРР-ММ-ДД ГГ:ХХ» у часі практики. */
export function formatPracticeDateTime(instant: Date | string): string {
  const w = wallClock(typeof instant === "string" ? new Date(instant) : instant);
  return `${w.year}-${pad(w.month)}-${pad(w.day)} ${pad(w.hour)}:${pad(w.minute)}`;
}

/** «ГГ:ХХ» у часі практики. */
export function formatPracticeTime(instant: Date | string): string {
  return formatPracticeDateTime(instant).slice(11);
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

/** Межі дня практики: [start, end). */
export function practiceDayRange(date: string): { start: Date; end: Date } {
  return { start: practiceInstant(date), end: practiceInstant(addDays(date, 1)) };
}

/** Понеділок тижня (пн–нд), до якого належить дата. */
export function weekStart(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 — неділя
  return addDays(date, -((weekday + 6) % 7));
}

/** Межі тижня практики з понеділка по неділю: [start, end) і дати пн та нд. */
export function practiceWeekRange(date: string): { monday: string; sunday: string; start: Date; end: Date } {
  const monday = weekStart(date);
  return {
    monday,
    sunday: addDays(monday, 6),
    start: practiceInstant(monday),
    end: practiceInstant(addDays(monday, 7)),
  };
}
