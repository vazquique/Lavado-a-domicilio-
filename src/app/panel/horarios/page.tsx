import { Suspense } from "react";
import { AddNew, NoBusiness, PanelLoading, SectionHeader } from "@/components/panel/section";
import { formatLongDate, todayInMexico } from "@/lib/dates";
import { getPanelSession } from "@/lib/panel/session";
import { BlockedDateItem } from "./blocked-date-item";
import { BlockedDateForm, ScheduleSettingsForm, TimeSlotForm } from "./forms";

export default function SchedulePage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Horarios"
        description="Cada franja se parte en horas exactas, una por lugar: tus clientes eligen una hora libre. Un servicio que ocupa 2 lugares (en Servicios y precios) toma 2 horas seguidas."
      />
      <Suspense fallback={<PanelLoading />}>
        <ScheduleEditor />
      </Suspense>
    </div>
  );
}

async function ScheduleEditor() {
  const { supabase, business } = await getPanelSession();
  if (!business) return <NoBusiness />;

  const today = todayInMexico();
  const [settings, slots, blocked] = await Promise.all([
    supabase
      .from("businesses")
      .select("working_days, booking_lead_minutes, booking_horizon_days")
      .eq("id", business.id)
      .single(),
    supabase
      .from("time_slots")
      .select("id, name, start_time, end_time, capacity, active, sort_order")
      .eq("business_id", business.id)
      .order("sort_order")
      .order("start_time"),
    supabase
      .from("blocked_dates")
      .select("date, reason")
      .eq("business_id", business.id)
      .gte("date", today)
      .order("date"),
  ]);
  if (settings.error) throw settings.error;
  if (slots.error) throw slots.error;
  if (blocked.error) throw blocked.error;

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Franjas y lugares</h2>
        {slots.data.map((slot) => (
          <div key={slot.id} className="rounded-xl border bg-card p-4 shadow-sm">
            <TimeSlotForm
              slot={{
                id: slot.id,
                name: slot.name,
                startTime: slot.start_time,
                endTime: slot.end_time,
                capacity: slot.capacity,
                active: slot.active,
                sortOrder: slot.sort_order,
              }}
            />
          </div>
        ))}
        <AddNew label="Agregar franja">
          <TimeSlotForm />
        </AddNew>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Días y anticipación</h2>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <ScheduleSettingsForm
            workingDays={settings.data.working_days}
            leadMinutes={settings.data.booking_lead_minutes}
            horizonDays={settings.data.booking_horizon_days}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Fechas bloqueadas</h2>
        <p className="text-sm text-muted-foreground">Días en que no trabajas aunque sea día laboral (vacaciones, días festivos).</p>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <BlockedDateForm />
          {blocked.data.length > 0 && (
            <ul className="mt-4 divide-y border-t">
              {blocked.data.map((day) => (
                <BlockedDateItem key={day.date} date={day.date} label={formatLongDate(day.date)} reason={day.reason} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
