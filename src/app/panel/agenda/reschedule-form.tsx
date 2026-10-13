"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionState } from "@/lib/panel/action-state";
import type { AgendaBooking } from "@/lib/panel/agenda-data";
import { getDaySlots, rescheduleBooking, type DaySlots } from "./actions";
import { freeChoice, TimePicker, type ChosenTime } from "./slot-picker";

// Pick another day and exact time for a booking; its own places count as free.
export function RescheduleForm({
  booking,
  today,
  onDone,
  onError,
  onClose,
}: {
  booking: AgendaBooking;
  today: string;
  onDone: (result: ActionState, date: string) => void;
  onError: (result: ActionState) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState(booking.serviceDate < today ? today : booking.serviceDate);
  const [day, setDay] = useState<DaySlots | null>(null);
  const [time, setTime] = useState<ChosenTime | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let current = true;
    getDaySlots(date, booking.id).then((result) => {
      if (current) setDay(result);
    });
    return () => {
      current = false;
    };
  }, [date, booking.id]);

  const loaded = day?.ok && day.date === date ? day : null;
  const chosen = loaded ? freeChoice(time, loaded, booking.capacityUnits) : null;

  function move() {
    if (!chosen) return;
    startTransition(async () => {
      const result = await rescheduleBooking(booking.id, date, chosen.slotId, chosen.place);
      if (result.status === "success") onDone(result, date);
      else onError(result);
    });
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
      <p className="text-sm font-medium">¿Para cuándo la cambiamos?</p>
      <Input
        type="date"
        min={today}
        value={date}
        aria-label="Nuevo día"
        onChange={(event) => {
          setDate(event.target.value);
          setTime(null);
        }}
      />
      {day?.ok === false && <p className="text-sm text-destructive">{day.message}</p>}
      {loaded && loaded.blockedReason !== null && (
        <p className="text-sm text-amber-800">Ese día está bloqueado ({loaded.blockedReason}). Puedes moverla igual.</p>
      )}
      {loaded && loaded.blockedReason === null && !loaded.working && (
        <p className="text-sm text-amber-800">Ese día no trabajas. Puedes moverla igual.</p>
      )}
      {loaded ? (
        <TimePicker
          date={date}
          slots={loaded.slots}
          usage={loaded.usage}
          unitsNeeded={booking.capacityUnits}
          value={chosen}
          onChange={setTime}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Viendo qué horas hay…</p>
      )}
      <div className="flex gap-2">
        <Button size="sm" disabled={!chosen || pending} onClick={move}>
          {pending ? "Moviendo…" : "Mover reserva"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
