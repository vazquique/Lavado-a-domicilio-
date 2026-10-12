"use client";

import { DeleteButton } from "@/components/panel/delete-button";
import { CheckboxField, Field, FormFooter } from "@/components/panel/form-bits";
import { useFormAction } from "@/components/panel/use-form-action";
import { Input } from "@/components/ui/input";
import { timeToInput } from "@/lib/panel/parse";
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
        <Field label="Anticipación mínima (horas)" htmlFor="leadHours" hint="Ej. 2: no se puede reservar una franja que empieza en menos de 2 horas.">
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

export function TimeSlotForm({ slot }: { slot?: TimeSlotValues }) {
  const { state, pending, formRef, onSubmit } = useFormAction(saveTimeSlot, { resetOnSuccess: !slot });
  const key = slot?.id ?? "new";

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-3">
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
            required
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Desde" htmlFor={`start-${key}`}>
          <Input id={`start-${key}`} name="startTime" type="time" defaultValue={slot ? timeToInput(slot.startTime) : ""} required />
        </Field>
        <Field label="Hasta" htmlFor={`end-${key}`}>
          <Input id={`end-${key}`} name="endTime" type="time" defaultValue={slot ? timeToInput(slot.endTime) : ""} required />
        </Field>
      </div>
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
