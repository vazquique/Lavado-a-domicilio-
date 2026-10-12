"use client";

import { useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { bookableDates, slotsForDate, type SlotAvailability } from "@/lib/availability";
import type { BookingData } from "@/lib/booking-data";
import { readableTextColor } from "@/lib/colors";
import { dayLabel } from "@/lib/dates";
import { formatMXN } from "@/lib/money";
import { calculateQuote, servicesForVehicle } from "@/lib/quote";
import { formatMxPhone } from "@/lib/quote-message";
import { formatClockTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { prepareQuote, type QuoteSummary } from "./actions";

type Customer = { name: string; phone: string; address: string; references: string; email: string };

const EMPTY_CUSTOMER: Customer = { name: "", phone: "", address: "", references: "", email: "" };

const SLOT_STATUS_TEXT: Record<SlotAvailability["status"], string> = {
  available: "",
  too_soon: "Ya no da tiempo",
  full: "Lleno",
  too_big: "No cabe en este horario",
};

export function BookingFlow({
  data,
  now: nowIso,
  askZoneUrl,
}: {
  data: BookingData;
  now: string;
  askZoneUrl: string | null;
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
  const [date, setDate] = useState<string | null>(null);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [customer, setCustomer] = useState<Customer>(EMPTY_CUSTOMER);
  const [website, setWebsite] = useState("");
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<QuoteSummary | null>(null);
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
  const unitsNeeded = quote?.capacityUnits ?? 1;

  const dates = bookableDates(data.rules, now);
  const slotsByDate = new Map(
    dates.map((day) => [
      day,
      slotsForDate({ date: day, slots: data.slots, usage: data.usage, rules: data.rules, now, unitsNeeded }),
    ]),
  );
  const daySlots = date ? (slotsByDate.get(date) ?? []) : [];
  const slot = daySlots.some((item) => item.id === slotId && item.status === "available") ? slotId : null;

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
          : !date || !slot
            ? "Elige el día y el horario."
            : null;
    if (missing || !vehicleTypeId || !base || !zoneId || !date || !slot) {
      setError(missing ?? "Revisa tus datos.");
      return;
    }
    startTransition(async () => {
      const response = await prepareQuote({
        slug: data.business.slug,
        vehicleTypeId,
        baseServiceId: base,
        extraServiceIds: extras,
        zoneId,
        date,
        timeSlotId: slot,
        customer,
        website,
      });
      if (response.ok) {
        setSummary(response.summary);
        window.scrollTo({ top: 0 });
      } else {
        setError(response.message);
      }
    });
  }

  if (summary) {
    return (
      <div style={brandStyle}>
        <Summary summary={summary} onBack={() => setSummary(null)} policy={data.business.cancellationPolicy} />
      </div>
    );
  }

  if (catalog.vehicleTypes.length === 0 || catalog.services.length === 0) {
    return <p className="rounded-lg bg-amber-100 p-4 text-amber-900">Este negocio todavía no tiene servicios disponibles.</p>;
  }

  return (
    <form id="booking-form" onSubmit={submit} className="space-y-8 pb-32" style={brandStyle}>
      <Step number={1} title="Tu vehículo">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {catalog.vehicleTypes.map((vehicle) => (
            <Choice key={vehicle.id} selected={vehicle.id === vehicleTypeId} onClick={() => setVehicleTypeId(vehicle.id)}>
              {vehicle.name}
            </Choice>
          ))}
        </div>
      </Step>

      <Step number={2} title="Servicio">
        {!vehicleTypeId ? (
          <Hint>Primero elige tu vehículo para ver los precios.</Hint>
        ) : (
          <div className="space-y-2">
            {offered.base.map((service) => (
              <Choice key={service.id} selected={service.id === base} onClick={() => setBaseServiceId(service.id)}>
                <span className="flex justify-between gap-3">
                  <span className="font-medium">{service.name}</span>
                  <span className="font-semibold">{formatMXN(service.priceCents)}</span>
                </span>
                {service.description && <span className="mt-1 block text-sm opacity-80">{service.description}</span>}
                {service.includesExtras && <span className="mt-1 block text-sm opacity-80">Incluye todos los extras.</span>}
              </Choice>
            ))}
          </div>
        )}
      </Step>

      {vehicleTypeId && base && extrasAllowed && offered.extras.length > 0 && (
        <Step number={3} title="Extras (opcional)">
          <div className="space-y-2">
            {offered.extras.map((service) => (
              <Choice
                key={service.id}
                selected={extras.includes(service.id)}
                onClick={() => toggleExtra(service.id)}
                role="checkbox"
              >
                <span className="flex justify-between gap-3">
                  <span>{service.name}</span>
                  <span className="shrink-0 font-semibold">+{formatMXN(service.priceCents)}</span>
                </span>
                {service.description && <span className="mt-1 block text-sm opacity-80">{service.description}</span>}
              </Choice>
            ))}
          </div>
        </Step>
      )}

      <Step number={4} title="Tu colonia">
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

      <Step number={5} title="Día y horario">
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
              <div className="mt-3 space-y-2">
                {daySlots.map((item) => (
                  <Choice
                    key={item.id}
                    selected={item.id === slot}
                    disabled={item.status !== "available"}
                    onClick={() => setSlotId(item.id)}
                  >
                    <span className="flex justify-between gap-3">
                      <span>
                        <span className="font-medium">{item.name}</span> · {formatClockTime(item.startTime)} a{" "}
                        {formatClockTime(item.endTime)}
                      </span>
                      <span className="shrink-0 text-sm">{SLOT_STATUS_TEXT[item.status]}</span>
                    </span>
                  </Choice>
                ))}
              </div>
            )}
          </>
        )}
      </Step>

      <Step number={6} title="Tus datos">
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
                  <p className="text-muted-foreground">Anticipo {formatMXN(quote.depositCents)}</p>
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

function Summary({ summary, onBack, policy }: { summary: QuoteSummary; onBack: () => void; policy: string }) {
  const { quote } = summary;
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
          <Row label={`Anticipo (${summary.depositLabel})`} value={formatMXN(quote.depositCents)} />
          <Row label="Saldo el día del servicio" value={formatMXN(quote.balanceCents)} />
        </div>
      </section>
      <section className="space-y-1 rounded-xl border bg-card p-4 text-sm shadow-sm">
        <p className="font-medium first-letter:uppercase">{summary.dateLabel}</p>
        <p>
          {summary.slot.name} · {formatClockTime(summary.slot.startTime)} a {formatClockTime(summary.slot.endTime)}
        </p>
        <p className="pt-2">
          {summary.customer.address}
          {quote.zone && `, ${quote.zone.name}`}
        </p>
        {summary.customer.references && <p className="text-muted-foreground">{summary.customer.references}</p>}
        <p className="pt-2">
          {summary.customer.name} · {formatMxPhone(summary.customer.phone)}
        </p>
      </section>

      {summary.whatsappUrl && (
        <a
          href={summary.whatsappUrl}
          className="block rounded-lg bg-green-600 px-4 py-3 text-center font-semibold text-white"
        >
          Enviar por WhatsApp para apartar
        </a>
      )}
      <p className="text-sm text-muted-foreground">
        Muy pronto podrás pagar tu anticipo aquí mismo para apartar tu lugar al instante.
      </p>
      {policy && (
        <details className="rounded-xl border bg-card p-4 text-sm">
          <summary className="cursor-pointer font-medium">Política de cancelación</summary>
          <p className="mt-2 whitespace-pre-line text-muted-foreground">{policy}</p>
        </details>
      )}
      <button type="button" onClick={onBack} className="text-sm font-medium underline">
        Cambiar algo
      </button>
    </div>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <span className="flex size-7 items-center justify-center rounded-full bg-[var(--brand)] text-sm text-[var(--brand-text)]">
          {number}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Choice({
  selected,
  onClick,
  disabled,
  role,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  role?: "checkbox";
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      role={role}
      aria-checked={role === "checkbox" ? selected : undefined}
      aria-pressed={role === "checkbox" ? undefined : selected}
      className={cn(
        "block w-full rounded-xl border-2 bg-card p-4 text-left transition-colors disabled:opacity-50",
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
