import { describe, expect, test } from "vitest";
import {
  blockedDateSchema,
  businessSettingsSchema,
  firstError,
  optionalPesosField,
  scheduleSettingsSchema,
  serviceSchema,
  timeSlotSchema,
  zoneSchema,
} from "./schemas";

describe("serviceSchema", () => {
  test("new service from form values", () => {
    const result = serviceSchema.parse({
      id: "",
      name: "  Pulido ",
      description: null,
      kind: "extra",
      active: "on",
      sortOrder: "",
    });
    expect(result).toEqual({
      id: undefined,
      name: "Pulido",
      description: "",
      kind: "extra",
      active: true,
      sortOrder: 0,
    });
  });

  test("unchecked checkbox means hidden; empty name is rejected", () => {
    expect(serviceSchema.parse({ name: "Cera", kind: "extra", active: null, sortOrder: "3" }).active).toBe(false);
    const result = serviceSchema.safeParse({ name: " ", kind: "extra" });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstError(result.error)).toBe("Nombre: no puede ir vacío.");
  });
});

describe("prices", () => {
  const price = optionalPesosField("Carro normal");

  test("empty means not offered, otherwise cents", () => {
    expect(price.parse("")).toBeNull();
    expect(price.parse("230")).toBe(23000);
  });

  test("bad amounts explain the format", () => {
    const result = price.safeParse("230,50");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(firstError(result.error)).toBe("Carro normal: escribe una cantidad como 230 o 230.50.");
    }
  });
});

test("zone surcharge defaults to 0", () => {
  expect(zoneSchema.parse({ name: "La Cima", surchargeCents: "", active: "on" }).surchargeCents).toBe(0);
  expect(zoneSchema.parse({ name: "Tesistán", surchargeCents: "50", active: "on" }).surchargeCents).toBe(5000);
});

describe("timeSlotSchema", () => {
  test("valid slot", () => {
    const slot = timeSlotSchema.parse({
      name: "Mañana",
      startTime: "09:00",
      endTime: "13:00",
      capacity: "3",
      active: "on",
    });
    expect(slot.capacity).toBe(3);
  });

  test("end must be after start", () => {
    const result = timeSlotSchema.safeParse({ name: "Tarde", startTime: "18:00", endTime: "13:00", capacity: "3" });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstError(result.error)).toBe("La hora de fin debe ser después del inicio.");
  });
});

describe("scheduleSettingsSchema", () => {
  test("days are deduplicated and sorted", () => {
    const result = scheduleSettingsSchema.parse({ workingDays: ["7", "1", "1"], leadHours: "2", horizonDays: "30" });
    expect(result).toEqual({ workingDays: [1, 7], leadHours: 2, horizonDays: 30 });
  });

  test("at least one working day", () => {
    const result = scheduleSettingsSchema.safeParse({ workingDays: [], leadHours: "2", horizonDays: "30" });
    expect(result.success).toBe(false);
  });
});

test("blocked date needs a real date", () => {
  expect(blockedDateSchema.parse({ date: "2026-12-25", reason: "Navidad" }).date).toBe("2026-12-25");
  expect(blockedDateSchema.safeParse({ date: "2026-02-30", reason: "" }).success).toBe(false);
});

describe("businessSettingsSchema", () => {
  const base = {
    name: "JB's Bros",
    whatsappPhone: "+52 33 1459 6017",
    brandColor: "#1d4ed8",
    cancellationPolicy: "",
    privacyNotice: "",
  };

  test("percent deposit", () => {
    const result = businessSettingsSchema.parse({ ...base, depositType: "percent", depositValue: "50" });
    expect(result.whatsappPhone).toBe("3314596017");
    expect(result.depositValue).toBe(50);
  });

  test("fixed deposit in pesos is stored in cents", () => {
    const result = businessSettingsSchema.parse({ ...base, depositType: "fixed", depositValue: "150" });
    expect(result.depositValue).toBe(15000);
  });

  test("percent over 100 is rejected", () => {
    const result = businessSettingsSchema.safeParse({ ...base, depositType: "percent", depositValue: "150" });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstError(result.error)).toBe("Anticipo: escribe un porcentaje entero de 0 a 100.");
  });

  test("incomplete WhatsApp is rejected", () => {
    const result = businessSettingsSchema.safeParse({
      ...base,
      whatsappPhone: "33 1459",
      depositType: "percent",
      depositValue: "50",
    });
    expect(result.success).toBe(false);
  });
});
