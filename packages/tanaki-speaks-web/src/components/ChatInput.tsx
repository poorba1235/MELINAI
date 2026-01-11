import { Box, Flex } from "@radix-ui/themes";
import { Mic, Send } from "lucide-react";
import { useCallback, useRef, useState } from "react";

export type ChatInputProps = {
  disabled?: boolean;
  placeholder?: string;
  onUserGesture?: () => void;
  onSend: (text: string) => void | Promise<void>;
  onVoiceClick?: () => void;
  isRecording?: boolean;
};

export function ChatInput({
  disabled = false,
  placeholder = "Transmit neural message...",
  onUserGesture,
  onSend,
  onVoiceClick,
  isRecording = false,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const send = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setIsSending(true);
    try {
      await onSend(trimmed);
      setText("");
    } finally {
      setIsSending(false);
      // Restore focus after sending
      requestAnimationFrame(() => inputRef.current?.focus());
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [onSend, text]);

  return (
    <Flex gap="3" align="center" style={{ width: "100%" }}>
      {/* Voice Recording Button */}
      <button
        onClick={() => {
          onUserGesture?.();
          onVoiceClick?.();
        }}
        className={`p-4 rounded-2xl shadow-lg border transition-all duration-300 ${
          isRecording
            ? "bg-red-500/20 border-red-400/50 text-red-300 animate-pulse shadow-red-500/25"
            : "bg-cyan-500/10 border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-300 hover:shadow-cyan-500/25"
        } ${disabled || isSending ? "cursor-not-allowed opacity-30" : ""}`}
        disabled={disabled || isSending}
        onPointerDownCapture={() => onUserGesture?.()}
        onTouchStartCapture={() => onUserGesture?.()}
      >
        <Mic size={20} />
      </button>

      {/* Text Input */}
      <Box style={{ flex: 1, minWidth: 0 }}>
        <input
          ref={inputRef}
          type="text"
          className="w-full placeholder:text-cyan-200/40 placeholder:italic p-4 rounded-2xl bg-black/10 border border-cyan-500/20 text-cyan-100 focus:border-cyan-400/50 focus:outline-none transition-all duration-300 shadow-inner disabled:opacity-30 disabled:cursor-not-allowed"
          value={text}
          placeholder={placeholder}
          disabled={disabled || isSending}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => onUserGesture?.()}
          onPointerDownCapture={() => onUserGesture?.()}
          onTouchStartCapture={() => onUserGesture?.()}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            if (e.shiftKey) return;
            e.preventDefault();
            void send();
          }}
        />
      </Box>

      {/* Send Button */}
      <button
        onClick={() => {
          onUserGesture?.();
          void send();
        }}
        disabled={disabled || isSending || text.trim().length === 0}
        className="p-4 rounded-2xl shadow-lg border border-cyan-500/30 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 hover:from-cyan-500/30 hover:to-purple-500/30 text-cyan-300 hover:text-cyan-100 transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-cyan-500/25"
        onPointerDownCapture={() => onUserGesture?.()}
        onTouchStartCapture={() => onUserGesture?.()}
      >
        <Send size={20} />
      </button>
    </Flex>
  );
}