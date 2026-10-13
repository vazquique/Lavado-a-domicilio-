"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionState } from "@/lib/panel/action-state";
import type { AgendaBooking } from "@/lib/panel/agenda-data";
import { getDaySlots, rescheduleBooking, type DaySlots } from "./actions";
import { SlotPicker } from "./slot-picker";

// Pick another day and time slot for a booking; shows how many places each slot has free.
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
  const [slotId, setSlotId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let current = true;
    getDaySlots(date).then((result) => {
      if (current) setDay(result);
    });
    return () => {
      current = false;
    };
  }, [date]);

  // The booking's own places count as free in its own slot.
  const slots =
    day?.ok && day.date === date
      ? day.slots.map((slot) =>
          date === booking.serviceDate && slot.id === booking.timeSlotId
            ? { ...slot, freeUnits: slot.freeUnits + booking.capacityUnits }
            : slot,
        )
      : null;

  function move() {
    if (!slotId) return;
    startTransition(async () => {
      const result = await rescheduleBooking(booking.id, date, slotId);
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
          setSlotId(null);
        }}
      />
      {day?.ok === false && <p className="text-sm text-destructive">{day.message}</p>}
      {day?.ok && day.date === date && day.blockedReason !== null && (
        <p className="text-sm text-amber-800">Ese día está bloqueado ({day.blockedReason}). Puedes moverla igual.</p>
      )}
      {day?.ok && day.date === date && day.blockedReason === null && !day.working && (
        <p className="text-sm text-amber-800">Ese día no trabajas. Puedes moverla igual.</p>
      )}
      {slots ? (
        <SlotPicker
          name={`reschedule-${booking.id}`}
          slots={slots}
          unitsNeeded={booking.capacityUnits}
          value={slotId}
          onChange={setSlotId}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Viendo qué horarios hay…</p>
      )}
      <div className="flex gap-2">
        <Button size="sm" disabled={!slotId || pending} onClick={move}>
          {pending ? "Moviendo…" : "Mover reserva"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
