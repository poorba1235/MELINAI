/** @typedef {import("@/components/TanakiAudio").TanakiAudioHandle} TanakiAudioHandle */

import { ChatInput } from "@/components/ChatInput";
import { TanakiAudio } from "@/components/TanakiAudio";
import { useTanakiSoul } from "@/hooks/useTanakiSoul";
import { base64ToUint8 } from "@/utils/base64";
import { SoulEngineProvider } from "@opensouls/react";
import { useProgress } from "@react-three/drei";
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
  
  const [blend, setBlend] = useState(0);
  const unlockedOnceRef = useRef(false);
  const [liveText, setLiveText] = useState("");
  
  // Simple chat messages array
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
    // Get all new AI responses
    const aiResponses = events.filter(e => 
      e._kind === "interactionRequest" && e.action === "says"
    );

    aiResponses.forEach(event => {
      if (lastSpokenIdRef.current === event._id) return;
      lastSpokenIdRef.current = event._id;
      console.log(event,event.content)
      setLiveText(event.content);
      
      // Add to messages if not already there
      setMessages(prev => {
        if (prev.some(msg => msg.id === event._id)) return prev;
        return [...prev, {
          id: event._id,
          text: event.content,
          isAI: true,
          timestamp: event._timestamp
        }];
      });
    });
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
    <div className="h-screen w-screen relative">
      {/* 3D Background - Simple */}
      <Tanaki3DExperience />
      
      {/* Audio */}
      <TanakiAudio
        ref={audioRef}
        enabled={true}
        onVolumeChange={(volume) => {
          setBlend((prev) => prev * 0.5 + volume * 0.5);
        }}
      />
      
      {/* SIMPLE CHAT UI - No animations, no z-index issues */}
      <div className="absolute inset-0 flex flex-col bg-gradient-to-b from-transparent via-transparent to-black/20">
        
        {/* Simple Status */}
        <div className="p-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 bg-black/70 text-white px-3 py-1.5 rounded-lg">
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm">
                {connected ? 'Connected' : 'Disconnected'}
              </span>
              {connectedUsers > 0 && (
                <span className="text-gray-300 text-xs ml-2">
                  {connectedUsers} online
                </span>
              )}
            </div>
            <div className="text-white text-sm bg-black/70 px-3 py-1.5 rounded-lg">
              MEILIN
            </div>
          </div>
        </div>
        
        {/* SIMPLE CHAT MESSAGES - Just show them */}
        <div className="flex-1 overflow-y-auto px-4">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-300">
              <div className="text-center">
                <div className="text-lg mb-2">Start chatting</div>
                <div className="text-sm">Type a message below</div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 max-w-2xl mx-auto">
              {messages.slice(-20).map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.isAI ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`max-w-[80%] px-4 py-3 rounded-lg ${
                      msg.isAI
                        ? 'bg-purple-700 text-white'
                        : 'bg-blue-700 text-white'
                    }`}
                  >
                    <div className="font-semibold text-xs mb-1">
                      {msg.isAI ? 'MEILIN' : 'You'}
                    </div>
                    <div className="text-sm">{msg.text}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* SIMPLE INPUT - No complex overlay */}
        <div className="p-4">
          <div className="max-w-2xl mx-auto">
            <div className="sr-only" aria-live="polite">
              {liveText}
            </div>
            <ChatInput
              disabled={!connected}
              onUserGesture={unlockOnce}
              onSend={handleSend}
              placeholder="Message MEILIN..."
            />
          </div>
        </div>
      </div>
      
      {/* Simple Loading */}
      {active && progress < 100 && (
        <div className="absolute inset-0 bg-white flex items-center justify-center z-50">
          <div className="text-center">
            <div className="text-lg mb-4">Loading...</div>
            <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}