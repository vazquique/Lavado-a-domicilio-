import { Suspense, type CSSProperties } from "react";
import { NoBusiness, PanelLoading, SectionHeader } from "@/components/panel/section";
import { isMonth, monthOf } from "@/lib/agenda";
import { readableTextColor } from "@/lib/colors";
import { todayInMexico } from "@/lib/dates";
import { getAgendaMonth } from "@/lib/panel/agenda-data";
import { getPanelSession } from "@/lib/panel/session";
import { AgendaView } from "./agenda-view";

export default function AgendaPage({ searchParams }: PageProps<"/panel/agenda">) {
  return (
    <div className="space-y-6">
      <SectionHeader title="Agenda" description="Tus reservas por día. Toca un día para ver quién sigue." />
      <Suspense fallback={<PanelLoading />}>
        {searchParams.then((params) => (
          <Agenda month={params.mes} day={params.dia} added={params.nueva} />
        ))}
      </Suspense>
    </div>
  );
}

type Param = string | string[] | undefined;
const first = (value: Param) => (Array.isArray(value) ? value[0] : value);
const isDay = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

async function Agenda({ month: monthParam, day: dayParam, added }: { month: Param; day: Param; added: Param }) {
  const { supabase, business } = await getPanelSession();
  if (!business) return <NoBusiness />;

  const now = new Date();
  const today = todayInMexico(now);
  const askedDay = first(dayParam);
  const askedMonth = first(monthParam);
  const month = isMonth(askedMonth) ? askedMonth : isDay(askedDay) ? monthOf(askedDay) : monthOf(today);

  const [data, settings] = await Promise.all([
    getAgendaMonth(supabase, business, month),
    supabase.from("businesses").select("brand_color").eq("id", business.id).single(),
  ]);
  if (settings.error) throw settings.error;

  // The chosen day, if this month's calendar shows it; otherwise today or the 1st.
  const shown = data.weeks.flat();
  const day = isDay(askedDay) && shown.includes(askedDay) ? askedDay : monthOf(today) === month ? today : `${month}-01`;
  const brand: string = settings.data.brand_color;
  const folio = first(added);

  return (
    <AgendaView
      key={month}
      data={data}
      today={today}
      initialDay={day}
      now={now.toISOString()}
      added={folio && /^[A-Z]{2,5}-\d+$/.test(folio) ? folio : null}
      style={{ "--brand": brand, "--brand-text": readableTextColor(brand) } as CSSProperties}
    />
  );
}
