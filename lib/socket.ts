import { io, Socket } from "socket.io-client";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000";

let socket: Socket | null = null;
let hasLoggedWsError = false;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket;
  if (!token?.trim()) {
    // Avoid noisy reconnect loops when auth context is not ready yet.
    throw new Error("Socket token is required");
  }

  socket = io(`${BACKEND_URL}/notifications`, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });

  socket.on("connect", () => {
    hasLoggedWsError = false;
    console.log("[WS] Connected to notification gateway");
  });

  socket.on("disconnect", (reason) => {
    console.log("[WS] Disconnected:", reason);
  });

  socket.on("connect_error", (error) => {
    if (!hasLoggedWsError) {
      hasLoggedWsError = true;
      console.warn("[WS] Connection error:", error.message);
    }
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
