import { useRef, useState, useEffect, useCallback } from "react";
import { SoulEngineProvider } from "@opensouls/react";
import { TanakiAudio } from "@/components/TanakiAudio";
import { ChatInput } from "@/components/ChatInput";
import { useTanakiSoul } from "@/hooks/useTanakiSoul";
import { Tanaki3DExperience } from "./3d/Tanaki3DExperience";
import { base64ToUint8 } from "@/utils/base64";
import Lottie from "lottie-react";
import loadingAnimation from "@/../public/loading.json";
import { useProgress } from "@react-three/drei";
import { VisuallyHidden } from "@radix-ui/themes";

// Icons
import { Home, Menu, Cpu, Users, Zap, Settings } from "lucide-react";

export default function TanakiClient() {
  const organization = "local";
  const local = false; // set to true if local dev

  const getWebSocketUrl =
    typeof window === "undefined"
      ? undefined
      : (org: string, _local: boolean, debug: boolean) => {
          const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
          const channel = debug ? "debug-chat" : "experience";
          return `${wsProtocol}//${window.location.host}/ws/soul/${encodeURIComponent(org)}/${channel}`;
        };

  return (
    <SoulEngineProvider organization={organization} local={local} getWebSocketUrl={getWebSocketUrl}>
      <TanakiExperience />
    </SoulEngineProvider>
  );
}

function TanakiExperience() {
  const { connected, events, send, connectedUsers, soul } = useTanakiSoul();
  const audioRef = useRef<any>(null);
  const lastSpokenIdRef = useRef<string | null>(null);
  const activeTtsStreamIdRef = useRef<string | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const [liveText, setLiveText] = useState("");
  const [userMessages, setUserMessages] = useState<{ id: string; text: string; timestamp: Date }[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const unlockOnce = useCallback(() => {
    void audioRef.current?.unlock();
  }, []);

  // Update live text from AI events
  useEffect(() => {
    const latest = [...events].reverse().find((e) => e._kind === "interactionRequest" && e.action === "says");
    if (!latest || lastSpokenIdRef.current === latest._id) return;
    lastSpokenIdRef.current = latest._id;
    setLiveText(latest.content);
  }, [events]);

  // Handle ephemeral audio
  useEffect(() => {
    const onChunk = (evt: any) => {
      const data = evt?.data;
      if (!data?.chunkBase64 || !data.streamId) return;

      if (activeTtsStreamIdRef.current !== data.streamId) {
        activeTtsStreamIdRef.current = data.streamId;
        audioRef.current?.interrupt();
      }

      try {
        const bytes = base64ToUint8(data.chunkBase64);
        audioRef.current?.enqueuePcm16(bytes);
      } catch (err) {
        console.error(err);
      }
    };
    const onComplete = (evt: any) => {
      if (evt?.data?.streamId === activeTtsStreamIdRef.current) {
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

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || !connected) return;
    setUserMessages((prev) => [...prev, { id: `user_${Date.now()}`, text, timestamp: new Date() }]);
    unlockOnce();
    await send(text);
  };

  const toggleMute = () => setIsMuted((prev) => !prev);

  const { active, progress } = useProgress();

  return (
    <div style={{ height: "100dvh", width: "100%", position: "relative" }}>
      {/* 3D Loading */}
      <ModelLoadingOverlay active={active} progress={progress} />

      {/* 3D Experience */}
      <Tanaki3DExperience message={liveText ? { content: liveText, animation: "Action" } : null} />

      {/* Audio */}
      <TanakiAudio
        ref={audioRef}
        enabled={!isMuted}
      />

      {/* UI Overlay */}
      <div className="fixed top-0 left-0 w-full h-full z-10 flex flex-col justify-between p-6">
        {/* Top nav / info */}
        <div style={{ display: "flex", justifyContent: "end", marginTop: 25, marginRight: 20 }}>
          <div className="flex items-center gap-3 py-2 px-4 rounded-2xl bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/30 shadow-lg">
            <span className="text-cyan-200/80 text-xs font-medium">{connectedUsers} users online</span>
            <span className="text-cyan-200/80 text-xs font-medium">{connected ? "🟢 Connected" : "🔴 Disconnected"}</span>
          </div>
        </div>

        {/* Chat */}
        <div
          ref={overlayRef}
          className="w-full md:w-[480px] h-[55vh] md:h-[75vh] flex flex-col p-5 rounded-3xl shadow-2xl border border-cyan-500/20 pointer-events-auto fixed bottom-0 left-0 md:relative md:bottom-auto md:left-auto mobile-chat"
        >
          <div className="flex-1 overflow-y-auto p-4 rounded-2xl bg-black/10 border border-cyan-500/10 shadow-inner mt-3">
            {[...userMessages, ...events.map(e => ({ id: e._id, text: e.content, isAI: true, timestamp: new Date() }))].sort(
              (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
            ).slice(-10).map(msg => (
              <div key={msg.id} className={`mb-3 p-3 rounded-xl ${msg.isAI ? "bg-purple-500/10" : "bg-cyan-500/10"}`}>
                <strong>{msg.isAI ? "MEILIN" : "YOU"}</strong>
                <div>{msg.text}</div>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <ChatInput
              disabled={!connected}
              onUserGesture={unlockOnce}
              isRecording={isRecording}
              onVoiceClick={() => setIsRecording(!isRecording)}
              onSend={handleSendMessage}
              placeholder="Type your message..."
            />
          </div>
        </div>

        {/* Mute button */}
        <button onClick={toggleMute} className="fixed bottom-6 right-6 z-20 p-3 rounded-2xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-300 hover:text-cyan-100 transition-all duration-300 shadow-lg">
          {isMuted ? "🔇" : "🔊"}
        </button>

        <VisuallyHidden>
          <div aria-live="polite" aria-atomic="true">{liveText}</div>
        </VisuallyHidden>
      </div>
    </div>
  );
}

interface ModelLoadingOverlayProps {
  active: boolean;
  progress: number;
}

function ModelLoadingOverlay({ active, progress }: ModelLoadingOverlayProps) {
  const [simulatedProgress, setSimulatedProgress] = useState(0);

  useEffect(() => {
    if (!active) {
      setSimulatedProgress(0);
      return;
    }
    const interval = setInterval(() => {
      setSimulatedProgress((prev) => Math.min(90, prev + (90 - prev) * 0.08));
    }, 100);
    return () => clearInterval(interval);
  }, [active]);

  if (!active || progress >= 100) return null;

  const pct = Math.round(simulatedProgress);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-white z-[1000] text-center">
      <Lottie animationData={loadingAnimation} className="w-[300px] h-[300px]" />
      <div className="w-full max-w-md mt-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-700">Loading 3D model…</span>
          <span className="text-gray-700">{pct}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-cyan-500 to-purple-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
