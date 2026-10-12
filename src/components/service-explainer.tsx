import {
  ArrowRight,
  Armchair,
  Brush,
  Bubbles,
  CloudRain,
  Disc,
  Disc3,
  Droplet,
  Droplets,
  Eraser,
  Gauge,
  Hand,
  Layers,
  Lightbulb,
  ShieldCheck,
  Sparkles,
  SprayCan,
  Sun,
  Wind,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties } from "react";
import { ServiceGlyph } from "@/components/car-summary";
import type { ServiceIcon } from "@/lib/car-parts";
import { readableTextColor, tintColor as tint } from "@/lib/colors";
import type { Explainer, StepIcon } from "@/lib/service-explainers";

const STEP_ICONS: Record<StepIcon, LucideIcon> = {
  foam: Bubbles,
  hand: Hand,
  vacuum: Wind,
  spray: SprayCan,
  clay: Eraser,
  brush: Brush,
  polish: Disc,
  shield: ShieldCheck,
  sun: Sun,
  drop: Droplet,
  rinse: Droplets,
  rain: CloudRain,
  sparkles: Sparkles,
  dash: Gauge,
  sand: Layers,
  wheel: Disc3,
  light: Lightbulb,
  seat: Armchair,
};

const STAR = "M0 -6 L1.5 -1.5 L6 0 L1.5 1.5 L0 6 L-1.5 1.5 L-6 0 L-1.5 -1.5 Z";

// "Before → after" pictures: the part dirty and dull, then clean and sparkling.
function BeforeAfter({ icon, color, before, after }: { icon: ServiceIcon; color: string; before: string; after: string }) {
  return (
    <div className="flex items-center gap-2" aria-hidden>
      <figure className="flex-1">
        <div className="relative flex h-20 items-center justify-center overflow-hidden rounded-xl bg-[#ebe1d3]">
          <svg viewBox="0 0 100 60" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
            {[
              [14, 12, 7, 4],
              [80, 10, 9, 5],
              [24, 48, 10, 5],
              [70, 46, 6, 4],
              [52, 8, 4, 3],
              [88, 34, 5, 3],
              [8, 32, 4, 3],
            ].map(([cx, cy, rx, ry]) => (
              <ellipse key={`${cx}-${cy}`} cx={cx} cy={cy} rx={rx} ry={ry} fill="#a68b66" opacity={0.45} />
            ))}
            {[
              [34, 20],
              [62, 28],
              [44, 40],
              [86, 52],
              [18, 22],
            ].map(([cx, cy]) => (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.4} fill="#7d6547" opacity={0.6} />
            ))}
          </svg>
          <ServiceGlyph icon={icon} className="relative size-8 text-[#8a7358]" />
        </div>
        <figcaption className="mt-1 text-center text-xs">
          <span className="font-semibold">Antes:</span> {before}
        </figcaption>
      </figure>
      <ArrowRight className="size-5 shrink-0 text-muted-foreground" />
      <figure className="flex-1">
        <div
          className="relative flex h-20 items-center justify-center overflow-hidden rounded-xl"
          style={{ backgroundColor: tint(color, 18) }}
        >
          <svg viewBox="0 0 100 60" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
            <path d="M-10 70 L40 -10 L52 -10 L2 70 Z" fill="#fff" opacity={0.45} />
            <path d="M8 70 L58 -10 L62 -10 L12 70 Z" fill="#fff" opacity={0.35} />
            {[
              [18, 14, 0],
              [82, 16, 0.5],
              [76, 46, 1],
              [24, 44, 1.4],
            ].map(([x, y, delay]) => (
              <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
                <path
                  className="car-sparkle"
                  d={STAR}
                  fill="#fff"
                  stroke={color}
                  strokeWidth={1}
                  style={{ animationDelay: `${delay}s` }}
                />
              </g>
            ))}
          </svg>
          <ServiceGlyph icon={icon} className="relative size-8" style={{ color }} />
        </div>
        <figcaption className="mt-1 text-center text-xs">
          <span className="font-semibold">Después:</span> {after}
        </figcaption>
      </figure>
    </div>
  );
}

// What a service is and how it's done, in plain words and pictures.
export function ServiceExplainer({ explainer, icon, color }: { explainer: Explainer; icon: ServiceIcon; color: string }) {
  const numberStyle = { backgroundColor: color, color: readableTextColor(color) } as CSSProperties;
  return (
    <div className="space-y-4 text-sm">
      <p className="leading-relaxed">{explainer.summary}</p>
      <BeforeAfter icon={icon} color={color} before={explainer.before} after={explainer.after} />
      <div>
        <p className="font-semibold">Así lo hacemos</p>
        <ol className="relative mt-3 space-y-3">
          <span
            aria-hidden
            className="absolute top-5 bottom-5 left-5 w-0.5 -translate-x-1/2"
            style={{ backgroundColor: tint(color, 35) }}
          />
          {explainer.steps.map((step, index) => {
            const Icon = STEP_ICONS[step.icon];
            return (
              <li key={step.text} className="relative flex items-center gap-3">
                <span
                  className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border-2 bg-card"
                  style={{ borderColor: color, color }}
                >
                  <Icon className="size-5" aria-hidden />
                  <span
                    className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full text-[11px] font-bold"
                    style={numberStyle}
                  >
                    {index + 1}
                  </span>
                </span>
                <span>{step.text}</span>
              </li>
            );
          })}
        </ol>
      </div>
      <p className="flex items-center gap-2 rounded-xl p-3 font-medium" style={{ backgroundColor: tint(color) }}>
        <Sparkles className="size-5 shrink-0" style={{ color }} aria-hidden />
        {explainer.result}
      </p>
    </div>
  );
}
