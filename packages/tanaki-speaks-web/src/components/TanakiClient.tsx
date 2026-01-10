/** @typedef {import("@/components/TanakiAudio").TanakiAudioHandle} TanakiAudioHandle */

import loadingAnimation from "@/../public/loading.json";
import { ChatInput } from "@/components/ChatInput";
import { TanakiAudio } from "@/components/TanakiAudio";
import { useTanakiSoul } from "@/hooks/useTanakiSoul";
import { base64ToUint8 } from "@/utils/base64";
import { SoulEngineProvider } from "@opensouls/react";
import { VisuallyHidden } from "@radix-ui/themes";
import { useProgress } from "@react-three/drei";
import Lottie from "lottie-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Tanaki3DExperience } from "./3d/Tanaki3DExperience";

// Import icons
import { Cpu, Home, Menu, Settings, Sparkles, Users, Zap } from "lucide-react";

// Type definitions
interface Message {
  id: string; // ADDED: Unique ID for each message
  text: string;
  user: {
    id: string;
    name: string;
  };
  timestamp: Date;
  isPending?: boolean; // ADDED: For thinking/loading state
}

interface SoulEvent {
  _id: string;
  _kind: string;
  action: string;
  content: string;
}

interface AvatarMessage {
  content: string;
  animation: string;
}

interface MenuItem {
  icon: React.ComponentType<{ size: number; className?: string }>;
  label: string;
  active?: boolean;
}

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

/* -------------------------------------------------- */
/* Main Experience */
/* -------------------------------------------------- */

function TanakiExperience() {
  const { connected, events, send, soul, connectedUsers } = useTanakiSoul();

  // Audio handling
  const audioRef = useRef<TanakiAudioHandle | null>(null);
  const unlockedOnceRef = useRef(false);
  const lastSpokenIdRef = useRef<string | null>(null);
  const activeTtsStreamIdRef = useRef<string | null>(null);
  const pendingResponseRef = useRef<Message | null>(null); // Track pending AI response
  
  // UI state
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [liveText, setLiveText] = useState("");
  const [currentMessage, setCurrentMessage] = useState<AvatarMessage | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(0);
  const [overlayHeight, setOverlayHeight] = useState(220);
  const [isThinking, setIsThinking] = useState(false); // Track thinking state

  const USER_ID = useMemo(() => "user_" + Math.random().toString(36).substr(2, 9), []);

  const unlockOnce = useCallback(() => {
    if (unlockedOnceRef.current) return;
    unlockedOnceRef.current = true;
    void audioRef.current?.unlock();
  }, []);

  // Extract message from events - COMPLETELY REWORKED
  useEffect(() => {
    // Log events for debugging
    if (events.length > 0) {
      console.log("All events:", events);
      console.log("Latest event:", events[events.length - 1]);
    }

    // Look for different types of events
    const latestSays = [...events]
      .reverse()
      .find((e: any) => {
        // Check multiple possible formats
        return (
          (e._kind === "interactionRequest" && e.action === "says") ||
          (e._kind === "says") ||
          (e.action === "says")
        );
      });

    if (!latestSays) {
      // Check if there are thinking events
      const thinkingEvent = events.find((e: any) => 
        e._kind === "thinking" || e.content?.toLowerCase().includes("thinking")
      );
      if (thinkingEvent) {
        setIsThinking(true);
      }
      return;
    }

    // If we already processed this response, skip
    if (lastSpokenIdRef.current === latestSays._id) return;

    lastSpokenIdRef.current = latestSays._id;
    const responseContent = latestSays.content || latestSays.text || "";
    
    if (!responseContent.trim()) {
      console.warn("Empty response content:", latestSays);
      return;
    }

    setLiveText(responseContent);
    setIsThinking(false); // Stop thinking when response arrives
    
    // Remove pending response if exists
    setMessages(prev => {
      // Filter out any pending AI messages
      const filtered = prev.filter(msg => !msg.isPending);
      
      // Add the actual AI response
      return [...filtered, {
        id: `ai_${Date.now()}`,
        text: responseContent,
        user: { id: "MEILIN_AI", name: "MEILIN" },
        timestamp: new Date()
      }];
    });
    
    // Create message object for avatar
    const newMessage: AvatarMessage = {
      content: responseContent,
      animation: "Action",
    };
    
    setCurrentMessage(newMessage);
    pendingResponseRef.current = null;
    
  }, [events]);

  // TTS audio stream handling
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
        setCurrentMessage(null);
      }
    };

    const onError = (evt: any) => {
      const data = evt?.data as any;
      const message = typeof data?.message === "string" ? data.message : "unknown error";
      console.error("TTS error event:", message, evt);
      setError("Audio playback failed. Please try again.");
      
      // Remove pending response on error
      if (pendingResponseRef.current) {
        setMessages(prev => prev.filter(msg => msg.id !== pendingResponseRef.current?.id));
        pendingResponseRef.current = null;
      }
      setIsThinking(false);
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

  // Overlay height for bubbles
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

  const handleMessagePlayed = () => {
    setCurrentMessage(null);
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || !connected) return;
    
    try {
      setError("");
      unlockOnce();
      
      // Add user message to chat
      const userMessage: Message = {
        id: `user_${Date.now()}`,
        text: text,
        user: { id: USER_ID, name: "YOU" },
        timestamp: new Date()
      };
      
      // Add AI pending/thinking message
      const pendingMessage: Message = {
        id: `pending_${Date.now()}`,
        text: "Thinking...",
        user: { id: "MEILIN_AI", name: "MEILIN" },
        timestamp: new Date(),
        isPending: true
      };
      
      pendingResponseRef.current = pendingMessage;
      setIsThinking(true);
      
      setMessages(prev => [...prev, userMessage, pendingMessage]);
      
      // Send to AI
      await send(text);
      
      // Set timeout to clear pending message if no response
      setTimeout(() => {
        if (pendingResponseRef.current) {
          setMessages(prev => prev.filter(msg => msg.id !== pendingResponseRef.current?.id));
          pendingResponseRef.current = null;
          setIsThinking(false);
          setError("No response received. Please try again.");
        }
      }, 30000); // 30 second timeout
      
    } catch (err) {
      console.error("Failed to send message:", err);
      setError("Failed to send message. Please try again.");
      
      // Remove pending message on error
      if (pendingResponseRef.current) {
        setMessages(prev => prev.filter(msg => msg.id !== pendingResponseRef.current?.id));
        pendingResponseRef.current = null;
      }
      setIsThinking(false);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  // 3D Model Loading Overlay
  const { active, progress } = useProgress();

  const menuItems: MenuItem[] = [
    { icon: Home, label: "Dashboard", active: true },
    { icon: Users, label: "Community" },
    { icon: Cpu, label: "Models" },
    { icon: Zap, label: "Features" },
    { icon: Settings, label: "Settings" }
  ];

  const mobileMenuItems = ["Dashboard", "Community", "Models", "Features", "Settings"];

  return (
    <div
      style={{ height: "100dvh", width: "100%", position: "relative" }}
      onPointerDownCapture={unlockOnce}
      onTouchStartCapture={unlockOnce}
    >
      {/* 3D Model Loading Overlay */}
      <ModelLoadingOverlay active={active} progress={progress} />

      {/* 3D Experience - Full Screen Background */}
      <Tanaki3DExperience
        message={currentMessage}
        onMessagePlayed={handleMessagePlayed}
        chat={() => console.log("Chat triggered")}
      />
      
      {/* 🔊 Audio Component */}
      <TanakiAudio
        ref={audioRef}
        enabled={!isMuted}
        onVolumeChange={(volume: number) => {
          const v = Math.min(1, volume * 1.6);
          setMouthOpen((p) => p * 0.6 + v * 0.4);
        }}
      />

      {/* UI Overlay */}
      <div
        className="fixed top-0 left-0 w-full h-full z-10 flex flex-col justify-between p-6"
        style={{ pointerEvents: "none" as const }}
      >
        <div>
          <nav
            className="flex flex-row md:flex-row gap-4 px-5 py-3 items-center justify-between md:items-start pointer-events-auto rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-gray-900/10 to-cyan-900/10 shadow-2xl"
            style={{ pointerEvents: "auto" as const }}
          >
            {/* ... navigation remains same ... */}
          </nav>

          <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'end', marginTop: '25px', marginRight: "20px" }}>
            <div className="flex items-center gap-3 py-2 px-4 rounded-2xl bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/30 shadow-lg">
              <div className="flex items-center gap-2">
                <span className="text-cyan-300 font-bold text-sm tracking-wider">LIVE CHAT</span>
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse delay-150"></div>
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse delay-300"></div>
                </div>
              </div>
              <div className="w-px h-4 bg-cyan-500/40"></div>
              <span className="text-cyan-200/80 text-xs font-medium">Users Online: {connectedUsers}</span>
            </div>
          </div>
        </div>

        {/* Chat Interface */}
        <div
          ref={overlayRef}
          className="w-full md:w-[480px] h-[55vh] md:h-[75vh] flex flex-col bg-gradient-to-br from-gray-900/10 to-cyan-900/10 p-5 rounded-3xl shadow-2xl border border-cyan-500/20 pointer-events-auto fixed bottom-0 left-0 md:relative md:bottom-auto md:left-auto mobile-chat"
          style={{ pointerEvents: "auto" as const }}
        >
          <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20 shadow-inner">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse"></div>
              <span className="text-cyan-300 font-bold text-lg tracking-wide" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                NEURAL_CHAT
              </span>
            </div>
            <div className="flex items-center gap-2 text-cyan-200/70 text-sm">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span style={{ fontFamily: "'Rajdhani', sans-serif" }}>SYSTEM ACTIVE</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 rounded-2xl bg-black/10 border border-cyan-500/10 shadow-inner mt-3">
            {error && (
              <div className="text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-xl mb-3 text-sm">
                {error}
              </div>
            )}
            {messages.map((msg) => (
              <div 
                key={msg.id}
                className={`mb-4 p-4 rounded-2xl border transition-all duration-300 ${
                  msg.user?.id === USER_ID 
                    ? "bg-cyan-500/10 border-cyan-500/30 ml-8" 
                    : msg.isPending
                    ? "bg-cyan-500/5 border-cyan-500/10 animate-pulse"
                    : "bg-purple-500/10 border-purple-500/30 mr-8"
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-2 h-2 rounded-full ${
                    msg.user?.id === USER_ID 
                      ? "bg-cyan-400" 
                      : msg.isPending 
                      ? "bg-cyan-400 animate-pulse" 
                      : "bg-purple-400"
                  }`}></div>
                  <strong className={`text-sm font-bold ${
                    msg.user?.id === USER_ID 
                      ? "text-cyan-300" 
                      : msg.isPending 
                      ? "text-cyan-300/60" 
                      : "text-purple-300"
                  }`}>
                    {msg.user?.name || msg.user?.id}
                  </strong>
                  {msg.user?.id === USER_ID && (
                    <div className="flex items-center gap-1 bg-cyan-500/20 px-2 py-1 rounded-full">
                      <span className="text-xs text-cyan-300 font-medium">LIVE</span>
                      <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></div>
                    </div>
                  )}
                  {msg.isPending && (
                    <div className="flex items-center gap-1 bg-cyan-500/10 px-2 py-1 rounded-full">
                      <div className="flex space-x-1">
                        <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce"></div>
                        <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce delay-150"></div>
                        <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce delay-300"></div>
                      </div>
                    </div>
                  )}
                </div>
                <div className={`text-sm leading-relaxed ${
                  msg.user?.id === USER_ID 
                    ? "text-cyan-100" 
                    : msg.isPending 
                    ? "text-cyan-300/60 italic" 
                    : "text-purple-100"
                }`}>
                  {msg.text}
                </div>
                {!msg.isPending && (
                  <div className={`text-xs mt-2 ${
                    msg.user?.id === USER_ID ? "text-cyan-400/60" : "text-purple-400/60"
                  }`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Chat Input */}
          <div className="mt-4">
            <ChatInput
              disabled={!connected}
              placeholder="Transmit neural message..."
              onUserGesture={unlockOnce}
              isRecording={isRecording}
              onVoiceClick={() => setIsRecording(!isRecording)}
              onSend={handleSendMessage}
            />
          </div>
        </div>

        {/* Mute Button */}
        <button
          onClick={toggleMute}
          className="fixed bottom-6 right-6 z-20 p-3 rounded-2xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-300 hover:text-cyan-100 transition-all duration-300 shadow-lg hover:shadow-cyan-500/25 pointer-events-auto"
        >
          {isMuted ? "🔇" : "🔊"}
        </button>

        <VisuallyHidden>
          <div aria-live="polite" aria-atomic="true">
            {liveText}
          </div>
        </VisuallyHidden>

        <style jsx>{`
          @media (max-width: 768px) {
            .mobile-chat {
              height: 45vh !important;
              background: linear-gradient(135deg, rgba(20, 20, 30, 0.1) 0%, rgba(10, 30, 40, 0.1) 100%) !important;
              border: 1px solid rgba(34, 211, 238, 0.3) !important;
              margin: 10px;
              border-radius: 20px !important;
            }
          }
          
          ::-webkit-scrollbar {
            width: 6px;
          }
          
          ::-webkit-scrollbar-track {
            background: rgba(6, 182, 212, 0.1);
            border-radius: 10px;
          }
          
          ::-webkit-scrollbar-thumb {
            background: rgba(6, 182, 212, 0.4);
            border-radius: 10px;
          }
          
          ::-webkit-scrollbar-thumb:hover {
            background: rgba(6, 182, 212, 0.6);
          }
        `}</style>

        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700&family=Rajdhani:wght@400;500;600;700&display=swap');
          
          .hover\\:drop-shadow-glow:hover {
            filter: drop-shadow(0 0 8px rgba(34, 211, 238, 0.6));
          }
        `}</style>
      </div>
    </div>
  );
}

/* -------------------------------------------------- */
/* 3D Model Loading Overlay */
/* -------------------------------------------------- */

interface ModelLoadingOverlayProps {
  active: boolean;
  progress: number;
}

function ModelLoadingOverlay({ active, progress }: ModelLoadingOverlayProps) {
  if (!active || progress >= 100) return null;

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-white z-[1000] text-center">
      <Lottie 
        animationData={loadingAnimation} 
        className="w-[300px] h-[300px] sm:w-[400px] sm:h-[400px] lg:w-[600px] lg:h-[600px]" 
      />
      <p className="hidden text-xs text-gray-600 max-w-[80%] mt-4 md:block md:hidden">
        For the best experience, we recommend using App on a desktop device.
        Mobile compatibility is currently limited.
      </p>
    </div>
  );
}