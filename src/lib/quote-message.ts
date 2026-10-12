import { formatLongDate } from "./dates";
import { formatMXN } from "./money";
import type { Quote } from "./quote";
import { formatClockTime } from "./time";

// "3312345678" -> "33 1234 5678"
export function formatMxPhone(phone: string): string {
  return /^\d{10}$/.test(phone) ? `${phone.slice(0, 2)} ${phone.slice(2, 6)} ${phone.slice(6)}` : phone;
}

export type QuoteRequest = {
  businessName: string;
  quote: Quote;
  date: string;
  slot: { name: string; startTime: string; endTime: string };
  customer: { name: string; phone: string; address: string; references: string; email: string | null };
  depositLabel: string; // e.g. "50%"
};

// Text the customer sends to the business by WhatsApp with everything needed to book.
export function quoteRequestMessage(request: QuoteRequest): string {
  const { quote, slot, customer } = request;
  const base = quote.lines.find((line) => line.kind === "base");
  const extras = quote.lines.filter((line) => line.kind === "extra");

  const lines = [
    `Hola ${request.businessName}, quiero agendar:`,
    "",
    `Vehículo: ${quote.vehicle.name}`,
    `Servicio: ${base?.name ?? ""}`,
    ...(extras.length > 0 ? [`Extras: ${extras.map((line) => line.name).join(", ")}`] : []),
    `Colonia: ${quote.zone?.name ?? ""}`,
    `Fecha: ${formatLongDate(request.date)}`,
    `Horario: ${slot.name} (${formatClockTime(slot.startTime)} a ${formatClockTime(slot.endTime)})`,
    `Dirección: ${customer.address}`,
    ...(customer.references ? [`Referencias: ${customer.references}`] : []),
    "",
    `Nombre: ${customer.name}`,
    `Celular: ${formatMxPhone(customer.phone)}`,
    ...(customer.email ? [`Correo: ${customer.email}`] : []),
    "",
    `Total: ${formatMXN(quote.totalCents)}`,
    `Anticipo (${request.depositLabel}): ${formatMXN(quote.depositCents)}`,
    `Saldo el día del servicio: ${formatMXN(quote.balanceCents)}`,
  ];
  return lines.join("\n");
}
