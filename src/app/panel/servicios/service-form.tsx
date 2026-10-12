"use client";

import { DeleteButton } from "@/components/panel/delete-button";
import { CheckboxField, Field, FormFooter, selectClassName } from "@/components/panel/form-bits";
import { useFormAction } from "@/components/panel/use-form-action";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { centsToPesosInput } from "@/lib/panel/parse";
import { deleteService, saveService } from "./actions";

export type ServiceValues = {
  id: string;
  name: string;
  description: string;
  kind: "base" | "extra";
  capacityUnits: number;
  active: boolean;
  sortOrder: number;
  prices: Record<string, number>;
};

export function ServiceForm({
  service,
  vehicleTypes,
}: {
  service?: ServiceValues;
  vehicleTypes: { id: string; name: string }[];
}) {
  const { state, pending, formRef, onSubmit } = useFormAction(saveService, { resetOnSuccess: !service });
  const key = service?.id ?? "new";

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="id" value={service?.id ?? ""} />
      <Field label="Nombre" htmlFor={`name-${key}`}>
        <Input id={`name-${key}`} name="name" defaultValue={service?.name} required maxLength={80} />
      </Field>
      <Field label="Descripción (opcional)" htmlFor={`description-${key}`}>
        <Textarea
          id={`description-${key}`}
          name="description"
          defaultValue={service?.description}
          maxLength={300}
          rows={2}
        />
      </Field>
      <div className="grid grid-cols-[1fr_5rem] gap-3">
        <Field
          label="Tipo"
          htmlFor={`kind-${key}`}
          hint="Principal: el cliente elige uno. Extra: se suma al principal."
        >
          <select id={`kind-${key}`} name="kind" defaultValue={service?.kind ?? "extra"} className={selectClassName}>
            <option value="base">Principal</option>
            <option value="extra">Extra</option>
          </select>
        </Field>
        <Field label="Orden" htmlFor={`order-${key}`}>
          <Input
            id={`order-${key}`}
            name="sortOrder"
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={service?.sortOrder ?? 0}
          />
        </Field>
      </div>

      <Field
        label="Lugares que ocupa"
        htmlFor={`units-${key}`}
        hint="Cada franja tiene lugares (ve Horarios). Lavado normal: 1. Un servicio que tarda toda la franja: el cupo completo. Extras rápidos: 0."
      >
        <Input
          id={`units-${key}`}
          name="capacityUnits"
          type="number"
          inputMode="numeric"
          min={0}
          max={20}
          defaultValue={service?.capacityUnits ?? 0}
          className="w-24"
        />
      </Field>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Precio por vehículo</legend>
        <p className="text-xs text-muted-foreground">Déjalo vacío si no ofreces este servicio para ese vehículo.</p>
        {vehicleTypes.map((vehicle) => (
          <div key={vehicle.id} className="grid grid-cols-[1fr_7.5rem] items-center gap-3">
            <label htmlFor={`price-${key}-${vehicle.id}`} className="text-sm">
              {vehicle.name}
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id={`price-${key}-${vehicle.id}`}
                name={`price_${vehicle.id}`}
                inputMode="decimal"
                placeholder="—"
                defaultValue={
                  service?.prices[vehicle.id] !== undefined ? centsToPesosInput(service.prices[vehicle.id]) : ""
                }
                className="pl-7 text-right"
              />
            </div>
          </div>
        ))}
      </fieldset>

      <CheckboxField id={`active-${key}`} name="active" label="Visible para clientes" defaultChecked={service?.active ?? true} />
      <FormFooter state={state} pending={pending} label={service ? "Guardar" : "Agregar"}>
        {service && (
          <DeleteButton
            action={deleteService.bind(null, service.id)}
            confirmText={`¿Borrar "${service.name}"? Las reservas que ya existen no cambian.`}
          />
        )}
      </FormFooter>
    </form>
  );
}
