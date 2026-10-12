import { cn } from "@/lib/utils";
import type { VehicleShape } from "@/lib/vehicle-shape";

// Decorative drawings of cars seen from the side. They carry no information.

const STAR = "M0 -7 L1.8 -1.8 L7 0 L1.8 1.8 L0 7 L-1.8 1.8 L-7 0 L-1.8 -1.8 Z";

// A shiny white car surrounded by soap bubbles, for the top of the booking page.
export function HeroCar({ glass, className }: { glass: string; className?: string }) {
  return (
    <svg viewBox="0 0 260 112" aria-hidden className={cn("car-diagram", className)}>
      <defs>
        <linearGradient id="hero-car-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dfe6ee" />
        </linearGradient>
      </defs>
      <ellipse cx={132} cy={100} rx={108} ry={7} fill="#000" opacity={0.18} />
      {/* Body */}
      <path
        d="M20 80 Q20 62 40 58 L78 52 Q96 30 128 28 L158 28 Q186 30 204 50 L228 56 Q244 60 244 74 L244 84 Q244 90 238 90 L28 90 Q20 90 20 82 Z"
        fill="url(#hero-car-body)"
        stroke="#cbd5e1"
        strokeWidth={1.5}
      />
      {/* Windows */}
      <path d="M88 52 Q102 35 124 34 L132 34 L132 52 Z" style={{ fill: glass }} opacity={0.85} />
      <path d="M138 34 L156 34 Q178 36 194 52 L138 52 Z" style={{ fill: glass }} opacity={0.85} />
      <path d="M98 50 L112 36 L118 36 L104 50 Z" fill="#fff" opacity={0.55} />
      <path d="M146 50 L160 36 L164 36 L150 50 Z" fill="#fff" opacity={0.55} />
      {/* Door, mirror and lights */}
      <path d="M135 56 L135 86" stroke="#cbd5e1" strokeWidth={1.5} />
      <path d="M190 52 L200 46 L202 54 Z" fill="#cbd5e1" />
      <path d="M230 62 Q240 63 241 69 L227 69 Z" fill="#fde68a" stroke="#f59e0b" strokeWidth={1} />
      <rect x={21} y={64} width={7} height={8} rx={2} fill="#f87171" />
      {/* Shine along the side */}
      <path d="M44 66 Q130 58 232 66" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" opacity={0.9} />
      {/* Wheels */}
      {[70, 196].map((x) => (
        <g key={x}>
          <circle cx={x} cy={90} r={19} fill="#cbd5e1" />
          <circle cx={x} cy={90} r={16} fill="#1f2937" />
          <circle cx={x} cy={90} r={7} fill="#e5e7eb" />
          <circle cx={x} cy={90} r={2.5} fill="#9ca3af" />
        </g>
      ))}
      {/* Soap bubbles and sparkles */}
      {[
        [30, 44, 7],
        [44, 30, 4.5],
        [18, 26, 3.5],
        [222, 34, 6],
        [238, 20, 4],
        [210, 18, 3],
        [112, 14, 3.5],
      ].map(([cx, cy, r]) => (
        <g key={`${cx}-${cy}`}>
          <circle cx={cx} cy={cy} r={r} fill="#fff" fillOpacity={0.25} stroke="#fff" strokeWidth={1.2} />
          <circle cx={cx - r / 3} cy={cy - r / 3} r={r / 4} fill="#fff" />
        </g>
      ))}
      {[
        [170, 20, 0],
        [62, 50, 0.7],
        [214, 70, 1.2],
      ].map(([x, y, delay]) => (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
          <path className="car-sparkle" d={STAR} fill="#fff" style={{ animationDelay: `${delay}s` }} />
        </g>
      ))}
    </svg>
  );
}

const SHAPES: Record<VehicleShape, { body: string; glass: string; wheels: [number, number]; r: number }> = {
  car: {
    body: "M6 36 Q6 28 14 27 L32 25 Q42 14 58 13 L72 13 Q86 14 96 24 L108 27 Q116 29 116 36 L116 39 Q116 42 113 42 L9 42 Q6 42 6 39 Z",
    glass: "M38 25 Q46 17 58 16 L64 16 L64 25 Z M68 16 L72 16 Q84 17 92 25 L68 25 Z",
    wheels: [30, 94],
    r: 7,
  },
  suv: {
    body: "M6 38 L6 25 Q6 21 10 20 L28 19 L38 9 Q40 7 44 7 L90 7 Q96 7 99 12 L106 21 Q116 23 116 32 L116 40 Q116 43 113 43 L9 43 Q6 43 6 40 Z",
    glass: "M34 19 L42 11 L62 11 L62 19 Z M66 11 L90 11 Q94 11 96 14 L100 19 L66 19 Z",
    wheels: [30, 94],
    r: 8,
  },
  big: {
    body: "M4 40 L4 21 Q4 17 8 17 L22 16 L30 6 Q32 4 36 4 L86 4 Q92 4 95 9 L102 18 L112 20 Q118 21 118 28 L118 41 Q118 44 115 44 L7 44 Q4 44 4 41 Z",
    glass: "M26 16 L33 8 L58 8 L58 16 Z M62 8 L86 8 Q90 8 92 11 L96 16 L62 16 Z",
    wheels: [28, 96],
    r: 9,
  },
};

// A vehicle type's outline, filled with the current text color.
export function VehicleSilhouette({ shape, className }: { shape: VehicleShape; className?: string }) {
  const { body, glass, wheels, r } = SHAPES[shape];
  return (
    <svg viewBox="0 0 122 54" aria-hidden className={className}>
      <path d={body} fill="currentColor" />
      <path d={glass} fill="#fff" opacity={0.55} />
      {wheels.map((x) => (
        <g key={x}>
          <circle cx={x} cy={44} r={r + 2} fill="#fff" />
          <circle cx={x} cy={44} r={r} fill="#1f2937" />
          <circle cx={x} cy={44} r={r / 2.5} fill="#d1d5db" />
        </g>
      ))}
    </svg>
  );
}
