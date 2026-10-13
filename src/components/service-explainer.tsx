import {
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
import { BeforeAfter } from "@/components/before-after";
import { readableTextColor, tintColor as tint } from "@/lib/colors";
import { EXPLAINERS, type ExplainerId, type StepIcon } from "@/lib/service-explainers";

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

// What a service is and how it's done, in plain words and pictures.
export function ServiceExplainer({ explainerId, color }: { explainerId: ExplainerId; color: string }) {
  const explainer = EXPLAINERS[explainerId];
  const numberStyle = { backgroundColor: color, color: readableTextColor(color) } as CSSProperties;
  return (
    <div className="space-y-4 text-sm">
      <p className="leading-relaxed">{explainer.summary}</p>
      <BeforeAfter explainerId={explainerId} color={color} before={explainer.before} after={explainer.after} />
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
