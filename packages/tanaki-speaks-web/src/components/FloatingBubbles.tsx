// SimpleChatDisplay.js
import { useEffect, useState } from "react";

type ChatMessage = {
  id: string;
  text: string;
  isAI: boolean;
  timestamp: number;
};

export function FloatingBubbles({ events }: { events: any[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    // Get AI responses from events
    const aiMessages = events
      .filter(e => e._kind === "interactionRequest" && e.action === "says")
      .map(e => ({
        id: e._id,
        text: e.content,
        isAI: true,
        timestamp: e._timestamp
      }));

    // Get user messages from events
    const userMessages = events
      .filter(e => (e._kind === "user-added" || (e._kind === "perception" && !e.internal)) && e.action === "said")
      .map(e => ({
        id: e._id,
        text: e.content,
        isAI: false,
        timestamp: e._timestamp
      }));

    // Combine and sort by timestamp
    const allMessages = [...aiMessages, ...userMessages]
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-10); // Keep last 10 messages

    setMessages(allMessages);
  }, [events]);

  if (messages.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        Start chatting with Tanaki...
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${msg.isAI ? 'justify-start' : 'justify-end'}`}
        >
          <div
            className={`max-w-[80%] rounded-lg p-3 ${
              msg.isAI
                ? 'bg-purple-100 text-gray-800'
                : 'bg-blue-100 text-gray-800'
            }`}
          >
            <div className="font-semibold text-sm mb-1">
              {msg.isAI ? 'Tanaki' : 'You'}
            </div>
            <div className="text-sm">{msg.text}</div>
          </div>
        </div>
      ))}
    </div>
  );
}