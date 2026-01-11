import { useCallback, useState } from "react";
import { useSoul } from "@opensouls/react";
import { said } from "@opensouls/soul";
import { usePresence } from "./usePresence";

// Consistent session ID for all users to share
const SHARED_SOUL_ID = "tanaki-shared-session";

export type StoreEvent = {
  _id: string;
  _kind: "perception" | "interactionRequest" | "system";
  _timestamp: number;
  _pending?: boolean;
  internal?: boolean;
  action: string;
  content: string;
  name?: string;
};

const useUniqueSoulId = () => {
  const [soulId] = useState(() => crypto.randomUUID());
  return soulId;
};

export function useTanakiSoul() {
  const soulId = useUniqueSoulId(); // each tab gets its own soul

  const organization = "local";
  const local = true;

  const { connectedUsers: presenceCount, isConnected: presenceConnected } = usePresence({ enabled: true });

  const { soul, connected, disconnect, store } = useSoul({
    blueprint: "tanaki-speaks",
    soulId, // unique per tab
    local,
    token: "test",
    debug: true,
  });

  const events = [] as StoreEvent[]; // don’t show old events from previous users

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    await soul.dispatch({
      ...said("User", trimmed),
      _metadata: { connectedUsers: presenceCount },
    });
  }, [soul, presenceCount]);

  return {
    organization,
    local,
    soul,
    connected,
    events,
    send,
    disconnect,
    connectedUsers: presenceCount,
    presenceConnected,
  };
}
