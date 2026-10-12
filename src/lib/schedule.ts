const WEEKDAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

// Working days come as ISO weekdays (1 = Monday ... 7 = Sunday).
export function formatWorkingDays(days: number[]): string {
  const sorted = [...new Set(days)].filter((day) => day >= 1 && day <= 7).sort((a, b) => a - b);
  if (sorted.length === 7) return "Todos los días";
  if (sorted.length === 0) return "Sin días de trabajo";
  const names = sorted.map((day) => WEEKDAY_NAMES[day - 1]);
  const text = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
