/** @typedef {import("@/components/TanakiAudio").TanakiAudioHandle} TanakiAudioHandle */

import loadingAnimation from "@/../public/loading.json";
import { ChatInput } from "@/components/ChatInput";
import { FloatingBubbles } from "@/components/FloatingBubbles";
import { TanakiAudio } from "@/components/TanakiAudio";
import { useTanakiSoul } from "@/hooks/useTanakiSoul";
import { base64ToUint8 } from "@/utils/base64";
import { SoulEngineProvider } from "@opensouls/react";
import { Box, Flex, Text, VisuallyHidden } from "@radix-ui/themes";
import { useProgress } from "@react-three/drei";
import Lottie from "lottie-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Tanaki3DExperience } from "./3d/Tanaki3DExperience";

function readBoolEnv(value: unknown, fallback: boolean): boolean {
  if (typeof value !== "string") return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

export default function TanakiClient() {
  const organization = "local";
  const local = readBoolEnv(import.meta.env.VITE_SOUL_ENGINE_LOCAL, false);

  const getWebSocketUrl =
    typeof window === "undefined"
      ? undefined
      : (org: string, _local: boolean, debug: boolean) => {
          const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
          const channel = debug ? "debug-chat" : "experience";
          return `${wsProtocol}//${window.location.host}/ws/soul/${encodeURIComponent(org)}/${channel}`;
        };

  return (
    <SoulEngineProvider
      organization={organization}
      local={local}
      getWebSocketUrl={getWebSocketUrl}
    >
      <TanakiExperience />
    </SoulEngineProvider>
  );
}

function TanakiExperience() {
  const { connected, events, send, connectedUsers, soul } = useTanakiSoul();
  const audioRef = useRef<TanakiAudioHandle | null>(null);
  const lastSpokenIdRef = useRef<string | null>(null);
  const activeTtsStreamIdRef = useRef<string | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [blend, setBlend] = useState(0);
  const unlockedOnceRef = useRef(false);
  const [overlayHeight, setOverlayHeight] = useState(240);
  const [liveText, setLiveText] = useState("");
  const [allMessages, setAllMessages] = useState([]); // Combined messages state

  const enableAnimationDebug = useMemo(() => {
    if (import.meta.env.DEV) return true;
    if (typeof window === "undefined") return false;
    const qs = new URLSearchParams(window.location.search);
    return qs.has("debugAnimations");
  }, []);

  const unlockOnce = useCallback(() => {
    if (unlockedOnceRef.current) return;
    unlockedOnceRef.current = true;
    void audioRef.current?.unlock();
  }, []);

  const statusIndicator = useMemo(() => {
    return connected ? "🟢" : "🔴";
  }, [connected]);

  // When Tanaki says something new, update aria-live text
  useEffect(() => {
    const latest = [...events]
      .reverse()
      .find((e) => e._kind === "interactionRequest" && e.action === "says");
    if (!latest) return;
    if (lastSpokenIdRef.current === latest._id) return;
    lastSpokenIdRef.current = latest._id;
    setLiveText(latest.content);
  }, [events.length, events[events.length - 1]?.content]);

  // Combine events with user messages
  useEffect(() => {
    // Filter out AI responses from events
    const aiMessages = events.filter(e => 
      e._kind === "interactionRequest" && e.action === "says"
    );
    
    // Combine with existing messages (keeping user messages)
    setAllMessages(prev => {
      // Keep user messages from prev
      const existingUserMessages = prev.filter(msg => 
        msg._kind === "user-added" || 
        (msg._kind === "perception" && msg.action === "said" && !msg.internal)
      );
      
      // Add new AI messages
      const newAiMessages = aiMessages.filter(aiMsg => 
        !prev.some(p => p._id === aiMsg._id)
      );
      
      return [...existingUserMessages, ...newAiMessages];
    });
  }, [events]);

  // Listen for Soul Engine ephemeral audio events
  useEffect(() => {
    const onChunk = (evt: any) => {
      const data = evt?.data as any;
      if (!data || typeof data !== "object") return;

      const streamId = typeof data.streamId === "string" ? data.streamId : null;
      const chunkBase64 = typeof data.chunkBase64 === "string" ? data.chunkBase64 : null;
      if (!streamId || !chunkBase64) return;

      if (activeTtsStreamIdRef.current !== streamId) {
        activeTtsStreamIdRef.current = streamId;
        audioRef.current?.interrupt();
      }

      try {
        const bytes = base64ToUint8(chunkBase64);
        audioRef.current?.enqueuePcm16(bytes);
      } catch (err) {
        console.error("Failed to decode/enqueue TTS chunk:", err);
      }
    };

    const onComplete = (evt: any) => {
      const data = evt?.data as any;
      const streamId = typeof data?.streamId === "string" ? data.streamId : null;
      if (!streamId) return;
      if (activeTtsStreamIdRef.current === streamId) {
        activeTtsStreamIdRef.current = null;
      }
    };

    const onError = (evt: any) => {
      const data = evt?.data as any;
      const message = typeof data?.message === "string" ? data.message : "unknown error";
      console.error("TTS error event:", message, evt);
    };

    soul.on("ephemeral:audio-chunk", onChunk);
    soul.on("ephemeral:audio-complete", onComplete);
    soul.on("ephemeral:audio-error", onError);
    return () => {
      soul.off("ephemeral:audio-chunk", onChunk);
      soul.off("ephemeral:audio-complete", onComplete);
      soul.off("ephemeral:audio-error", onError);
    };
  }, [soul]);

  // Measure the bottom overlay so bubbles can avoid it
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setOverlayHeight(Math.max(120, Math.round(rect.height + 10)));
    };

    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const handleSend = async (text) => {
    if (!text.trim() || !connected) return;
    
    // Add user message immediately to allMessages
    const userMessage = {
      _id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      _kind: "user-added", // Custom type
      action: "said",
      content: text,
      internal: false,
      _timestamp: Date.now()
    };
    
    setAllMessages(prev => [...prev, userMessage]);
    
    unlockOnce();
    await send(text);
  };

  return (
    <div
      style={{ height: "100dvh", width: "100%", position: "relative" }}
      onPointerDownCapture={() => {
        unlockOnce();
      }}
      onTouchStartCapture={() => {
        unlockOnce();
      }}
    >
      <ModelLoadingOverlay />
      <Tanaki3DExperience/>

      <TanakiAudio
        ref={audioRef}
        enabled={true}
        onVolumeChange={(volume) => {
          setBlend((prev) => prev * 0.5 + volume * 0.5);
        }}
      />

      {/* Use combined messages instead of just events */}
      <FloatingBubbles events={allMessages} avoidBottomPx={overlayHeight} maxBubbles={5} />

      <Box
        ref={overlayRef}
        className="absolute left-4 right-4 bottom-4 max-w-2xl mx-auto"
        style={{
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(10px)",
          borderRadius: 12,
          padding: 12,
        }}
      >
        <Flex justify="between" align="center" className="mb-2" gap="3">
          <Flex align="center" gap="2">
            <Text size="2">
              {statusIndicator}
            </Text>
            {connectedUsers > 0 && (
              <Text size="1" color="gray" style={{ opacity: 0.7 }}>
                {connectedUsers} {connectedUsers === 1 ? "person" : "people"} here
              </Text>
            )}
          </Flex>
          <Text size="2" color="gray">
            tanaki
          </Text>
        </Flex>

        <VisuallyHidden>
          <div aria-live="polite" aria-atomic="true">
            {liveText}
          </div>
        </VisuallyHidden>

        <Box className="mt-3">
          <ChatInput
            disabled={!connected}
            onUserGesture={unlockOnce}
            onSend={handleSend}  
          />
        </Box>
      </Box>
    </div>
  );
}

function ModelLoadingOverlay() {
  const { active, progress, item, total } = useProgress();
  const [simulatedProgress, setSimulatedProgress] = useState(0);
  const simulationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasRealProgress = total > 0;

  useEffect(() => {
    if (!active) {
      setSimulatedProgress(0);
      if (simulationRef.current) {
        clearInterval(simulationRef.current);
        simulationRef.current = null;
      }
      return;
    }

    if (hasRealProgress) {
      if (simulationRef.current) {
        clearInterval(simulationRef.current);
        simulationRef.current = null;
      }
      return;
    }

    simulationRef.current = setInterval(() => {
      setSimulatedProgress((prev) => {
        const remaining = 90 - prev;
        if (remaining <= 0) return prev;
        return prev + remaining * 0.08;
      });
    }, 100);

    return () => {
      if (simulationRef.current) {
        clearInterval(simulationRef.current);
        simulationRef.current = null;
      }
    };
  }, [active, hasRealProgress]);

  if (!active || progress >= 100) return null;

  const pct = hasRealProgress
    ? Math.max(0, Math.min(100, Math.round(progress)))
    : Math.max(0, Math.min(100, Math.round(simulatedProgress)));

  const label =
    typeof item === "string" && item.length > 0
      ? `Loading ${item.split("/").slice(-1)[0]}…`
      : "Loading 3D model…";

  return (
    <div
      aria-live="polite"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <Box
        style={{
          width: "min(520px, 92vw)",
          background: "rgba(0,0,0,0.72)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 14,
          padding: 16,
          backdropFilter: "blur(10px)",
        }}
      >
        <Flex justify="between" align="center" gap="3">
          <Text size="2" color="gray">
            {label}
          </Text>
          <Text size="2" color="gray">
            {pct}%
          </Text>
        </Flex>

        <div
          style={{
            height: 10,
            borderRadius: 999,
            marginTop: 10,
            background: "rgba(255,255,255,0.10)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: "rgba(34,197,94,0.9)",
              transition: "width 120ms linear",
            }}
          />
        </div>
      </Box>
    </div>
  );
}