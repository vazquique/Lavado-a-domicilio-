"use client";

import { formatClockTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { DaySlot } from "./actions";

// Time slots of a day as radio buttons, with the places still free in each.
export function SlotPicker({
  name,
  slots,
  unitsNeeded,
  value,
  onChange,
}: {
  name: string;
  slots: DaySlot[];
  unitsNeeded: number;
  value: string | null;
  onChange: (slotId: string) => void;
}) {
  if (slots.length === 0) return <p className="text-sm text-muted-foreground">No tienes horarios activos.</p>;
  return (
    <div className="grid gap-2">
      {slots.map((slot) => {
        const fits = slot.freeUnits >= unitsNeeded;
        return (
          <label
            key={slot.id}
            className={cn(
              "flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border bg-card px-3 text-sm",
              value === slot.id && "border-[var(--brand)] ring-2 ring-[var(--brand)]/30",
              !fits && "cursor-not-allowed opacity-50",
            )}
          >
            <span className="flex items-center gap-2">
              <input
                type="radio"
                name={name}
                value={slot.id}
                checked={value === slot.id}
                disabled={!fits}
                onChange={() => onChange(slot.id)}
                className="size-4 accent-[var(--brand)]"
              />
              <span>
                <span className="font-medium">{slot.name}</span> · {formatClockTime(slot.startTime)} a{" "}
                {formatClockTime(slot.endTime)}
              </span>
            </span>
            <span className={cn("shrink-0 text-xs", fits ? "text-muted-foreground" : "text-destructive")}>
              {fits ? `${slot.freeUnits} de ${slot.capacity} libres` : "Lleno"}
            </span>
          </label>
        );
      })}
    </div>
  );
}
