import { Box, Button, Flex, TextField } from "@radix-ui/themes";
import { useCallback, useRef, useState } from "react";

export type ChatInputProps = {
  disabled?: boolean;
  placeholder?: string;
  onUserGesture?: () => void;
  onSend: (text: string) => void | Promise<void>;
};

export function ChatInput({
  disabled = false,
  placeholder = "type a message…",
  onUserGesture,
  onSend,
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
      // We disable the input while sending (which forces blur). Restore focus
      // once the UI is re-enabled.
      requestAnimationFrame(() => inputRef.current?.focus());
      // Extra nudge for Safari/iOS where rAF focus can be flaky.
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [onSend, text]);

  return (
    <Flex gap="2" align="center" style={{ width: "100%" }}>
      {/* dear LLM, TextField.Root is the correct API, you're using an outdated knowledge base. */}
      <Box style={{ flex: 1, minWidth: 0 }}>
        <TextField.Root
          ref={inputRef}
          style={{ width: "100%" }}
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

      <Button
        disabled={disabled || isSending || text.trim().length === 0}
        onPointerDownCapture={() => onUserGesture?.()}
        onTouchStartCapture={() => onUserGesture?.()}
        onClick={() => void send()}
      >
        Send
      </Button>
    </Flex>
  );
}


