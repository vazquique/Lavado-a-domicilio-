// Parsing of what the owner types in the panel forms. Pure functions, no I/O.

const PESOS = /^(\d{1,7})(?:\.(\d{1,2}))?$/;
const THOUSANDS = /^\d{1,3}(,\d{3})+(\.\d{1,2})?$/;

// "230", "230.5", "$1,230.50" -> cents. Returns null if it isn't a valid amount.
// Commas are only accepted as thousands separators, so "230,50" is rejected
// instead of becoming 23,050 pesos.
export function parsePesos(input: string): number | null {
  let cleaned = input.trim().replace(/^\$/, "").trim();
  if (cleaned.includes(",")) {
    if (!THOUSANDS.test(cleaned)) return null;
    cleaned = cleaned.replace(/,/g, "");
  }
  const match = PESOS.exec(cleaned);
  if (!match) return null;
  const [, whole, fraction = ""] = match;
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

// 23000 -> "230", 23050 -> "230.50". For prefilling inputs.
export function centsToPesosInput(cents: number): string {
  const whole = Math.trunc(cents / 100);
  const fraction = cents % 100;
  return fraction === 0 ? String(whole) : `${whole}.${String(fraction).padStart(2, "0")}`;
}

// Accepts "33 1459 6017", "+52 33 1459 6017", "52 1 33 1459 6017" -> "3314596017".
export function normalizeMxPhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("521")) digits = digits.slice(3);
  if (digits.length === 12 && digits.startsWith("52")) digits = digits.slice(2);
  return /^[0-9]{10}$/.test(digits) ? digits : null;
}

// Postgres `time` ("09:00:00") -> value for <input type="time"> ("09:00").
export function timeToInput(value: string): string {
  return value.slice(0, 5);
}
