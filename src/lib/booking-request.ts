import { z } from "zod";
import { normalizeMxPhone } from "./panel/parse";

// What the booking page sends to the server: only choices (ids) and the customer's
// details, never amounts. `website` is a honeypot: people never see it, bots fill it.
export const bookingRequestSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  vehicleTypeId: z.uuid({ error: "Elige tu vehículo." }),
  baseServiceId: z.uuid({ error: "Elige un servicio." }),
  extraServiceIds: z.array(z.uuid()).max(30),
  zoneId: z.uuid({ error: "Elige tu colonia." }),
  date: z.iso.date({ error: "Elige el día." }),
  timeSlotId: z.uuid({ error: "Elige el horario." }),
  // Which turn of the slot (0 = its first time); the server turns it into the clock time.
  startPlace: z.number({ error: "Elige la hora." }).int().min(0).max(99),
  customer: z.object({
    name: z.string().trim().min(2, "Escribe tu nombre.").max(100, "Tu nombre es muy largo."),
    phone: z.string().transform((value, ctx) => {
      const phone = normalizeMxPhone(value);
      if (!phone) {
        ctx.addIssue({ code: "custom", message: "Escribe tu celular a 10 dígitos." });
        return z.NEVER;
      }
      return phone;
    }),
    address: z
      .string()
      .trim()
      .min(5, "Escribe tu dirección (calle, número y colonia).")
      .max(300, "La dirección es muy larga."),
    references: z.string().trim().max(300, "Las referencias son muy largas."),
    email: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? null : value),
      z.email("Revisa tu correo.").trim().toLowerCase().max(254).nullable(),
    ),
  }),
  website: z.string().max(0),
});

export type BookingRequest = z.input<typeof bookingRequestSchema>;
