// Postgres `time` values arrive as "09:00:00". Shows them as "9:00".
export function formatClockTime(value: string): string {
  const [hours, minutes] = value.split(":");
  return `${Number(hours)}:${minutes}`;
}

// When a booking is: its time slot and, since exact times, the time we arrive ("10:20").
export type BookingTime = {
  name: string;
  startTime: string | null;
  endTime: string | null;
  arrivalTime: string | null;
};

// "10:20 (Mañana)". Bookings from before exact times show their whole slot, "Mañana (9:00
// a 13:00)", or just its name when its hours are unknown.
export function slotLabel(slot: BookingTime): string {
  if (slot.arrivalTime) return `${formatClockTime(slot.arrivalTime)} (${slot.name})`;
  return slot.startTime && slot.endTime
    ? `${slot.name} (${formatClockTime(slot.startTime)} a ${formatClockTime(slot.endTime)})`
    : slot.name;
}

// What the customer reads: "Llegamos a las 10:20 (Mañana)".
export function arrivalLabel(slot: BookingTime): string {
  return slot.arrivalTime ? `Llegamos a las ${slotLabel(slot)}` : slotLabel(slot);
}
