import {
  Armchair,
  Brush,
  Check,
  CloudRain,
  Disc3,
  Droplets,
  Footprints,
  Gauge,
  Lightbulb,
  Sparkles,
  SprayCan,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties } from "react";
import { CarDiagram } from "@/components/car-diagram";
import {
  AREA_LABELS,
  CAR_PART_LABELS,
  PARTS_BY_AREA,
  SERVICE_AREAS,
  type CarPart,
  type ServiceIcon,
} from "@/lib/car-parts";
import { readableTextColor } from "@/lib/colors";
import { cn } from "@/lib/utils";

const ICONS: Record<ServiceIcon, LucideIcon> = {
  wash: Droplets,
  complete: Sparkles,
  body: SprayCan,
  windows: CloudRain,
  wheels: Disc3,
  lights: Lightbulb,
  trim: Brush,
  seats: Armchair,
  floors: Footprints,
  dashboard: Gauge,
};

// The picture of a service (see serviceIcon()).
export function ServiceGlyph({ icon, className, style }: { icon: ServiceIcon; className?: string; style?: CSSProperties }) {
  const Icon = ICONS[icon];
  return <Icon className={className} style={style} aria-hidden />;
}

// Round badge with the picture of a service.
export function ServiceIconBadge({ icon, className, style }: { icon: ServiceIcon; className?: string; style?: CSSProperties }) {
  return (
    <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", className)} style={style}>
      <ServiceGlyph icon={icon} className="size-5" />
    </span>
  );
}

// The car drawing next to the list of parts, checked where the chosen services work.
export function CarSummary({
  parts,
  color,
  title = "Lo que le haremos a tu auto",
  className,
}: {
  parts: readonly CarPart[];
  color: string;
  title?: string;
  className?: string;
}) {
  const checkStyle = { backgroundColor: color, color: readableTextColor(color) };
  return (
    <section className={cn("flex gap-4 rounded-2xl border bg-card p-4 shadow-sm", className)}>
      <CarDiagram parts={parts} color={color} className="w-24 shrink-0 self-center" />
      <div className="min-w-0 flex-1 space-y-3 text-sm">
        <p className="font-semibold">{title}</p>
        {SERVICE_AREAS.map((area) => (
          <div key={area}>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{AREA_LABELS[area]}</p>
            <ul className="mt-1 space-y-1">
              {PARTS_BY_AREA[area].map((part) => {
                const done = parts.includes(part);
                return (
                  <li key={part} className={cn("flex items-center gap-2", done ? "font-medium" : "text-muted-foreground")}>
                    <span
                      className={cn("flex size-4 shrink-0 items-center justify-center rounded-full", !done && "border")}
                      style={done ? checkStyle : undefined}
                    >
                      {done && <Check className="size-3" strokeWidth={3} aria-hidden />}
                    </span>
                    {CAR_PART_LABELS[part]}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
