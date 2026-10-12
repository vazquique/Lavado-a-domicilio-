// Price of a booking. Pure function: the server runs it with data from the database
// (never with amounts from the browser); the page runs the same code to show the
// price while the customer chooses.

export type QuoteCatalog = {
  vehicleTypes: { id: string; name: string }[];
  services: { id: string; name: string; kind: "base" | "extra"; capacityUnits: number }[];
  prices: { serviceId: string; vehicleTypeId: string; priceCents: number }[];
  zones: { id: string; name: string; surchargeCents: number }[];
  deposit: { type: "percent" | "fixed"; value: number };
};

export type QuoteSelection = {
  vehicleTypeId: string;
  baseServiceId: string;
  extraServiceIds: string[];
  zoneId: string | null;
};

export type QuoteLine = { serviceId: string; name: string; kind: "base" | "extra"; priceCents: number };

export type Quote = {
  vehicle: { id: string; name: string };
  zone: { id: string; name: string; surchargeCents: number } | null;
  lines: QuoteLine[];
  subtotalCents: number;
  surchargeCents: number;
  totalCents: number;
  depositCents: number;
  balanceCents: number;
  // Places this booking takes in a time slot (at least 1).
  capacityUnits: number;
};

export type QuoteError = "vehicle" | "base_service" | "extra_service" | "zone";

export type QuoteResult = { ok: true; quote: Quote } | { ok: false; error: QuoteError };

function priceOf(catalog: Pick<QuoteCatalog, "prices">, serviceId: string, vehicleTypeId: string): number | undefined {
  return catalog.prices.find((price) => price.serviceId === serviceId && price.vehicleTypeId === vehicleTypeId)
    ?.priceCents;
}

// Deposit in cents. Percentages are rounded to whole pesos; never more than the total.
export function depositFor(totalCents: number, deposit: QuoteCatalog["deposit"]): number {
  const amount =
    deposit.type === "percent" ? Math.round((totalCents * deposit.value) / 100 / 100) * 100 : deposit.value;
  return Math.max(0, Math.min(amount, totalCents));
}

// Services the customer can choose for a vehicle, with their price.
export function servicesForVehicle<S extends QuoteCatalog["services"][number]>(
  catalog: Omit<QuoteCatalog, "services"> & { services: S[] },
  vehicleTypeId: string,
) {
  const offered = catalog.services.flatMap((service) => {
    const priceCents = priceOf(catalog, service.id, vehicleTypeId);
    return priceCents === undefined ? [] : [{ ...service, priceCents }];
  });
  return {
    base: offered.filter((service) => service.kind === "base"),
    extras: offered.filter((service) => service.kind === "extra"),
  };
}

export function calculateQuote(catalog: QuoteCatalog, selection: QuoteSelection): QuoteResult {
  const vehicle = catalog.vehicleTypes.find((item) => item.id === selection.vehicleTypeId);
  if (!vehicle) return { ok: false, error: "vehicle" };

  const lines: QuoteLine[] = [];
  let capacityUnits = 0;

  const base = catalog.services.find((service) => service.id === selection.baseServiceId && service.kind === "base");
  const basePrice = base && priceOf(catalog, base.id, vehicle.id);
  if (!base || basePrice === undefined) return { ok: false, error: "base_service" };
  lines.push({ serviceId: base.id, name: base.name, kind: "base", priceCents: basePrice });
  capacityUnits += base.capacityUnits;

  for (const extraId of new Set(selection.extraServiceIds)) {
    const extra = catalog.services.find((service) => service.id === extraId && service.kind === "extra");
    const extraPrice = extra && priceOf(catalog, extra.id, vehicle.id);
    if (!extra || extraPrice === undefined) return { ok: false, error: "extra_service" };
    lines.push({ serviceId: extra.id, name: extra.name, kind: "extra", priceCents: extraPrice });
    capacityUnits += extra.capacityUnits;
  }

  let zone: Quote["zone"] = null;
  if (selection.zoneId !== null) {
    zone = catalog.zones.find((item) => item.id === selection.zoneId) ?? null;
    if (!zone) return { ok: false, error: "zone" };
  }

  const subtotalCents = lines.reduce((sum, line) => sum + line.priceCents, 0);
  const surchargeCents = zone?.surchargeCents ?? 0;
  const totalCents = subtotalCents + surchargeCents;
  const depositCents = depositFor(totalCents, catalog.deposit);

  return {
    ok: true,
    quote: {
      vehicle,
      zone,
      lines,
      subtotalCents,
      surchargeCents,
      totalCents,
      depositCents,
      balanceCents: totalCents - depositCents,
      capacityUnits: Math.max(1, capacityUnits),
    },
  };
}
