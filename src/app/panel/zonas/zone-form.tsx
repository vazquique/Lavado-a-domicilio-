"use client";

import { DeleteButton } from "@/components/panel/delete-button";
import { CheckboxField, Field, FormFooter } from "@/components/panel/form-bits";
import { useFormAction } from "@/components/panel/use-form-action";
import { Input } from "@/components/ui/input";
import { centsToPesosInput } from "@/lib/panel/parse";
import { deleteZone, saveZone } from "./actions";

export type ZoneValues = { id: string; name: string; surchargeCents: number; active: boolean; sortOrder: number };

export function ZoneForm({ zone }: { zone?: ZoneValues }) {
  const { state, pending, formRef, onSubmit } = useFormAction(saveZone, { resetOnSuccess: !zone });
  const key = zone?.id ?? "new";

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="id" value={zone?.id ?? ""} />
      <Field label="Colonia o zona" htmlFor={`name-${key}`}>
        <Input id={`name-${key}`} name="name" defaultValue={zone?.name} required maxLength={80} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Recargo" htmlFor={`surcharge-${key}`} hint="0 si no cobras extra.">
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              id={`surcharge-${key}`}
              name="surcharge"
              inputMode="decimal"
              defaultValue={zone ? centsToPesosInput(zone.surchargeCents) : "0"}
              className="pl-7"
            />
          </div>
        </Field>
        <Field label="Orden" htmlFor={`order-${key}`}>
          <Input
            id={`order-${key}`}
            name="sortOrder"
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={zone?.sortOrder ?? 0}
          />
        </Field>
      </div>
      <CheckboxField id={`active-${key}`} name="active" label="Visible para clientes" defaultChecked={zone?.active ?? true} />
      <FormFooter state={state} pending={pending} label={zone ? "Guardar" : "Agregar"}>
        {zone && <DeleteButton action={deleteZone.bind(null, zone.id)} confirmText={`¿Borrar "${zone.name}"?`} />}
      </FormFooter>
    </form>
  );
}
