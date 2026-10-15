"use client";

import {
  Armchair,
  Banknote,
  CalendarCheck,
  Car,
  Check,
  ChevronDown,
  CirclePlus,
  CreditCard,
  Info,
  MapPin,
  MessageCircle,
  Plus,
  Sparkles,
  TriangleAlert,
  User,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { VehicleSilhouette } from "@/components/car-illustrations";
import { CarSummary, ServiceIconBadge } from "@/components/car-summary";
import { ServiceExplainer } from "@/components/service-explainer";
import { bookableDates, daysWithTimeLeft, earliestStart, slotsForDate, type SlotAvailability } from "@/lib/availability";
import type { BookingData, BookingService } from "@/lib/booking-data";
import {
  AREA_LABELS,
  partsLabels,
  partsWorkedOn,
  serviceIcon,
  SERVICE_AREAS,
  type CarPart,
  type ServiceArea,
} from "@/lib/car-parts";
import { readableTextColor } from "@/lib/colors";
import { dayLabel } from "@/lib/dates";
import { formatMXN } from "@/lib/money";
import { calculateQuote, servicesForVehicle } from "@/lib/quote";
import { formatMxPhone } from "@/lib/quote-message";
import { arrivalLabel, formatClockTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { BookingRequest } from "@/lib/booking-request";
import type { PaymentOption } from "@/lib/payment-options";
import { isExplainerId } from "@/lib/service-explainers";
import { vehicleShape } from "@/lib/vehicle-shape";
import { bookWithCash, prepareQuote, startCheckout, type QuoteSummary } from "./actions";

type Customer = { name: string; phone: string; address: string; references: string; email: string };

const EMPTY_CUSTOMER: Customer = { name: "", phone: "", address: "", references: "", email: "" };

const SLOT_STATUS_TEXT: Record<Exclude<SlotAvailability["status"], "available">, string> = {
  too_soon: "Ya no da tiempo",
  full: "Lleno",
  too_big: "Tu servicio no cabe en este horario",
};

export function BookingFlow({
  data,
  now: nowIso,
  askZoneUrl,
  specialServiceUrl,
  payOnline,
}: {
  data: BookingData;
  now: string;
  askZoneUrl: string | null;
  // WhatsApp message to ask for a special service that isn't in the list.
  specialServiceUrl: string | null;
  // Mercado Pago is connected: the bar can mention paying the deposit online.
  payOnline: boolean;
}) {
  const now = new Date(nowIso);
  const { catalog } = data;

  const [vehicleTypeId, setVehicleTypeId] = useState<string | null>(
    catalog.vehicleTypes.length === 1 ? catalog.vehicleTypes[0].id : null,
  );
  const [baseServiceId, setBaseServiceId] = useState<string | null>(null);
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [zoneMissing, setZoneMissing] = useState(false);
  const [extrasTab, setExtrasTab] = useState<ServiceArea>("exterior");
  // Extras stay folded until the customer asks for them: who only wants the wash isn't
  // flooded with options, and who opens them is interested.
  const [showExtras, setShowExtras] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  // The exact time: a slot and which of its turns (0 = its first time).
  const [start, setStart] = useState<{ slotId: string; place: number } | null>(null);
  const [customer, setCustomer] = useState<Customer>(EMPTY_CUSTOMER);
  const [website, setWebsite] = useState("");
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<{ quote: QuoteSummary; request: BookingRequest } | null>(null);
  const [pending, startTransition] = useTransition();

  // Choices that stop making sense (another vehicle, a full slot) are dropped here
  // instead of in effects, so the screen never shows an impossible combination.
  const offered = vehicleTypeId ? servicesForVehicle(catalog, vehicleTypeId) : { base: [], extras: [] };
  const baseService = offered.base.find((service) => service.id === baseServiceId) ?? null;
  const base = baseService?.id ?? null;
  // A service like Full detailing already includes every extra: hide them.
  const extrasAllowed = !baseService?.includesExtras;
  const extras = extrasAllowed ? extraIds.filter((id) => offered.extras.some((service) => service.id === id)) : [];
  const result =
    vehicleTypeId && base
      ? calculateQuote(catalog, { vehicleTypeId, baseServiceId: base, extraServiceIds: extras, zoneId })
      : null;
  const quote = result?.ok ? result.quote : null;
  // What the drawing lights up: the main service plus the chosen extras.
  const parts = partsWorkedOn([
    ...(baseService ? [baseService] : []),
    ...offered.extras.filter((service) => extras.includes(service.id)),
  ]);
  const extraAreas = SERVICE_AREAS.filter((area) => offered.extras.some((service) => service.area === area));
  const tab = extraAreas.includes(extrasTab) ? extrasTab : extraAreas[0];
  const unitsNeeded = quote?.capacityUnits ?? 1;

  const notBefore = earliestStart(data.rules, now);
  const slotsByDate = new Map(
    bookableDates(data.rules, now).map((day) => [
      day,
      slotsForDate({ date: day, slots: data.slots, usage: data.usage, unitsNeeded, notBefore }),
    ]),
  );
  const dates = daysWithTimeLeft(slotsByDate);
  const daySlots = date ? (slotsByDate.get(date) ?? []) : [];
  const chosen =
    start &&
    daySlots
      .find((item) => item.id === start.slotId)
      ?.starts.some((item) => item.place === start.place && item.status === "available")
      ? start
      : null;

  const brandStyle = {
    "--brand": data.business.brandColor,
    "--brand-text": readableTextColor(data.business.brandColor),
  } as CSSProperties;

  function toggleExtra(id: string) {
    setExtraIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const missing = !vehicleTypeId
      ? "Elige tu vehículo."
      : !base
        ? "Elige un servicio."
        : !zoneId
          ? "Elige tu colonia."
          : !date || !chosen
            ? "Elige el día y la hora."
            : null;
    if (missing || !vehicleTypeId || !base || !zoneId || !date || !chosen) {
      setError(missing ?? "Revisa tus datos.");
      return;
    }
    const request: BookingRequest = {
      slug: data.business.slug,
      vehicleTypeId,
      baseServiceId: base,
      extraServiceIds: extras,
      zoneId,
      date,
      timeSlotId: chosen.slotId,
      startPlace: chosen.place,
      customer,
      website,
    };
    startTransition(async () => {
      const response = await prepareQuote(request);
      if (response.ok) {
        setSummary({ quote: response.summary, request });
        window.scrollTo({ top: 0 });
      } else {
        setError(response.message);
      }
    });
  }

  if (summary) {
    return (
      <div style={brandStyle}>
        <Summary
          summary={summary.quote}
          request={summary.request}
          onBack={() => setSummary(null)}
          policy={data.business.cancellationPolicy}
          privacy={data.business.privacyNotice}
          priceNotice={data.business.priceNotice}
          parts={partsWorkedOn(
            summary.quote.quote.lines.flatMap((line) => catalog.services.filter((service) => service.id === line.serviceId)),
          )}
          brandColor={data.business.brandColor}
        />
      </div>
    );
  }

  if (catalog.vehicleTypes.length === 0 || catalog.services.length === 0) {
    return <p className="rounded-lg bg-amber-100 p-4 text-amber-900">Este negocio todavía no tiene servicios disponibles.</p>;
  }

  return (
    <form id="booking-form" onSubmit={submit} className="space-y-8 pb-32" style={brandStyle}>
      <Step number={1} title="Tu vehículo" icon={Car}>
        <div className="grid grid-cols-3 gap-2">
          {catalog.vehicleTypes.map((vehicle) => {
            const selected = vehicle.id === vehicleTypeId;
            return (
              <button
                key={vehicle.id}
                type="button"
                onClick={() => setVehicleTypeId(vehicle.id)}
                aria-pressed={selected}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-2xl border-2 bg-card px-2 pt-3 pb-2.5 text-center text-sm transition-colors",
                  selected ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-text)]" : "border-border",
                )}
              >
                <VehicleSilhouette
                  shape={vehicleShape(vehicle.name)}
                  className={cn("h-9 w-20", selected ? "text-[var(--brand-text)]" : "text-[var(--brand)]")}
                />
                <span className="leading-tight font-medium">{vehicle.name}</span>
              </button>
            );
          })}
        </div>
      </Step>

      <Step number={2} title="Servicio" icon={Sparkles}>
        {!vehicleTypeId ? (
          <Hint>Primero elige tu vehículo para ver los precios.</Hint>
        ) : (
          <>
            <div className="space-y-2">
              {offered.base.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  selected={service.id === base}
                  onClick={() => setBaseServiceId(service.id)}
                  color={data.business.brandColor}
                />
              ))}
            </div>
            {data.business.priceNotice && (
              <p className="flex gap-2 text-sm text-muted-foreground">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                {data.business.priceNotice}
              </p>
            )}
          </>
        )}
        {baseService && <CarSummary parts={parts} color={data.business.brandColor} />}
      </Step>

      {vehicleTypeId && base && extrasAllowed && offered.extras.length > 0 && (
        <Step number={3} title="Extras (opcional)" icon={CirclePlus}>
          {!showExtras ? (
            <button
              type="button"
              onClick={() => setShowExtras(true)}
              aria-expanded={false}
              className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-[color-mix(in_oklab,var(--brand)_45%,white)] bg-[color-mix(in_oklab,var(--brand)_6%,white)] p-4 text-left"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-[var(--brand-text)]">
                <Plus className="size-6" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">
                  {extras.length > 0
                    ? `Llevas ${extras.length === 1 ? "1 extra" : `${extras.length} extras`}: ver o cambiar`
                    : "¿Le agregamos algo a tu auto?"}
                </span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  {extras.length > 0
                    ? offered.extras
                        .filter((service) => extras.includes(service.id))
                        .map((service) => service.name)
                        .join(", ")
                    : `Tenemos ${offered.extras.length} servicios extra, como ${offered.extras
                        .slice(0, 2)
                        .map((service) => service.name)
                        .join(" y ")}. Si solo quieres tu ${baseService?.name ?? "servicio"}, sigue abajo.`}
                </span>
              </span>
              <ChevronDown className="size-5 shrink-0 text-[var(--brand)]" aria-hidden />
            </button>
          ) : (
            <>
          {extraAreas.length > 1 && (
            <div role="tablist" aria-label="Extras" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
              {extraAreas.map((area) => {
                const count = offered.extras.filter((service) => service.area === area && extras.includes(service.id)).length;
                const Icon = area === "exterior" ? Car : Armchair;
                return (
                  <button
                    key={area}
                    type="button"
                    role="tab"
                    aria-selected={area === tab}
                    onClick={() => setExtrasTab(area)}
                    className={cn(
                      "flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors",
                      area === tab ? "bg-card shadow-sm" : "text-muted-foreground",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    {AREA_LABELS[area]}
                    {count > 0 && (
                      <span className="rounded-full bg-[var(--brand)] px-1.5 text-xs leading-5 text-[var(--brand-text)]">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            {tab === "interior"
              ? "Asientos, alfombras, tablero y cueros."
              : "Pintura, vidrios, rines, faros y plásticos de afuera."}
          </p>
          <div className="space-y-2" role="tabpanel">
            {offered.extras
              .filter((service) => service.area === tab)
              .map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  selected={extras.includes(service.id)}
                  onClick={() => toggleExtra(service.id)}
                  role="checkbox"
                  color={data.business.brandColor}
                />
              ))}
          </div>
          <button
            type="button"
            onClick={() => setShowExtras(false)}
            aria-expanded={true}
            className="w-full text-center text-sm font-medium text-[var(--brand)]"
          >
            {extras.length > 0 ? "Listo con los extras" : "Ocultar extras"}
          </button>
            </>
          )}
        </Step>
      )}

      {vehicleTypeId && data.business.specialServicesNotice && (
        <aside className="flex items-start gap-3 rounded-2xl border bg-card p-4 text-sm shadow-sm">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--brand)_14%,white)] text-[var(--brand)]">
            <Wrench className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="font-semibold">¿Necesitas algo especial?</p>
            <p className="text-muted-foreground">{data.business.specialServicesNotice}</p>
            {specialServiceUrl && (
              <a
                href={specialServiceUrl}
                className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 font-medium text-white"
              >
                <MessageCircle className="size-4" aria-hidden />
                Cotizar por WhatsApp
              </a>
            )}
          </div>
        </aside>
      )}

      <Step number={4} title="Tu colonia" icon={MapPin}>
        <div className="flex flex-wrap gap-2">
          {catalog.zones.map((zone) => (
            <Chip
              key={zone.id}
              selected={zone.id === zoneId}
              onClick={() => {
                setZoneId(zone.id);
                setZoneMissing(false);
              }}
            >
              {zone.name}
              {zone.surchargeCents > 0 && <span className="opacity-80"> +{formatMXN(zone.surchargeCents)}</span>}
            </Chip>
          ))}
          <Chip
            selected={zoneMissing}
            onClick={() => {
              setZoneId(null);
              setZoneMissing(true);
            }}
          >
            Mi colonia no está
          </Chip>
        </div>
        {zoneMissing && (
          <div className="mt-3 rounded-xl bg-muted p-4 text-sm">
            <p>Pregúntanos si llegamos a tu colonia.</p>
            {askZoneUrl && (
              <a href={askZoneUrl} className="mt-3 block rounded-lg bg-green-600 px-4 py-3 text-center font-medium text-white">
                Pregúntanos por WhatsApp
              </a>
            )}
          </div>
        )}
      </Step>

      <Step number={5} title="Día y hora" icon={CalendarCheck}>
        {dates.length === 0 ? (
          <Hint>Por ahora no hay días disponibles. Escríbenos por WhatsApp.</Hint>
        ) : (
          <>
            <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2">
              {dates.map((day) => {
                const label = dayLabel(day);
                const hasRoom = (slotsByDate.get(day) ?? []).some((item) => item.status === "available");
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setDate(day)}
                    aria-pressed={day === date}
                    className={cn(
                      "flex min-w-16 snap-start flex-col items-center rounded-xl border bg-card px-3 py-2 text-sm",
                      day === date && "border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-text)]",
                      !hasRoom && day !== date && "opacity-50",
                    )}
                  >
                    <span className="capitalize">{label.weekday}</span>
                    <span className="text-lg font-semibold">{label.day}</span>
                    <span>{label.month}</span>
                    {!hasRoom && <span className="text-xs">Lleno</span>}
                  </button>
                );
              })}
            </div>
            {date && (
              <div className="mt-3 space-y-4">
                {daySlots.map((item) => (
                  <div key={item.id} role="group" aria-label={item.name} className="space-y-2">
                    <p className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-semibold">{item.name}</span>
                      <span className="text-muted-foreground">
                        {item.status === "available"
                          ? `${formatClockTime(item.startTime)} a ${formatClockTime(item.endTime)}`
                          : SLOT_STATUS_TEXT[item.status]}
                      </span>
                    </p>
                    {item.status === "available" && (
                      <div className="grid grid-cols-3 gap-2">
                        {item.starts
                          .filter((time) => time.status !== "too_soon")
                          .map((time) => {
                            const taken = time.status !== "available";
                            const selected = chosen?.slotId === item.id && chosen.place === time.place;
                            return (
                              <button
                                key={time.place}
                                type="button"
                                disabled={taken}
                                onClick={() => setStart({ slotId: item.id, place: time.place })}
                                aria-pressed={selected}
                                aria-label={`${formatClockTime(time.time)}${taken ? ", ocupado" : ""}`}
                                className={cn(
                                  "h-11 rounded-xl border-2 bg-card text-base font-semibold transition-colors",
                                  selected ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-text)]" : "border-border",
                                  taken && "border-dashed font-normal text-muted-foreground line-through opacity-60",
                                )}
                              >
                                {formatClockTime(time.time)}
                              </button>
                            );
                          })}
                      </div>
                    )}
                  </div>
                ))}
                <Hint>Es la hora en que llegamos a tu domicilio.</Hint>
              </div>
            )}
          </>
        )}
      </Step>

      <Step number={6} title="Tus datos" icon={User}>
        <div className="space-y-3">
          <TextField
            label="Nombre"
            name="name"
            value={customer.name}
            onChange={(name) => setCustomer({ ...customer, name })}
            autoComplete="name"
            required
          />
          <TextField
            label="Celular (10 dígitos)"
            name="phone"
            type="tel"
            inputMode="tel"
            value={customer.phone}
            onChange={(phone) => setCustomer({ ...customer, phone })}
            autoComplete="tel-national"
            required
          />
          <TextField
            label="Dirección (calle, número y colonia)"
            name="address"
            value={customer.address}
            onChange={(address) => setCustomer({ ...customer, address })}
            autoComplete="street-address"
            required
          />
          <TextField
            label="Referencias (opcional)"
            name="references"
            value={customer.references}
            onChange={(references) => setCustomer({ ...customer, references })}
            placeholder="Ej. portón negro, frente al parque"
          />
          <TextField
            label="Correo (opcional)"
            name="email"
            type="email"
            inputMode="email"
            value={customer.email}
            onChange={(email) => setCustomer({ ...customer, email })}
            autoComplete="email"
          />
          {/* Honeypot: hidden from people, filled by spam bots. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Sitio web
              <input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
            </label>
          </div>
        </div>
      </Step>

      <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-xl px-4 py-3">
          {error && (
            <p aria-live="polite" className="mb-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm">
              {quote ? (
                <>
                  <p className="text-lg font-bold">{formatMXN(quote.totalCents)}</p>
                  <p className="text-muted-foreground">
                    {payOnline && quote.depositCents < quote.totalCents
                      ? `o anticipo de ${formatMXN(quote.depositCents)} en línea`
                      : "Pagas el día del servicio"}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">Elige vehículo y servicio</p>
              )}
            </div>
            <button
              type="submit"
              disabled={pending}
              className="h-11 rounded-lg bg-[var(--brand)] px-5 font-semibold text-[var(--brand-text)] disabled:opacity-60"
            >
              {pending ? "Revisando…" : "Ver resumen"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

function Summary({
  summary,
  request,
  onBack,
  policy,
  privacy,
  priceNotice,
  parts,
  brandColor,
}: {
  summary: QuoteSummary;
  request: BookingRequest;
  onBack: () => void;
  policy: string;
  privacy: string;
  priceNotice: string;
  parts: CarPart[];
  brandColor: string;
}) {
  const { quote } = summary;
  // Cash on the day unless the customer picks card or transfer (when Mercado Pago is on).
  const [method, setMethod] = useState<"cash" | "online">("cash");
  const [option, setOption] = useState<PaymentOption>(summary.choices[0]?.option ?? "full");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState("");
  const [paying, startPaying] = useTransition();
  const [soon, setSoon] = useState(false);
  const online = method === "online" && summary.payOnline;
  const amountCents = summary.choices.find((choice) => choice.option === option)?.amountCents ?? quote.totalCents;

  function confirm() {
    setError("");
    if (!acceptTerms) {
      setError("Acepta la política de cancelación y el aviso de privacidad para continuar.");
      return;
    }
    startPaying(async () => {
      if (online) {
        const response = await startCheckout(request, { option, acceptTerms });
        if (response.ok) window.location.assign(response.checkoutUrl);
        else setError(response.message);
        return;
      }
      const response = await bookWithCash(request, { acceptTerms });
      if (response.ok) window.location.assign(response.bookingUrl);
      else setError(response.message);
    });
  }

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold">Tu cotización</h2>
      <section className="space-y-3 rounded-xl border bg-card p-4 text-sm shadow-sm">
        <Row label="Vehículo" value={quote.vehicle.name} />
        {quote.lines.map((line) => (
          <Row key={line.serviceId} label={line.name} value={formatMXN(line.priceCents)} />
        ))}
        {quote.surchargeCents > 0 && (
          <Row label={`Recargo ${quote.zone?.name ?? ""}`} value={formatMXN(quote.surchargeCents)} />
        )}
        <div className="border-t pt-3">
          <Row label="Total" value={formatMXN(quote.totalCents)} strong />
          {online && option === "deposit" && (
            <>
              <Row label={`Anticipo (${summary.depositLabel})`} value={formatMXN(quote.depositCents)} />
              <Row label="Saldo el día del servicio" value={formatMXN(quote.balanceCents)} />
            </>
          )}
        </div>
      </section>
      {priceNotice && (
        <p className="flex gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden />
          <span>
            <strong className="font-semibold">Precio sujeto a cambios.</strong> {priceNotice}
          </span>
        </p>
      )}
      <CarSummary parts={parts} color={brandColor} title="Esto le haremos a tu auto" />
      <section className="space-y-1 rounded-xl border bg-card p-4 text-sm shadow-sm">
        <p className="font-medium first-letter:uppercase">{summary.dateLabel}</p>
        <p>{arrivalLabel(summary.slot)}</p>
        <p className="pt-2">
          {summary.customer.address}
          {quote.zone && `, ${quote.zone.name}`}
        </p>
        {summary.customer.references && <p className="text-muted-foreground">{summary.customer.references}</p>}
        <p className="pt-2">
          {summary.customer.name} · {formatMxPhone(summary.customer.phone)}
        </p>
      </section>

      {summary.bookOnline ? (
        <>
          <section className="space-y-2">
            <h3 className="font-semibold">¿Cómo quieres pagar?</h3>
            <Choice selected={method === "cash"} onClick={() => setMethod("cash")}>
              <span className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-medium">
                  <Banknote className="size-5" aria-hidden /> Efectivo
                </span>
                <span className="font-semibold">{formatMXN(quote.totalCents)}</span>
              </span>
              <span className="mt-1 block text-sm opacity-80">
                Pagas el día del servicio. Tu lugar queda apartado desde ahora.
              </span>
            </Choice>
            <Choice
              selected={online}
              onClick={() => {
                if (summary.payOnline) setMethod("online");
                else setSoon(true);
              }}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-medium">
                  <CreditCard className="size-5" aria-hidden /> Tarjeta o transferencia
                </span>
                {!summary.payOnline && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                    Muy pronto
                  </span>
                )}
              </span>
              <span className="mt-1 block text-sm opacity-80">
                {summary.payOnline
                  ? "Pagas en línea, en Mercado Pago: el anticipo o todo."
                  : soon
                    ? "Todavía no está listo. Por ahora elige efectivo y pagas el día del servicio."
                    : "Pronto podrás pagar en línea."}
              </span>
            </Choice>
          </section>

          {online && (
            <section className="space-y-2">
              <h3 className="font-semibold">¿Cuánto quieres pagar ahora?</h3>
              {summary.choices.map((choice) => (
                <Choice key={choice.option} selected={choice.option === option} onClick={() => setOption(choice.option)}>
                  <span className="flex justify-between gap-3">
                    <span className="font-medium">{choice.option === "full" ? "Pagar todo" : "Solo el anticipo"}</span>
                    <span className="font-semibold">{formatMXN(choice.amountCents)}</span>
                  </span>
                  <span className="mt-1 block text-sm opacity-80">
                    {choice.option === "full"
                      ? "Ya no pagas nada el día del servicio."
                      : `El resto, ${formatMXN(quote.totalCents - choice.amountCents)}, el día del servicio.`}
                  </span>
                </Choice>
              ))}
            </section>
          )}

          <label className="flex items-start gap-3 rounded-xl border bg-card p-4 text-sm">
            <input
              type="checkbox"
              name="acceptTerms"
              checked={acceptTerms}
              onChange={(event) => {
                setAcceptTerms(event.target.checked);
                setError("");
              }}
              className="mt-0.5 size-5 shrink-0 accent-[var(--brand)]"
            />
            <span>Acepto la política de cancelación y el aviso de privacidad.</span>
          </label>
          {policy && (
            <details className="rounded-xl border bg-card p-4 text-sm">
              <summary className="cursor-pointer font-medium">Política de cancelación</summary>
              <p className="mt-2 whitespace-pre-line text-muted-foreground">{policy}</p>
            </details>
          )}
          {privacy && (
            <details className="rounded-xl border bg-card p-4 text-sm">
              <summary className="cursor-pointer font-medium">Aviso de privacidad</summary>
              <p className="mt-2 whitespace-pre-line text-muted-foreground">{privacy}</p>
            </details>
          )}

          {error && (
            <p aria-live="polite" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={confirm}
            disabled={paying}
            className="block h-12 w-full rounded-lg bg-[var(--brand)] px-4 font-semibold text-[var(--brand-text)] disabled:opacity-60"
          >
            {paying
              ? online
                ? "Abriendo Mercado Pago…"
                : "Agendando…"
              : online
                ? `Pagar ${formatMXN(amountCents)} con Mercado Pago`
                : "Agendar"}
          </button>
          <p className="text-sm text-muted-foreground">
            {online
              ? "Tu lugar queda apartado 30 minutos mientras pagas."
              : "Al agendar, tu lugar queda apartado y le llega tu reserva al negocio."}
          </p>
          {summary.whatsappUrl && (
            <a href={summary.whatsappUrl} className="block text-center text-sm font-medium underline">
              ¿Dudas? Escríbenos por WhatsApp
            </a>
          )}
        </>
      ) : (
        <>
          {summary.whatsappUrl && (
            <a
              href={summary.whatsappUrl}
              className="block rounded-lg bg-green-600 px-4 py-3 text-center font-semibold text-white"
            >
              Enviar por WhatsApp para apartar
            </a>
          )}
          {policy && (
            <details className="rounded-xl border bg-card p-4 text-sm">
              <summary className="cursor-pointer font-medium">Política de cancelación</summary>
              <p className="mt-2 whitespace-pre-line text-muted-foreground">{policy}</p>
            </details>
          )}
        </>
      )}
      <button type="button" onClick={onBack} className="text-sm font-medium underline">
        Cambiar algo
      </button>
    </div>
  );
}

// A service the customer can pick: its picture, name, price and the parts of the car it
// covers. "¿Qué es esto?" opens a plain explanation with pictures of how it's done.
function ServiceCard({
  service,
  selected,
  onClick,
  role,
  color,
}: {
  service: BookingService & { priceCents: number };
  selected: boolean;
  onClick: () => void;
  role?: "checkbox";
  color: string;
}) {
  const [open, setOpen] = useState(false);
  const explainerId = isExplainerId(service.explainer) ? service.explainer : null;
  const icon = serviceIcon(service);
  const labels = partsLabels(service.carParts);
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border-2 bg-card transition-colors",
        selected ? "border-[var(--brand)]" : "border-border",
      )}
    >
      <button
        type="button"
        onClick={onClick}
        role={role}
        aria-checked={role === "checkbox" ? selected : undefined}
        aria-pressed={role === "checkbox" ? undefined : selected}
        className={cn(
          "flex w-full items-start gap-3 p-3 text-left transition-colors",
          selected && "bg-[var(--brand)] text-[var(--brand-text)]",
        )}
      >
        <ServiceIconBadge
          icon={icon}
          className={selected ? "bg-white/20" : "bg-[color-mix(in_oklab,var(--brand)_14%,white)] text-[var(--brand)]"}
        />
        <span className="min-w-0 flex-1">
          <span className="flex justify-between gap-3">
            <span className="font-medium">{service.name}</span>
            <span className="shrink-0 font-semibold">
              {role === "checkbox" ? "+" : ""}
              {formatMXN(service.priceCents)}
            </span>
          </span>
          {service.description && <span className="mt-1 block text-sm opacity-80">{service.description}</span>}
          {service.includesExtras && <span className="mt-1 block text-sm opacity-80">Incluye todos los extras.</span>}
          {labels.length > 0 && (
            <span className="mt-2 flex flex-wrap gap-1">
              {labels.map((label) => (
                <span
                  key={label}
                  className={cn("rounded-full px-2 py-0.5 text-xs", selected ? "bg-white/20" : "bg-muted text-muted-foreground")}
                >
                  {label}
                </span>
              ))}
            </span>
          )}
        </span>
        {role === "checkbox" && (
          <span
            className={cn(
              "mt-2.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2",
              selected ? "border-current" : "border-border",
            )}
          >
            {selected && <Check className="size-4" strokeWidth={3} aria-hidden />}
          </span>
        )}
      </button>
      {explainerId && (
        <>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className="flex w-full items-center justify-center gap-1.5 border-t px-3 py-2 text-sm font-medium text-[var(--brand)]"
          >
            <Info className="size-4" aria-hidden />
            {open ? "Ocultar explicación" : "¿Qué es esto? Mira cómo se hace"}
            <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
          </button>
          {open && (
            <div className="border-t bg-muted/40 p-4">
              <ServiceExplainer explainerId={explainerId} color={color} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Step({
  number,
  title,
  icon: Icon,
  children,
}: {
  number: number;
  title: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2.5 text-lg font-semibold">
        <span className="flex size-8 items-center justify-center rounded-full bg-[var(--brand)] text-sm text-[var(--brand-text)] shadow-sm ring-4 ring-[color-mix(in_oklab,var(--brand)_15%,white)]">
          {number}
        </span>
        {title}
        <Icon className="ml-auto size-5 text-[var(--brand)] opacity-60" aria-hidden />
      </h2>
      {children}
    </section>
  );
}

function Choice({
  selected,
  onClick,
  role,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  role?: "checkbox";
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role={role}
      aria-checked={role === "checkbox" ? selected : undefined}
      aria-pressed={role === "checkbox" ? undefined : selected}
      className={cn(
        "block w-full rounded-xl border-2 bg-card p-4 text-left transition-colors",
        selected ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-text)]" : "border-border",
      )}
    >
      {children}
    </button>
  );
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "rounded-full border-2 bg-card px-4 py-2 text-sm",
        selected ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-text)]" : "border-border",
      )}
    >
      {children}
    </button>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <p className={cn("flex justify-between gap-3", strong && "text-base font-bold")}>
      <span>{label}</span>
      <span className="shrink-0">{value}</span>
    </p>
  );
}

function TextField({
  label,
  name,
  value,
  onChange,
  type = "text",
  inputMode,
  autoComplete,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  inputMode?: "tel" | "email" | "text";
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1.5 text-sm font-medium">
      <span>{label}</span>
      <input
        name={name}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-lg border border-input bg-card px-3 text-base font-normal shadow-xs"
      />
    </label>
  );
}
