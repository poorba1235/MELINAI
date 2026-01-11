/** @typedef {import("@/components/TanakiAudio").TanakiAudioHandle} TanakiAudioHandle */

import loadingAnimation from "@/../public/loading.json";
import { ChatInput } from "@/components/ChatInput";
import { TanakiAudio } from "@/components/TanakiAudio";
import { useTanakiSoul } from "@/hooks/useTanakiSoul";
import { base64ToUint8 } from "@/utils/base64";
import { SoulEngineProvider } from "@opensouls/react";
import { useProgress } from "@react-three/drei";
import Lottie from "lottie-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
  
  const [blend, setBlend] = useState(0);
  const unlockedOnceRef = useRef(false);
  const [liveText, setLiveText] = useState("");
  
  // Simple chat state
  const [messages, setMessages] = useState<Array<{
    id: string;
    text: string;
    isAI: boolean;
    timestamp: number;
  }>>([]);

  const unlockOnce = useCallback(() => {
    if (unlockedOnceRef.current) return;
    unlockedOnceRef.current = true;
    void audioRef.current?.unlock();
  }, []);

  // When AI responds, add to messages
  useEffect(() => {
    const aiResponse = events
      .filter(e => e._kind === "interactionRequest" && e.action === "says")
      .find(e => lastSpokenIdRef.current !== e._id);

    if (aiResponse) {
      lastSpokenIdRef.current = aiResponse._id;
      setLiveText(aiResponse.content);
      
      setMessages(prev => {
        if (prev.some(msg => msg.id === aiResponse._id)) return prev;
        return [...prev, {
          id: aiResponse._id,
          text: aiResponse.content,
          isAI: true,
          timestamp: aiResponse._timestamp
        }];
      });
    }
  }, [events]);

  // Listen for audio TTS
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

  const handleSend = async (text: string) => {
    if (!text.trim() || !connected) return;
    
    // Add user message immediately
    const userMessage = {
      id: `user_${Date.now()}`,
      text: text,
      isAI: false,
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    unlockOnce();
    await send(text);
  };

  const { active, progress } = useProgress();

  return (
    <div className="h-screen w-screen relative overflow-hidden">
      {/* Loading */}
      {active && progress < 100 && (
        <ModelLoadingOverlay active={active} progress={progress} />
      )}
      
      {/* 3D Background */}
      <Tanaki3DExperience />
      
      {/* Audio */}
      <TanakiAudio
        ref={audioRef}
        enabled={true}
        onVolumeChange={(volume) => {
          setBlend((prev) => prev * 0.5 + volume * 0.5);
        }}
      />
      
      {/* Main UI */}
      <div className="absolute inset-0 z-10 flex flex-col p-4">
        
        {/* Status */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-lg">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-white text-sm">
              {connected ? 'Connected' : 'Disconnected'}
            </span>
            {connectedUsers > 0 && (
              <span className="text-gray-300 text-xs ml-2">
                {connectedUsers} online
              </span>
            )}
          </div>
          <div className="text-white text-sm bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-lg">
            tanaki
          </div>
        </div>
        
        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto mb-4">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="text-lg mb-2">Start chatting</div>
                <div className="text-sm">Type a message below</div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 max-w-2xl mx-auto w-full">
              {messages.slice(-10).map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.isAI ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                      msg.isAI
                        ? 'bg-purple-600/90 text-white rounded-bl-sm'
                        : 'bg-blue-600/90 text-white rounded-br-sm'
                    } backdrop-blur-sm border ${
                      msg.isAI ? 'border-purple-400/30' : 'border-blue-400/30'
                    }`}
                  >
                    <div className="font-semibold text-xs mb-1 opacity-80">
                      {msg.isAI ? 'Tanaki' : 'You'}
                    </div>
                    <div className="text-sm md:text-base">{msg.text}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Chat Input */}
        <div className="bg-black/40 backdrop-blur-md rounded-2xl p-4 border border-white/10">
          <div className="max-w-2xl mx-auto">
            <div className="sr-only" aria-live="polite">
              {liveText}
            </div>
            <ChatInput
              disabled={!connected}
              onUserGesture={unlockOnce}
              onSend={handleSend}
              placeholder="Message Tanaki..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ModelLoadingOverlay({ active, progress }: { active: boolean; progress: number }) {
  const [simulatedProgress, setSimulatedProgress] = useState(0);
  const simulationRef = useRef<any>(null);

  useEffect(() => {
    if (!active) {
      setSimulatedProgress(0);
      if (simulationRef.current) {
        clearInterval(simulationRef.current);
      }
      return;
    }

    simulationRef.current = setInterval(() => {
      setSimulatedProgress((prev) => {
        const remaining = 90 - prev;
        return remaining <= 0 ? prev : prev + remaining * 0.08;
      });
    }, 100);

    return () => {
      if (simulationRef.current) {
        clearInterval(simulationRef.current);
      }
    };
  }, [active]);

  const pct = Math.max(0, Math.min(100, Math.round(simulatedProgress)));

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white">
      <Lottie 
        animationData={loadingAnimation} 
        className="w-64 h-64 sm:w-80 sm:h-80" 
      />
      <div className="w-64 sm:w-80 mt-4">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Loading model...</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}