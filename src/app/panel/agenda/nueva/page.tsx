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
        {searchParams.then((params) => (
          <NewBooking day={Array.isArray(params.dia) ? params.dia[0] : params.dia} />
        ))}
      </Suspense>
    </div>
  );
}

async function NewBooking({ day }: { day: string | undefined }) {
  const { supabase, business } = await getPanelSession();
  if (!business) return <NoBusiness />;

  const now = new Date();
  const data = await getBookingData(supabase, business.slug, now);
  if (!data) return <NoBusiness />;

  const today = todayInMexico(now);
  const date = day && /^\d{4}-\d{2}-\d{2}$/.test(day) && day >= today ? day : today;
  const brand = data.business.brandColor;
  return (
    <div style={{ "--brand": brand, "--brand-text": readableTextColor(brand) } as CSSProperties}>
      <NewBookingForm catalog={data.catalog} initialDate={date} today={today} />
    </div>
  );
}
