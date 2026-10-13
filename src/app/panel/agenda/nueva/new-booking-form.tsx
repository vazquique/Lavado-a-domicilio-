"use client";

import { useEffect, useState } from "react";
import { Field, FormFooter, selectClassName } from "@/components/panel/form-bits";
import { useFormAction } from "@/components/panel/use-form-action";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { BookingData } from "@/lib/booking-data";
import { formatMXN } from "@/lib/money";
import { calculateQuote, servicesForVehicle } from "@/lib/quote";
import { cn } from "@/lib/utils";
import { createManualBooking, getDaySlots, type DaySlots } from "../actions";
import { freeChoice, TimePicker, type ChosenTime } from "../slot-picker";

const optionClassName =
  "flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border bg-card px-3 text-sm has-[:checked]:border-[var(--brand)] has-[:checked]:ring-2 has-[:checked]:ring-[var(--brand)]/30";

// A booking that came by WhatsApp or phone. The total shown here is only a preview: the
// server prices it again with the catalog before saving.
export function NewBookingForm({
  catalog,
  initialDate,
  initialTime,
  today,
}: {
  catalog: BookingData["catalog"];
  initialDate: string;
  // A free time tapped in the agenda ("Agregar" next to it).
  initialTime: ChosenTime | null;
  today: string;
}) {
  const { state, pending, formRef, onSubmit } = useFormAction(createManualBooking);
  const [vehicleTypeId, setVehicleTypeId] = useState(catalog.vehicleTypes[0]?.id ?? "");
  const [baseServiceId, setBaseServiceId] = useState<string | null>(null);
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [zoneId, setZoneId] = useState("");
  const [date, setDate] = useState(initialDate);
  const [day, setDay] = useState<DaySlots | null>(null);
  const [time, setTime] = useState<ChosenTime | null>(initialTime);

  useEffect(() => {
    let current = true;
    getDaySlots(date).then((result) => {
      if (current) setDay(result);
    });
    return () => {
      current = false;
    };
  }, [date]);

  const offered = servicesForVehicle(catalog, vehicleTypeId);
  const base = offered.base.find((service) => service.id === baseServiceId) ?? null;
  const extras = base?.includesExtras ? [] : offered.extras;
  const chosenExtras = extraIds.filter((id) => extras.some((extra) => extra.id === id));
  const result = base
    ? calculateQuote(catalog, {
        vehicleTypeId,
        baseServiceId: base.id,
        extraServiceIds: chosenExtras,
        zoneId: zoneId || null,
      })
    : null;
  const quote = result?.ok ? result.quote : null;
  const unitsNeeded = quote?.capacityUnits ?? 1;
  const loaded = day?.ok && day.date === date ? day : null;
  const chosen = loaded ? freeChoice(time, loaded, unitsNeeded) : null;

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="text-lg font-semibold">Cliente</legend>
        <Field label="Nombre" htmlFor="customerName">
          <Input id="customerName" name="customerName" required maxLength={100} autoComplete="off" />
        </Field>
        <Field label="Celular (10 dígitos)" htmlFor="customerPhone">
          <Input id="customerPhone" name="customerPhone" type="tel" inputMode="numeric" required autoComplete="off" />
        </Field>
        <Field label="Dirección (calle, número y colonia)" htmlFor="address">
          <Input id="address" name="address" required maxLength={300} autoComplete="off" />
        </Field>
        <Field label="Referencias (opcional)" htmlFor="references">
          <Input id="references" name="references" maxLength={300} autoComplete="off" />
        </Field>
        <Field label="Correo (opcional)" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="off" />
        </Field>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-lg font-semibold">Servicio</legend>
        <Field label="Vehículo" htmlFor="vehicleTypeId">
          <select
            id="vehicleTypeId"
            name="vehicleTypeId"
            value={vehicleTypeId}
            onChange={(event) => {
              setVehicleTypeId(event.target.value);
              setBaseServiceId(null);
            }}
            className={selectClassName}
          >
            {catalog.vehicleTypes.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.name}
              </option>
            ))}
          </select>
        </Field>

        <div role="radiogroup" aria-label="Servicio principal" className="grid gap-2">
          {offered.base.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Este vehículo no tiene servicios con precio. Pónselos en Servicios y precios.
            </p>
          )}
          {offered.base.map((service) => (
            <label key={service.id} className={optionClassName}>
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="baseServiceId"
                  value={service.id}
                  checked={baseServiceId === service.id}
                  onChange={() => setBaseServiceId(service.id)}
                  className="size-4 accent-[var(--brand)]"
                />
                <span className="font-medium">{service.name}</span>
              </span>
              <span className="shrink-0 font-semibold">{formatMXN(service.priceCents)}</span>
            </label>
          ))}
        </div>

        {base?.includesExtras && (
          <p className="text-sm text-muted-foreground">{base.name} ya incluye todos los extras.</p>
        )}
        {base && extras.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Extras (opcional)</p>
            <div className="grid gap-2">
              {extras.map((extra) => (
                <label key={extra.id} className={optionClassName}>
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="extraServiceIds"
                      value={extra.id}
                      checked={chosenExtras.includes(extra.id)}
                      onChange={(event) =>
                        setExtraIds((ids) =>
                          event.target.checked ? [...ids, extra.id] : ids.filter((id) => id !== extra.id),
                        )
                      }
                      className="size-4 accent-[var(--brand)]"
                    />
                    {extra.name}
                  </span>
                  <span className="shrink-0">+{formatMXN(extra.priceCents)}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <Field label="Colonia" htmlFor="zoneId">
          <select
            id="zoneId"
            name="zoneId"
            value={zoneId}
            onChange={(event) => setZoneId(event.target.value)}
            className={selectClassName}
          >
            <option value="">Otra (sin recargo)</option>
            {catalog.zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
                {zone.surchargeCents > 0 ? ` (+${formatMXN(zone.surchargeCents)})` : ""}
              </option>
            ))}
          </select>
        </Field>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-lg font-semibold">Día y hora</legend>
        <Input
          type="date"
          name="date"
          min={today}
          value={date}
          required
          aria-label="Día"
          onChange={(event) => {
            setDate(event.target.value);
            setTime(null);
          }}
        />
        {day?.ok === false && <p className="text-sm text-destructive">{day.message}</p>}
        {loaded && loaded.blockedReason !== null && (
          <p className="text-sm text-amber-800">Ese día está bloqueado ({loaded.blockedReason}). Puedes agendar igual.</p>
        )}
        {loaded && loaded.blockedReason === null && !loaded.working && (
          <p className="text-sm text-amber-800">Ese día no trabajas. Puedes agendar igual.</p>
        )}
        <input type="hidden" name="timeSlotId" value={chosen?.slotId ?? ""} />
        <input type="hidden" name="startPlace" value={chosen?.place ?? ""} />
        {loaded ? (
          <TimePicker
            date={date}
            slots={loaded.slots}
            usage={loaded.usage}
            unitsNeeded={unitsNeeded}
            value={chosen}
            onChange={setTime}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Viendo qué horas hay…</p>
        )}
      </fieldset>

      <Field label="Notas (opcional)" htmlFor="notes">
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={1000}
          placeholder="Ej. portón café, paga con transferencia, el perro muerde"
        />
      </Field>

      <div className="sticky bottom-0 -mx-4 space-y-2 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <p className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-muted-foreground">Total (se cobra el día del servicio)</span>
          <span className={cn("text-xl font-bold", !quote && "text-muted-foreground")}>
            {quote ? formatMXN(quote.totalCents) : "—"}
          </span>
        </p>
        <FormFooter state={state} pending={pending} label="Guardar reserva" />
      </div>
    </form>
  );
}
