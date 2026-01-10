import { useCallback } from "react";
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

export function useTanakiSoul() {
  const organization = "local";
  const local = true;

  // Connect to presence tracking
  const { connectedUsers: presenceCount, isConnected: presenceConnected } = usePresence({ 
    enabled: true 
  });

  const { soul, connected, disconnect, store } = useSoul({
    blueprint: "tanaki-speaks",
    soulId: SHARED_SOUL_ID,
    local,
    token: "test",
    debug: true,
  });

  const events = (store?.events ?? []) as unknown as StoreEvent[];

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Dispatch with connected count in metadata
    await soul.dispatch({
      ...said("User", trimmed),
      _metadata: {
        connectedUsers: presenceCount,
      },
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
