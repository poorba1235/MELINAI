/** @typedef {import("@/components/TanakiAudio").TanakiAudioHandle} TanakiAudioHandle */

import { ChatInput } from "@/components/ChatInput";
import { TanakiAudio } from "@/components/TanakiAudio";
import { useTanakiSoul } from "@/hooks/useTanakiSoul";
import { base64ToUint8 } from "@/utils/base64";
import { SoulEngineProvider } from "@opensouls/react";
import { useProgress } from "@react-three/drei";
import { useCallback, useEffect, useRef, useState } from "react";
import { Tanaki3DExperience } from "./3d/Tanaki3DExperience";

/* -------------------------------------------------- */
/* Utils */
/* -------------------------------------------------- */

function readBoolEnv(value: unknown, fallback: boolean): boolean {
  if (typeof value !== "string") return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function normalizeTimestamp(ts: number) {
  // Handles seconds vs milliseconds safely
  return ts < 1e12 ? ts * 1000 : ts;
}

/* -------------------------------------------------- */
/* Client Wrapper */
/* -------------------------------------------------- */

export default function TanakiClient() {
  const organization = "local";
  const local = readBoolEnv(import.meta.env.VITE_SOUL_ENGINE_LOCAL, false);

  const getWebSocketUrl =
    typeof window === "undefined"
      ? undefined
      : (org: string, _local: boolean, debug: boolean) => {
          const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
          const channel = debug ? "debug-chat" : "experience";
          return `${wsProtocol}//${window.location.host}/ws/soul/${encodeURIComponent(
            org
          )}/${channel}`;
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

/* -------------------------------------------------- */
/* Main Experience */
/* -------------------------------------------------- */

function TanakiExperience() {
  const { connected, events, send, connectedUsers, soul } = useTanakiSoul();

  const audioRef = useRef<TanakiAudioHandle | null>(null);
  const activeTtsStreamIdRef = useRef<string | null>(null);
  const unlockedOnceRef = useRef(false);

  const [liveText, setLiveText] = useState("");
  const [mouthBlend, setMouthBlend] = useState(0);

  const [messages, setMessages] = useState<
    Array<{
      id: string;
      text: string;
      isAI: boolean;
      timestamp: number;
    }>
  >([]);

  /* -------------------------------------------------- */
  /* Audio unlock */
  /* -------------------------------------------------- */

  const unlockOnce = useCallback(() => {
    if (unlockedOnceRef.current) return;
    unlockedOnceRef.current = true;
    void audioRef.current?.unlock();
  }, []);

  /* -------------------------------------------------- */
  /* Collect AI messages (SAFE) */
  /* -------------------------------------------------- */

useEffect(() => {
  const aiEvents = events.filter(
    (e) => e._kind === "interactionRequest" && e.action === "says"
  );

  setMessages((prev) => {
    const existingIds = new Set(prev.map((m) => m.id));

    const newMessages = aiEvents
      .filter((e) => !existingIds.has(e._id))
      .map((e) => ({
        id: e._id,
        text: e.content,
        isAI: true,
        timestamp: normalizeTimestamp(e._timestamp),
      }));

    return newMessages.length > 0 ? [...prev, ...newMessages] : prev;
  });

  const latest = aiEvents.at(-1);
  if (latest) setLiveText(latest.content);
}, [events]); 


  /* -------------------------------------------------- */
  /* TTS audio stream */
  /* -------------------------------------------------- */

  useEffect(() => {
    const onChunk = (evt: any) => {
      const data = evt?.data;
      if (!data?.streamId || !data?.chunkBase64) return;

      if (activeTtsStreamIdRef.current !== data.streamId) {
        activeTtsStreamIdRef.current = data.streamId;
        audioRef.current?.interrupt();
      }

      try {
        const bytes = base64ToUint8(data.chunkBase64);
        audioRef.current?.enqueuePcm16(bytes);
      } catch (err) {
        console.error("TTS decode error", err);
      }
    };

    const onComplete = (evt: any) => {
      if (activeTtsStreamIdRef.current === evt?.data?.streamId) {
        activeTtsStreamIdRef.current = null;
      }
    };

    soul.on("ephemeral:audio-chunk", onChunk);
    soul.on("ephemeral:audio-complete", onComplete);

    return () => {
      soul.off("ephemeral:audio-chunk", onChunk);
      soul.off("ephemeral:audio-complete", onComplete);
    };
  }, [soul]);

  /* -------------------------------------------------- */
  /* Send user message */
  /* -------------------------------------------------- */

  const handleSend = async (text: string) => {
    if (!text.trim() || !connected) return;

    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        text,
        isAI: false,
        timestamp: Date.now(),
      },
    ]);

    unlockOnce();
    await send(text);
  };

  /* -------------------------------------------------- */
  /* Loader */
  /* -------------------------------------------------- */

  const { active, progress } = useProgress();

  /* -------------------------------------------------- */
  /* Render */
  /* -------------------------------------------------- */

  return (
    <div
      className="h-screen w-screen relative"
      onPointerDownCapture={unlockOnce}
      onTouchStartCapture={unlockOnce}
    >
      {/* 3D background */}
      <Tanaki3DExperience />

      {/* Audio */}
      <TanakiAudio
        ref={audioRef}
        enabled
        onVolumeChange={(v) =>
          setMouthBlend((p) => p * 0.6 + Math.min(1, v * 1.6) * 0.4)
        }
      />

      {/* UI */}
      <div className="absolute inset-0 flex flex-col bg-gradient-to-b from-transparent to-black/30">
        {/* Header */}
        <div className="p-4 flex justify-between items-center">
          <div className="bg-black/70 px-3 py-1.5 rounded-lg text-white text-sm flex gap-2 items-center">
            <div
              className={`w-2 h-2 rounded-full ${
                connected ? "bg-green-500" : "bg-red-500"
              }`}
            />
            {connected ? "Connected" : "Disconnected"}
            {connectedUsers > 0 && (
              <span className="text-xs text-gray-300">
                {connectedUsers} online
              </span>
            )}
          </div>
          <div className="bg-black/70 px-3 py-1.5 rounded-lg text-white text-sm">
            MEILIN
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4">
          <div className="max-w-2xl mx-auto space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.isAI ? "justify-start" : "justify-end"
                }`}
              >
                <div
                  className={`px-4 py-3 rounded-lg max-w-[80%] ${
                    msg.isAI
                      ? "bg-purple-700 text-white"
                      : "bg-blue-700 text-white"
                  }`}
                >
                  <div className="text-xs font-semibold mb-1">
                    {msg.isAI ? "MEILIN" : "You"}
                  </div>
                  <div className="text-sm">{msg.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Input */}
        <div className="p-4">
          <div className="max-w-2xl mx-auto">
            <div className="sr-only" aria-live="polite">
              {liveText}
            </div>
            <ChatInput
              disabled={!connected}
              onUserGesture={unlockOnce}
              onSend={handleSend}
              placeholder="Message MEILIN…"
            />
          </div>
        </div>
      </div>

      {/* Loading */}
      {active && progress < 100 && (
        <div className="absolute inset-0 bg-white flex items-center justify-center z-50">
          <div className="w-64">
            <div className="text-center mb-2">Loading…</div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
