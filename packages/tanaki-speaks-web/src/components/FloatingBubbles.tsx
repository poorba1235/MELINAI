import { useEffect, useMemo, useState, type CSSProperties } from "react";

import type { StoreEvent } from "@/hooks/useTanakiSoul";

type BubbleRole = "user" | "tanaki";

type Bubble = {
  id: string;
  role: BubbleRole;
  content: string;
  durationMs: number;
  opacity: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

export type FloatingBubblesProps = {
  events: StoreEvent[];
  avoidBottomPx: number;
  maxBubbles?: number;
};

export function FloatingBubbles({
  events,
  avoidBottomPx,
  maxBubbles = 14,
}: FloatingBubblesProps) {
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const tickMs = reducedMotion ? 500 : 200;
    const id = window.setInterval(() => setNow(Date.now()), tickMs);
    return () => window.clearInterval(id);
  }, [reducedMotion]);

  const bubbles = useMemo<Bubble[]>(() => {
    const baseDurationMs = reducedMotion ? 4200 : 14000;
    const fadeInPct = 0.08;
    const fadeOutStartPct = 0.92;

    const relevant = events.filter((e) => {
      if (e._kind === "perception") return !e.internal && e.action === "said";
      if (e._kind === "interactionRequest") return e.action === "says";
      return false;
    });

    const fresh = relevant.filter((e) => now - e._timestamp >= 0 && now - e._timestamp < baseDurationMs);
    const visible = fresh.slice(-maxBubbles);

    return visible.map((e) => {
      const ageMs = now - e._timestamp;
      const t = clamp(ageMs / baseDurationMs, 0, 1);
      const fadeOpacity =
        t < fadeInPct
          ? t / fadeInPct
          : t < fadeOutStartPct
            ? 1
            : (1 - t) / (1 - fadeOutStartPct);

      return {
        id: `${e._id}-bubble`,
        role: e._kind === "interactionRequest" ? "tanaki" : "user",
        content: e.content,
        durationMs: baseDurationMs,
        opacity: clamp(fadeOpacity, 0, 1),
      };
    });
  }, [events, maxBubbles, reducedMotion, now]);

  return (
    <div
      className="tanaki-bubble-layer"
      aria-hidden="true"
      style={
        {
          // Reserve room for the bottom input overlay so bubbles stack above it.
          ["--tanaki-bubble-avoid-bottom" as any]: `${Math.max(0, avoidBottomPx)}px`,
        } as CSSProperties
      }
    >
      <div className="tanaki-bubble-stack">
        {bubbles.map((b, i) => {
          const isUser = b.role === "user";
          // Slightly dim older bubbles so the stack reads like a timeline.
          const indexOpacity = clamp(1 - (bubbles.length - 1 - i) * 0.08, 0.35, 1);
          return (
            <div
              key={b.id}
              className={[
                "tanaki-bubble-item",
                isUser ? "tanaki-bubble-item--user" : "tanaki-bubble-item--tanaki",
                reducedMotion ? "tanaki-bubble-item--reduced-motion" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={
                {
                  // We derive fade/age directly from timestamps, so don't rely on CSS animation state.
                  animation: "none",
                  opacity: b.opacity,
                  filter: `opacity(${indexOpacity})`,
                } as CSSProperties
              }
            >
              <div className="tanaki-bubble">{b.content}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


