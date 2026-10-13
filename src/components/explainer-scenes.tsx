import {
  Brush,
  BrushCleaning,
  Bubbles,
  Droplets,
  Eraser,
  Hand,
  ShieldCheck,
  Sparkles,
  SprayCan,
  WandSparkles,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { memo, useId, type ReactNode } from "react";
import type { ExplainerId } from "@/lib/service-explainers";

// A picture for each explanation (src/lib/service-explainers.ts). Every service has its own
// scene, and each scene is drawn twice: dirty ("before") and clean ("after"). The slider in
// before-after.tsx stacks both so the customer can wipe from one to the other with the tool
// shown on the handle. The pictures are decorative: the captions say the same in words.

type Ids = { id: (name: string) => string; url: (name: string) => string };
export type Scene = { tool: LucideIcon; draw: (clean: boolean, ids: Ids) => ReactNode };

export const SceneArt = memo(function SceneArt({
  scene,
  clean,
  className,
}: {
  scene: Scene;
  clean: boolean;
  className?: string;
}) {
  // Gradients and clip paths need ids that are unique on the page.
  const uid = useId();
  const ids: Ids = { id: (name) => `${uid}${name}`, url: (name) => `url(#${uid}${name})` };
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      {scene.draw(clean, ids)}
    </svg>
  );
});

// ---------------------------------------------------------------------------------------------
// Helpers. Random-looking details (dust, crumbs, cracks) come from a fixed seed, so the server
// and the browser draw exactly the same thing.

function random(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (value: number) => Math.round(value * 10) / 10;

type Dot = { x: number; y: number; r: number };

// Dots spread over a box [x, y, width, height] with radius between min and max.
function scatter(seed: number, count: number, [x, y, width, height]: number[], [min, max]: number[]): Dot[] {
  const next = random(seed);
  return Array.from({ length: count }, () => ({
    x: round(x + next() * width),
    y: round(y + next() * height),
    r: round(min + next() * (max - min)),
  }));
}

// Short zigzag lines: cracks in dry leather, crazing on an old headlight.
function cracks(seed: number, count: number, [x, y, width, height]: number[], size: number): string[] {
  const next = random(seed);
  return Array.from({ length: count }, () => {
    let px = x + next() * width;
    let py = y + next() * height;
    let angle = next() * Math.PI * 2;
    let d = `M${round(px)} ${round(py)}`;
    const segments = 2 + Math.floor(next() * 4);
    for (let i = 0; i < segments; i++) {
      angle += (next() - 0.5) * 1.6;
      const length = size * (0.5 + next());
      px += Math.cos(angle) * length;
      py += Math.sin(angle) * length;
      d += ` L${round(px)} ${round(py)}`;
    }
    return d;
  });
}

// An arc of a circle, angles in degrees (0 = right, 90 = down).
function arc(cx: number, cy: number, r: number, from: number, to: number) {
  const point = (angle: number) =>
    `${round(cx + r * Math.cos((angle * Math.PI) / 180))} ${round(cy + r * Math.sin((angle * Math.PI) / 180))}`;
  return `M${point(from)} A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${point(to)}`;
}

const STAR = "M0 -6 L1.5 -1.5 L6 0 L1.5 1.5 L0 6 L-1.5 1.5 L-6 0 L-1.5 -1.5 Z";

// Twinkling stars: [x, y, delay in seconds, size].
function Twinkles({ points, color = "#fff" }: { points: number[][]; color?: string }) {
  return points.map(([x, y, delay = 0, size = 1]) => (
    <g key={`${x}-${y}`} transform={`translate(${x} ${y}) scale(${size})`}>
      <path className="car-sparkle" d={STAR} fill={color} style={{ animationDelay: `${delay}s` }} />
    </g>
  ));
}

// Soap bubbles floating up: [x, y, radius, delay].
function SoapBubbles({ points }: { points: number[][] }) {
  return points.map(([x, y, r, delay = 0]) => (
    <g key={`${x}-${y}`} className="ba-float" style={{ animationDelay: `${delay}s` }}>
      <circle cx={x} cy={y} r={r} fill="#fff" fillOpacity={0.2} stroke="#fff" strokeWidth={1.2} />
      <circle cx={x - r / 3} cy={y - r / 3} r={r / 4} fill="#fff" />
    </g>
  ));
}

function Cloud({ x, y, scale = 1, color = "#fff", opacity = 0.92 }: { x: number; y: number; scale?: number; color?: string; opacity?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} fill={color} opacity={opacity}>
      <circle cx={0} cy={4} r={9} />
      <circle cx={12} cy={-2} r={12} />
      <circle cx={26} cy={4} r={9} />
      <rect x={-9} y={4} width={44} height={9} rx={4.5} />
    </g>
  );
}

// A splash of mud: a blob with drops around it.
function Splat({ x, y, r, color, seed, opacity = 0.85 }: { x: number; y: number; r: number; color: string; seed: number; opacity?: number }) {
  const next = random(seed);
  const drops = Array.from({ length: 6 }, () => {
    const angle = next() * Math.PI * 2;
    const distance = r * (1.2 + next() * 0.9);
    return {
      cx: round(x + Math.cos(angle) * distance),
      cy: round(y + Math.sin(angle) * distance * 0.8),
      r: round(r * (0.14 + next() * 0.22)),
    };
  });
  return (
    <g fill={color} opacity={opacity}>
      <ellipse cx={x} cy={y} rx={r} ry={round(r * 0.78)} />
      {drops.map((drop, index) => (
        <circle key={index} {...drop} />
      ))}
    </g>
  );
}

// A bug squashed on the glass or the bumper: a yellow-green smear with a few drops.
function BugSplat({ x, y, r = 3.4, seed }: { x: number; y: number; r?: number; seed: number }) {
  const next = random(seed);
  const tilt = round(-35 + next() * 70);
  const drops = Array.from({ length: 4 }, () => {
    const angle = -Math.PI / 2 + ((tilt * Math.PI) / 180) + (next() - 0.5) * 1.4;
    const distance = r * (2.4 + next() * 1.4);
    return {
      cx: round(x + Math.cos(angle) * distance),
      cy: round(y + Math.sin(angle) * distance),
      r: round(r * (0.16 + next() * 0.18)),
    };
  });
  return (
    <g>
      <path
        d={`M${x - r} ${y} Q${x - r} ${round(y - r * 1.2)} ${x} ${round(y - r * 2.6)} Q${x + r} ${round(y - r * 1.2)} ${x + r} ${y} Q${x + r} ${round(y + r)} ${x} ${round(y + r)} Q${x - r} ${round(y + r)} ${x - r} ${y} Z`}
        transform={`rotate(${tilt} ${x} ${y})`}
        fill="#d4da86"
        fillOpacity={0.9}
        stroke="#8c9238"
        strokeOpacity={0.55}
        strokeWidth={0.6}
      />
      {drops.map((drop, index) => (
        <circle key={index} {...drop} fill="#d4da86" opacity={0.85} />
      ))}
      <circle cx={x} cy={y} r={round(r * 0.4)} fill="#3a3a16" />
      <path d={`M${x} ${y} l${round(r * 1.2)} ${round(r * 0.9)} M${x} ${y} l${round(-r * 1.1)} ${round(r * 1)}`} stroke="#3a3a16" strokeWidth={0.6} />
    </g>
  );
}

// A water drop sitting on a waxed surface: round, with a bright spot and a soft shadow.
function Bead({ x, y, r, fill, className, delay = 0 }: Dot & { fill: string; className?: string; delay?: number }) {
  return (
    <g className={className} style={className ? { animationDelay: `${delay}s` } : undefined}>
      <ellipse cx={round(x + r * 0.15)} cy={round(y + r * 0.35)} rx={r} ry={round(r * 0.85)} fill="#000" opacity={0.22} />
      <circle cx={x} cy={y} r={r} fill={fill} stroke="#dbeafe" strokeOpacity={0.45} strokeWidth={0.6} />
      <circle cx={round(x - r * 0.35)} cy={round(y - r * 0.38)} r={round(r * 0.28)} fill="#fff" opacity={0.92} />
      <path
        d={arc(x, y, round(r * 0.68), 15, 70)}
        stroke="#fff"
        strokeOpacity={0.4}
        strokeWidth={round(Math.max(r * 0.16, 0.5))}
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
}

// ---------------------------------------------------------------------------------------------
// Lavado: a red car outdoors, covered in dust and mud with "LÁVAME" written with a finger.

const SEDAN_BODY =
  "M20 80 Q20 62 40 58 L78 52 Q96 30 128 28 L158 28 Q186 30 204 50 L228 56 Q244 60 244 74 L244 84 Q244 90 238 90 L28 90 Q20 90 20 82 Z";
const LAVAME =
  "M0 0 L0 12 L7 12 M10 12 L14.5 0 L19 12 M11.5 8 L17.5 8 M15.5 -3 L18 -6 M21 0 L25.5 12 L30 0 M32 12 L36.5 0 L41 12 M33.5 8 L39.5 8 M44 12 L44 0 L48.5 7 L53 0 L53 12 M63 0 L56 0 L56 12 L63 12 M56 6 L61 6";
const WASH_DUST = scatter(11, 24, [0, 0, 320, 140], [0.8, 2.4]);
const WASH_SPECKS = scatter(12, 46, [24, 32, 216, 56], [0.4, 1.1]);

function carWash(clean: boolean, { id, url }: Ids) {
  const mud = "#6f5331";
  return (
    <>
      <defs>
        <linearGradient id={id("sky")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={clean ? "#62b6f4" : "#e6d5b3"} />
          <stop offset="1" stopColor={clean ? "#e3f3fe" : "#cdb187"} />
        </linearGradient>
        <linearGradient id={id("paint")} x1="0" y1="28" x2="0" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fb7185" />
          <stop offset="0.45" stopColor="#e11d48" />
          <stop offset="1" stopColor="#9f1239" />
        </linearGradient>
        <linearGradient id={id("glass")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d5efff" />
          <stop offset="1" stopColor="#2f6aa3" />
        </linearGradient>
        <radialGradient id={id("rim")}>
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#94a3b8" />
        </radialGradient>
      </defs>
      <rect width={320} height={180} fill={url("sky")} />
      {clean ? (
        <>
          <circle cx={282} cy={30} r={22} fill="#fde047" opacity={0.25} />
          <circle cx={282} cy={30} r={14} fill="#fde047" />
          <Cloud x={52} y={28} />
          <Cloud x={190} y={18} scale={0.75} />
        </>
      ) : (
        <>
          <circle cx={282} cy={30} r={16} fill="#f7eedb" opacity={0.7} />
          {WASH_DUST.map((dot, index) => (
            <circle key={index} cx={dot.x} cy={dot.y} r={dot.r} fill="#a88b5f" opacity={0.35} />
          ))}
        </>
      )}
      <rect y={148} width={320} height={32} fill={clean ? "#d3dbe5" : "#a98c62"} />
      {!clean && <ellipse cx={172} cy={165} rx={130} ry={9} fill={mud} opacity={0.6} />}
      <ellipse cx={160} cy={152} rx={122} ry={6} fill="#000" opacity={0.22} />
      <g transform="translate(28 46)">
        <path d={SEDAN_BODY} fill={url("paint")} stroke="#881337" strokeWidth={1.2} />
        {!clean && (
          <>
            <path d={SEDAN_BODY} fill="#bba27b" opacity={0.64} />
            {WASH_SPECKS.map((dot, index) => (
              <circle key={index} cx={dot.x} cy={dot.y} r={dot.r} fill="#7d6343" opacity={0.5} />
            ))}
            <path
              d={LAVAME}
              transform="translate(58 61) rotate(-5)"
              fill="none"
              stroke="#d81b47"
              strokeWidth={2.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M20 75 Q130 71 244 75 L244 84 Q244 90 238 90 L28 90 Q20 90 20 82 Z"
              fill={mud}
              opacity={0.6}
            />
          </>
        )}
        <path d="M88 52 Q102 35 124 34 L132 34 L132 52 Z" fill={clean ? url("glass") : "#a39274"} />
        <path d="M138 34 L156 34 Q178 36 194 52 L138 52 Z" fill={clean ? url("glass") : "#a39274"} />
        {clean && (
          <>
            <path d="M98 50 L112 36 L118 36 L104 50 Z" fill="#fff" opacity={0.6} />
            <path d="M146 50 L160 36 L164 36 L150 50 Z" fill="#fff" opacity={0.6} />
          </>
        )}
        <path d="M135 56 L135 86" stroke={clean ? "#9f1239" : "#7d6343"} strokeWidth={1.2} />
        <rect x={114} y={62} width={10} height={2.5} rx={1.2} fill="#4c0519" opacity={0.5} />
        <rect x={170} y={62} width={10} height={2.5} rx={1.2} fill="#4c0519" opacity={0.5} />
        <path d="M190 52 L200 46 L202 54 Z" fill={clean ? "#be123c" : "#8d6f55"} />
        <path
          d="M230 62 Q240 63 241 69 L227 69 Z"
          fill={clean ? "#fef9c3" : "#cdb88a"}
          stroke={clean ? "#f59e0b" : "#9b8360"}
          strokeWidth={1}
        />
        <rect x={21} y={64} width={7} height={8} rx={2} fill={clean ? "#fb7185" : "#9b5b52"} />
        {clean && (
          <>
            <path d="M44 67 Q130 59 232 67" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" opacity={0.85} />
            <path d="M60 80 Q140 76 226 80" fill="none" stroke="#fff" strokeWidth={1.2} strokeLinecap="round" opacity={0.4} />
          </>
        )}
        {[70, 196].map((x) => (
          <g key={x}>
            <circle cx={x} cy={90} r={19} fill={clean ? "#111827" : "#4b4036"} />
            <circle cx={x} cy={90} r={11} fill={clean ? url("rim") : "#8f826f"} />
            {[0, 72, 144, 216, 288].map((angle) => (
              <path
                key={angle}
                d={`M${x} 90 L${x} 80`}
                transform={`rotate(${angle} ${x} 90)`}
                stroke={clean ? "#94a3b8" : "#6b5d4c"}
                strokeWidth={2.4}
                strokeLinecap="round"
              />
            ))}
            <circle cx={x} cy={90} r={3} fill={clean ? "#64748b" : "#5a4d3f"} />
            {!clean && <Splat x={x - 4} y={100} r={6} color={mud} seed={x} />}
          </g>
        ))}
        {!clean && (
          <>
            <Splat x={48} y={80} r={4.5} color={mud} seed={3} />
            <Splat x={104} y={82} r={4} color={mud} seed={4} />
            <Splat x={164} y={83} r={5} color={mud} seed={5} />
            <Splat x={226} y={80} r={4} color={mud} seed={6} />
          </>
        )}
      </g>
      {clean && (
        <>
          <SoapBubbles
            points={[
              [30, 112, 7, 0],
              [18, 86, 4.5, 1.6],
              [296, 112, 6, 0.8],
              [306, 86, 3.5, 2.4],
              [146, 44, 4, 3.2],
            ]}
          />
          <Twinkles
            points={[
              [186, 80, 0, 1.1],
              [92, 116, 0.6, 0.8],
              [268, 128, 1.2, 0.9],
              [238, 98, 0.9, 0.7],
            ]}
          />
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Full detailing: a tired SUV in a dusty garage, then shining in a showroom with a gift bow.

const SUV = {
  body: "M40 132 L40 72 Q40 58 54 57 L176 53 Q190 53 198 62 L222 84 L262 89 Q282 92 284 108 L284 128 Q284 138 274 138 L50 138 Q40 138 40 132 Z",
  frame: "M48 60 L180 56 Q190 56 196 63 L216 86 L48 86 Z",
  windows: [
    "M52 64 Q52 61 56 61 L90 60 L90 83 L52 83 Z",
    "M96 60 L146 58.5 L146 83 L96 83 Z",
    "M152 58.4 L178 57.6 Q188 57.6 194 64 L210 83 L152 83 Z",
  ],
  trim: "M40 120 L284 120 L284 128 Q284 138 274 138 L50 138 Q40 138 40 132 Z",
};
const GARAGE_DUST = scatter(21, 30, [0, 0, 320, 150], [0.6, 1.6]);

function Suv({ clean, url }: { clean: boolean; url: Ids["url"] }) {
  return (
    <>
      <path d={SUV.body} fill={url("paint")} stroke={clean ? "#172554" : "#3f4652"} strokeWidth={1.2} />
      <path d={SUV.frame} fill={clean ? "#0b1222" : "#3b3a38"} />
      {SUV.windows.map((d) => (
        <path key={d} d={d} fill={url("glass")} />
      ))}
      {clean && (
        <path d="M60 81 L76 61 L84 61 L68 81 Z M104 81 L120 60 L125 60 L109 81 Z M160 81 L176 59 L181 59 L165 81 Z" fill="#fff" opacity={0.35} />
      )}
      <path d="M58 54 L172 50.5" stroke={clean ? "#0b1222" : "#4a4744"} strokeWidth={3} strokeLinecap="round" />
      <path d="M93 86 L93 132 M149 86 L149 132" stroke="#000" strokeOpacity={0.25} strokeWidth={1.2} />
      <rect x={118} y={92} width={12} height={3} rx={1.5} fill="#000" opacity={0.35} />
      <rect x={172} y={92} width={12} height={3} rx={1.5} fill="#000" opacity={0.35} />
      <path d="M206 82 L218 76 Q222 76 222 80 L220 88 L208 88 Z" fill={url("paint")} stroke="#000" strokeOpacity={0.25} />
      <path
        d="M262 91 L281 95 Q284 99 281 103 L264 101 Q260 96 262 91 Z"
        fill={clean ? "#f0f9ff" : "#cbb26a"}
        stroke={clean ? "#93c5fd" : "#8a7444"}
      />
      <rect x={40} y={72} width={6} height={22} rx={2} fill={clean ? "#ef4444" : "#7f4b45"} />
      <path d={SUV.trim} fill={clean ? "#0b1222" : "#6b7280"} />
      <path d="M62 138 A30 30 0 0 1 122 138 Z M202 138 A30 30 0 0 1 262 138 Z" fill="#05070c" />
      {[92, 232].map((x) => (
        <g key={x}>
          <circle cx={x} cy={140} r={22} fill={clean ? "#0f141c" : "#3f3a36"} />
          <circle cx={x} cy={140} r={13} fill={clean ? url("rim") : "#78716c"} />
          {[0, 72, 144, 216, 288].map((angle) => (
            <path
              key={angle}
              d={`M${x} 140 L${x} 128`}
              transform={`rotate(${angle} ${x} 140)`}
              stroke={clean ? "#94a3b8" : "#5c5650"}
              strokeWidth={3}
              strokeLinecap="round"
            />
          ))}
          <circle cx={x} cy={140} r={3.5} fill={clean ? "#475569" : "#44403c"} />
        </g>
      ))}
    </>
  );
}

function Leaf({ x, y, angle, color }: { x: number; y: number; angle: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <path d="M0 0 Q6 -5 13 0 Q6 5 0 0 Z" fill={color} />
      <path d="M0 0 L12 0" stroke="#000" strokeOpacity={0.25} strokeWidth={0.6} />
    </g>
  );
}

function fullDetail(clean: boolean, { id, url }: Ids) {
  return (
    <>
      <defs>
        <linearGradient id={id("wall")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={clean ? "#1e293b" : "#79736c"} />
          <stop offset="1" stopColor={clean ? "#0b1222" : "#57524c"} />
        </linearGradient>
        <linearGradient id={id("paint")} x1="0" y1="52" x2="0" y2="138" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={clean ? "#60a5fa" : "#8a939e"} />
          <stop offset="0.5" stopColor={clean ? "#1d4ed8" : "#6b7280"} />
          <stop offset="1" stopColor={clean ? "#172554" : "#4b5058"} />
        </linearGradient>
        <linearGradient id={id("glass")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={clean ? "#bfdbfe" : "#8b857c"} />
          <stop offset="1" stopColor={clean ? "#1e3a8a" : "#5d5852"} />
        </linearGradient>
        <radialGradient id={id("rim")}>
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#94a3b8" />
        </radialGradient>
        <linearGradient id={id("cone")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={0.38} />
          <stop offset="1" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
        <linearGradient id={id("floor")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#020617" stopOpacity={0.1} />
          <stop offset="1" stopColor="#020617" stopOpacity={1} />
        </linearGradient>
      </defs>
      <rect width={320} height={180} fill={url("wall")} />
      {clean ? (
        <>
          {[64, 128, 192, 256].map((x) => (
            <path key={x} d={`M${x} 0 L${x} 150`} stroke="#fff" strokeOpacity={0.05} />
          ))}
          <rect y={150} width={320} height={30} fill="#020617" />
          <g transform="translate(0 324) scale(1 -1)" opacity={0.3}>
            <Suv clean url={url} />
          </g>
          <rect y={150} width={320} height={30} fill={url("floor")} />
          <path className="ba-sway" d="M96 0 L120 0 L178 152 L38 152 Z" fill={url("cone")} />
          <path className="ba-sway" style={{ animationDelay: "-3s" }} d="M204 0 L228 0 L286 152 L146 152 Z" fill={url("cone")} />
        </>
      ) : (
        <>
          <rect y={150} width={320} height={30} fill="#45403b" />
          <ellipse cx={96} cy={168} rx={32} ry={5} fill="#1c1917" opacity={0.5} />
          <path d="M70 0 L70 18" stroke="#292524" strokeWidth={1.5} />
          <circle cx={70} cy={30} r={30} fill="#fde68a" opacity={0.12} />
          <circle cx={70} cy={24} r={6} fill="#fde68a" opacity={0.8} />
          <g stroke="#f5f5f4" strokeOpacity={0.5} strokeWidth={0.8} fill="none">
            <path d="M320 0 L266 0 M320 0 L274 28 M320 0 L298 44 M320 0 L320 54" />
            <path d="M302 0 Q306 7 312 10 Q316 12 320 12" />
            <path d="M286 0 Q292 14 304 20 Q313 25 320 26" />
            <path d="M272 0 Q280 22 298 32 Q310 39 320 41" />
          </g>
          {GARAGE_DUST.map((dot, index) => (
            <circle key={index} cx={dot.x} cy={dot.y} r={dot.r} fill="#f5f5f4" opacity={0.25} />
          ))}
        </>
      )}
      <ellipse cx={162} cy={160} rx={128} ry={6} fill="#000" opacity={0.35} />
      <Suv clean={clean} url={url} />
      {clean ? (
        <>
          <path d="M50 102 Q160 94 280 102" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" opacity={0.55} />
          <path d="M116 54.6 L124 54.4 L124 138 L116 138 Z" fill="#dc2626" />
          <path d="M119 54.5 L121 54.5 L121 138 L119 138 Z" fill="#fca5a5" opacity={0.6} />
          <g stroke="#991b1b" strokeWidth={1} strokeLinejoin="round">
            <path d="M118 51 L107 67 L112 65 L114 70 L121 52 Z M122 51 L133 67 L128 65 L126 70 L119 52 Z" fill="#dc2626" />
            <path d="M120 50 C106 33 87 39 97 50 C102 56 114 54 120 50 Z" fill="#ef4444" />
            <path d="M120 50 C134 33 153 39 143 50 C138 56 126 54 120 50 Z" fill="#ef4444" />
          </g>
          <path d="M105 46 Q108 41 114 44 M135 46 Q132 41 126 44" stroke="#fecaca" strokeWidth={1.2} fill="none" strokeLinecap="round" />
          <ellipse cx={120} cy={50} rx={5} ry={4} fill="#b91c1c" />
          <Twinkles
            points={[
              [60, 40, 0, 1.1],
              [252, 34, 0.7, 1],
              [206, 112, 1.3, 0.8],
              [160, 72, 0.4, 0.7],
              [284, 80, 1.8, 0.8],
            ]}
          />
        </>
      ) : (
        <>
          <path d={SUV.body} fill="#a8a29e" opacity={0.3} />
          <Leaf x={64} y={55} angle={-12} color="#c2410c" />
          <Leaf x={138} y={51} angle={18} color="#a16207" />
          <Leaf x={160} y={50} angle={-160} color="#9a3412" />
          <Leaf x={238} y={86} angle={24} color="#b45309" />
          <g stroke="#f5f5f4" strokeOpacity={0.6} strokeWidth={0.6} fill="none">
            <path d="M206 82 L196 66 M210 80 L198 72 M214 78 L204 64" />
            <path d="M199 70 Q204 72 207 79 M197 67 Q205 68 211 77" />
          </g>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Detallado exterior: the car from the front. Bugs on the glass, wiper marks in the dust and
// yellow headlights, then white and shiny with the lights on.

const FRONT = {
  body: "M64 96 Q66 84 90 82 L230 82 Q254 84 256 96 L262 126 Q264 142 248 144 L72 144 Q56 142 58 126 Z",
  cabin: "M98 82 L112 44 Q114 38 122 38 L198 38 Q206 38 208 44 L222 82 Z",
  windshield: "M104 80 L116 47 Q117 44 121 44 L199 44 Q203 44 204 47 L216 80 Z",
  lights: [
    "M70 102 Q72 94 82 94 L118 98 Q124 106 114 110 L80 110 Q70 108 70 102 Z",
    "M250 102 Q248 94 238 94 L202 98 Q196 106 206 110 L240 110 Q250 108 250 102 Z",
  ],
  grille: "M128 106 L192 106 Q197 106 195 111 L189 124 Q187 128 181 128 L139 128 Q133 128 131 124 L125 111 Q123 106 128 106 Z",
  bumper: "M78 132 L242 132 L238 142 Q237 144 234 144 L86 144 Q83 144 82 142 Z",
  mirrors: ["M98 74 L80 70 Q72 70 72 76 L74 82 L96 84 Z", "M222 74 L240 70 Q248 70 248 76 L246 82 L224 84 Z"],
};
const FRONT_BUGS = [
  [126, 56],
  [194, 64],
  [152, 50],
  [178, 72],
  [100, 91],
  [222, 93],
  [108, 123],
  [214, 121],
  [158, 117],
];

function exteriorDetail(clean: boolean, { id, url }: Ids) {
  const edge = clean ? "#94a3b8" : "#9c8e74";
  return (
    <>
      <defs>
        <linearGradient id={id("sky")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={clean ? "#5fb3f2" : "#c9af88"} />
          <stop offset="1" stopColor={clean ? "#e0f2fe" : "#e6d5b6"} />
        </linearGradient>
        <linearGradient id={id("paint")} x1="0" y1="38" x2="0" y2="144" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={clean ? "#ffffff" : "#e8e0d0"} />
          <stop offset="1" stopColor={clean ? "#cdd6e1" : "#b3a68f"} />
        </linearGradient>
        <linearGradient id={id("glass")} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor={clean ? "#c7e9fd" : "#b5a68c"} />
          <stop offset="1" stopColor={clean ? "#0c5d96" : "#7a6c57"} />
        </linearGradient>
        <radialGradient id={id("beam")}>
          <stop offset="0" stopColor="#fff" stopOpacity={0.95} />
          <stop offset="0.35" stopColor="#e0f2fe" stopOpacity={0.55} />
          <stop offset="1" stopColor="#e0f2fe" stopOpacity={0} />
        </radialGradient>
        <clipPath id={id("glassClip")}>
          <path d={FRONT.windshield} />
        </clipPath>
        <clipPath id={id("carClip")}>
          <path d={FRONT.body} />
          <path d={FRONT.cabin} />
        </clipPath>
      </defs>
      <rect width={320} height={180} fill={url("sky")} />
      {clean && (
        <>
          <circle cx={276} cy={30} r={22} fill="#fde047" opacity={0.25} />
          <circle cx={276} cy={30} r={13} fill="#fde047" />
          <Cloud x={30} y={26} scale={0.9} />
        </>
      )}
      <rect y={98} width={320} height={82} fill={clean ? "#8fd18f" : "#b69d72"} />
      <path d="M146 98 L174 98 L320 180 L0 180 Z" fill={clean ? "#5b6677" : "#7c6d58"} />
      <ellipse cx={160} cy={150} rx={106} ry={8} fill="#000" opacity={0.25} />
      <rect x={66} y={126} width={30} height={28} rx={6} fill={clean ? "#111827" : "#3d352c"} />
      <rect x={224} y={126} width={30} height={28} rx={6} fill={clean ? "#111827" : "#3d352c"} />
      {FRONT.mirrors.map((d) => (
        <path key={d} d={d} fill={url("paint")} stroke={edge} strokeWidth={1} />
      ))}
      <path d={FRONT.cabin} fill={url("paint")} stroke={edge} strokeWidth={1} />
      <path d={FRONT.body} fill={url("paint")} stroke={edge} strokeWidth={1} />
      <path d={FRONT.windshield} fill={url("glass")} />
      <path d="M118 86 Q114 94 106 100 M202 86 Q206 94 214 100" stroke="#000" strokeOpacity={0.1} strokeWidth={1.5} fill="none" />
      {FRONT.lights.map((d) => (
        <path key={d} d={d} fill={clean ? "#f0f8ff" : "#dcb955"} stroke={clean ? "#94a3b8" : "#a08850"} strokeWidth={1} />
      ))}
      {[94, 226].map((x) => (
        <circle key={x} cx={x} cy={102} r={4.5} fill={clean ? "#fff" : "#b99a45"} stroke={clean ? "#7dd3fc" : "#8a7240"} strokeWidth={1.5} />
      ))}
      <path d={FRONT.grille} fill={clean ? "#111827" : "#81786a"} />
      {[112, 117, 122].map((y) => (
        <path key={y} d={`M130 ${y} L190 ${y}`} stroke={clean ? "#374151" : "#9a9081"} strokeWidth={1.5} />
      ))}
      <circle cx={160} cy={101} r={3.5} fill={clean ? "#e2e8f0" : "#a89d88"} stroke={clean ? "#64748b" : "#857a66"} />
      <path d={FRONT.bumper} fill={clean ? "#111827" : "#a29d94"} />
      <circle cx={96} cy={128} r={4} fill={clean ? "#f8fafc" : "#cbbf9f"} />
      <circle cx={224} cy={128} r={4} fill={clean ? "#f8fafc" : "#cbbf9f"} />
      <rect x={146} y={131} width={28} height={9} rx={1.5} fill={clean ? "#f8fafc" : "#ddd3bf"} stroke={clean ? "#94a3b8" : "#a39579"} strokeWidth={0.8} />
      {clean ? (
        <>
          <path d="M132 46 L116 78 L124 78 L140 46 Z M146 46 L130 78 L134 78 L150 46 Z" fill="#fff" opacity={0.35} />
          <ellipse cx={160} cy={89} rx={56} ry={2.2} fill="#fff" opacity={0.85} />
          {[94, 226].map((x) => (
            <circle key={x} className="ba-pulse" cx={x} cy={102} r={34} fill={url("beam")} />
          ))}
          <g clipPath={url("carClip")}>
            <g className="ba-shine">
              <rect x={40} y={20} width={24} height={140} transform="skewX(-20)" fill="#fff" opacity={0.35} />
            </g>
          </g>
          <Twinkles
            points={[
              [118, 90, 0, 0.9],
              [238, 62, 0.7, 1],
              [64, 118, 1.3, 0.8],
              [182, 40, 0.4, 0.8],
            ]}
          />
        </>
      ) : (
        <>
          <path d={FRONT.body} fill="#b29a72" opacity={0.3} />
          <path d={FRONT.cabin} fill="#b29a72" opacity={0.3} />
          <g clipPath={url("glassClip")}>
            <path d="M100 80 A30 30 0 0 1 160 80 Z M160 80 A30 30 0 0 1 220 80 Z" fill="#8aa0b2" opacity={0.8} />
          </g>
          <path d="M130 80 L104 75 M190 80 L164 75" stroke="#111827" strokeWidth={2} strokeLinecap="round" />
          {FRONT_BUGS.map(([x, y], index) => (
            <BugSplat key={index} x={x} y={y} seed={index + 1} />
          ))}
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Detallado interior: inside the cabin. Trash, crumbs, a fly and a bad smell, then clean with
// a fresh air freshener swinging from the mirror.

const CABIN_CRUMBS = [...scatter(31, 24, [26, 134, 92, 30], [0.7, 1.5]), ...scatter(32, 22, [204, 134, 92, 30], [0.7, 1.5])];
const CABIN_DUST = scatter(33, 44, [20, 74, 280, 22], [0.4, 1]);

function Pinito({ fresh }: { fresh: boolean }) {
  return (
    <g className={fresh ? "ba-swing" : undefined}>
      <path d="M160 23 L160 34" stroke={fresh ? "#f8fafc" : "#a8a29e"} strokeWidth={1} />
      <path
        d="M160 32 L171 47 L166 47 L175 61 L145 61 L154 47 L149 47 Z"
        fill={fresh ? "#16a34a" : "#9c8a5a"}
        stroke={fresh ? "#14532d" : "#6f6243"}
        strokeWidth={1}
        strokeLinejoin="round"
      />
      <rect x={157} y={61} width={6} height={4} fill={fresh ? "#92400e" : "#6f6243"} />
    </g>
  );
}

function cabin(clean: boolean, { id, url }: Ids) {
  const frame = "#1a1f29";
  return (
    <>
      <defs>
        <linearGradient id={id("sky")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={clean ? "#7cc4fa" : "#d9c7a6"} />
          <stop offset="1" stopColor={clean ? "#e0f2fe" : "#ece0c8"} />
        </linearGradient>
        <linearGradient id={id("dash")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={clean ? "#3a4252" : "#7a7268"} />
          <stop offset="1" stopColor={clean ? "#161b26" : "#4f4942"} />
        </linearGradient>
        <linearGradient id={id("seat")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={clean ? "#4b5567" : "#6d665d"} />
          <stop offset="1" stopColor={clean ? "#1f2633" : "#48423b"} />
        </linearGradient>
      </defs>
      <rect width={320} height={100} fill={url("sky")} />
      <path d="M0 64 Q80 58 160 60 Q240 58 320 64 L320 100 L0 100 Z" fill={clean ? "#8fd18f" : "#c4ad84"} />
      <path d="M152 60 L168 60 L230 100 L90 100 Z" fill={clean ? "#64748b" : "#8b7b64"} />
      {clean ? <Cloud x={226} y={22} scale={0.7} /> : <rect width={320} height={100} fill="#d6c3a0" opacity={0.3} />}
      <path d="M0 0 L46 0 L20 100 L0 100 Z" fill={frame} />
      <path d="M320 0 L274 0 L300 100 L320 100 Z" fill={frame} />
      <rect width={320} height={9} fill={frame} />
      <path d="M0 96 Q80 70 160 68 Q240 70 320 96 L320 180 L0 180 Z" fill={url("dash")} />
      <path d="M8 93 Q80 70 160 68 Q240 70 312 93" fill="none" stroke="#fff" strokeOpacity={clean ? 0.14 : 0.06} strokeWidth={2} />
      <path d="M54 92 Q92 70 132 88 L128 98 L58 100 Z" fill="#0d1118" opacity={0.9} />
      <rect x={116} y={84} width={16} height={9} rx={2.5} fill="#0d1118" />
      <rect x={188} y={84} width={16} height={9} rx={2.5} fill="#0d1118" />
      <rect x={138} y={77} width={44} height={26} rx={3} fill="#0b1120" stroke="#2b3240" />
      {clean ? (
        <>
          <rect x={140} y={79} width={40} height={22} rx={2} fill="#0f2a44" />
          <path d="M142 96 L178 88 M150 79 L158 101 M168 79 L174 101" stroke="#1e4a6e" strokeWidth={2} />
          <path d="M146 98 Q154 90 160 92 T175 84" stroke="#38bdf8" strokeWidth={2} fill="none" strokeLinecap="round" />
          <circle cx={175} cy={84} r={2.5} fill="#ef4444" />
        </>
      ) : (
        <>
          <rect x={140} y={79} width={40} height={22} rx={2} fill="#2b2a28" />
          <ellipse cx={152} cy={88} rx={6} ry={4} fill="#fff" opacity={0.12} />
          <ellipse cx={170} cy={94} rx={5} ry={3} fill="#fff" opacity={0.1} />
        </>
      )}
      <circle cx={94} cy={126} r={30} fill="none" stroke="#0b0e14" strokeWidth={7} />
      <path d="M94 126 L66 120 M94 126 L122 120 M94 126 L94 156" stroke="#0b0e14" strokeWidth={6} strokeLinecap="round" />
      <circle cx={94} cy={126} r={9} fill="#151a23" />
      <path d="M128 180 L134 140 Q136 134 142 134 L178 134 Q184 134 186 140 L192 180 Z" fill="#1c222d" />
      <rect x={156} y={140} width={8} height={14} rx={3} fill="#2b3240" />
      <circle cx={160} cy={139} r={6} fill="#39414f" />
      <circle cx={146} cy={168} r={7} fill="#0b0e14" />
      <path d="M10 180 L16 146 Q20 132 40 130 L102 130 Q122 132 124 146 L128 180 Z" fill={url("seat")} />
      <path d="M310 180 L304 146 Q300 132 280 130 L218 130 Q198 132 196 146 L192 180 Z" fill={url("seat")} />
      <path d="M160 0 L160 9" stroke="#0b0e14" strokeWidth={3} />
      <rect x={134} y={8} width={52} height={15} rx={5} fill="#111827" />
      <rect x={137} y={10.5} width={46} height={10} rx={3.5} fill={clean ? "#9fb3c8" : "#8d8273"} />
      {clean ? (
        <>
          <path d="M40 140 L102 140 M218 140 L280 140" stroke="#94a3b8" strokeOpacity={0.5} strokeDasharray="3 3" />
          <Pinito fresh />
          <g className="ba-pulse" stroke="#7dd3fc" strokeWidth={1.5} fill="none" strokeLinecap="round">
            <path d="M180 40 q4 -6 8 0 t8 0 t8 0" />
            <path d="M184 52 q4 -6 8 0 t8 0" />
            <path d="M140 40 q-4 -6 -8 0 t-8 0 t-8 0" />
            <path d="M136 52 q-4 -6 -8 0 t-8 0" />
          </g>
          <Twinkles
            points={[
              [58, 152, 0, 0.8],
              [262, 150, 0.8, 0.9],
              [212, 80, 1.4, 0.7],
              [110, 30, 0.4, 0.8],
            ]}
          />
        </>
      ) : (
        <>
          <path d="M0 96 Q80 70 160 68 Q240 70 320 96 L320 104 Q240 80 160 78 Q80 80 0 104 Z" fill="#cbbb9c" opacity={0.5} />
          {CABIN_DUST.map((dot, index) => (
            <circle key={index} cx={dot.x} cy={dot.y} r={dot.r} fill="#efe4cc" opacity={0.7} />
          ))}
          <path d="M70 84 L90 79 L92 87 L72 92 Z" fill="#f5f5f4" opacity={0.9} />
          <path d="M74 85 L88 81.5 M75 88 L86 85" stroke="#a8a29e" strokeWidth={0.8} />
          <path d="M206 77 L212 71 L221 72 L225 78 L221 84 L212 85 L206 81 Z" fill="#f5f5f4" stroke="#a8a29e" strokeWidth={0.8} />
          <path d="M210 76 L218 80 M214 73 L213 83" stroke="#a8a29e" strokeWidth={0.7} />
          <path d="M139 146 L153 146 L151 170 L141 170 Z" fill="#b2493f" />
          <path d="M140 155 L152 155" stroke="#f5f5f4" strokeWidth={3} />
          <path d="M138 146 L154 146 L153 142 L139 142 Z" fill="#e7e5e4" />
          <path d="M148 142 L153 126" stroke="#f5f5f4" strokeWidth={2} strokeLinecap="round" />
          {CABIN_CRUMBS.map((dot, index) => (
            <circle key={index} cx={dot.x} cy={dot.y} r={dot.r} fill="#e2c68f" />
          ))}
          <ellipse cx={70} cy={152} rx={11} ry={5} fill="#2d1d12" opacity={0.4} />
          <ellipse cx={252} cy={160} rx={9} ry={4} fill="#2d1d12" opacity={0.35} />
          <g className="ba-wave" stroke="#84cc16" strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.7}>
            <path d="M172 130 q-4 -6 0 -12 t0 -12" />
            <path d="M182 128 q-4 -6 0 -12 t0 -12 t0 -10" />
            <path d="M246 126 q-4 -6 0 -12 t0 -12" />
          </g>
          <path d="M196 56 q10 -14 20 -6 t16 -10" stroke="#1c1917" strokeOpacity={0.45} strokeDasharray="1.5 3" fill="none" />
          <g className="ba-buzz">
            <ellipse cx={236} cy={40} rx={3.4} ry={2.3} fill="#1c1917" />
            <ellipse cx={234} cy={37} rx={2.8} ry={1.6} fill="#f5f5f4" opacity={0.85} transform="rotate(-30 234 37)" />
            <ellipse cx={238} cy={37} rx={2.8} ry={1.6} fill="#f5f5f4" opacity={0.85} transform="rotate(30 238 37)" />
          </g>
          <Pinito fresh={false} />
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Descontaminado: a magnifying glass over the paint. Rough with iron specks, tar and sap,
// then smooth as glass.

const DECON_SPECKS = scatter(41, 80, [0, 0, 320, 180], [0.4, 1.1]);
const DECON_IRON = scatter(42, 18, [102, 40, 96, 92], [1.6, 3.4]);
const DECON_GRAIN = scatter(43, 110, [94, 30, 112, 112], [0.3, 0.8]);

function decon(clean: boolean, { id, url }: Ids) {
  return (
    <>
      <defs>
        <linearGradient id={id("paint")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={clean ? "#f87171" : "#b4605a"} />
          <stop offset="0.55" stopColor={clean ? "#c81e1e" : "#8e3a35"} />
          <stop offset="1" stopColor={clean ? "#6f1414" : "#5c2622"} />
        </linearGradient>
        <radialGradient id={id("lens")} cx="0.4" cy="0.35" r="0.75">
          <stop offset="0" stopColor={clean ? "#f05252" : "#c06a62"} />
          <stop offset="1" stopColor={clean ? "#8b1313" : "#8a3c35"} />
        </radialGradient>
        <clipPath id={id("lensClip")}>
          <circle cx={150} cy={86} r={55} />
        </clipPath>
      </defs>
      <rect width={320} height={180} fill={url("paint")} />
      <path d="M0 132 Q160 104 320 120" fill="none" stroke="#fff" strokeOpacity={clean ? 0.35 : 0.12} strokeWidth={2} />
      <path d="M0 136 Q160 108 320 124" fill="none" stroke="#000" strokeOpacity={0.2} strokeWidth={2} />
      {clean ? (
        <path d="M0 44 Q160 14 320 36 L320 56 Q160 36 0 66 Z" fill="#fff" opacity={0.3} />
      ) : (
        DECON_SPECKS.map((dot, index) => <circle key={index} cx={dot.x} cy={dot.y} r={dot.r} fill="#3b2412" opacity={0.45} />)
      )}
      <circle cx={150} cy={86} r={64} fill="#000" opacity={0.18} />
      <g clipPath={url("lensClip")}>
        <rect x={90} y={26} width={120} height={120} fill={url("lens")} />
        {clean ? (
          <>
            <path d="M90 74 Q150 40 212 62 L212 84 Q150 62 90 98 Z" fill="#fff" opacity={0.55} />
            <path d="M96 112 Q150 96 206 104" stroke="#fff" strokeOpacity={0.3} strokeWidth={3} fill="none" />
          </>
        ) : (
          <>
            {DECON_GRAIN.map((dot, index) => (
              <circle key={index} cx={dot.x} cy={dot.y} r={dot.r} fill="#2a1710" opacity={0.28} />
            ))}
            <path d="M112 66 q6 -6 12 -1 q5 5 -1 10 q-7 5 -12 -1 q-3 -4 1 -8 Z" fill="#1c1917" />
            <path d="M172 104 q5 -7 12 -3 q6 4 1 10 q-5 6 -11 2 q-5 -3 -2 -9 Z" fill="#1c1917" />
            <path d="M136 118 q3 -4 7 -2 q3 3 0 6 q-4 3 -7 0 Z" fill="#1c1917" />
            <ellipse cx={176} cy={60} rx={6} ry={4.5} fill="#f59e0b" opacity={0.85} />
            <circle cx={174} cy={58.5} r={1.4} fill="#fff" opacity={0.8} />
            <ellipse cx={122} cy={100} rx={4.5} ry={3.5} fill="#f59e0b" opacity={0.85} />
            <circle cx={120.8} cy={99} r={1.1} fill="#fff" opacity={0.8} />
            {DECON_IRON.map((dot, index) => (
              <circle key={index} cx={dot.x} cy={dot.y} r={dot.r} fill="#c2410c" stroke="#7c2d12" strokeWidth={0.8} />
            ))}
          </>
        )}
      </g>
      <path d="M112 50 A52 52 0 0 1 148 34" stroke="#fff" strokeOpacity={0.6} strokeWidth={3.5} strokeLinecap="round" fill="none" />
      <circle cx={150} cy={86} r={59} fill="none" stroke="#1f2937" strokeWidth={8} />
      <circle cx={150} cy={86} r={55} fill="none" stroke="#cbd5e1" strokeOpacity={0.7} strokeWidth={1.2} />
      <path d="M194 128 L236 170" stroke="#1f2937" strokeWidth={14} strokeLinecap="round" />
      <path d="M206 140 L232 166" stroke="#374151" strokeWidth={9} strokeLinecap="round" />
      {clean && (
        <Twinkles
          points={[
            [254, 44, 0, 1],
            [56, 146, 0.7, 0.9],
            [282, 118, 1.3, 0.8],
            [124, 70, 0.4, 0.7],
          ]}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Cerámico rápido: rain on the hood. The water spreads in dull puddles, then it beads up in
// round drops that roll away.

const HOOD_BEADS = scatter(51, 34, [6, 82, 308, 94], [2, 6.4]);
const RAIN = scatter(52, 28, [0, -10, 330, 96], [6, 12]);
const HOOD_SPECKS = scatter(53, 50, [0, 72, 320, 108], [0.4, 1]);
const SHEETS = [
  "M30 118 C48 100 96 104 112 118 C126 130 104 146 76 146 C52 146 22 134 30 118 Z",
  "M150 96 C170 86 214 90 222 102 C230 114 204 124 180 120 C160 117 140 106 150 96 Z",
  "M232 132 C252 118 296 124 304 138 C312 152 286 164 262 160 C240 157 222 146 232 132 Z",
  "M120 150 C140 140 176 146 180 158 C184 170 160 176 140 172 C122 168 108 160 120 150 Z",
  "M60 84 C76 78 104 80 108 88 C112 96 92 100 76 98 C62 96 52 90 60 84 Z",
];

function beading(clean: boolean, { id, url }: Ids) {
  return (
    <>
      <defs>
        <linearGradient id={id("sky")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={clean ? "#9fb2c6" : "#959ca6"} />
          <stop offset="1" stopColor={clean ? "#dfe7ef" : "#c9ced5"} />
        </linearGradient>
        <linearGradient id={id("paint")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={clean ? "#2f6be0" : "#3e5272"} />
          <stop offset="0.5" stopColor={clean ? "#1a3f8f" : "#2f3f5a"} />
          <stop offset="1" stopColor={clean ? "#0a1838" : "#222d40"} />
        </linearGradient>
        <radialGradient id={id("bead")} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#e0f2fe" stopOpacity={0.55} />
          <stop offset="0.55" stopColor="#1e3a8a" stopOpacity={0.15} />
          <stop offset="1" stopColor="#020617" stopOpacity={0.55} />
        </radialGradient>
      </defs>
      <rect width={320} height={180} fill={url("sky")} />
      <Cloud x={40} y={18} scale={1.1} color="#eef2f6" opacity={0.85} />
      <Cloud x={220} y={10} scale={0.9} color="#eef2f6" opacity={0.85} />
      <path d="M0 66 Q160 38 320 66 L320 180 L0 180 Z" fill={url("paint")} />
      <path d="M0 66 Q160 38 320 66" fill="none" stroke="#fff" strokeOpacity={clean ? 0.6 : 0.18} strokeWidth={2} />
      {clean ? (
        <>
          <path d="M10 98 Q160 70 310 98 L310 108 Q160 84 10 112 Z" fill="#fff" opacity={0.16} />
          {HOOD_BEADS.map((bead, index) => (
            <Bead
              key={index}
              {...bead}
              fill={url("bead")}
              className={index % 6 === 0 ? "ba-roll" : undefined}
              delay={(index % 4) * 0.7}
            />
          ))}
          <Twinkles
            points={[
              [84, 92, 0, 0.8],
              [236, 88, 0.9, 0.9],
            ]}
          />
        </>
      ) : (
        <>
          {SHEETS.map((d) => (
            <path key={d} d={d} fill="#c7d7ee" fillOpacity={0.2} stroke="#dbeafe" strokeOpacity={0.4} strokeWidth={1} />
          ))}
          <path d="M20 164 Q60 152 100 168 M200 110 Q240 100 280 114" stroke="#a8a29e" strokeOpacity={0.35} strokeWidth={1.5} fill="none" />
          {HOOD_SPECKS.map((dot, index) => (
            <circle key={index} cx={dot.x} cy={dot.y} r={dot.r} fill="#a8a29e" opacity={0.4} />
          ))}
        </>
      )}
      <g className="ba-rain" stroke="#fff" strokeOpacity={0.55} strokeWidth={1} strokeLinecap="round">
        {RAIN.map((drop, index) => (
          <path key={index} d={`M${drop.x} ${drop.y} l-3 ${drop.r}`} />
        ))}
      </g>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Tratamiento cerámico: sun, rain and birds against the paint. Without protection they fade
// and spot it; with the ceramic layer they bounce off.

const ROOF = "M0 128 Q50 120 86 104 Q120 80 168 76 Q222 78 252 100 Q284 118 320 122";
const COATING_EDGE = "M0 114 Q50 106 86 90 Q120 66 168 62 Q222 64 252 86 Q284 104 320 108";
// The layer fills the space between its top edge and the paint (the roof line, backwards).
const COATING = `${COATING_EDGE} L320 122 Q284 118 252 100 Q222 78 168 76 Q120 80 86 104 Q50 120 0 128 Z`;
const PAINT_SPOTS = scatter(61, 14, [224, 112, 88, 40], [1.6, 3]);

function shield(clean: boolean, { id, url }: Ids) {
  return (
    <>
      <defs>
        <linearGradient id={id("sky")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fcd98a" />
          <stop offset="1" stopColor="#fff3d6" />
        </linearGradient>
        <linearGradient id={id("paint")} x1="0" y1="70" x2="0" y2="180" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={clean ? "#8b5cf6" : "#a597c4"} />
          <stop offset="0.5" stopColor={clean ? "#5b21b6" : "#7a6c99"} />
          <stop offset="1" stopColor={clean ? "#2e1065" : "#4d4366"} />
        </linearGradient>
        <pattern id={id("hex")} width={12} height={10.4} patternUnits="userSpaceOnUse">
          <path d="M3 0 L9 0 L12 5.2 L9 10.4 L3 10.4 L0 5.2 Z" fill="none" stroke="#38bdf8" strokeOpacity={0.8} strokeWidth={0.8} />
        </pattern>
        <marker id={id("arrow")} viewBox="0 0 10 10" refX={8} refY={5} markerWidth={5} markerHeight={5} orient="auto">
          <path d="M0 0 L10 5 L0 10 Z" fill="#f59e0b" />
        </marker>
      </defs>
      <rect width={320} height={180} fill={url("sky")} />
      <circle cx={52} cy={36} r={17} fill="#fbbf24" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
        <path key={angle} d="M52 12 L52 5" transform={`rotate(${angle} 52 36)`} stroke="#f59e0b" strokeWidth={3} strokeLinecap="round" />
      ))}
      <Cloud x={234} y={20} color="#94a3b8" opacity={0.95} />
      <path d="M150 30 q6 -6 12 0 q6 -6 12 0" stroke="#1f2937" strokeWidth={2} fill="none" strokeLinecap="round" />
      <path d={`${ROOF} L320 180 L0 180 Z`} fill={url("paint")} />
      <path d="M114 98 Q136 86 166 84 Q202 86 224 100 Z" fill={clean ? "#1e1b4b" : "#4a4560"} />
      <path d="M168 104 L168 180" stroke="#000" strokeOpacity={0.2} strokeWidth={1.2} />
      {[70, 262].map((x) => (
        <g key={x}>
          <circle cx={x} cy={186} r={28} fill="#111827" />
          <circle cx={x} cy={186} r={15} fill={clean ? "#cbd5e1" : "#8f8a99"} />
        </g>
      ))}
      {clean ? (
        <>
          <path d="M30 142 Q160 106 300 138" stroke="#fff" strokeOpacity={0.3} strokeWidth={5} fill="none" strokeLinecap="round" />
          <path d={COATING} fill="#c7ecff" fillOpacity={0.85} />
          <path d={COATING} fill={url("hex")} />
          <path d={COATING_EDGE} fill="none" stroke="#0ea5e9" strokeWidth={1.5} />
          <g stroke="#f59e0b" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M68 50 L107 76 L111 42" markerEnd={url("arrow")} />
            <path d="M72 44 L131 67 L154 37" markerEnd={url("arrow")} />
          </g>
          <circle cx={107} cy={76} r={3} fill="#fff" />
          <circle cx={131} cy={67} r={3} fill="#fff" />
          <g stroke="#60a5fa" strokeWidth={2} strokeLinecap="round">
            <path d="M246 44 l-2 7 M262 46 l-2 7 M278 44 l-2 7" />
          </g>
          <Bead x={262} y={87} r={3.5} fill="#bfdbfe" className="ba-roll" />
          <Bead x={288} y={96} r={4.5} fill="#bfdbfe" className="ba-roll" delay={1.2} />
          <Bead x={240} y={75} r={3} fill="#bfdbfe" />
          <Twinkles
            points={[
              [196, 126, 0, 0.9],
              [96, 140, 0.8, 0.8],
              [292, 140, 1.4, 0.8],
            ]}
          />
        </>
      ) : (
        <>
          <g stroke="#f59e0b" strokeWidth={2.5} fill="none" strokeLinecap="round">
            <path d="M68 50 L104 87" markerEnd={url("arrow")} />
            <path d="M72 44 L128 79" markerEnd={url("arrow")} />
          </g>
          <ellipse cx={110} cy={96} rx={18} ry={7} fill="#f3e8ff" opacity={0.55} />
          <ellipse cx={136} cy={88} rx={14} ry={6} fill="#f3e8ff" opacity={0.45} />
          <g stroke="#fff" strokeOpacity={0.4} strokeWidth={0.8} fill="none">
            <path d={arc(206, 136, 9, 200, 330)} />
            <path d={arc(206, 136, 15, 170, 300)} />
            <path d={arc(206, 136, 21, 220, 340)} />
            <path d={arc(206, 136, 27, 190, 280)} />
          </g>
          <path
            d="M181 79 C182 74 190 72 195 75 C200 77 200 82 196 84 L197 92 Q196 95 194 92 L192 85 L189 86 L188 90 Q187 92 186 89 L185 85 C181 84 180 82 181 79 Z"
            fill="#f8fafc"
          />
          <ellipse cx={189} cy={79} rx={3} ry={2} fill="#a8a29e" />
          <g stroke="#60a5fa" strokeWidth={2} strokeLinecap="round">
            <path d="M246 44 l-6 20 M262 46 l-6 22 M278 44 l-6 26" />
          </g>
          {PAINT_SPOTS.map((dot, index) => (
            <circle key={index} cx={dot.x} cy={dot.y} r={dot.r} fill="none" stroke="#f1f5f9" strokeOpacity={0.6} strokeWidth={0.9} />
          ))}
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Vidrios: the road seen through the windshield on a rainy day. Blurry and smeared, then
// sharp with the rain beading away.

const GLASS_SPOTS = scatter(71, 28, [30, 16, 260, 124], [1.6, 4.2]);
const GLASS_BEADS = scatter(72, 34, [36, 18, 248, 122], [1.2, 3.8]);

function rainGlass(clean: boolean, { id, url }: Ids) {
  const frame = "#1b2029";
  return (
    <>
      <defs>
        <linearGradient id={id("sky")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7d8ca1" />
          <stop offset="1" stopColor="#c8d0da" />
        </linearGradient>
        <filter id={id("blur")} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation={3} />
        </filter>
        <radialGradient id={id("tail")}>
          <stop offset="0" stopColor="#fca5a5" stopOpacity={0.9} />
          <stop offset="1" stopColor="#ef4444" stopOpacity={0} />
        </radialGradient>
      </defs>
      <g filter={clean ? undefined : url("blur")}>
        <rect width={320} height={160} fill={url("sky")} />
        <path d="M0 92 Q40 76 80 86 Q120 72 160 84 Q210 70 250 84 Q290 74 320 86 L320 100 L0 100 Z" fill="#5f6d82" />
        <path d="M60 92 L60 70 L74 70 L74 92 Z M240 92 L240 64 L252 64 L252 92 Z M258 92 L258 74 L268 74 L268 92 Z" fill="#53627a" />
        <path d="M0 92 L320 92 L320 160 L0 160 Z" fill="#56677a" />
        <path d="M148 92 L172 92 L300 160 L20 160 Z" fill="#3c4757" />
        <path d="M159 96 L161 96 L161.6 102 L158.4 102 Z M158 108 L162 108 L163 118 L157 118 Z M156 126 L164 126 L166 142 L154 142 Z" fill="#e2e8f0" opacity={0.85} />
        <path d="M44 150 L44 64 Q44 58 52 58 L62 58" stroke="#2f3a4a" strokeWidth={2.5} fill="none" />
        <circle cx={64} cy={60} r={7} fill="#fef3c7" opacity={0.6} />
        <rect x={140} y={98} width={40} height={16} rx={5} fill="#1e293b" />
        <rect x={147} y={90} width={26} height={10} rx={4} fill="#1e293b" />
        <rect x={150} y={92} width={20} height={6} rx={2} fill="#64748b" />
        <circle cx={146} cy={107} r={9} fill={url("tail")} />
        <circle cx={174} cy={107} r={9} fill={url("tail")} />
        <rect x={141} y={105} width={8} height={4} rx={1} fill="#ef4444" />
        <rect x={171} y={105} width={8} height={4} rx={1} fill="#ef4444" />
      </g>
      {clean ? (
        GLASS_BEADS.map((bead, index) => (
          <g key={index} className={index % 5 === 0 ? "ba-wind" : undefined} style={index % 5 === 0 ? { animationDelay: `${(index % 3) * 0.6}s` } : undefined}>
            <circle cx={bead.x} cy={bead.y} r={bead.r} fill="#e0f2fe" fillOpacity={0.22} stroke="#f8fafc" strokeOpacity={0.75} strokeWidth={0.7} />
            <circle cx={round(bead.x - bead.r * 0.35)} cy={round(bead.y - bead.r * 0.35)} r={round(bead.r * 0.32)} fill="#fff" />
          </g>
        ))
      ) : (
        <>
          <rect width={320} height={160} fill="#e2e8f0" opacity={0.22} />
          <g stroke="#fff" strokeOpacity={0.2} strokeWidth={14} fill="none">
            <path d="M-22 152 A92 92 0 0 1 162 152" />
            <path d="M98 152 A92 92 0 0 1 282 152" />
          </g>
          <g stroke="#fff" strokeOpacity={0.32} strokeWidth={2.5} fill="none" strokeLinecap="round">
            <path d="M84 18 q3 20 -1 40 t2 40" />
            <path d="M206 16 q-3 22 1 44 t-2 34" />
            <path d="M246 30 q3 18 -1 36" />
            <path d="M120 24 q-2 16 1 30" />
          </g>
          {GLASS_SPOTS.map((dot, index) => (
            <circle key={index} cx={dot.x} cy={dot.y} r={dot.r} fill="#fff" fillOpacity={0.1} stroke="#f8fafc" strokeOpacity={0.55} strokeWidth={1} />
          ))}
        </>
      )}
      <path d="M0 0 L42 0 L14 160 L0 160 Z" fill={frame} />
      <path d="M320 0 L278 0 L306 160 L320 160 Z" fill={frame} />
      <rect width={320} height={12} fill={frame} />
      <path d="M0 150 Q160 132 320 150 L320 180 L0 180 Z" fill="#232a35" />
      <path d="M0 150 Q160 132 320 150" stroke="#fff" strokeOpacity={0.08} strokeWidth={2} fill="none" />
      <path d="M54 146 L150 137 M170 138 L262 132" stroke="#0b0e14" strokeWidth={3} strokeLinecap="round" />
      <path d="M160 0 L160 11" stroke="#0b0e14" strokeWidth={3} />
      <rect x={134} y={10} width={52} height={15} rx={5} fill="#0f141c" />
      <rect x={137} y={12.5} width={46} height={10} rx={3.5} fill="#7c8a9d" />
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Rines y llantas: a wheel up close. Black brake dust and mud, then polished spokes, a red
// caliper and a deep black tire.

const WHEEL_SPECKS = scatter(81, 80, [110, 44, 100, 100], [0.4, 1.2]);
const WHEEL = { x: 160, y: 94 };

function wheel(clean: boolean, { id, url }: Ids) {
  const { x, y } = WHEEL;
  return (
    <>
      <defs>
        <linearGradient id={id("paint")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={clean ? "#fb923c" : "#c79a74"} />
          <stop offset="1" stopColor={clean ? "#9a3412" : "#7d5a42"} />
        </linearGradient>
        <linearGradient id={id("rim")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={clean ? "#ffffff" : "#b3a999"} />
          <stop offset="0.5" stopColor={clean ? "#cbd5e1" : "#8d8273"} />
          <stop offset="1" stopColor={clean ? "#8392a6" : "#665c50"} />
        </linearGradient>
        <radialGradient id={id("dust")} cx="0.5" cy="0.62" r="0.6">
          <stop offset="0" stopColor="#2b211b" stopOpacity={0.1} />
          <stop offset="0.7" stopColor="#2b211b" stopOpacity={0.45} />
          <stop offset="1" stopColor="#2b211b" stopOpacity={0.8} />
        </radialGradient>
        <clipPath id={id("rimClip")}>
          <circle cx={x} cy={y} r={49} />
        </clipPath>
      </defs>
      <rect width={320} height={180} fill={url("paint")} />
      {clean && <path d="M0 22 Q160 6 320 22" stroke="#fff" strokeOpacity={0.45} strokeWidth={3} fill="none" />}
      <rect y={164} width={320} height={16} fill={clean ? "#6b7280" : "#7b6a55"} />
      <circle cx={x} cy={y} r={80} fill="#0a0a0c" />
      <circle cx={x} cy={y} r={72} fill={clean ? "#141414" : "#3b342e"} />
      <circle cx={x} cy={y} r={63} fill="none" stroke={clean ? "#262626" : "#4d453d"} strokeWidth={2} />
      {clean && <path d={arc(x, y, 67, 200, 290)} stroke="#fff" strokeOpacity={0.18} strokeWidth={4} fill="none" strokeLinecap="round" />}
      <circle cx={x} cy={y} r={44} fill={clean ? "#a1a8b3" : "#6f5f52"} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
        <circle key={angle} cx={x} cy={y - 34} r={1.6} fill="#4b5563" transform={`rotate(${angle + 22} ${x} ${y})`} />
      ))}
      <rect x={-11} y={-47} width={22} height={28} rx={7} transform={`translate(${x} ${y}) rotate(-38)`} fill={clean ? "#dc2626" : "#7a3a30"} />
      {[0, 72, 144, 216, 288].map((angle) => (
        <g key={angle} transform={`rotate(${angle} ${x} ${y})`} fill={url("rim")}>
          <path d={`M${x - 9} ${y - 11} L${x - 12} ${y - 46} L${x - 4} ${y - 46} L${x - 2.5} ${y - 11} Z`} />
          <path d={`M${x + 9} ${y - 11} L${x + 12} ${y - 46} L${x + 4} ${y - 46} L${x + 2.5} ${y - 11} Z`} />
        </g>
      ))}
      <circle cx={x} cy={y} r={47} fill="none" stroke={url("rim")} strokeWidth={6} />
      <circle cx={x} cy={y} r={14} fill={url("rim")} />
      {[0, 72, 144, 216, 288].map((angle) => (
        <circle key={angle} cx={x} cy={y - 8.5} r={1.8} fill={clean ? "#64748b" : "#3b332c"} transform={`rotate(${angle + 36} ${x} ${y})`} />
      ))}
      <circle cx={x} cy={y} r={5} fill={clean ? "#1f2937" : "#3b332c"} />
      {clean ? (
        <>
          <g clipPath={url("rimClip")}>
            <g className="ba-shine">
              <rect x={60} y={20} width={22} height={150} transform="skewX(-18)" fill="#fff" opacity={0.5} />
            </g>
          </g>
          <Twinkles
            points={[
              [114, 60, 0, 1],
              [212, 70, 0.6, 0.9],
              [246, 140, 1.2, 0.8],
              [60, 40, 1.6, 0.8],
            ]}
          />
        </>
      ) : (
        <>
          <circle cx={x} cy={y} r={50} fill={url("dust")} />
          {WHEEL_SPECKS.map((dot, index) => (
            <circle key={index} cx={dot.x} cy={dot.y} r={dot.r} fill="#1f1712" opacity={0.6} />
          ))}
          <Splat x={112} y={146} r={7} color="#5d4630" seed={7} />
          <Splat x={198} y={152} r={6} color="#5d4630" seed={8} />
          <Splat x={156} y={163} r={5} color="#5d4630" seed={9} />
          <Splat x={36} y={150} r={6} color="#5d4630" seed={10} opacity={0.6} />
          <Splat x={282} y={146} r={7} color="#5d4630" seed={12} opacity={0.6} />
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Faros: a headlight at night. Yellow, cloudy and dim, then crystal clear and bright.

const HEADLIGHT = "M46 84 Q50 56 98 52 L232 58 Q270 62 276 88 Q280 116 250 126 L96 132 Q50 130 46 104 Z";
const CRAZING = cracks(91, 80, [52, 56, 220, 72], 4);
const STARS = scatter(92, 18, [0, 0, 320, 30], [0.4, 1]);

function headlight(clean: boolean, { id, url }: Ids) {
  return (
    <>
      <defs>
        <linearGradient id={id("night")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#070b16" />
          <stop offset="1" stopColor="#1b2335" />
        </linearGradient>
        <linearGradient id={id("paint")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={clean ? "#5b6b82" : "#565a63"} />
          <stop offset="1" stopColor={clean ? "#1c2534" : "#2a2d33"} />
        </linearGradient>
        <radialGradient id={id("chrome")} cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor={clean ? "#f8fafc" : "#a39a84"} />
          <stop offset="1" stopColor={clean ? "#3f4a5c" : "#3d3a33"} />
        </radialGradient>
        <radialGradient id={id("lens")} cx="0.4" cy="0.4" r="0.7">
          <stop offset="0" stopColor={clean ? "#ffffff" : "#d9a640"} />
          <stop offset="0.5" stopColor={clean ? "#bfe3ff" : "#8a5a14"} />
          <stop offset="1" stopColor={clean ? "#3b82f6" : "#3d2a0c"} />
        </radialGradient>
        <radialGradient id={id("glow")}>
          <stop offset="0" stopColor={clean ? "#ffffff" : "#fcd34d"} stopOpacity={clean ? 0.9 : 0.4} />
          <stop offset="0.4" stopColor={clean ? "#dbeafe" : "#f59e0b"} stopOpacity={clean ? 0.4 : 0.1} />
          <stop offset="1" stopColor={clean ? "#dbeafe" : "#f59e0b"} stopOpacity={0} />
        </radialGradient>
        <linearGradient id={id("yellow")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fde047" stopOpacity={0.6} />
          <stop offset="1" stopColor="#ca8a04" stopOpacity={0.8} />
        </linearGradient>
        <clipPath id={id("lightClip")}>
          <path d={HEADLIGHT} />
        </clipPath>
      </defs>
      <rect width={320} height={180} fill={url("night")} />
      {STARS.map((star, index) => (
        <circle key={index} cx={star.x} cy={star.y} r={star.r} fill="#fff" opacity={0.7} />
      ))}
      <path d="M266 6 a10 10 0 1 0 9 17 a8 8 0 1 1 -9 -17 Z" fill="#fef9c3" opacity={0.9} />
      <path d="M0 36 Q150 20 320 42 L320 180 L0 180 Z" fill={url("paint")} />
      <path d="M0 36 Q150 20 320 42" stroke="#fff" strokeOpacity={clean ? 0.3 : 0.1} strokeWidth={2} fill="none" />
      <path d="M0 146 Q160 134 320 146 L320 180 L0 180 Z" fill="#0d1119" />
      <g stroke="#2a3140" strokeWidth={1.5}>
        <path d="M40 158 L280 154 M40 166 L280 162 M40 174 L280 170" />
      </g>
      <path d={HEADLIGHT} fill="#0b1120" stroke={clean ? "#cbd5e1" : "#77705f"} strokeWidth={2} />
      <g clipPath={url("lightClip")}>
        <circle cx={110} cy={92} r={30} fill={url("chrome")} />
        <circle cx={110} cy={92} r={18} fill={url("lens")} />
        <circle cx={186} cy={94} r={22} fill={url("chrome")} />
        <circle cx={186} cy={94} r={6} fill={clean ? "#f8fafc" : "#b08a3a"} />
        <path d="M236 62 Q264 66 272 90 L246 92 Z" fill={clean ? "#f59e0b" : "#8a5a14"} opacity={0.85} />
        <path d="M60 118 Q150 126 252 114" stroke={clean ? "#f0f9ff" : "#9c8550"} strokeWidth={4} strokeLinecap="round" fill="none" />
        {clean ? (
          <path d="M66 62 L124 56 L108 72 L60 78 Z" fill="#fff" opacity={0.3} />
        ) : (
          <>
            <path d={HEADLIGHT} fill={url("yellow")} />
            <ellipse cx={150} cy={78} rx={84} ry={22} fill="#fef9c3" opacity={0.32} />
            {CRAZING.map((d, index) => (
              <path key={index} d={d} stroke="#713f12" strokeOpacity={0.4} strokeWidth={0.7} fill="none" />
            ))}
          </>
        )}
      </g>
      {clean ? (
        <>
          <g className="ba-pulse">
            <circle cx={110} cy={92} r={84} fill={url("glow")} />
            {[-150, -120, -90, -60, -30, 0, 30, 150, 180].map((angle) => (
              <path
                key={angle}
                d={`M${round(110 + 30 * Math.cos((angle * Math.PI) / 180))} ${round(92 + 30 * Math.sin((angle * Math.PI) / 180))} L${round(110 + 92 * Math.cos((angle * Math.PI) / 180))} ${round(92 + 92 * Math.sin((angle * Math.PI) / 180))}`}
                stroke="#e0f2fe"
                strokeOpacity={0.35}
                strokeWidth={2}
                strokeLinecap="round"
              />
            ))}
          </g>
          <path d="M60 118 Q150 126 252 114" stroke="#e0f2fe" strokeOpacity={0.45} strokeWidth={10} strokeLinecap="round" fill="none" />
          <Twinkles
            points={[
              [232, 106, 0.4, 0.9],
              [292, 60, 1.1, 0.8],
            ]}
          />
        </>
      ) : (
        <circle cx={110} cy={92} r={36} fill={url("glow")} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Plásticos exteriores: the front of a white truck under a strong sun. Chalky gray bumper and
// grille, then deep black again.

const GRILLE = "M92 44 L228 44 Q236 44 236 52 L232 104 Q231 112 222 112 L98 112 Q89 112 88 104 L84 52 Q84 44 92 44 Z";
const BUMPER =
  "M18 118 L302 118 Q308 118 308 126 L304 156 Q302 164 292 164 L28 164 Q18 164 16 156 L12 126 Q12 118 18 118 Z";
const CHALK = [
  "M30 128 C44 122 70 126 78 132 C70 138 46 140 30 128 Z",
  "M220 140 C236 132 262 136 272 142 C260 150 234 150 220 140 Z",
  "M120 152 C140 148 170 150 186 156 C170 160 136 160 120 152 Z",
  "M96 52 C110 48 130 52 136 58 C124 62 104 60 96 52 Z",
  "M176 86 C192 80 214 84 222 92 C208 96 186 94 176 86 Z",
  "M270 124 C280 122 292 124 296 128 C288 132 276 132 270 124 Z",
];

function grille(clean: boolean, { id, url }: Ids) {
  return (
    <>
      <defs>
        <linearGradient id={id("sky")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fcd27a" />
          <stop offset="1" stopColor="#fff4dc" />
        </linearGradient>
        <linearGradient id={id("paint")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={clean ? "#ffffff" : "#efe9df"} />
          <stop offset="1" stopColor={clean ? "#d3dbe6" : "#cbc1b2"} />
        </linearGradient>
        <linearGradient id={id("plastic")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={clean ? "#2e2e35" : "#b8b3ac"} />
          <stop offset="1" stopColor={clean ? "#0b0b0d" : "#99948d"} />
        </linearGradient>
        <pattern id={id("hex")} width={12} height={10.4} patternUnits="userSpaceOnUse">
          <rect width={12} height={10.4} fill={clean ? "#050506" : "#8f8a83"} />
          <path
            d="M3 0 L9 0 L12 5.2 L9 10.4 L3 10.4 L0 5.2 Z"
            fill={clean ? "#1c1c20" : "#b3ada5"}
            stroke={clean ? "#34343b" : "#cbc5bc"}
            strokeWidth={1}
          />
        </pattern>
      </defs>
      <rect width={320} height={180} fill={url("sky")} />
      <circle cx={36} cy={22} r={clean ? 22 : 28} fill="#fbbf24" opacity={0.25} />
      <circle cx={36} cy={22} r={14} fill="#fbbf24" />
      <path d="M0 26 Q160 12 320 26 L320 124 L0 124 Z" fill={url("paint")} />
      <path d="M10 40 L80 46 Q86 54 78 60 L14 58 Q6 50 10 40 Z M310 40 L240 46 Q234 54 242 60 L306 58 Q314 50 310 40 Z" fill={clean ? "#eaf6ff" : "#e6d9ae"} stroke={clean ? "#94a3b8" : "#a8997a"} />
      <path d={GRILLE} fill={url("hex")} stroke={clean ? "#e5e7eb" : "#bdb6ab"} strokeWidth={4} />
      <circle cx={160} cy={78} r={8} fill={clean ? "#e5e7eb" : "#c8c0b2"} stroke={clean ? "#94a3b8" : "#a39a8b"} />
      <path d={BUMPER} fill={url("plastic")} />
      {[58, 262].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy={140} r={12} fill={clean ? "#050506" : "#8f8a83"} />
          <circle cx={cx} cy={140} r={7} fill={clean ? "#f8fafc" : "#d8cba2"} />
        </g>
      ))}
      <rect x={108} y={128} width={104} height={22} rx={6} fill={url("hex")} />
      <rect x={128} y={155} width={64} height={6} rx={3} fill={clean ? "#cbd5e1" : "#b3ab9c"} />
      <rect y={164} width={320} height={16} fill={clean ? "#d4d4d8" : "#c8b998"} />
      {clean ? (
        <>
          <path d="M22 123 L298 123" stroke="#fff" strokeOpacity={0.25} strokeWidth={2} strokeLinecap="round" />
          <path d="M96 48 L224 48" stroke="#fff" strokeOpacity={0.6} strokeWidth={1.5} strokeLinecap="round" />
          <Twinkles
            points={[
              [40, 130, 0, 0.9],
              [196, 60, 0.6, 1],
              [286, 150, 1.2, 0.8],
              [120, 100, 1.7, 0.7],
            ]}
          />
        </>
      ) : (
        <>
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => (
            <path key={angle} d="M36 -4 L36 -12" transform={`rotate(${angle} 36 22)`} stroke="#f59e0b" strokeWidth={2.5} strokeLinecap="round" />
          ))}
          <path d="M70 18 q6 -4 12 0 t12 0 M64 30 q6 -4 12 0 t12 0" stroke="#f59e0b" strokeOpacity={0.6} strokeWidth={1.5} fill="none" />
          {CHALK.map((d) => (
            <path key={d} d={d} fill="#fafaf9" opacity={0.5} />
          ))}
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Asientos y alfombras: a seat and its floor mat. Coffee, soda, crumbs, hair and muddy shoe
// prints, then clean fabric and fresh vacuum lines on the mat.

const SEAT_CRUMBS = scatter(101, 34, [96, 118, 128, 12], [0.6, 1.4]);
const SEAT_HAIRS = cracks(102, 16, [104, 40, 112, 104], 3);
const MAT_CRUMBS = scatter(103, 18, [70, 156, 180, 20], [0.6, 1.3]);
const SOLE = "M0 0 C4 -2 9 0 9 6 C9 11 6 14 5 17 C4 20 0 20 -1 17 C-2 13 -4 5 0 0 Z M1 21 C4 20 6 22 6 25 C6 28 1 29 0 26 C-1 24 -1 22 1 21 Z";

function seat(clean: boolean, { id, url }: Ids) {
  const insert = clean ? "#3f4a5c" : "#7d7367";
  return (
    <>
      <defs>
        <linearGradient id={id("bg")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={clean ? "#334155" : "#4a463f"} />
          <stop offset="1" stopColor={clean ? "#151b26" : "#2b2824"} />
        </linearGradient>
        <linearGradient id={id("fabric")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={clean ? "#2b3444" : "#685f54"} />
          <stop offset="0.5" stopColor={clean ? "#566173" : "#91877a"} />
          <stop offset="1" stopColor={clean ? "#2b3444" : "#685f54"} />
        </linearGradient>
        <pattern id={id("stripes")} width={24} height={24} patternUnits="userSpaceOnUse" patternTransform="rotate(-25)">
          <rect width={12} height={24} fill="#fff" opacity={0.07} />
        </pattern>
      </defs>
      <rect width={320} height={180} fill={url("bg")} />
      <path d="M0 24 L44 34 L50 180 L0 180 Z" fill={clean ? "#28303d" : "#4a453f"} />
      <path d="M0 100 L46 104 L47 116 L0 114 Z" fill={clean ? "#1d2430" : "#3d3934"} />
      <path d="M282 112 L320 102 L320 180 L276 180 Z" fill={clean ? "#1f2633" : "#45403a"} />
      <path d="M146 30 L146 40 M174 30 L174 40" stroke={clean ? "#94a3b8" : "#8a8278"} strokeWidth={3} />
      <rect x={128} y={4} width={64} height={28} rx={12} fill={url("fabric")} />
      <path d="M108 46 Q110 38 122 38 L198 38 Q210 38 212 46 L222 112 Q222 122 212 122 L108 122 Q98 122 98 112 Z" fill={url("fabric")} />
      <path d="M136 48 L184 48 L190 116 L130 116 Z" fill={insert} />
      <path d="M150 48 L148 116 M160 48 L160 116 M170 48 L172 116" stroke="#000" strokeOpacity={0.18} strokeWidth={1.2} />
      <path d="M90 118 L230 118 Q244 120 242 132 L236 144 Q234 150 226 150 L94 150 Q86 150 84 144 L78 132 Q76 120 90 118 Z" fill={url("fabric")} />
      <path d="M124 122 L196 122 L200 144 L120 144 Z" fill={insert} />
      <path d="M60 154 L260 154 L290 180 L30 180 Z" fill={clean ? "#1d2330" : "#4a3f35"} />
      {clean ? (
        <>
          <path d="M60 154 L260 154 L290 180 L30 180 Z" fill={url("stripes")} />
          <g stroke="#cbd5e1" strokeOpacity={0.55} strokeDasharray="2.5 2" fill="none">
            <path d="M136 48 L184 48 L190 116 L130 116 Z" />
            <path d="M124 122 L196 122 L200 144 L120 144 Z" />
            <path d="M134 8 L186 8" />
          </g>
          <Twinkles
            points={[
              [118, 62, 0, 0.9],
              [208, 136, 0.7, 0.8],
              [196, 16, 1.2, 0.7],
              [70, 166, 1.6, 0.8],
            ]}
          />
        </>
      ) : (
        <>
          <path d="M162 128 C170 122 186 124 190 132 C194 138 184 142 176 141 C170 144 158 142 156 136 C154 132 158 130 162 128 Z" fill="#5b3a1e" opacity={0.6} />
          <circle cx={196} cy={128} r={2.2} fill="#5b3a1e" opacity={0.55} />
          <circle cx={152} cy={140} r={1.6} fill="#5b3a1e" opacity={0.55} />
          <path d="M140 74 C148 66 166 68 170 78 C174 88 162 96 150 94 C140 92 134 82 140 74 Z" fill="#2c1f17" opacity={0.35} />
          {SEAT_CRUMBS.map((dot, index) => (
            <circle key={index} cx={dot.x} cy={dot.y} r={dot.r} fill="#e2c68f" />
          ))}
          {SEAT_HAIRS.map((d, index) => (
            <path key={index} d={d} stroke={index % 2 ? "#e7e5e4" : "#a8a29e"} strokeWidth={0.7} fill="none" opacity={0.8} />
          ))}
          <path d={SOLE} transform="translate(116 155) rotate(-14) scale(0.85)" fill="#2b2118" opacity={0.6} />
          <path d={SOLE} transform="translate(196 156) rotate(10) scale(0.85)" fill="#2b2118" opacity={0.55} />
          {MAT_CRUMBS.map((dot, index) => (
            <circle key={index} cx={dot.x} cy={dot.y} r={dot.r} fill="#c9b48a" />
          ))}
          <path d="M240 160 L252 157 L254 164 L242 167 Z" fill="#e7e5e4" opacity={0.85} />
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Plásticos interiores: the dashboard up close. Faded, dusty and with a finger line drawn in
// the dust, then dark, clean and like new.

const DASH_DUST = scatter(111, 120, [0, 30, 320, 68], [0.4, 1.1]);

function dashboard(clean: boolean, { id, url }: Ids) {
  return (
    <>
      <defs>
        <linearGradient id={id("sky")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cfe8fb" />
          <stop offset="1" stopColor="#f4f9ff" />
        </linearGradient>
        <linearGradient id={id("top")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={clean ? "#4a4a52" : "#a39d95"} />
          <stop offset="1" stopColor={clean ? "#1d1d22" : "#7d7770"} />
        </linearGradient>
        <linearGradient id={id("low")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={clean ? "#2a2a30" : "#8a847d"} />
          <stop offset="1" stopColor={clean ? "#141418" : "#6c6761"} />
        </linearGradient>
      </defs>
      <rect width={320} height={40} fill={url("sky")} />
      <path d="M0 34 Q160 18 320 34 L320 100 L0 100 Z" fill={url("top")} />
      <path d="M0 100 L320 100 L320 180 L0 180 Z" fill={url("low")} />
      <path d="M0 100 L320 100" stroke="#000" strokeOpacity={0.3} strokeWidth={2} />
      <path d="M22 58 Q76 32 134 56 L132 72 L24 72 Z" fill={clean ? "#18181c" : "#8e8880"} />
      <rect x={28} y={66} width={100} height={36} rx={10} fill="#0b0d12" />
      {[56, 100].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy={84} r={13} fill="#0f1218" stroke={clean ? "#38bdf8" : "#57534e"} strokeOpacity={0.8} strokeWidth={1.5} />
          <path d={`M${cx} 84 L${cx + 8} 78`} stroke={clean ? "#ef4444" : "#7f5f5a"} strokeWidth={1.8} strokeLinecap="round" />
          <circle cx={cx} cy={84} r={1.8} fill="#6b7280" />
        </g>
      ))}
      <rect x={146} y={46} width={84} height={48} rx={6} fill="#0b1120" stroke="#2a2f3a" strokeWidth={2} />
      {clean ? (
        <>
          <rect x={149} y={49} width={78} height={42} rx={4} fill="#0f2a44" />
          <path d="M150 80 L226 64 M168 49 L180 91 M200 49 L206 91" stroke="#1e4a6e" strokeWidth={3} />
          <path d="M156 86 Q172 70 186 74 T220 58" stroke="#38bdf8" strokeWidth={2.5} fill="none" strokeLinecap="round" />
          <circle cx={220} cy={58} r={3.5} fill="#ef4444" />
          <circle cx={220} cy={58} r={1.4} fill="#fff" />
        </>
      ) : (
        <>
          <rect x={149} y={49} width={78} height={42} rx={4} fill="#34322f" />
          <ellipse cx={168} cy={64} rx={9} ry={6} fill="#fff" opacity={0.1} />
          <ellipse cx={204} cy={78} rx={8} ry={5} fill="#fff" opacity={0.1} />
          <ellipse cx={186} cy={58} rx={6} ry={4} fill="#fff" opacity={0.08} />
        </>
      )}
      <rect x={244} y={50} width={56} height={22} rx={6} fill="#0b0d12" />
      <rect x={152} y={106} width={34} height={14} rx={4} fill="#0b0d12" />
      <rect x={192} y={106} width={34} height={14} rx={4} fill="#0b0d12" />
      <g stroke={clean ? "#3f3f46" : "#b8b0a4"} strokeWidth={1.5}>
        <path d="M248 56 L296 56 M248 61 L296 61 M248 66 L296 66" />
        <path d="M155 110 L183 110 M155 115 L183 115 M195 110 L223 110 M195 115 L223 115" />
      </g>
      <rect x={180} y={128} width={18} height={18} rx={4} fill={clean ? "#1f1f24" : "#77716a"} />
      <path d="M189 131 L195 142 L183 142 Z" fill="none" stroke={clean ? "#ef4444" : "#b2817a"} strokeWidth={1.8} strokeLinejoin="round" />
      <path d="M244 116 L308 116 Q312 116 312 120 L312 160 Q312 164 308 164 L244 164 Q240 164 240 160 L240 120 Q240 116 244 116 Z" fill="none" stroke="#000" strokeOpacity={0.3} strokeWidth={1.5} />
      {clean ? (
        <>
          <path d="M0 42 Q160 26 320 42" stroke="#fff" strokeOpacity={0.14} strokeWidth={6} fill="none" />
          <path d="M26 60 Q76 38 130 58" stroke="#fff" strokeOpacity={0.12} strokeWidth={2} fill="none" />
          <Twinkles
            points={[
              [96, 44, 0, 1],
              [270, 40, 0.7, 0.9],
              [60, 130, 1.3, 0.8],
              [276, 140, 1.8, 0.8],
            ]}
          />
        </>
      ) : (
        <>
          <ellipse cx={244} cy={16} rx={80} ry={16} fill="#fff" opacity={0.75} />
          <path d="M0 34 Q160 18 320 34 L320 100 L0 100 Z" fill="#ddd2bf" opacity={0.45} />
          <path d="M22 58 Q76 32 134 56 L132 72 L24 72 Z" fill="#ddd2bf" opacity={0.45} />
          {DASH_DUST.map((dot, index) => (
            <circle key={index} cx={dot.x} cy={dot.y} r={dot.r} fill="#f3ead9" opacity={0.75} />
          ))}
          <path d="M156 40 C190 34 232 34 286 42" stroke="#5f5a53" strokeWidth={6} strokeLinecap="round" fill="none" opacity={0.9} />
          <g stroke="#5f5a53" strokeOpacity={0.7} fill="none" strokeWidth={0.8}>
            <ellipse cx={296} cy={44} rx={6} ry={4.5} />
            <ellipse cx={296} cy={44} rx={4} ry={2.8} />
            <ellipse cx={296} cy={44} rx={2} ry={1.3} />
          </g>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Cueros: a leather seat up close. Pale, dry and cracked, then rich and soft as a feather.

const LEATHER_CRACKS = cracks(121, 54, [6, 10, 308, 160], 6);
const CHANNELS = [64, 130, 196];

function leather(clean: boolean, { id, url }: Ids) {
  return (
    <>
      <defs>
        <linearGradient id={id("left")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={clean ? "#5a2309" : "#a68a68"} />
          <stop offset="1" stopColor={clean ? "#9a3f12" : "#cdb492"} />
        </linearGradient>
        <linearGradient id={id("right")} x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor={clean ? "#5a2309" : "#a68a68"} />
          <stop offset="1" stopColor={clean ? "#9a3f12" : "#cdb492"} />
        </linearGradient>
        <linearGradient id={id("channel")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={clean ? "#6b2a0c" : "#b99a76"} />
          <stop offset="0.45" stopColor={clean ? "#b4531a" : "#dcc4a3"} />
          <stop offset="0.6" stopColor={clean ? "#c2611f" : "#dcc4a3"} />
          <stop offset="1" stopColor={clean ? "#6b2a0c" : "#b99a76"} />
        </linearGradient>
      </defs>
      <rect width={320} height={180} fill={clean ? "#3f1806" : "#8f7556"} />
      <path d="M0 0 L58 0 L62 180 L0 180 Z" fill={url("left")} />
      <path d="M320 0 L262 0 L258 180 L320 180 Z" fill={url("right")} />
      {CHANNELS.map((x) => (
        <rect key={x} x={x} y={8} width={60} height={176} rx={24} fill={url("channel")} />
      ))}
      {CHANNELS.map((x) =>
        [30, 44, 58, 72, 86, 100, 114, 128, 142, 156].map((y) =>
          [16, 30, 44].map((dx) => (
            <circle key={`${x}-${y}-${dx}`} cx={x + dx} cy={y} r={1.3} fill={clean ? "#2a0e03" : "#7a6248"} opacity={0.55} />
          )),
        ),
      )}
      <g stroke={clean ? "#fcd9a0" : "#cdb898"} strokeWidth={1.2} strokeDasharray="4 3" fill="none">
        {[61, 127, 193, 259].map((x) => (
          <path key={x} d={`M${x - 4} 0 L${x - 4} 180 M${x + 4} 0 L${x + 4} 180`} />
        ))}
      </g>
      {clean ? (
        <>
          {CHANNELS.map((x) => (
            <rect key={x} x={x + 18} y={18} width={10} height={150} rx={5} fill="#fff" opacity={0.14} />
          ))}
          <g className="ba-drift">
            <g transform="translate(206 70) rotate(-30) scale(1.15)">
              <path d="M6 -1 Q12 -9 22 -11 L24 -8 Q30 -13 40 -12 L41 -9 Q50 -9 58 -2 Q34 -3 6 -1 Z" fill="#fff" />
              <path d="M6 0 Q14 7 26 8 L27 5 Q36 9 46 6 L46 3 Q53 3 58 -2 Q34 -1 6 0 Z" fill="#f1f5f9" />
              <path d="M-4 1 Q26 -2 58 -2" stroke="#cbd5e1" strokeWidth={1.2} fill="none" strokeLinecap="round" />
              <g stroke="#cbd5e1" strokeWidth={0.6}>
                {[14, 22, 30, 38, 46].map((x) => (
                  <path key={x} d={`M${x} -1.5 L${x + 6} -9 M${x} -0.5 L${x + 6} 5`} />
                ))}
              </g>
              <path d="M4 -1 Q0 -6 -2 -4 M5 0 Q1 5 -1 3" stroke="#fff" strokeWidth={0.8} fill="none" />
            </g>
          </g>
          <Twinkles
            points={[
              [100, 40, 0, 1],
              [168, 124, 0.7, 0.9],
              [36, 120, 1.3, 0.8],
              [290, 150, 1.8, 0.8],
            ]}
          />
        </>
      ) : (
        <>
          <ellipse cx={160} cy={100} rx={46} ry={30} fill="#f0e3cc" opacity={0.45} />
          <ellipse cx={94} cy={60} rx={20} ry={14} fill="#f0e3cc" opacity={0.35} />
          <g stroke="#8a6c4c" strokeOpacity={0.45} strokeWidth={1.2} fill="none">
            <path d="M70 120 Q96 112 118 122" />
            <path d="M138 70 Q162 62 184 72" />
            <path d="M204 132 Q226 124 250 134" />
          </g>
          {LEATHER_CRACKS.map((d, index) => (
            <path key={index} d={d} stroke="#6b4f33" strokeOpacity={0.6} strokeWidth={0.8} fill="none" />
          ))}
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------------------------

export const SCENES = {
  "lavado-completo": { tool: Bubbles, draw: carWash },
  "lavado-exterior": { tool: Bubbles, draw: carWash },
  "full-detailing": { tool: WandSparkles, draw: fullDetail },
  "detallado-exterior": { tool: Sparkles, draw: exteriorDetail },
  "detallado-interior": { tool: Wind, draw: cabin },
  "descontaminado-pintura": { tool: Eraser, draw: decon },
  "ceramico-rapido": { tool: SprayCan, draw: beading },
  "tratamiento-ceramico": { tool: ShieldCheck, draw: shield },
  vidrios: { tool: Droplets, draw: rainGlass },
  "rines-llantas": { tool: Brush, draw: wheel },
  faros: { tool: Sparkles, draw: headlight },
  "plasticos-exteriores": { tool: SprayCan, draw: grille },
  "asientos-suelos": { tool: BrushCleaning, draw: seat },
  "plasticos-interiores": { tool: Brush, draw: dashboard },
  cueros: { tool: Hand, draw: leather },
} satisfies Record<ExplainerId, Scene>;
