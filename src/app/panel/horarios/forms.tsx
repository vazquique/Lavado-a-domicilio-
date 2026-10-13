"use client";

import { useState } from "react";
import { DeleteButton } from "@/components/panel/delete-button";
import { CheckboxField, Field, FormFooter } from "@/components/panel/form-bits";
import { useFormAction } from "@/components/panel/use-form-action";
import { Input } from "@/components/ui/input";
import { slotTimes } from "@/lib/availability";
import { timeToInput } from "@/lib/panel/parse";
import { formatClockTime } from "@/lib/time";
import {
  addBlockedDate,
  deleteTimeSlot,
  saveScheduleSettings,
  saveTimeSlot,
} from "./actions";

const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export function ScheduleSettingsForm({
  workingDays,
  leadMinutes,
  horizonDays,
}: {
  workingDays: number[];
  leadMinutes: number;
  horizonDays: number;
}) {
  const { state, pending, formRef, onSubmit } = useFormAction(saveScheduleSettings);

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Días de trabajo</legend>
        <div className="grid grid-cols-2 gap-x-3">
          {WEEKDAYS.map((day, index) => (
            <CheckboxField
              key={day}
              id={`day-${index + 1}`}
              name="workingDays"
              value={String(index + 1)}
              label={day}
              defaultChecked={workingDays.includes(index + 1)}
            />
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Anticipación mínima (horas)" htmlFor="leadHours" hint="Ej. 2: nadie puede reservar una hora que es en menos de 2 horas.">
          <Input
            id="leadHours"
            name="leadHours"
            type="number"
            inputMode="decimal"
            min={0}
            max={168}
            step="0.5"
            defaultValue={leadMinutes / 60}
          />
        </Field>
        <Field label="Días hacia adelante" htmlFor="horizonDays" hint="Hasta cuántos días adelante se puede reservar.">
          <Input
            id="horizonDays"
            name="horizonDays"
            type="number"
            inputMode="numeric"
            min={1}
            max={365}
            defaultValue={horizonDays}
          />
        </Field>
      </div>
      <FormFooter state={state} pending={pending} />
    </form>
  );
}

export type TimeSlotValues = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  capacity: number;
  active: boolean;
  sortOrder: number;
};

// The exact times customers will see for what's typed: "9:00, 10:20 y 11:40".
function timesPreview({ start, end, capacity }: { start: string; end: string; capacity: string }): string | null {
  const places = Number(capacity);
  const valid = /^\d{2}:\d{2}$/;
  if (!valid.test(start) || !valid.test(end) || end <= start || !Number.isInteger(places) || places < 1 || places > 100) {
    return null;
  }
  const times = slotTimes({ startTime: start, endTime: end, capacity: places }).map(formatClockTime);
  return times.length === 1 ? times[0] : `${times.slice(0, -1).join(", ")} y ${times.at(-1)}`;
}

export function TimeSlotForm({ slot }: { slot?: TimeSlotValues }) {
  const { state, pending, formRef, onSubmit } = useFormAction(saveTimeSlot, { resetOnSuccess: !slot });
  const key = slot?.id ?? "new";
  const initial = {
    start: slot ? timeToInput(slot.startTime) : "",
    end: slot ? timeToInput(slot.endTime) : "",
    capacity: String(slot?.capacity ?? 3),
  };
  const [typed, setTyped] = useState(initial);
  const times = timesPreview(typed);

  return (
    <form ref={formRef} onSubmit={onSubmit} onReset={() => setTyped(initial)} className="space-y-3">
      <input type="hidden" name="id" value={slot?.id ?? ""} />
      <input type="hidden" name="sortOrder" value={slot?.sortOrder ?? 0} />
      <div className="grid grid-cols-[1fr_5rem] gap-3">
        <Field label="Nombre" htmlFor={`name-${key}`}>
          <Input id={`name-${key}`} name="name" defaultValue={slot?.name} placeholder="Mañana" required maxLength={40} />
        </Field>
        <Field label="Lugares" htmlFor={`capacity-${key}`}>
          <Input
            id={`capacity-${key}`}
            name="capacity"
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            defaultValue={slot?.capacity ?? 3}
            onChange={(event) => setTyped({ ...typed, capacity: event.target.value })}
            required
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Desde" htmlFor={`start-${key}`}>
          <Input
            id={`start-${key}`}
            name="startTime"
            type="time"
            defaultValue={initial.start}
            onChange={(event) => setTyped({ ...typed, start: event.target.value })}
            required
          />
        </Field>
        <Field label="Hasta" htmlFor={`end-${key}`}>
          <Input
            id={`end-${key}`}
            name="endTime"
            type="time"
            defaultValue={initial.end}
            onChange={(event) => setTyped({ ...typed, end: event.target.value })}
            required
          />
        </Field>
      </div>
      {times && (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">
          Horas que eligen tus clientes: <span className="font-medium">{times}</span>
        </p>
      )}
      <CheckboxField id={`active-${key}`} name="active" label="Disponible para reservar" defaultChecked={slot?.active ?? true} />
      <FormFooter state={state} pending={pending} label={slot ? "Guardar" : "Agregar"}>
        {slot && <DeleteButton action={deleteTimeSlot.bind(null, slot.id)} confirmText={`¿Borrar la franja "${slot.name}"?`} />}
      </FormFooter>
    </form>
  );
}

export function BlockedDateForm() {
  const { state, pending, formRef, onSubmit } = useFormAction(addBlockedDate, { resetOnSuccess: true });

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Día" htmlFor="blocked-date">
          <Input id="blocked-date" name="date" type="date" required />
        </Field>
        <Field label="Motivo (opcional)" htmlFor="blocked-reason">
          <Input id="blocked-reason" name="reason" maxLength={100} placeholder="Ej. vacaciones" />
        </Field>
      </div>
      <FormFooter state={state} pending={pending} label="Bloquear día" />
    </form>
  );
}
