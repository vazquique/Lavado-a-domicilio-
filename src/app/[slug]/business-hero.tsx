import { BadgeCheck, Clock, House } from "lucide-react";
import Image from "next/image";
import { HeroCar } from "@/components/car-illustrations";
import { readableTextColor, tintColor } from "@/lib/colors";

const BADGES = [
  { icon: House, text: "Vamos a tu domicilio" },
  { icon: Clock, text: "Aparta en un minuto" },
  { icon: BadgeCheck, text: "Precio claro desde el inicio" },
];

// Soap bubbles rising behind the header: left (%), size (px), delay and duration (s).
const BUBBLES = [
  [6, 18, 0, 7],
  [18, 10, 2.5, 6],
  [32, 24, 4, 8],
  [55, 12, 1, 6.5],
  [68, 20, 3, 7.5],
  [82, 14, 5, 6],
  [92, 26, 1.8, 8.5],
] as const;

// Top of the booking page: the business with its color and logo, a clean car and bubbles.
export function BusinessHero({
  business,
}: {
  business: { name: string; brandColor: string; logoUrl: string | null };
}) {
  const color = business.brandColor;
  return (
    <header
      className="relative overflow-hidden rounded-3xl px-5 pt-5 shadow-lg"
      style={{
        background: `linear-gradient(140deg, ${color} 0%, color-mix(in oklab, ${color} 62%, black) 100%)`,
        color: readableTextColor(color),
      }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {BUBBLES.map(([left, size, delay, duration]) => (
          <span
            key={left}
            className="hero-bubble absolute bottom-0 rounded-full border border-white/60 bg-white/15"
            style={{ left: `${left}%`, width: size, height: size, animationDelay: `${delay}s`, animationDuration: `${duration}s` }}
          />
        ))}
      </div>
      <div className="relative flex items-center gap-4">
        {business.logoUrl && (
          <div className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-white shadow-md">
            <Image src={business.logoUrl} alt={`Logo de ${business.name}`} fill unoptimized className="object-contain p-1" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold">{business.name}</h1>
          <p className="mt-1 text-sm opacity-90">Lavado y detallado de autos a domicilio.</p>
        </div>
      </div>
      <ul className="relative mt-4 flex flex-wrap gap-2 text-xs font-medium">
        {BADGES.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 backdrop-blur-sm">
            <Icon className="size-3.5" aria-hidden />
            {text}
          </li>
        ))}
      </ul>
      <HeroCar glass={tintColor(color, 55)} className="relative mx-auto mt-3 -mb-1 w-full max-w-xs" />
    </header>
  );
}
