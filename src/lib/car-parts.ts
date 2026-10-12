// Parts of the car a service works on. The booking page lights them up on a drawing so the
// customer sees what will be done, and groups the extras by area.

export const CAR_PARTS = ["body", "windows", "wheels", "lights", "trim", "seats", "floors", "dashboard"] as const;
export type CarPart = (typeof CAR_PARTS)[number];

export const SERVICE_AREAS = ["exterior", "interior"] as const;
export type ServiceArea = (typeof SERVICE_AREAS)[number];

export const AREA_LABELS: Record<ServiceArea, string> = { exterior: "Exterior", interior: "Interior" };

export const CAR_PART_LABELS: Record<CarPart, string> = {
  body: "Carrocería y pintura",
  windows: "Vidrios",
  wheels: "Rines y llantas",
  lights: "Faros",
  trim: "Plásticos exteriores",
  seats: "Asientos y vestiduras",
  floors: "Pisos y alfombras",
  dashboard: "Tablero y plásticos interiores",
};

export const PARTS_BY_AREA: Record<ServiceArea, CarPart[]> = {
  exterior: ["body", "windows", "wheels", "lights", "trim"],
  interior: ["seats", "floors", "dashboard"],
};

export function isCarPart(value: unknown): value is CarPart {
  return typeof value === "string" && (CAR_PARTS as readonly string[]).includes(value);
}

// Everything the chosen services work on, in drawing order.
export function partsWorkedOn(services: { carParts: readonly CarPart[] }[]): CarPart[] {
  const chosen = new Set(services.flatMap((service) => service.carParts));
  return CAR_PARTS.filter((part) => chosen.has(part));
}

export type ServiceIcon = CarPart | "wash" | "complete";

// The picture for a service card: the whole car for packages, a wash for main services,
// otherwise the most specific part it works on.
const ICON_PRIORITY: CarPart[] = ["wheels", "lights", "windows", "trim", "dashboard", "seats", "floors", "body"];
export function serviceIcon(service: { kind: "base" | "extra"; area: ServiceArea; carParts: readonly CarPart[] }): ServiceIcon {
  if (service.carParts.length >= 5) return "complete";
  if (service.kind === "base") return "wash";
  return ICON_PRIORITY.find((part) => service.carParts.includes(part)) ?? (service.area === "interior" ? "seats" : "body");
}

// Short labels for a service's parts: whole areas collapse into "Todo el exterior" and so on.
export function partsLabels(parts: readonly CarPart[]): string[] {
  const covers = (list: readonly CarPart[]) => list.every((part) => parts.includes(part));
  if (covers(CAR_PARTS)) return ["Todo el auto"];
  return SERVICE_AREAS.flatMap((area) =>
    covers(PARTS_BY_AREA[area])
      ? [area === "exterior" ? "Todo el exterior" : "Todo el interior"]
      : PARTS_BY_AREA[area].filter((part) => parts.includes(part)).map((part) => CAR_PART_LABELS[part]),
  );
}
