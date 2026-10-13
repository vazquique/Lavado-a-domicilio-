import { formatLongDate } from "./dates";
import { formatMXN } from "./money";
import { formatMxPhone } from "./quote-message";
import { slotLabel, type BookingTime } from "./time";

// A paid online booking, as the success page, the WhatsApp message and the email show it.
export type PaidBooking = {
  businessName: string;
  folio: string;
  serviceDate: string; // ISO date, e.g. "2026-10-20"
  slot: BookingTime;
  address: string;
  references: string;
  zoneName: string | null;
  vehicleName: string;
  services: string[];
  customer: { name: string; phone: string; email: string | null };
  totalCents: number;
  paidCents: number;
  balanceCents: number;
};

// Lines about the money, shared by the page, the message and the email. Nothing paid
// online means the customer chose to pay cash on the day.
export function paymentLines(booking: Pick<PaidBooking, "totalCents" | "paidCents" | "balanceCents">): string[] {
  if (booking.balanceCents === 0) return [`Total: ${formatMXN(booking.totalCents)} (pagado completo)`];
  if (booking.paidCents === 0) return [`Total: ${formatMXN(booking.totalCents)}, en efectivo el día del servicio`];
  return [
    `Total: ${formatMXN(booking.totalCents)}`,
    `Anticipo pagado: ${formatMXN(booking.paidCents)}`,
    `Saldo el día del servicio: ${formatMXN(booking.balanceCents)}`,
  ];
}

// Text the customer sends to the business by WhatsApp after booking.
export function paidBookingMessage(booking: PaidBooking): string {
  const lines = [
    booking.paidCents > 0
      ? `Hola ${booking.businessName}, ya pagué mi reserva ${booking.folio}:`
      : `Hola ${booking.businessName}, aparté mi lugar con la reserva ${booking.folio}:`,
    "",
    `Fecha: ${formatLongDate(booking.serviceDate)}`,
    `Horario: ${slotLabel(booking.slot)}`,
    `Dirección: ${booking.address}${booking.zoneName ? `, ${booking.zoneName}` : ""}`,
    ...(booking.references ? [`Referencias: ${booking.references}`] : []),
    `Vehículo: ${booking.vehicleName}`,
    `Servicios: ${booking.services.join(", ")}`,
    "",
    `Nombre: ${booking.customer.name}`,
    `Celular: ${formatMxPhone(booking.customer.phone)}`,
    "",
    ...paymentLines(booking),
  ];
  return lines.join("\n");
}
