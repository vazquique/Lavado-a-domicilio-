// All business dates and times are in Mexico City time.
export const TIMEZONE = "America/Mexico_City";

// Today's calendar date in Mexico City as "YYYY-MM-DD".
export function todayInMexico(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

// "2026-12-25" -> "viernes, 25 de diciembre de 2026". The value is a calendar
// date, so it's formatted without any time zone shift.
export function formatLongDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}
