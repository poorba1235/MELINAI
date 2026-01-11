import type { StoreEvent } from "@/hooks/useTanakiSoul";
import { useEffect, useMemo, useState } from "react";

type BubbleRole = "user" | "tanaki";

type Bubble = {
  id: string;
  role: BubbleRole;
  content: string;
  durationMs: number;
  opacity: number;
  timestamp: number;
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
  maxBubbles = 5, // Reduced for better visibility
}: FloatingBubblesProps) {
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion());
  const [now, setNow] = useState(() => Date.now());

  // Handle reduced motion preference
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // Update time for fade calculations
  useEffect(() => {
    if (typeof window === "undefined") return;
    const tickMs = reducedMotion ? 500 : 100; // Faster updates for smoother fades
    const id = window.setInterval(() => setNow(Date.now()), tickMs);
    return () => window.clearInterval(id);
  }, [reducedMotion]);

  // Process events into bubbles with proper fading
  const bubbles = useMemo<Bubble[]>(() => {
    const baseDurationMs = reducedMotion ? 8000 : 12000; // Show bubbles longer
    const fadeInPct = 0.15; // Faster fade in
    const fadeOutStartPct = 0.85; // Later fade out

    // Filter relevant events
    const relevant = events.filter((e) => {
      if (e._kind === "user-added") return e.action === "said";
      if (e._kind === "perception") return !e.internal && e.action === "said";
      if (e._kind === "interactionRequest") return e.action === "says";
      return false;
    });

    // Sort by timestamp (newest first for display)
    const sorted = [...relevant].sort((a, b) => b._timestamp - a._timestamp);
    
    // Take only the newest messages
    const visible = sorted.slice(0, maxBubbles);

    return visible.map((e) => {
      const ageMs = now - e._timestamp;
      const t = clamp(ageMs / baseDurationMs, 0, 1);
      
      // Calculate opacity with smooth fading
      let fadeOpacity = 1;
      if (t < fadeInPct) {
        fadeOpacity = t / fadeInPct; // Fade in
      } else if (t > fadeOutStartPct) {
        fadeOpacity = (1 - t) / (1 - fadeOutStartPct); // Fade out
      }

      return {
        id: `${e._id}-bubble`,
        role: e._kind === "interactionRequest" ? "tanaki" : "user",
        content: e.content,
        durationMs: baseDurationMs,
        opacity: clamp(fadeOpacity, 0, 1),
        timestamp: e._timestamp,
      };
    });
  }, [events, maxBubbles, reducedMotion, now]);

  // Debug logging
  useEffect(() => {
    if (bubbles.length > 0) {
      console.log("FloatingBubbles: Showing", bubbles.length, "bubbles");
      bubbles.forEach((b, i) => {
        console.log(`Bubble ${i}:`, { 
          role: b.role, 
          content: b.content.substring(0, 50),
          opacity: b.opacity.toFixed(2)
        });
      });
    }
  }, [bubbles]);

  return (
    <div className="fixed inset-0 pointer-events-none z-30 overflow-hidden">
      {/* Background for bubbles - prevents overlap with 3D scene */}
      <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-transparent" />
      
      {/* Bubbles container */}
      <div 
        className="absolute bottom-0 left-0 right-0 flex flex-col items-center px-4 md:px-6 space-y-2"
        style={{ 
          bottom: `${avoidBottomPx + 20}px`,
          maxHeight: "60vh",
          overflow: "hidden"
        }}
      >
        {bubbles.map((bubble) => {
          const isUser = bubble.role === "user";
          
          return (
            <div
              key={bubble.id}
              className={`w-full flex ${isUser ? 'justify-end' : 'justify-start'} transition-all duration-300 ease-out`}
              style={{
                opacity: bubble.opacity,
                transform: `translateY(${bubble.opacity < 0.3 ? '10px' : '0px'})`,
              }}
            >
              {/* User bubble */}
              {isUser ? (
                <div className="flex flex-col items-end max-w-[80%] md:max-w-md">
                  <div className="flex items-center space-x-2 mb-1">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                    <span className="text-xs text-blue-300 font-medium">You</span>
                  </div>
                  <div className="bg-gradient-to-r from-blue-500/90 to-blue-600/90 text-white px-4 py-3 rounded-2xl rounded-br-none backdrop-blur-sm border border-blue-400/30 shadow-xl shadow-blue-500/10">
                    <p className="text-sm md:text-base leading-relaxed break-words">
                      {bubble.content}
                    </p>
                  </div>
                </div>
              ) : (
     
                <div className="flex flex-col items-start max-w-[80%] md:max-w-md">
                  <div className="flex items-center space-x-2 mb-1">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
                    <span className="text-xs text-purple-300 font-medium">MEILIN</span>
                  </div>
                  <div className="bg-gradient-to-r from-purple-500/90 to-purple-600/90 text-white px-4 py-3 rounded-2xl rounded-bl-none backdrop-blur-sm border border-purple-400/30 shadow-xl shadow-purple-500/10">
                    <p className="text-sm md:text-base leading-relaxed break-words">
                      {bubble.content}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        
        {/* Empty state (for debugging) */}
        {bubbles.length === 0 && (
          <div className="text-center py-4 opacity-50">
            <p className="text-xs text-gray-400">Chat messages will appear here...</p>
          </div>
        )}
      </div>
    </div>
  );
}