// Postgres `time` values arrive as "09:00:00". Shows them as "9:00".
export function formatClockTime(value: string): string {
  const [hours, minutes] = value.split(":");
  return `${Number(hours)}:${minutes}`;
}
