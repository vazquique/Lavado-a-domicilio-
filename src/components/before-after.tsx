"use client";

import { ChevronLeft, ChevronRight, MoveHorizontal } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { SceneArt, SCENES } from "@/components/explainer-scenes";
import type { ExplainerId } from "@/lib/service-explainers";

// The tool's first pass when the picture shows up, so people see they can drag it:
// how much of the picture still shows "before", in %.
const HINT = [50, 14, 86, 50];
const HINT_MS = 2600;

function hintPosition(t: number) {
  const segments = HINT.length - 1;
  const index = Math.min(Math.floor(t * segments), segments - 1);
  const local = t * segments - index;
  const eased = local < 0.5 ? 2 * local * local : 1 - (-2 * local + 2) ** 2 / 2;
  return HINT[index] + (HINT[index + 1] - HINT[index]) * eased;
}

const label = "absolute top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white";

// "Before → after" for a service: the dirty picture on the left, the clean one on the right, and
// the service's tool on the handle. Dragging the tool wipes one into the other.
export function BeforeAfter({
  explainerId,
  color,
  before,
  after,
}: {
  explainerId: ExplainerId;
  color: string;
  before: string;
  after: string;
}) {
  const scene = SCENES[explainerId];
  const Tool = scene.tool;
  const [position, setPosition] = useState(50);
  const boxRef = useRef<HTMLDivElement>(null);
  const stopHint = useRef(() => {});
  // A finger that went down on the picture: a tap jumps there, a sideways drag moves the tool and
  // anything else is left to the page (scrolling).
  const touch = useRef<{ id: number; x: number } | null>(null);

  useEffect(() => {
    const box = boxRef.current;
    if (!box || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        const start = performance.now();
        const step = (now: number) => {
          const t = Math.min((now - start) / HINT_MS, 1);
          setPosition(hintPosition(t));
          if (t < 1) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
      },
      { threshold: 0.7 },
    );
    observer.observe(box);
    const stop = () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
    stopHint.current = stop;
    return stop;
  }, []);

  function moveTo(clientX: number) {
    const box = boxRef.current;
    if (!box) return;
    const { left, width } = box.getBoundingClientRect();
    setPosition(Math.min(100, Math.max(0, ((clientX - left) / width) * 100)));
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    stopHint.current();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (event.pointerType === "mouse") moveTo(event.clientX);
    else touch.current = { id: event.pointerId, x: event.clientX };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    if (touch.current && Math.abs(event.clientX - touch.current.x) < 4) return;
    touch.current = null;
    moveTo(event.clientX);
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (touch.current?.id === event.pointerId) moveTo(event.clientX);
    touch.current = null;
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = {
      ArrowLeft: position - 5,
      ArrowDown: position - 5,
      ArrowRight: position + 5,
      ArrowUp: position + 5,
      Home: 0,
      End: 100,
    }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    stopHint.current();
    setPosition(Math.min(100, Math.max(0, target)));
  }

  const shown = Math.round(position);
  return (
    <div className="space-y-2">
      <div
        ref={boxRef}
        role="slider"
        tabIndex={0}
        aria-label="Antes y después: desliza para ver el cambio"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={shown}
        aria-valuetext={`Antes ${shown}%, después ${100 - shown}%`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (touch.current = null)}
        onKeyDown={onKeyDown}
        className="relative aspect-[16/9] w-full cursor-ew-resize touch-pan-y overflow-hidden rounded-2xl shadow-sm outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <SceneArt scene={scene} clean className="absolute inset-0 size-full" />
        <span className={`${label} right-2`}>Después</span>
        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
          <SceneArt scene={scene} clean={false} className="absolute inset-0 size-full" />
          <span className={`${label} left-2`}>Antes</span>
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-y-0" style={{ left: `${position}%` }}>
          <div className="absolute inset-y-0 -left-[1.5px] w-[3px] bg-white shadow-[0_0_6px_rgba(0,0,0,0.5)]" />
          <div className="absolute top-1/2 left-0 flex -translate-x-1/2 -translate-y-1/2 items-center">
            <ChevronLeft className="size-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]" strokeWidth={3} />
            <span
              className="flex size-11 items-center justify-center rounded-full border-[3px] bg-white shadow-lg"
              style={{ borderColor: color, color }}
            >
              <Tool className="size-5" />
            </span>
            <ChevronRight className="size-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]" strokeWidth={3} />
          </div>
        </div>
      </div>
      <div className="flex items-start justify-between gap-3 text-xs">
        <p>
          <span className="font-semibold">Antes:</span> {before}
        </p>
        <MoveHorizontal className="mt-px size-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-right">
          <span className="font-semibold">Después:</span> {after}
        </p>
      </div>
    </div>
  );
}
