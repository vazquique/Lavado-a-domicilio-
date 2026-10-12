import type { CSSProperties } from "react";
import { CAR_PART_LABELS, type CarPart } from "@/lib/car-parts";
import { cn } from "@/lib/utils";

// A car seen from above, roof off, front at the top. The parts being worked on light up
// in the business color, with a little sparkle.

const OFF = {
  body: "#eef1f5",
  line: "#b6bfcb",
  tire: "#2f3542",
  glass: "#d6e2ee",
  light: "#f8fafc",
  trim: "#c3cad4",
  floor: "#f6f7f9",
  dash: "#d4d9e0",
  seat: "#dde2e8",
} as const;

// Where each part's sparkle shines, in the drawing's coordinates.
const SPARKLES: Record<CarPart, [number, number]> = {
  body: [100, 84],
  windows: [132, 140],
  wheels: [24, 100],
  lights: [53, 30],
  trim: [100, 17],
  seats: [78, 204],
  floors: [100, 300],
  dashboard: [128, 171],
};

const STAR = "M0 -10 L2.4 -2.4 L10 0 L2.4 2.4 L0 10 L-2.4 2.4 L-10 0 L-2.4 -2.4 Z";

export function CarDiagram({
  parts,
  color,
  className,
}: {
  parts: readonly CarPart[];
  color: string;
  className?: string;
}) {
  const on = new Set(parts);
  const fill = (part: CarPart, off: string) => (on.has(part) ? "var(--car-on)" : off);
  const label =
    parts.length > 0
      ? `Se trabaja en: ${parts.map((part) => CAR_PART_LABELS[part].toLowerCase()).join(", ")}`
      : "Elige un servicio para ver qué se le hace a tu auto";

  return (
    <svg
      viewBox="0 0 200 420"
      role="img"
      aria-label={label}
      className={cn("car-diagram", className)}
      style={{ "--car-on": color, filter: "drop-shadow(0 6px 8px rgb(0 0 0 / 0.14))" } as CSSProperties}
    >
      {/* Wheels, under the body */}
      {[
        [14, 76],
        [168, 76],
        [14, 290],
        [168, 290],
      ].map(([x, y]) => (
        <rect key={`${x}-${y}`} className="car-part" x={x} y={y} width={18} height={54} rx={7} fill={fill("wheels", OFF.tire)} />
      ))}

      {/* Body */}
      <rect
        className="car-part"
        x={28}
        y={16}
        width={144}
        height={388}
        rx={46}
        fill={fill("body", OFF.body)}
        fillOpacity={on.has("body") ? 0.32 : 1}
        stroke={on.has("body") ? "var(--car-on)" : OFF.line}
        strokeWidth={3}
      />
      {/* Hood and trunk lines */}
      <path d="M58 60 Q100 50 142 60 M58 372 Q100 382 142 372" fill="none" stroke={OFF.line} strokeWidth={1.5} />

      {/* Exterior plastics: bumpers and mirrors */}
      <path
        className="car-part"
        d="M46 22 Q100 6 154 22 M46 398 Q100 414 154 398"
        fill="none"
        stroke={fill("trim", OFF.trim)}
        strokeWidth={8}
        strokeLinecap="round"
      />
      <rect className="car-part" x={12} y={146} width={18} height={12} rx={5} fill={fill("trim", OFF.trim)} />
      <rect className="car-part" x={170} y={146} width={18} height={12} rx={5} fill={fill("trim", OFF.trim)} />

      {/* Lights: headlights at the front, taillights at the back */}
      {[
        [40, 26, 28, 11],
        [132, 26, 28, 11],
        [42, 384, 24, 9],
        [134, 384, 24, 9],
      ].map(([x, y, width, height]) => (
        <rect
          key={`${x}-${y}`}
          className="car-part"
          x={x}
          y={y}
          width={width}
          height={height}
          rx={height / 2}
          fill={fill("lights", OFF.light)}
          stroke={on.has("lights") ? "var(--car-on)" : OFF.line}
          strokeWidth={1.5}
        />
      ))}

      {/* Glass: windshield, rear window and side windows */}
      <g className="car-part" fill={fill("windows", OFF.glass)} fillOpacity={on.has("windows") ? 0.75 : 1}>
        <path d="M50 128 L150 128 L140 158 L60 158 Z" />
        <path d="M60 322 L140 322 L150 346 L50 346 Z" />
        <rect x={38} y={166} width={8} height={146} rx={4} />
        <rect x={154} y={166} width={8} height={146} rx={4} />
      </g>

      {/* Inside: floor and carpets, dashboard, seats */}
      <rect
        className="car-part"
        x={52}
        y={162}
        width={96}
        height={154}
        rx={14}
        fill={fill("floors", OFF.floor)}
        fillOpacity={on.has("floors") ? 0.3 : 1}
        stroke={on.has("floors") ? "var(--car-on)" : OFF.dash}
        strokeWidth={2}
      />
      <rect className="car-part" x={56} y={165} width={88} height={14} rx={7} fill={fill("dashboard", OFF.dash)} />
      <circle cx={78} cy={172} r={4} fill={on.has("dashboard") ? "#fff" : OFF.line} />
      {[
        [62, 190, 32, 42],
        [106, 190, 32, 42],
        [62, 256, 76, 44],
      ].map(([x, y, width, height]) => (
        <rect
          key={`${x}-${y}`}
          className="car-part"
          x={x}
          y={y}
          width={width}
          height={height}
          rx={9}
          fill={fill("seats", OFF.seat)}
          stroke={on.has("seats") ? "#fff" : OFF.trim}
          strokeWidth={1.5}
        />
      ))}

      {/* Sparkles over what's being worked on */}
      {parts.map((part, index) => {
        const [x, y] = SPARKLES[part];
        return (
          <g key={part} transform={`translate(${x} ${y})`}>
            <path
              className="car-sparkle"
              d={STAR}
              fill="#fff"
              stroke="var(--car-on)"
              strokeWidth={1.5}
              style={{ animationDelay: `${(index * 0.27) % 1.8}s` }}
            />
          </g>
        );
      })}
    </svg>
  );
}
