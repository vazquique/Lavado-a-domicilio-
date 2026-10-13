"use client";

import { slotsForDate, type PlaceUsage, type SlotRule } from "@/lib/availability";
import { formatClockTime } from "@/lib/time";
import { cn } from "@/lib/utils";

// An exact time: a slot and which of its places (0 = its first time).
export type ChosenTime = { slotId: string; place: number };

// The chosen time if it's still free for a booking of this many places (the services, and
// with them the places needed, can change after picking it).
export function freeChoice(
  value: ChosenTime | null,
  day: { date: string; slots: SlotRule[]; usage: PlaceUsage[] },
  unitsNeeded: number,
): ChosenTime | null {
  if (!value) return null;
  const slot = slotsForDate({ ...day, unitsNeeded, notBefore: null }).find((item) => item.id === value.slotId);
  return slot?.starts.some((start) => start.place === value.place && start.status === "available") ? value : null;
}

// The day's times per slot as buttons: free ones can be picked, taken ones are crossed
// out. The owner can pick any time, even one that already passed (to write down a walk-in).
export function TimePicker({
  date,
  slots,
  usage,
  unitsNeeded,
  value,
  onChange,
}: {
  date: string;
  slots: SlotRule[];
  usage: PlaceUsage[];
  unitsNeeded: number;
  value: ChosenTime | null;
  onChange: (value: ChosenTime) => void;
}) {
  if (slots.length === 0) return <p className="text-sm text-muted-foreground">No tienes horarios activos.</p>;
  return (
    <div className="space-y-3">
      {slotsForDate({ date, slots, usage, unitsNeeded, notBefore: null }).map((slot) => (
        <div key={slot.id} role="group" aria-label={slot.name} className="space-y-2">
          <p className="flex items-baseline justify-between gap-2 text-sm">
            <span>
              <span className="font-medium">{slot.name}</span> · {formatClockTime(slot.startTime)} a{" "}
              {formatClockTime(slot.endTime)}
            </span>
            <span
              className={cn("shrink-0 text-xs", slot.status === "available" ? "text-muted-foreground" : "text-destructive")}
            >
              {slot.status === "too_big"
                ? "No cabe"
                : slot.status === "available"
                  ? `${slot.freeUnits} de ${slot.capacity} libres`
                  : "Lleno"}
            </span>
          </p>
          {slot.starts.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {slot.starts.map((start) => {
                const taken = start.status !== "available";
                const selected = value?.slotId === slot.id && value.place === start.place;
                return (
                  <button
                    key={start.place}
                    type="button"
                    disabled={taken}
                    aria-pressed={selected}
                    aria-label={`${slot.name}, ${formatClockTime(start.time)}${taken ? ", ocupado" : ""}`}
                    onClick={() => onChange({ slotId: slot.id, place: start.place })}
                    className={cn(
                      "h-10 rounded-lg border bg-card text-sm font-semibold tabular-nums transition-colors",
                      selected && "border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-text)]",
                      taken && "border-dashed font-normal text-muted-foreground line-through opacity-60",
                    )}
                  >
                    {formatClockTime(start.time)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
