import { z } from "zod";
import { normalizeMxPhone, parsePesos } from "./parse";

// Validation for the panel forms. Messages are shown to the owner as-is.

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

const optionalId = z.preprocess(emptyToUndefined, z.uuid().optional());

const checkbox = z.preprocess((value) => value === "on" || value === "true", z.boolean());

function requiredText(label: string, max: number) {
  return z
    .string({ error: `${label}: escribe un texto.` })
    .trim()
    .min(1, `${label}: no puede ir vacío.`)
    .max(max, `${label}: máximo ${max} caracteres.`);
}

function optionalText(label: string, max: number) {
  return z.preprocess(
    (value) => value ?? "",
    z.string().trim().max(max, `${label}: máximo ${max} caracteres.`),
  );
}

const sortOrder = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? 0 : value),
  z.coerce.number({ error: "Orden: escribe un número." }).int("Orden: escribe un número entero.").min(0).max(999),
);

export function pesosField(label: string) {
  return z.string({ error: `${label}: escribe una cantidad.` }).transform((value, ctx) => {
    const cents = parsePesos(value);
    if (cents === null) {
      ctx.addIssue({ code: "custom", message: `${label}: escribe una cantidad como 230 o 230.50.` });
      return z.NEVER;
    }
    return cents;
  });
}

// Empty means "no price" (the service isn't offered for that vehicle).
export function optionalPesosField(label: string) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    pesosField(label).nullable(),
  );
}

const clockTime = (label: string) =>
  z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, `${label}: elige una hora.`);

export const serviceSchema = z.object({
  id: optionalId,
  name: requiredText("Nombre", 80),
  description: optionalText("Descripción", 300),
  kind: z.enum(["base", "extra"], { error: "Tipo: elige principal o extra." }),
  capacityUnits: z.coerce
    .number({ error: "Lugares que ocupa: escribe un número." })
    .int("Lugares que ocupa: escribe un número entero.")
    .min(0, "Lugares que ocupa: mínimo 0.")
    .max(20, "Lugares que ocupa: máximo 20."),
  includesExtras: checkbox,
  active: checkbox,
  sortOrder,
});

export const vehicleTypeSchema = z.object({
  id: optionalId,
  name: requiredText("Nombre", 60),
  active: checkbox,
  sortOrder,
});

export const zoneSchema = z.object({
  id: optionalId,
  name: requiredText("Nombre", 80),
  surchargeCents: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? "0" : value),
    pesosField("Recargo"),
  ),
  active: checkbox,
  sortOrder,
});

export const timeSlotSchema = z
  .object({
    id: optionalId,
    name: requiredText("Nombre", 40),
    startTime: clockTime("Inicio"),
    endTime: clockTime("Fin"),
    capacity: z.coerce
      .number({ error: "Cupo: escribe un número." })
      .int("Cupo: escribe un número entero.")
      .min(1, "Cupo: mínimo 1.")
      .max(100, "Cupo: máximo 100."),
    active: checkbox,
    sortOrder,
  })
  .refine((slot) => slot.endTime > slot.startTime, { message: "La hora de fin debe ser después del inicio." });

export const scheduleSettingsSchema = z.object({
  workingDays: z
    .array(z.coerce.number().int().min(1).max(7))
    .min(1, "Elige al menos un día de trabajo.")
    .transform((days) => [...new Set(days)].sort((a, b) => a - b)),
  leadHours: z.coerce
    .number({ error: "Anticipación: escribe un número de horas." })
    .min(0, "Anticipación: mínimo 0 horas.")
    .max(168, "Anticipación: máximo 168 horas (7 días)."),
  horizonDays: z.coerce
    .number({ error: "Días hacia adelante: escribe un número." })
    .int("Días hacia adelante: escribe un número entero.")
    .min(1, "Días hacia adelante: mínimo 1.")
    .max(365, "Días hacia adelante: máximo 365."),
});

export const blockedDateSchema = z.object({
  date: z.iso.date("Fecha: elige un día."),
  reason: optionalText("Motivo", 100),
});

export const businessSettingsSchema = z
  .object({
    name: requiredText("Nombre del negocio", 80),
    whatsappPhone: z.string().transform((value, ctx) => {
      const phone = normalizeMxPhone(value);
      if (!phone) {
        ctx.addIssue({ code: "custom", message: "WhatsApp: escribe los 10 dígitos, por ejemplo 33 1234 5678." });
        return z.NEVER;
      }
      return phone;
    }),
    brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color: elige un color."),
    depositType: z.enum(["percent", "fixed"], { error: "Anticipo: elige porcentaje o monto fijo." }),
    depositValue: z.string(),
    cancellationPolicy: optionalText("Política de cancelación", 2000),
    privacyNotice: optionalText("Aviso de privacidad", 4000),
  })
  .transform((values, ctx) => {
    let depositValue: number | null;
    if (values.depositType === "percent") {
      const percent = Number(values.depositValue.trim());
      depositValue = Number.isInteger(percent) && percent >= 0 && percent <= 100 ? percent : null;
      if (depositValue === null) {
        ctx.addIssue({ code: "custom", message: "Anticipo: escribe un porcentaje entero de 0 a 100." });
        return z.NEVER;
      }
    } else {
      depositValue = parsePesos(values.depositValue);
      if (depositValue === null) {
        ctx.addIssue({ code: "custom", message: "Anticipo: escribe una cantidad como 150 o 150.50." });
        return z.NEVER;
      }
    }
    return { ...values, depositValue };
  });

export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Revisa los datos.";
}
