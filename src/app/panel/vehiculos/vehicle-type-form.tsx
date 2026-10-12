"use client";

import { CheckboxField, Field, FormFooter } from "@/components/panel/form-bits";
import { DeleteButton } from "@/components/panel/delete-button";
import { useFormAction } from "@/components/panel/use-form-action";
import { Input } from "@/components/ui/input";
import { deleteVehicleType, saveVehicleType } from "./actions";

export type VehicleTypeValues = { id: string; name: string; sortOrder: number; active: boolean };

export function VehicleTypeForm({ vehicle }: { vehicle?: VehicleTypeValues }) {
  const { state, pending, formRef, onSubmit } = useFormAction(saveVehicleType, { resetOnSuccess: !vehicle });
  const key = vehicle?.id ?? "new";

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="id" value={vehicle?.id ?? ""} />
      <div className="grid grid-cols-[1fr_5rem] gap-3">
        <Field label="Nombre" htmlFor={`name-${key}`}>
          <Input id={`name-${key}`} name="name" defaultValue={vehicle?.name} required maxLength={60} />
        </Field>
        <Field label="Orden" htmlFor={`order-${key}`}>
          <Input
            id={`order-${key}`}
            name="sortOrder"
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={vehicle?.sortOrder ?? 0}
          />
        </Field>
      </div>
      <CheckboxField id={`active-${key}`} name="active" label="Visible para clientes" defaultChecked={vehicle?.active ?? true} />
      <FormFooter state={state} pending={pending} label={vehicle ? "Guardar" : "Agregar"}>
        {vehicle && (
          <DeleteButton
            action={deleteVehicleType.bind(null, vehicle.id)}
            confirmText={`¿Borrar "${vehicle.name}"? También se borran sus precios.`}
          />
        )}
      </FormFooter>
    </form>
  );
}
