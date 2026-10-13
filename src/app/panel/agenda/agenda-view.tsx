"use client";

import { CalendarPlus, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { dayLoad, formatMonth, isActiveBooking, monthOf, shiftMonth, slotRows, type DayLoad } from "@/lib/agenda";
import { formatLongDate, isoWeekday } from "@/lib/dates";
import type { ActionState } from "@/lib/panel/action-state";
import type { AgendaBooking, AgendaMonth } from "@/lib/panel/agenda-data";
import { formatClockTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { BookingCard } from "./booking-card";

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

const LOAD_STYLES: Record<DayLoad, string> = {
  none: "",
  some: "bg-[color-mix(in_oklab,var(--brand)_18%,white)] text-[var(--brand)]",
  busy: "bg-amber-100 text-amber-800",
  full: "bg-red-100 text-red-700",
};

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// Month calendar with how busy each day is, and the chosen day's bookings by exact time:
// each slot's times with the booking at each one, or free (tap to add one there).
export function AgendaView({
  data,
  today,
  initialDay,
  now: nowIso,
  added,
  style,
}: {
  data: AgendaMonth;
  today: string;
  initialDay: string;
  now: string;
  added: string | null;
  style: CSSProperties;
}) {
  const router = useRouter();
  const now = new Date(nowIso);
  const [selected, setSelected] = useState(initialDay);
  const [notice, setNotice] = useState<ActionState | null>(
    added ? { status: "success", message: `Se agregó la reserva ${added}.` } : null,
  );
  const { month } = data;

  // The chosen day stays in the address, so reloading or saving keeps it.
  function select(day: string) {
    setSelected(day);
    setNotice(null);
    window.history.replaceState(null, "", `/panel/agenda?mes=${month}&dia=${day}`);
  }

  // After moving a booking, follow it to its new day.
  function followTo(day: string) {
    if (data.weeks.flat().includes(day)) {
      setSelected(day);
      window.history.replaceState(null, "", `/panel/agenda?mes=${month}&dia=${day}`);
    } else {
      router.push(`/panel/agenda?dia=${day}`);
    }
  }

  const byDay = new Map<string, AgendaBooking[]>();
  for (const booking of data.bookings) {
    byDay.set(booking.serviceDate, [...(byDay.get(booking.serviceDate) ?? []), booking]);
  }
  const activeSlots = data.slots.filter((slot) => slot.active);
  const isWorking = (day: string) => data.workingDays.includes(isoWeekday(day)) && !(day in data.blockedDates);
  const capacityOf = (day: string) =>
    isWorking(day) ? activeSlots.reduce((sum, slot) => sum + slot.capacity, 0) : 0;

  const dayBookings = byDay.get(selected) ?? [];
  const active = dayBookings.filter((booking) => isActiveBooking(booking, now));
  const inactive = dayBookings.filter((booking) => !isActiveBooking(booking, now));
  const usedUnits = active.reduce((sum, booking) => sum + booking.capacityUnits, 0);
  const daySlots = data.slots.filter(
    (slot) => slot.active || active.some((booking) => booking.timeSlotId === slot.id),
  );
  const blockedReason = data.blockedDates[selected];

  return (
    <div className="space-y-5" style={style}>
      <section className="space-y-3 rounded-2xl border bg-card p-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <Button asChild variant="ghost" size="icon" aria-label="Mes anterior">
            <Link href={`/panel/agenda?mes=${shiftMonth(month, -1)}`} scroll={false}>
              <ChevronLeft />
            </Link>
          </Button>
          <h2 className="text-lg font-semibold">{formatMonth(month)}</h2>
          <Button asChild variant="ghost" size="icon" aria-label="Mes siguiente">
            <Link href={`/panel/agenda?mes=${shiftMonth(month, 1)}`} scroll={false}>
              <ChevronRight />
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((weekday, index) => (
            <span key={index} className="text-xs font-medium text-muted-foreground">
              {weekday}
            </span>
          ))}
          {data.weeks.flat().map((day) => {
            const count = (byDay.get(day) ?? []).filter((booking) => isActiveBooking(booking, now)).length;
            const used = (byDay.get(day) ?? [])
              .filter((booking) => isActiveBooking(booking, now))
              .reduce((sum, booking) => sum + booking.capacityUnits, 0);
            const load = dayLoad(used, capacityOf(day));
            const isSelected = day === selected;
            const outside = monthOf(day) !== month;
            return (
              <button
                key={day}
                type="button"
                onClick={() => select(day)}
                aria-pressed={isSelected}
                aria-label={`${formatLongDate(day)}: ${count === 1 ? "1 reserva" : `${count} reservas`}`}
                className={cn(
                  "flex h-12 flex-col items-center justify-center gap-0.5 rounded-lg text-sm transition-colors",
                  outside && "text-muted-foreground/60",
                  !isWorking(day) && !isSelected && "bg-muted/70 text-muted-foreground",
                  day === today && !isSelected && "font-bold ring-2 ring-[var(--brand)] ring-inset",
                  isSelected && "bg-[var(--brand)] font-semibold text-[var(--brand-text)]",
                )}
              >
                <span className={cn(day in data.blockedDates && "line-through")}>{Number(day.slice(8))}</span>
                {count > 0 ? (
                  <span
                    className={cn(
                      "min-w-5 rounded-full px-1 text-[11px] leading-4 font-semibold",
                      isSelected ? "bg-white/25" : LOAD_STYLES[load],
                    )}
                  >
                    {count}
                  </span>
                ) : (
                  <span className="h-4" />
                )}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1">
              <span className={cn("size-3 rounded-full", LOAD_STYLES.some)} /> Con lugar
            </span>
            <span className="flex items-center gap-1">
              <span className={cn("size-3 rounded-full", LOAD_STYLES.busy)} /> Medio lleno
            </span>
            <span className="flex items-center gap-1">
              <span className={cn("size-3 rounded-full", LOAD_STYLES.full)} /> Lleno
            </span>
            <span className="flex items-center gap-1">
              <span className="size-3 rounded-full bg-muted" /> No trabajas
            </span>
          </span>
          {selected !== today &&
            (monthOf(today) === month || data.weeks.flat().includes(today) ? (
              <Button variant="outline" size="xs" onClick={() => select(today)}>
                Hoy
              </Button>
            ) : (
              <Button asChild variant="outline" size="xs">
                <Link href="/panel/agenda">Hoy</Link>
              </Button>
            ))}
        </div>
      </section>

      <section className="space-y-4" aria-live="polite">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              {selected === today ? "Hoy, " : ""}
              {selected === today ? formatLongDate(selected) : capitalize(formatLongDate(selected))}
            </h2>
            <p className="text-sm text-muted-foreground">
              {active.length === 0
                ? "Sin reservas"
                : `${active.length === 1 ? "1 servicio" : `${active.length} servicios`}${
                    capacityOf(selected) > 0 ? ` · ${usedUnits} de ${capacityOf(selected)} lugares` : ""
                  }`}
            </p>
          </div>
          {selected >= today && (
            <Button asChild size="sm" className="shrink-0 bg-[var(--brand)] text-[var(--brand-text)]">
              <Link href={`/panel/agenda/nueva?dia=${selected}`}>
                <CalendarPlus /> Agregar
              </Link>
            </Button>
          )}
        </div>

        {notice && (
          <p
            className={cn(
              "rounded-lg px-3 py-2 text-sm",
              notice.status === "error" ? "bg-destructive/10 text-destructive" : "bg-green-100 text-green-800",
            )}
          >
            {notice.message}
          </p>
        )}
        {blockedReason !== undefined && (
          <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">
            Día bloqueado{blockedReason ? `: ${blockedReason}` : ""}. Los clientes no lo pueden elegir.
          </p>
        )}
        {blockedReason === undefined && !isWorking(selected) && (
          <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            Este día no trabajas. Los clientes no lo pueden elegir.
          </p>
        )}

        {daySlots.map((slot) => {
          const inSlot = active.filter((booking) => booking.timeSlotId === slot.id);
          const used = inSlot.reduce((sum, booking) => sum + booking.capacityUnits, 0);
          const { rows, loose } = slotRows(slot, inSlot);
          const hasRoom = used < slot.capacity;
          const canAdd = slot.active && hasRoom && selected >= today;
          return (
            <div key={slot.id} className="space-y-2">
              <h3 className="flex items-baseline justify-between gap-2 text-sm font-semibold">
                <span>
                  {slot.name} · {formatClockTime(slot.startTime)} a {formatClockTime(slot.endTime)}
                </span>
                <span className="font-normal text-muted-foreground">
                  {used} de {slot.capacity} lugares
                </span>
              </h3>
              {rows.map((row) =>
                row.bookings.length > 0 ? (
                  row.bookings.map((booking) => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      today={today}
                      onResult={setNotice}
                      onMoved={followTo}
                    />
                  ))
                ) : slot.active ? (
                  <div
                    key={`free-${row.place}`}
                    className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-dashed px-3 text-sm"
                  >
                    <span>
                      <span className="font-semibold tabular-nums">{formatClockTime(row.time)}</span>
                      <span className="text-muted-foreground"> · {hasRoom ? "Libre" : "Sin lugar"}</span>
                    </span>
                    {canAdd && (
                      <Link
                        href={`/panel/agenda/nueva?dia=${selected}&horario=${slot.id}&lugar=${row.place}`}
                        aria-label={`Agregar reserva a las ${formatClockTime(row.time)}`}
                        className="flex items-center gap-1 font-medium text-[var(--brand)]"
                      >
                        <Plus className="size-4" aria-hidden /> Agregar
                      </Link>
                    )}
                  </div>
                ) : null,
              )}
              {loose.map((booking) => (
                <BookingCard key={booking.id} booking={booking} today={today} onResult={setNotice} onMoved={followTo} />
              ))}
            </div>
          );
        })}

        {inactive.length > 0 && (
          <details className="rounded-xl border bg-card p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Canceladas y sin pagar ({inactive.length})
            </summary>
            <div className="mt-3 space-y-2">
              {inactive.map((booking) => (
                <BookingCard key={booking.id} booking={booking} today={today} onResult={setNotice} onMoved={followTo} />
              ))}
            </div>
          </details>
        )}
      </section>
    </div>
  );
}
