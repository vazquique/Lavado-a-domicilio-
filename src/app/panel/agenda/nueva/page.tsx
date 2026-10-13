import { Suspense, type CSSProperties } from "react";
import { NoBusiness, PanelLoading, SectionHeader } from "@/components/panel/section";
import { getBookingData } from "@/lib/booking-data";
import { readableTextColor } from "@/lib/colors";
import { todayInMexico } from "@/lib/dates";
import { getPanelSession } from "@/lib/panel/session";
import { NewBookingForm } from "./new-booking-form";

export default function NewBookingPage({ searchParams }: PageProps<"/panel/agenda/nueva">) {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Agregar reserva"
        description="Para los clientes que te escriben por WhatsApp o te llaman. Ocupa su lugar en el horario y se paga el día del servicio."
        back={{ href: "/panel/agenda", label: "Agenda" }}
      />
      <Suspense fallback={<PanelLoading />}>
        {searchParams.then((params) => {
          const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
          return <NewBooking day={first(params.dia)} slotId={first(params.horario)} place={first(params.lugar)} />;
        })}
      </Suspense>
    </div>
  );
}

// `horario` and `lugar` come from tapping a free time in the agenda.
async function NewBooking({
  day,
  slotId,
  place,
}: {
  day: string | undefined;
  slotId: string | undefined;
  place: string | undefined;
}) {
  const { supabase, business } = await getPanelSession();
  if (!business) return <NoBusiness />;

  const now = new Date();
  const data = await getBookingData(supabase, business.slug, now);
  if (!data) return <NoBusiness />;

  const today = todayInMexico(now);
  const date = day && /^\d{4}-\d{2}-\d{2}$/.test(day) && day >= today ? day : today;
  const slot = data.slots.find((item) => item.id === slotId);
  const initialTime =
    slot && place && /^\d{1,2}$/.test(place) && Number(place) < slot.capacity
      ? { slotId: slot.id, place: Number(place) }
      : null;
  const brand = data.business.brandColor;
  return (
    <div style={{ "--brand": brand, "--brand-text": readableTextColor(brand) } as CSSProperties}>
      <NewBookingForm catalog={data.catalog} initialDate={date} initialTime={initialTime} today={today} />
    </div>
  );
}
