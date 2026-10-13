import { slotLabel, type PaidBooking } from "./booking-message";
import { formatLongDate } from "./dates";
import { formatMXN } from "./money";

// A booking as the agenda's WhatsApp reminder tells it to the customer.
export type ReminderBooking = {
  businessName: string;
  customerName: string;
  folio: string;
  serviceDate: string; // ISO date
  slot: PaidBooking["slot"];
  address: string;
  zoneName: string | null;
  vehicleName: string;
  services: string[];
  totalCents: number;
  paidOnlineCents: number; // deposit (or everything) paid with Mercado Pago, 0 if none
  balanceCents: number;
  balancePaid: boolean;
};

function moneyLines(booking: ReminderBooking): string[] {
  if (booking.balancePaid || booking.balanceCents === 0) return [`Total: ${formatMXN(booking.totalCents)} (pagado)`];
  if (booking.paidOnlineCents === 0) return [`Total a pagar el día del servicio: ${formatMXN(booking.totalCents)}`];
  return [
    `Total: ${formatMXN(booking.totalCents)}`,
    `Anticipo pagado: ${formatMXN(booking.paidOnlineCents)}`,
    `Saldo el día del servicio: ${formatMXN(booking.balanceCents)}`,
  ];
}

// Text the business sends the customer by WhatsApp before the service.
export function reminderMessage(booking: ReminderBooking): string {
  const firstName = booking.customerName.trim().split(/\s+/)[0];
  return [
    `Hola ${firstName}, te recordamos tu servicio con ${booking.businessName}:`,
    "",
    `Fecha: ${formatLongDate(booking.serviceDate)}`,
    `Horario: ${slotLabel(booking.slot)}`,
    `Dirección: ${booking.address}${booking.zoneName ? `, ${booking.zoneName}` : ""}`,
    `Vehículo: ${booking.vehicleName}`,
    `Servicios: ${booking.services.join(", ")}`,
    "",
    ...moneyLines(booking),
    "",
    `Folio ${booking.folio}. Si necesitas cambiar algo, contéstanos por aquí.`,
  ].join("\n");
}
