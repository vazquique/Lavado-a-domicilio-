// All business dates and times are in Mexico City time. Calendar dates travel as
// "YYYY-MM-DD" strings and clock times as "HH:MM" or "HH:MM:SS".
export const TIMEZONE = "America/Mexico_City";

function parseIsoDate(isoDate: string): [number, number, number] {
  const [year, month, day] = isoDate.split("-").map(Number);
  return [year, month, day];
}

// Today's calendar date in Mexico City as "YYYY-MM-DD".
export function todayInMexico(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = parseIsoDate(isoDate);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

// ISO weekday: 1 = Monday ... 7 = Sunday.
export function isoWeekday(isoDate: string): number {
  const [year, month, day] = parseIsoDate(isoDate);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

// How far Mexico City's clock is from UTC at a given instant, in milliseconds.
function mexicoCityOffsetMs(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"));
  return asUtc - instant.getTime();
}

// "2026-10-13" + "09:00" in Mexico City -> the real instant (2026-10-13T15:00:00Z).
export function mexicoCityDateTime(isoDate: string, clockTime: string): Date {
  const [year, month, day] = parseIsoDate(isoDate);
  const [hours, minutes] = clockTime.split(":").map(Number);
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hours, minutes);
  return new Date(wallClockAsUtc - mexicoCityOffsetMs(new Date(wallClockAsUtc)));
}

// "2026-12-25" -> "viernes, 25 de diciembre de 2026". The value is a calendar
// date, so it's formatted without any time zone shift.
export function formatLongDate(isoDate: string): string {
  const [year, month, day] = parseIsoDate(isoDate);
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

// Short pieces for a day button: { weekday: "lun", day: "13", month: "oct" }.
export function dayLabel(isoDate: string): { weekday: string; day: string; month: string } {
  const [year, month, day] = parseIsoDate(isoDate);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("es-MX", { timeZone: "UTC", ...options }).format(date).replace(".", "");
  return { weekday: format({ weekday: "short" }), day: String(day), month: format({ month: "short" }) };
}
