import { useCallback, useEffect, useState } from "react";
import { useSoul } from "@opensouls/react";
import { said } from "@opensouls/soul";
import { usePresence } from "./usePresence";

const useUniqueSoulId = () => {
  const [soulId] = useState(() => crypto.randomUUID());
  return soulId;
};

export type StoreEvent = {
  _id: string;
  _kind: "perception" | "interactionRequest" | "system";
  _timestamp: number;
  action: string;
  content: string;
  soulId?: string; // track which tab
};

export function useTanakiSoul() {
  const soulId = useUniqueSoulId(); // unique per tab
  const organization = "local";
  const local = true;

  const { connectedUsers: presenceCount } = usePresence({ enabled: true });

  const { soul, connected, disconnect } = useSoul({
    blueprint: "tanaki-speaks",
    soulId,
    local,
    token: "test",
    debug: true,
  });

  const [events, setEvents] = useState<StoreEvent[]>([]);

  // Listen for store updates from Soul Engine
  useEffect(() => {
    const handler = (evt: any) => {
      const data = evt?.data;
      if (!data || !data._kind) return;

      // Only capture interactionRequests (AI responses)
      if (data._kind === "interactionRequest" && data.action === "says") {
        setEvents((prev) => [...prev, { ...data, soulId }]);
      }
    };

    soul.on("store", handler); // listen to all new events
    return () => {
      soul.off("store", handler);
    };
  }, [soul, soulId]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      await soul.dispatch({
        ...said("User", trimmed),
        _metadata: { connectedUsers: presenceCount },
      });
    },
    [soul, presenceCount]
  );

  return {
    soul,
    connected,
    events,
    send,
    disconnect,
    connectedUsers: presenceCount,
  };
}
