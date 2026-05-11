"use client";

import { useEffect } from "react";
import { getSocket } from "@/lib/socket";

/**
 * Subscribes to Nest `/notifications` room `support_ticket:{id}` for instant thread refresh.
 * Keeps a slow HTTP poll as fallback when WebSocket is down or for edge cases (no extra cost on WS path).
 */
export function useSupportTicketLive(ticketId: string | undefined, loadTicket: () => void | Promise<void>) {
  useEffect(() => {
    if (!ticketId) return;
    const tid = String(ticketId);
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const pollMsVisible = 45_000;
    const pollMsHidden = 120_000;

    const onThread = (payload: { ticketId?: string }) => {
      if (payload?.ticketId === tid) void loadTicket();
    };

    const subscribeIfReady = () => {
      const s = getSocket();
      if (!s?.connected) return;
      s.off("support_ticket_thread", onThread);
      s.on("support_ticket_thread", onThread);
      s.emit("subscribe_support_ticket", tid);
    };

    const startPolling = () => {
      if (intervalId) clearInterval(intervalId);
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        intervalId = setInterval(() => void loadTicket(), pollMsHidden);
        return;
      }
      intervalId = setInterval(() => void loadTicket(), pollMsVisible);
    };

    const onVisibility = () => {
      if (typeof document === "undefined") return;
      if (document.visibilityState === "visible") {
        void loadTicket();
        subscribeIfReady();
        if (intervalId) clearInterval(intervalId);
        intervalId = undefined;
        startPolling();
      } else {
        if (intervalId) clearInterval(intervalId);
        intervalId = undefined;
        startPolling();
      }
    };

    void loadTicket();
    subscribeIfReady();
    const s0 = getSocket();
    s0?.on("connect", subscribeIfReady);
    startPolling();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      const s = getSocket();
      s?.off("connect", subscribeIfReady);
      s?.off("support_ticket_thread", onThread);
      s?.emit("unsubscribe_support_ticket", tid);
      if (intervalId) clearInterval(intervalId);
    };
  }, [ticketId, loadTicket]);
}
