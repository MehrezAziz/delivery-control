"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { buildIdempotencyKey } from "@/lib/idempotency";
import { connectSocket, getSocket } from "@/lib/socket";

type Order = {
  id: string;
  status: string;
  createdAt: string;
  price?: string | number | null;
  cancelAfterMinutes?: number | null;
  cancelRemainingSeconds?: number | null;
  cancelTimerLastResumedAt?: string | null;
  description?: string | null;
  trackingToken?: string | null;
  driverAssignment?: {
    driverId?: string;
    arrivedAt?: string | null;
    pickedUpAt?: string | null;
    deliveredAt?: string | null;
    image1Proof?: string | null;
    image2Proof?: string | null;
  } | null;
  returnDepositFeedback?: {
    feedback: string;
    conditionIssue: boolean;
  } | null;
};

type ChatMessage = {
  id: string;
  senderType: string;
  senderName: string;
  content: string;
  timestamp: string;
};

type ChatRoomDto = {
  id: string;
  status: string;
  driver?: { id: string; name: string } | null;
  messages: ChatMessage[];
} | null;

/** Timeline includes approval step for company-managed orders */
const ORDER_FLOW = [
  "SEARCHING_DRIVER",
  "PENDING_CUSTOMER_APPROVAL",
  "DRIVER_ASSIGNED",
  "DRIVER_ARRIVED",
  "PICKED_UP",
  "DELIVERING",
  "RETURNED",
  "RETURN_DEPOSIT",
  "DELIVERED",
];

function computeCancelRemaining(order: Order | null): number | null {
  if (!order || order.status !== "SEARCHING_DRIVER") return null;
  const base =
    typeof order.cancelRemainingSeconds === "number"
      ? order.cancelRemainingSeconds
      : Math.max(0, Number(order.cancelAfterMinutes ?? 15) * 60);
  const last = order.cancelTimerLastResumedAt ? new Date(order.cancelTimerLastResumedAt).getTime() : null;
  if (!last) return Math.max(0, base);
  const elapsed = Math.floor((Date.now() - last) / 1000);
  return Math.max(0, base - elapsed);
}

export default function CompanyOrderDetailsPage() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [feedback, setFeedback] = useState("");
  const [conditionIssue, setConditionIssue] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [chatRoom, setChatRoom] = useState<ChatRoomDto>(null);
  const [chatText, setChatText] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [cancelRemain, setCancelRemain] = useState<number | null>(null);

  const loadChat = useCallback(async () => {
    const chatRes = await fetch(`/api/company/orders/${params.id}/chat`, { cache: "no-store" });
    const chatData = await chatRes.json();
    if (chatRes.ok) setChatRoom(chatData);
  }, [params.id]);

  const loadOrder = useCallback(async () => {
    const res = await fetch("/api/company/orders", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) return setMessage(data?.error || "Failed to load order");
    const found = (Array.isArray(data) ? data : []).find((x: Order) => x.id === params.id) || null;
    setOrder(found);
    if (found?.returnDepositFeedback) {
      setFeedback(found.returnDepositFeedback.feedback || "");
      setConditionIssue(!!found.returnDepositFeedback.conditionIssue);
    }
    setCancelRemain(computeCancelRemaining(found));
  }, [params.id]);

  useEffect(() => {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("dc_company_chat_order_id", String(params.id));
    }
    return () => {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem("dc_company_chat_order_id");
      }
    };
  }, [params.id]);

  useEffect(() => {
    if (order?.status !== "SEARCHING_DRIVER") return;
    const t = setInterval(() => setCancelRemain(computeCancelRemaining(order)), 1000);
    return () => clearInterval(t);
  }, [order]);

  useEffect(() => {
    const orderIdStr = String(params.id);
    const onNotif = (notif: { relatedEntityType?: string; relatedEntityId?: string; type?: string }) => {
      const isSameOrder =
        (notif?.relatedEntityType === "Order" || notif?.relatedEntityType === "ChatRoom") &&
        notif?.relatedEntityId === orderIdStr;
      if (isSameOrder) {
        void loadOrder();
        if (
          notif.type === "NEW_MESSAGE_FROM_DRIVER" ||
          notif.type === "NEW_MESSAGE_FROM_CUSTOMER"
        ) {
          void loadChat();
        }
      }
    };
    const onChatRefresh = (payload: { orderId?: string }) => {
      if (payload?.orderId === orderIdStr) void loadChat();
    };
    const run = async () => {
      await loadOrder();
      await loadChat();
      const meRes = await fetch("/api/company-auth/me", { cache: "no-store" });
      const me = await meRes.json().catch(() => null);
      if (meRes.ok && me?.token) {
        const socket = connectSocket(String(me.token));
        socket.on("notification", onNotif);
        socket.on("order_chat_refresh", onChatRefresh);
      }
    };
    void run();
    return () => {
      const socket = getSocket();
      socket?.off("notification", onNotif);
      socket?.off("order_chat_refresh", onChatRefresh);
    };
  }, [params.id, loadOrder, loadChat]);

  const currentStep = useMemo(() => {
    const idx = ORDER_FLOW.indexOf(order?.status || "");
    return idx >= 0 ? idx : 0;
  }, [order?.status]);

  const submitFeedback = async () => {
    const orderId = String(params.id);
    const idemKey = buildIdempotencyKey("company-return-deposit-feedback", {
      orderId,
      feedback,
      conditionIssue,
    });
    const res = await fetch(`/api/company/orders/${params.id}/return-deposit-feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idemKey },
      body: JSON.stringify({ feedback, conditionIssue }),
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data?.error || "Failed to save feedback");
    setMessage("Feedback saved.");
  };

  const approveDriver = async () => {
    const res = await fetch(`/api/company/orders/${params.id}/approve-driver`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) return setMessage(data?.error || "Failed to approve driver");
    setMessage("Driver approved.");
    await loadOrder();
    await loadChat();
  };

  const rejectDriver = async () => {
    const res = await fetch(`/api/company/orders/${params.id}/reject-driver`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: rejectReason || undefined }),
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data?.error || "Failed to reject driver");
    setMessage("Driver rejected.");
    await loadOrder();
    await loadChat();
  };

  const sendChatMessage = async () => {
    const text = chatText.trim();
    if (!text) return;
    const res = await fetch(`/api/company/orders/${params.id}/chat/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data?.error || "Failed to send message");
    setChatText("");
    await loadChat();
  };

  if (!order) return <div className="text-sm text-muted-foreground">Loading order details...</div>;

  const fmtRemain = (sec: number | null) => {
    if (sec == null) return null;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      {message && <div className="rounded-md border bg-muted px-3 py-2 text-sm">{message}</div>}
      <section className="rounded-xl border bg-gradient-to-br from-background to-muted/30 p-5 shadow-sm">
        <h1 className="text-xl font-semibold">Order {order.id}</h1>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          <p className="text-sm text-muted-foreground">
            Status: <span className="font-medium text-foreground">{order.status}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Price: <span className="font-medium text-foreground">{Number(order.price || 0).toFixed(2)}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Tracking: <span className="font-medium text-foreground">{order.trackingToken || "-"}</span>
          </p>
          {order.status === "SEARCHING_DRIVER" && cancelRemain != null && (
            <p className="text-sm md:col-span-3">
              <span className="text-muted-foreground">Time until auto-cancel if no driver: </span>
              <span className="font-mono font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                {fmtRemain(cancelRemain)}
              </span>
            </p>
          )}
        </div>
      </section>

      <section className="rounded-xl border p-5">
        <h2 className="mb-4 text-lg font-semibold">Timeline</h2>
        <div className="overflow-x-auto pb-2">
          <div className="relative min-w-[640px] px-2 pt-6">
            <div className="absolute left-4 right-4 top-7 h-0.5 bg-border" aria-hidden />
            <div className="relative flex justify-between">
              {ORDER_FLOW.map((s, idx) => {
                const done = idx <= currentStep;
                const label = s.replace(/_/g, " ");
                return (
                  <div key={s} className="flex w-0 flex-1 flex-col items-center gap-2">
                    <div
                      className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-semibold tabular-nums shadow-sm ${
                        done
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/35 bg-background text-muted-foreground"
                      }`}
                      title={s}
                    >
                      {idx + 1}
                    </div>
                    <span
                      className={`max-w-[5.5rem] text-center text-[10px] leading-tight ${
                        done ? "font-medium text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border p-5">
        <h2 className="mb-3 text-lg font-semibold">Driver Info</h2>
        <p className="text-sm">Driver ID: {order.driverAssignment?.driverId || "-"}</p>
        <p className="text-sm">Arrived: {order.driverAssignment?.arrivedAt || "-"}</p>
        <p className="text-sm">Picked Up: {order.driverAssignment?.pickedUpAt || "-"}</p>
        <p className="text-sm">Delivered: {order.driverAssignment?.deliveredAt || "-"}</p>
        <p className="text-sm">Proof 1: {order.driverAssignment?.image1Proof ? "Uploaded" : "Missing"}</p>
        <p className="text-sm">Proof 2: {order.driverAssignment?.image2Proof ? "Uploaded" : "Optional"}</p>
        {(order.status === "PENDING_CUSTOMER_APPROVAL" ||
          order.status === "DRIVER_ASSIGNED" ||
          order.status === "DRIVER_ARRIVED") && (
          <div className="mt-3 space-y-2">
            {order.status === "PENDING_CUSTOMER_APPROVAL" && (
              <button type="button" className="rounded-md border px-3 py-2 text-sm" onClick={approveDriver}>
                Accept Driver
              </button>
            )}
            <div className="flex gap-2">
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Rejection reason (required if driver arrived)"
              />
              <button type="button" className="rounded-md border px-3 py-2 text-sm" onClick={rejectDriver}>
                Reject Driver
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border p-5">
        <h2 className="mb-3 text-lg font-semibold">Chat with Driver</h2>
        {!chatRoom ? (
          <p className="text-sm text-muted-foreground">No active chat room yet.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Driver: {chatRoom.driver?.name || "-"} | Room: {chatRoom.status}
            </p>
            <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg border bg-muted/20 p-3">
              {chatRoom.messages.map((m) => {
                const isCompany = m.senderType === "CUSTOMER";
                return (
                  <div key={m.id} className={`flex w-full ${isCompany ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[min(100%,28rem)] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                        isCompany
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-card border rounded-bl-md"
                      }`}
                    >
                      <p className={`text-[11px] ${isCompany ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                        {m.senderName} ({isCompany ? "Company" : "Driver"})
                      </p>
                      <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    </div>
                  </div>
                );
              })}
              {chatRoom.messages.length === 0 && (
                <p className="text-sm text-muted-foreground">No messages yet.</p>
              )}
            </div>
            <div className="flex gap-2">
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                disabled={chatRoom.status !== "ACTIVE" || order.status === "DELIVERED"}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendChatMessage();
                  }
                }}
                placeholder="Type your message..."
              />
              <button
                type="button"
                className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                onClick={sendChatMessage}
                disabled={chatRoom.status !== "ACTIVE" || order.status === "DELIVERED"}
              >
                Send
              </button>
            </div>
            {(chatRoom.status !== "ACTIVE" || order.status === "DELIVERED") && (
              <p className="text-xs text-muted-foreground">Chat room is closed for completed delivery.</p>
            )}
          </div>
        )}
      </section>

      {(order.status === "RETURNED" || order.status === "RETURN_DEPOSIT") && (
        <section className="rounded-lg border p-4">
          <h2 className="mb-3 text-lg font-semibold">Return Flow</h2>
          <p className="text-sm text-muted-foreground">
            Status moves from RETURNED to RETURN_DEPOSIT, then company submits feedback.
          </p>
          {order.status === "RETURN_DEPOSIT" && (
            <div className="mt-3 space-y-2">
              <textarea
                className="min-h-24 w-full rounded-md border px-3 py-2"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Describe return/deposit condition..."
              />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={conditionIssue} onChange={(e) => setConditionIssue(e.target.checked)} />
                Package condition issue
              </label>
              <button type="button" className="rounded-md border px-3 py-2 text-sm" onClick={submitFeedback}>
                Save Feedback
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
