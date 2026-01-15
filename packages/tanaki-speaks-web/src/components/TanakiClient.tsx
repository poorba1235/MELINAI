/** @typedef {import("@/components/TanakiAudio").TanakiAudioHandle} TanakiAudioHandle */

import loadingAnimation from "@/../public/loading.json";
import { ChatInput } from "@/components/ChatInput";
import { TanakiAudio } from "@/components/TanakiAudio";
import { useTanakiSoul } from "@/hooks/useTanakiSoul";
import { SoulEngineProvider } from "@opensouls/react";
import { VisuallyHidden } from "@radix-ui/themes";
import { useProgress } from "@react-three/drei";
import Lottie from "lottie-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Tanaki3DExperience } from "./3d/Tanaki3DExperience";
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
// Import icons
import { Cpu, Home, Menu, Settings, Users, Zap } from "lucide-react";


const elevenLabsApiKey = '16a6522513845dac5246b8f5e9edf8ff92ea01a45588569a8119cb0abc1af532';
const elevenVoiceId = "piI8Kku0DcvcL6TTSeQt"; // Your chosen ElevenLabs voice
const elevenLabsClient = new ElevenLabsClient({ apiKey: elevenLabsApiKey });

async function speakTextWithElevenLabs(text: string) {
  if (!text.trim()) return;
  try {
    const stream = await elevenLabsClient.textToSpeech.convert(elevenVoiceId, {
      modelId: "eleven_multilingual_v2",
      text,
    });

    const response = new Response(stream as any); // TS fix for ReadableStream
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    audio.play();
  } catch (err) {
    console.error("ElevenLabs TTS error:", err);
  }
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

  // EXACT WebSocket URL from working code
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
  // EXACTLY same as working code
  const { connected, events, send, connectedUsers, soul } = useTanakiSoul();
  const audioRef = useRef<TanakiAudioHandle | null>(null);
  const lastSpokenIdRef = useRef<string | null>(null);
  const activeTtsStreamIdRef = useRef<string | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [blend, setBlend] = useState(0);
  const unlockedOnceRef = useRef(false);
  const [overlayHeight, setOverlayHeight] = useState(240);
  const [liveText, setLiveText] = useState("");
  const [now, setNow] = useState(() => Date.now());

  // UI state for your design
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [userMessages, setUserMessages] = useState<{id: string, text: string, timestamp: Date}[]>([]);

  // Speech recognition state
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");

  // Update now timestamp every 200ms (same as FloatingBubbles logic)
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech recognition not supported in this browser");
      return;
    }

    const recognitionInstance = new SpeechRecognition();
    recognitionInstance.continuous = true;
    recognitionInstance.interimResults = true;
    recognitionInstance.lang = 'en-US';

    recognitionInstance.onstart = () => {
      console.log("Speech recognition started");
      setIsRecording(true);
    };

    recognitionInstance.onresult = (event) => {
      let interim = '';
      let final = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      
      if (interim) {
        setInterimTranscript(interim);
      }
      
      if (final) {
        setFinalTranscript(prev => prev + final + ' ');
        setInterimTranscript('');
      }
    };

    recognitionInstance.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsRecording(false);
    };

    recognitionInstance.onend = () => {
      console.log("Speech recognition ended");
      setIsRecording(false);
    };

    setRecognition(recognitionInstance);

    return () => {
      if (recognitionInstance) {
        recognitionInstance.stop();
      }
    };
  }, []);

  const toggleVoiceRecording = () => {
    if (!recognition) {
      alert("Speech recognition is not supported in your browser. Please use Chrome or Edge.");
      return;
    }

    if (isRecording) {
      recognition.stop();
      setIsRecording(false);
      // If we have final transcript, use it
      if (finalTranscript.trim()) {
        // This will be handled by the handleSendMessage function
      }
    } else {
      setFinalTranscript("");
      setInterimTranscript("");
      recognition.start();
    }
  };

  const unlockOnce = useCallback(() => {
    if (unlockedOnceRef.current) return;
    unlockedOnceRef.current = true;
    void audioRef.current?.unlock();
  }, []);

  // Filter events with the SAME logic as FloatingBubbles (14 seconds TTL)
  const recentEvents = useMemo(() => {
    const baseDurationMs = 14000; // 10 seconds - adjusted for chat
    
    const relevant = events.filter((e) => {
      if (e._kind === "perception") return !e.internal && e.action === "said";
      if (e._kind === "interactionRequest") return e.action === "says";
      return false;
    });

    // Only show events from the last 10 seconds
    return relevant.filter((e) => now - e._timestamp >= 0 && now - e._timestamp < baseDurationMs);
  }, [events, now]);

  // When Tanaki says something new, update aria-live text
  useEffect(() => {
    const latest = [...recentEvents]
      .reverse()
      .find((e) => e._kind === "interactionRequest" && e.action === "says");
    if (!latest) return;
    if (lastSpokenIdRef.current === latest._id) return;
    lastSpokenIdRef.current = latest._id;
    setLiveText(latest.content);
    void speakTextWithElevenLabs(latest.content);

  }, [recentEvents.length, recentEvents[recentEvents.length - 1]?.content]);

  // Listen for Soul Engine ephemeral audio events (useTTS) - EXACT from working code
  // useEffect(() => {
  //   const onChunk = (evt: any) => {
  //     const data = evt?.data as any;
  //     if (!data || typeof data !== "object") return;

  //     const streamId = typeof data.streamId === "string" ? data.streamId : null;
  //     const chunkBase64 = typeof data.chunkBase64 === "string" ? data.chunkBase64 : null;
  //     if (!streamId || !chunkBase64) return;

  //     // If a new stream starts, interrupt queued audio so it feels responsive.
  //     if (activeTtsStreamIdRef.current !== streamId) {
  //       activeTtsStreamIdRef.current = streamId;
  //       audioRef.current?.interrupt();
  //     }

  //     try {
  //       const bytes = base64ToUint8(chunkBase64);
  //       audioRef.current?.enqueuePcm16(bytes);
  //     } catch (err) {
  //       console.error("Failed to decode/enqueue TTS chunk:", err);
  //     }
  //   };

  //   const onComplete = (evt: any) => {
  //     const data = evt?.data as any;
  //     const streamId = typeof data?.streamId === "string" ? data.streamId : null;
  //     if (!streamId) return;
  //     if (activeTtsStreamIdRef.current === streamId) {
  //       activeTtsStreamIdRef.current = null;
  //     }
  //   };

  //   const onError = (evt: any) => {
  //     const data = evt?.data as any;
  //     const message = typeof data?.message === "string" ? data.message : "unknown error";
  //     console.error("TTS error event:", message, evt);
  //   };

  //   soul.on("ephemeral:audio-chunk", onChunk);
  //   soul.on("ephemeral:audio-complete", onComplete);
  //   soul.on("ephemeral:audio-error", onError);
  //   return () => {
  //     soul.off("ephemeral:audio-chunk", onChunk);
  //     soul.off("ephemeral:audio-complete", onComplete);
  //     soul.off("ephemeral:audio-error", onError);
  //   };
  // }, [soul]);

  // Measure the bottom overlay - EXACT from working code
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

  // Simple send function - EXACT from working code
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || !connected) return;
    
    // Add user message to UI immediately
    const userMessage = {
      id: `user_${Date.now()}`,
      text: text,
      timestamp: new Date()
    };
    setUserMessages(prev => [...prev, userMessage]);
    
    unlockOnce();
    await send(text);
  };

  // Handle voice input
  const handleVoiceMessage = async () => {
    const textToSend = finalTranscript.trim() || interimTranscript.trim();
    if (textToSend) {
      await handleSendMessage(textToSend);
      setFinalTranscript("");
      setInterimTranscript("");
    }
  };

  // Filter user messages to only show recent ones (10 seconds)
  const recentUserMessages = useMemo(() => {
    const baseDurationMs = 10000; // 10 seconds - same as events
    return userMessages.filter(msg => 
      now - msg.timestamp.getTime() >= 0 && now - msg.timestamp.getTime() < baseDurationMs
    );
  }, [userMessages, now]);

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  // Model loading
  const { active, progress } = useProgress();

  const menuItems = [
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
      onPointerDownCapture={() => {
        unlockOnce();
      }}
      onTouchStartCapture={() => {
        unlockOnce();
      }}
    >
      {/* 3D Model Loading Overlay */}
      <ModelLoadingOverlay active={active} progress={progress} />

      {/* 3D Experience - Full Screen Background */}
      <Tanaki3DExperience
        message={liveText ? { content: liveText, animation: "Action" } : null}
        chat={() => console.log("Chat triggered")}
      />
      
      {/* 🔊 Audio Component - EXACT from working code */}
      <TanakiAudio
        ref={audioRef}
        enabled={!isMuted}
        onVolumeChange={(volume) => {
          setBlend((prev) => prev * 0.5 + volume * 0.5);
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
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse"></div>
                <a
                  href="/"
                  className="text-cyan-300 font-bold text-xl hover:text-cyan-100 transition-all duration-300 hover:drop-shadow-glow"
                  style={{ fontFamily: "'Orbitron', sans-serif", letterSpacing: "0.1em" }}
                >
                  MIYU AI
                </a>
              </div>
              
              <div className="hidden md:flex items-center gap-1 ml-6">
                {menuItems.map((item, index) => (
                  <a
                    key={index}
                    href="#"
                    className="flex items-center gap-2 text-cyan-200/80 hover:text-cyan-100 px-4 py-2 rounded-xl hover:bg-cyan-500/10 transition-all duration-300 border border-transparent hover:border-cyan-500/30 group"
                  >
                    <item.icon size={16} className="group-hover:scale-110 transition-transform" />
                    <span className="font-medium text-sm" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                      {item.label}
                    </span>
                  </a>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Social Links */}
              <div className="hidden md:flex items-center gap-3">
                <a
                  href="#"
                  className="px-4 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:text-cyan-100 transition-all duration-300 text-sm font-medium"
                  style={{ fontFamily: "'Rajdhani', sans-serif" }}
                >
                  TWITTER
                </a>
                <a
                  href="#"
                  className="px-4 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 hover:text-purple-100 transition-all duration-300 text-sm font-medium"
                  style={{ fontFamily: "'Rajdhani', sans-serif" }}
                >
                  GITHUB
                </a>
              </div>

              <div className="md:hidden relative">
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="p-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-300 transition-all duration-300 shadow-lg hover:shadow-cyan-500/25"
                >
                  <Menu size={20} />
                </button>

                <div
                  className={`absolute ${isMenuOpen ? "flex opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"} 
                    flex-col bg-gray-900/10 border border-cyan-500/20 p-4 rounded-2xl right-0 top-full w-64 
                    transition-all duration-300 shadow-2xl z-20`}
                >
                  {mobileMenuItems.map((item) => (
                    <a
                      key={item}
                      href="#"
                      className="text-cyan-200 hover:text-cyan-100 p-3 rounded-lg hover:bg-cyan-500/10 transition-all duration-200 text-center font-medium"
                      style={{ fontFamily: "'Rajdhani', sans-serif" }}
                    >
                      {item}
                    </a>
                  ))}
                  <div className="border-t border-cyan-500/20 pt-3 mt-2">
                    <a
                      href="#"
                      className="text-cyan-200 hover:text-cyan-100 p-3 rounded-lg hover:bg-cyan-500/10 transition-all duration-200 text-center font-medium block"
                      style={{ fontFamily: "'Rajdhani', sans-serif" }}
                    >
                      TWITTER
                    </a>
                    <a
                      href="#"
                      className="text-purple-200 hover:text-purple-100 p-3 rounded-lg hover:bg-purple-500/10 transition-all duration-200 text-center font-medium block"
                      style={{ fontFamily: "'Rajdhani', sans-serif" }}
                    >
                      GITHUB
                    </a>
                  </div>
                </div>
              </div>
            </div>
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
              <span className="text-cyan-200/80 text-xs font-medium">
                {connectedUsers} {connectedUsers === 1 ? "user" : "users"} online
              </span>
              <div className="w-px h-4 bg-cyan-500/40"></div>
              <span className="text-cyan-200/80 text-xs font-medium">
                {connected ? "🟢 Connected" : "🔴 Disconnected"}
              </span>
            </div>
          </div>
        </div>

        {/* Chat Interface */}
        <div
          ref={overlayRef}
          className="w-full md:w-[480px] h-[55vh] md:h-[75vh] flex flex-col bg-gradient-to-br from-gray-900/10 to-cyan-900/10 p-5 rounded-3xl shadow-2xl border border-cyan-500/20 pointer-events-auto fixed bottom-0 left-0 md:relative md:bottom-auto md:left-auto mobile-chat chat-container"
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

          <div className="flex-1 overflow-y-auto p-4 rounded-2xl bg-black/10 border border-cyan-500/10 shadow-inner mt-3 chat-messages">
            {[...recentUserMessages, ...recentEvents
              .filter(e => e._kind === "interactionRequest" && e.action === "says" && e.content)
              .map(event => ({
                id: event._id,
                text: event.content,
                timestamp: new Date(event._timestamp || Date.now()),
                isAI: true
              }))]
              .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
              .slice(-10) // Show last 10 messages total
              .map((msg) => (
                <div 
                  key={msg.id}
                  className={`mb-3 p-3 rounded-xl ${
                    msg.isAI 
                      ? "bg-purple-500/10 border border-purple-500/30 ml-8" 
                      : "bg-cyan-500/10 border border-cyan-500/30 mr-8"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full ${
                      msg.isAI ? "bg-purple-400" : "bg-cyan-400"
                    }`}></div>
                    <strong className={`text-sm ${
                      msg.isAI ? "text-purple-300" : "text-cyan-300"
                    }`}>
                      {msg.isAI ? "MEILIN" : "YOU"}
                    </strong>
                    {!msg.isAI && (
                      <div className="flex items-center gap-1 bg-cyan-500/20 px-2 py-1 rounded-full">
                        <span className="text-xs text-cyan-300 font-medium">LIVE</span>
                        <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></div>
                      </div>
                    )}
                  </div>
                  <div className={`text-sm ${
                    msg.isAI ? "text-purple-100" : "text-cyan-100"
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
            
            {recentUserMessages.length === 0 && 
             recentEvents.filter(e => e._kind === "interactionRequest" && e.action === "says").length === 0 && (
              <div className="text-center py-8 text-cyan-300/50">
                <div className="text-lg mb-2"></div>
                <div className="text-sm"></div>
              </div>
            )}
          </div>

          {/* Voice Input Indicator */}
{isRecording && (
  <div className="mb-3 p-3 rounded-xl bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 sm:w-3 sm:h-3 bg-red-400 rounded-full"></div>
        <strong className="text-cyan-300 text-xs sm:text-sm">LISTENING...</strong>
      </div>
    </div>
    
    <div className="mt-2 text-cyan-200 text-xs sm:text-sm">
      {finalTranscript && <div className="mb-1 break-words">{finalTranscript}</div>}
      {interimTranscript && <div className="italic text-cyan-300/70 break-words">{interimTranscript}</div>}
      {!finalTranscript && !interimTranscript && (
        <div className="italic text-cyan-300/50">Speak now...</div>
      )}
    </div>
    
    <div className="flex gap-0.5 sm:gap-1 mt-2 sm:mt-3 mb-2">
      <div className="w-0.5 h-3 sm:w-1 sm:h-4 bg-cyan-400 rounded-full"></div>
      <div className="w-0.5 h-3 sm:w-1 sm:h-4 bg-purple-400 rounded-full"></div>
      <div className="w-0.5 h-3 sm:w-1 sm:h-4 bg-cyan-400 rounded-full"></div>
      <div className="w-0.5 h-3 sm:w-1 sm:h-4 bg-purple-400 rounded-full"></div>
    </div>
    
    {(finalTranscript.trim() || interimTranscript.trim()) && (
      <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-cyan-500/20">
        <button
          onClick={handleVoiceMessage}
          className="w-full px-2 py-1.5 sm:px-3 sm:py-2.5 rounded-lg bg-gradient-to-r from-cyan-500/40 to-purple-500/40 hover:from-cyan-500/50 hover:to-purple-500/50 border border-cyan-400/50 text-cyan-100 hover:text-white transition-all duration-300 text-xs sm:text-sm font-medium shadow-lg hover:shadow-cyan-500/40 pointer-events-auto flex items-center justify-center gap-1 sm:gap-2"
        >
          <span className="text-xs sm:text-sm">📤</span>
          <span className="whitespace-nowrap">SEND VOICE MESSAGE</span>
        </button>
      </div>
    )}
  </div>
)}

          {/* Chat Input */}
          <div className="mt-4">
            <ChatInput
              disabled={!connected}
              onUserGesture={unlockOnce}
              isRecording={isRecording}
              onVoiceClick={toggleVoiceRecording}
              onSend={handleSendMessage}
              placeholder="Type your message..."
              // Pass voice transcription state if you want to modify ChatInput
              voiceTranscript={finalTranscript || interimTranscript}
            />
          </div>
        </div>

        {/* Mute Button */}
      <button
  onClick={toggleMute}
  className="fixed top-52 right-6 z-20 p-3 rounded-2xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-300 hover:text-cyan-100 transition-all duration-300 shadow-lg hover:shadow-cyan-500/25 pointer-events-auto sm:top-auto sm:bottom-6"
>
  {isMuted ? "🔇" : "🔊"}
</button>

        {/* Voice Send Button (only shown when we have voice transcript) */}


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
          
          /* Custom scrollbar styling */
          .chat-messages::-webkit-scrollbar {
            width: 8px;
          }
          
          .chat-messages::-webkit-scrollbar-track {
            background: linear-gradient(to bottom, 
              rgba(6, 182, 212, 0.1) 0%, 
              rgba(147, 51, 234, 0.1) 100%
            );
            border-radius: 10px;
          }
          
          .chat-messages::-webkit-scrollbar-thumb {
            background: linear-gradient(to bottom, 
              #06b6d4 0%, 
              #9333ea 100%
            );
            border-radius: 10px;
            border: 2px solid rgba(255, 255, 255, 0.1);
          }
          
          .chat-messages::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(to bottom, 
              #0ea5e9 0%, 
              #a855f7 100%
            );
            box-shadow: 0 0 10px rgba(34, 211, 238, 0.5);
          }
          
          /* For Firefox */
          .chat-messages {
            scrollbar-width: thin;
            scrollbar-color: #06b6d4 rgba(6, 182, 212, 0.1);
          }
          
          /* Animated scrollbar */
          .chat-messages::-webkit-scrollbar-thumb {
            background: linear-gradient(45deg, 
              #06b6d4 0%, 
              #9333ea 25%, 
              #06b6d4 50%, 
              #9333ea 75%, 
              #06b6d4 100%
            );
            background-size: 200% 100%;
            animation: scrollbarGradient 3s linear infinite;
          }
          
          @keyframes scrollbarGradient {
            0% {
              background-position: 200% 0;
            }
            100% {
              background-position: 0 0;
            }
          }
        `}</style>

        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700&family=Rajdhani:wght@400;500;600;700&display=swap');
          
          .hover\\:drop-shadow-glow:hover {
            filter: drop-shadow(0 0 8px rgba(34, 211, 238, 0.6));
          }
          
          /* Global scrollbar styling for the entire app */
          ::-webkit-scrollbar {
            width: 10px;
          }
          
          ::-webkit-scrollbar-track {
            background: rgba(6, 182, 212, 0.05);
            backdrop-filter: blur(10px);
          }
          
          ::-webkit-scrollbar-thumb {
            background: linear-gradient(45deg, #06b6d4, #9333ea);
            border-radius: 10px;
            border: 2px solid rgba(255, 255, 255, 0.1);
          }
          
          ::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(45deg, #0ea5e9, #a855f7);
            box-shadow: 0 0 15px rgba(34, 211, 238, 0.5);
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
  const [simulatedProgress, setSimulatedProgress] = useState(0);
  const simulationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // EXACT same simulation logic as working code
  useEffect(() => {
    if (!active) {
      setSimulatedProgress(0);
      if (simulationRef.current) {
        clearInterval(simulationRef.current);
        simulationRef.current = null;
      }
      return;
    }

    // Simulate progress with diminishing returns (never quite reaches 100)
    simulationRef.current = setInterval(() => {
      setSimulatedProgress((prev) => {
        // Logarithmic approach: fast at start, slows as it nears ~90%
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
  }, [active]);

  // Show while any three loader is active, but especially helpful for the big GLB.
  if (!active || progress >= 100) return null;

  const pct = Math.max(0, Math.min(100, Math.round(simulatedProgress)));

  const label = "Loading 3D model…";

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-white z-[1000] text-center">
      <Lottie 
        animationData={loadingAnimation} 
        className="w-[300px] h-[300px] sm:w-[400px] sm:h-[400px] lg:w-[600px] lg:h-[600px]" 
      />
      <div className="w-full max-w-md mt-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-700">{label}</span>
          <span className="text-gray-700">{pct}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
