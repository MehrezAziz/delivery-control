"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatCoinsCeil3 } from "@/lib/format-coins";
import { buildIdempotencyKey } from "@/lib/idempotency";
import { connectSocket, getSocket } from "@/lib/socket";
import {
  Camera,
  CheckCircle2,
  Clock,
  MessageCircle,
  Package,
  PanelRightClose,
  Pencil,
  Truck,
  User,
} from "lucide-react";

type ReturnDepositFeedbackRow = {
  driverId: string;
  feedback: string;
  conditionIssue: boolean;
};

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
    customerCallCountBeforeReturn?: number | null;
    returnEvidenceImageUrl?: string | null;
    driver?: {
      user?: { firstName?: string | null; secondName?: string | null; phone?: string | null };
      performanceMetrics?: {
        avgRating?: string | number | null;
        avgDeliveryTimeMinutes?: number | null;
        completionRate?: string | number | null;
        completedOrders?: number | null;
        totalOrders?: number | null;
      } | null;
      ratingsReceived?: Array<{ score: number; comment: string | null; createdAt: string }>;
    } | null;
  } | null;
  returnDepositFeedback?: {
    feedback: string;
    conditionIssue: boolean;
  } | null;
  returnDepositFeedbacks?: ReturnDepositFeedbackRow[];
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

const TIMELINE_BASE: { key: string; label: string; color: string }[] = [
  { key: "SEARCHING_DRIVER", label: "Searching driver", color: "bg-amber-500" },
  { key: "PENDING_CUSTOMER_APPROVAL", label: "Customer approval", color: "bg-orange-500" },
  { key: "DRIVER_ASSIGNED", label: "Driver assigned", color: "bg-sky-500" },
  { key: "DRIVER_ARRIVED", label: "Arrived", color: "bg-violet-500" },
  { key: "PICKED_UP", label: "Picked up", color: "bg-orange-600" },
  { key: "DELIVERING", label: "Delivering", color: "bg-indigo-500" },
];

function orderStatusRank(status: string): number {
  const order = [
    "SEARCHING_DRIVER",
    "PENDING_CUSTOMER_APPROVAL",
    "DRIVER_ASSIGNED",
    "DRIVER_ARRIVED",
    "PICKED_UP",
    "DELIVERING",
    "DELIVERED",
    "RETURNED",
    "RETURN_DEPOSIT",
  ];
  const i = order.indexOf(status);
  return i >= 0 ? i : 0;
}

const TRACKING_LIVE_STATUSES = new Set(["DRIVER_ARRIVED", "PICKED_UP", "DELIVERING"]);

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [feedback, setFeedback] = useState("");
  const [conditionIssue, setConditionIssue] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [chatRoom, setChatRoom] = useState<ChatRoomDto>(null);
  const [chatFetched, setChatFetched] = useState(false);
  const [chatText, setChatText] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [cancelRemain, setCancelRemain] = useState<number | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const chatSectionRef = useRef<HTMLElement | null>(null);
  const chatComposerRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const prevChatMessageLenRef = useRef(0);
  const handledChatQueryRef = useRef(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [returnFeedbackEditing, setReturnFeedbackEditing] = useState(false);

  /** Scroll message list internally, then align the composer to the bottom of the viewport. Never use scrollIntoView on message nodes — it scrolls the page to the last bubble and hides the input. */
  const scrollChatIntoView = useCallback((opts?: { focusInput?: boolean }) => {
    const innerBehavior: ScrollBehavior = opts?.focusInput ? "auto" : "smooth";
    requestAnimationFrame(() => {
      const el = chatScrollRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: innerBehavior });
      requestAnimationFrame(() => {
        chatComposerRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "end",
          inline: "nearest",
        });
        if (opts?.focusInput) {
          window.setTimeout(() => {
            chatInputRef.current?.focus({ preventScroll: true });
          }, 200);
        }
      });
    });
  }, []);

  const loadChat = useCallback(async () => {
    try {
      const chatRes = await fetch(`/api/company/orders/${params.id}/chat`, { cache: "no-store" });
      const chatData = await chatRes.json();
      if (chatRes.ok) setChatRoom(chatData);
    } catch {
      /* keep previous */
    } finally {
      setChatFetched(true);
    }
  }, [params.id]);

  const loadOrder = useCallback(async () => {
    const res = await fetch("/api/company/orders", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) return setMessage(data?.error || "Failed to load order");
    const found = (Array.isArray(data) ? data : []).find((x: Order) => x.id === params.id) || null;
    setOrder(found);
    const drvId = found?.driverAssignment?.driverId;
    const list = found?.returnDepositFeedbacks;
    const matched =
      drvId && list?.length
        ? list.find((f: ReturnDepositFeedbackRow) => f.driverId === drvId)
        : undefined;
    const effectiveFb = matched ?? found?.returnDepositFeedback ?? null;
    if (effectiveFb) {
      setFeedback(effectiveFb.feedback || "");
      setConditionIssue(!!effectiveFb.conditionIssue);
      setReturnFeedbackEditing(false);
    } else {
      setReturnFeedbackEditing(true);
    }
    setCancelRemain(computeCancelRemaining(found));
  }, [params.id]);

  const chatMessages = chatRoom?.messages;
  const chatMsgLen = chatMessages?.length ?? 0;
  const lastChatMessage = chatMsgLen > 0 && chatMessages ? chatMessages[chatMsgLen - 1] : null;

  useEffect(() => {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("dc_company_chat_order_id", String(params.id));
    }
    prevChatMessageLenRef.current = 0;
    handledChatQueryRef.current = false;
    setChatFetched(false);
    return () => {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem("dc_company_chat_order_id");
      }
    };
  }, [params.id]);

  /** Opened from a “new message” notification (?chat=1): show latest messages, composer, and focus the input. */
  useEffect(() => {
    if (searchParams.get("chat") !== "1") return;
    if (!order || !chatFetched || handledChatQueryRef.current) return;
    handledChatQueryRef.current = true;
    router.replace(`/company/orders/${params.id}`, { scroll: false });
    if (chatRoom) {
      setIsNearBottom(true);
      scrollChatIntoView({ focusInput: true });
    } else {
      requestAnimationFrame(() => chatSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
    }
  }, [order, chatFetched, chatRoom, searchParams, params.id, router, scrollChatIntoView]);

  /** Mark chat-thread notifications read on load and whenever messages update so the bell badge can go to 0. */
  useEffect(() => {
    const orderId = String(params.id);
    let cancelled = false;
    async function markChatNotificationsRead() {
      try {
        await fetch("/api/company/notifications/thread/read", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ groupKey: `chat:${orderId}` }),
        });
        if (!cancelled && typeof window !== "undefined") {
          window.dispatchEvent(new Event("dc-company-notifications-refresh"));
        }
      } catch {
        /* ignore */
      }
    }
    void markChatNotificationsRead();
    return () => {
      cancelled = true;
    };
  }, [params.id, chatMsgLen, lastChatMessage?.id]);

  /** New chat activity: keep the thread tail and composer in view (any party). */
  useEffect(() => {
    if (!lastChatMessage || chatMsgLen === 0) return;
    const prevLen = prevChatMessageLenRef.current;
    const increased = chatMsgLen > prevLen;
    prevChatMessageLenRef.current = chatMsgLen;
    if (!increased) return;
    setIsNearBottom(true);
    scrollChatIntoView();
  }, [chatMsgLen, lastChatMessage?.id, scrollChatIntoView]);

  useEffect(() => {
    if (order?.status !== "SEARCHING_DRIVER") return;
    const t = setInterval(() => setCancelRemain(computeCancelRemaining(order)), 1000);
    return () => clearInterval(t);
  }, [order]);

  /** After expanding chat from minimized, jump to the latest message (not the top). */
  useEffect(() => {
    if (chatCollapsed) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = chatScrollRef.current;
        if (el) el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
        setIsNearBottom(true);
      });
    });
  }, [chatCollapsed]);

  /** Keep the message list scrolled to the tail only inside its box — do not scrollIntoView on inner nodes (that steals viewport from the composer). */
  useEffect(() => {
    if (!isNearBottom) return;
    const el = chatScrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [chatMsgLen, isNearBottom]);

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
    const onOrderUpdated = (payload: { orderId?: string }) => {
      if (payload?.orderId === orderIdStr) {
        void loadOrder();
        void loadChat();
      }
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
        socket.on("order_updated", onOrderUpdated);
      }
    };
    void run();
    const poll = setInterval(() => {
      void loadOrder();
      void loadChat();
    }, 4000);
    return () => {
      clearInterval(poll);
      const socket = getSocket();
      socket?.off("notification", onNotif);
      socket?.off("order_chat_refresh", onChatRefresh);
      socket?.off("order_updated", onOrderUpdated);
    };
  }, [params.id, loadOrder, loadChat]);

  const timelineSteps = useMemo(() => {
    const st = order?.status || "";
    const base = [...TIMELINE_BASE];
    if (st === "DELIVERED") {
      return [...base, { key: "DELIVERED", label: "Delivered", color: "bg-emerald-500" }];
    }
    if (st === "RETURNED") {
      return [...base, { key: "RETURNED", label: "Returned", color: "bg-rose-500" }];
    }
    if (st === "RETURN_DEPOSIT") {
      return [
        ...base,
        { key: "RETURNED", label: "Returned", color: "bg-rose-500" },
        { key: "RETURN_DEPOSIT", label: "Return deposit", color: "bg-fuchsia-600" },
      ];
    }
    if (["CANCELLED", "REFUNDED", "DISPUTED"].includes(st)) {
      return base;
    }
    if (orderStatusRank(st) <= orderStatusRank("DELIVERING")) {
      return [...base, { key: "OUTCOME", label: "Delivered or returned", color: "bg-slate-400" }];
    }
    return [...base, { key: "DELIVERED", label: "Delivered", color: "bg-emerald-500" }];
  }, [order?.status]);

  const stepDone = (stepKey: string) => {
    const st = order?.status || "";
    if (stepKey === "OUTCOME") return false;
    if (stepKey === "DELIVERED") return st === "DELIVERED";
    if (stepKey === "RETURNED") return st === "RETURNED" || st === "RETURN_DEPOSIT";
    if (stepKey === "RETURN_DEPOSIT") return st === "RETURN_DEPOSIT";
    return orderStatusRank(st) >= orderStatusRank(stepKey);
  };

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
    setReturnFeedbackEditing(false);
    await loadOrder();
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

  const cancelSearchingOrder = async () => {
    if (!confirm("Cancel this order and refund the reserved budget? This cannot be undone.")) return;
    const res = await fetch(`/api/company/orders/${params.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) return setMessage(data?.error || data?.message || "Failed to cancel order");
    setMessage("Order cancelled.");
    router.push("/company/orders");
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
    setIsNearBottom(true);
    await loadChat();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollChatIntoView({ focusInput: true }));
    });
  };

  const effectiveReturnDepositFeedback = useMemo(() => {
    const drvId = order?.driverAssignment?.driverId;
    const list = order?.returnDepositFeedbacks;
    if (drvId && list?.length) {
      const m = list.find((f) => f.driverId === drvId);
      if (m) return m;
    }
    return order?.returnDepositFeedback ?? null;
  }, [order]);

  if (!order) return <div className="text-sm text-muted-foreground">Loading order details...</div>;

  const trackingLive = Boolean(order.trackingToken && TRACKING_LIVE_STATUSES.has(order.status));

  const fmtRemain = (sec: number | null) => {
    if (sec == null) return null;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const chatDisabled = chatRoom && (chatRoom.status !== "ACTIVE" || order.status === "DELIVERED");

  return (
    <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
      <div className="min-w-0 flex-1 space-y-6">
      {message && <div className="rounded-md border bg-muted px-3 py-2 text-sm">{message}</div>}
      <section className="rounded-xl border bg-gradient-to-br from-background to-muted/30 p-5 shadow-sm">
        <h1 className="text-xl font-semibold">Order {order.id}</h1>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          <p className="text-sm text-muted-foreground">
            Status: <span className="font-medium text-foreground">{order.status}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Price: <span className="font-medium text-foreground">{formatCoinsCeil3(order.price || 0)}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Tracking:{" "}
            {order.trackingToken ? (
              trackingLive ? (
                <Link
                  href={`/company/orders/${order.id}/track`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  {order.trackingToken}
                </Link>
              ) : (
                <span className="font-mono font-medium text-foreground">{order.trackingToken}</span>
              )
            ) : (
              <span className="font-medium text-foreground">—</span>
            )}
          </p>
          {order.trackingToken && !trackingLive && (
            <p className="text-xs text-muted-foreground md:col-span-3">
              Live map opens when the driver has arrived and is on the way (status: arrived, picked up, or delivering).
            </p>
          )}
          {order.status === "SEARCHING_DRIVER" && cancelRemain != null && (
            <p className="text-sm md:col-span-3">
              <span className="text-muted-foreground">Time until auto-cancel if no driver: </span>
              <span className="font-mono font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                {fmtRemain(cancelRemain)}
              </span>
            </p>
          )}
        </div>
        {order.status === "SEARCHING_DRIVER" && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive hover:bg-destructive/15"
              onClick={cancelSearchingOrder}
            >
              Cancel order (withdraw)
            </button>
            <p className="w-full text-xs text-muted-foreground">
              To edit weight, route, or confirmation delay while still searching, use{" "}
              <code className="rounded bg-muted px-1">PATCH /api/company/orders/{"{id}"}</code> with the same JSON body
              as create order (preview recommended first).
            </p>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50/80 to-background p-5 shadow-sm dark:border-slate-800 dark:from-slate-950/40">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Clock className="h-5 w-5 text-sky-600" aria-hidden />
          Order timeline
        </h2>
        <div className="overflow-x-auto pb-2">
          <div className="relative min-w-[min(100%,720px)] px-1 pt-4">
            <div
              className="absolute left-6 right-6 top-[18px] h-1 rounded-full bg-gradient-to-r from-slate-200 via-slate-200 to-slate-100 dark:from-slate-700 dark:via-slate-700 dark:to-slate-800"
              aria-hidden
            />
            <div className="relative flex justify-between gap-1">
              {timelineSteps.map((step, idx) => {
                const done = stepDone(step.key);
                return (
                  <div key={`${step.key}-${idx}`} className="flex w-0 min-w-[4.5rem] flex-1 flex-col items-center gap-2">
                    <div
                      className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums text-white shadow-md ring-2 ring-white dark:ring-background ${
                        done ? step.color : "bg-slate-300 dark:bg-slate-600"
                      }`}
                      title={step.key}
                    >
                      {done ? <CheckCircle2 className="h-5 w-5 text-white" strokeWidth={2.5} /> : idx + 1}
                    </div>
                    <span
                      className={`max-w-[6rem] text-center text-[10px] font-medium leading-tight ${
                        done ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-card shadow-sm dark:border-slate-800">
        <div className="border-b border-slate-100 bg-gradient-to-r from-sky-50 to-indigo-50/50 px-5 py-3 dark:border-slate-800 dark:from-sky-950/30 dark:to-indigo-950/20">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Truck className="h-5 w-5 text-sky-600" aria-hidden />
            Driver
          </h2>
        </div>
        <div className="space-y-4 p-5">
          {order.driverAssignment?.driver && (
            <div className="rounded-lg border border-slate-100 bg-muted/20 p-4 dark:border-slate-800">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Profile</p>
              <p className="mt-1 text-base font-semibold text-foreground">
                {[order.driverAssignment.driver.user?.firstName, order.driverAssignment.driver.user?.secondName]
                  .filter(Boolean)
                  .join(" ")
                  .trim() || "—"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Phone:{" "}
                <span className="font-medium text-foreground">
                  {order.driverAssignment.driver.user?.phone?.trim() || "—"}
                </span>
              </p>
              {!order.driverAssignment.driver.performanceMetrics && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Performance statistics are not available yet for this driver (e.g. new account or no completed deliveries).
                </p>
              )}
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-[11px] uppercase text-muted-foreground">Avg rating</p>
                  <p className="text-sm font-semibold">
                    {order.driverAssignment.driver.performanceMetrics?.avgRating != null
                      ? Number(order.driverAssignment.driver.performanceMetrics.avgRating).toFixed(1)
                      : "—"}{" "}
                    <span className="text-xs font-normal text-muted-foreground">/ 10</span>
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase text-muted-foreground">Avg delivery time</p>
                  <p className="text-sm font-semibold">
                    {order.driverAssignment.driver.performanceMetrics?.avgDeliveryTimeMinutes != null
                      ? `${order.driverAssignment.driver.performanceMetrics.avgDeliveryTimeMinutes} min`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase text-muted-foreground">Completion</p>
                  <p className="text-sm font-semibold">
                    {order.driverAssignment.driver.performanceMetrics?.completionRate != null
                      ? `${Number(order.driverAssignment.driver.performanceMetrics.completionRate).toFixed(0)}%`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase text-muted-foreground">Orders</p>
                  <p className="text-sm font-semibold">
                    {order.driverAssignment.driver.performanceMetrics?.completedOrders ?? "—"}
                    {order.driverAssignment.driver.performanceMetrics?.totalOrders != null
                      ? ` / ${order.driverAssignment.driver.performanceMetrics.totalOrders}`
                      : ""}
                  </p>
                </div>
              </div>
              {order.driverAssignment.driver.ratingsReceived &&
                order.driverAssignment.driver.ratingsReceived.filter((r) => r.comment?.trim()).length > 0 && (
                  <div className="mt-3 border-t border-dashed pt-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Recent comments
                    </p>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-foreground">
                      {order.driverAssignment.driver.ratingsReceived
                        .filter((r) => r.comment?.trim())
                        .slice(0, 6)
                        .map((r, idx) => (
                          <li key={`${r.createdAt}-${r.score}-${idx}`} className="break-words">
                            <span className="text-muted-foreground">({r.score}/10)</span> {r.comment}
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              <p className="mt-3 font-mono text-[11px] text-muted-foreground">
                ID: {order.driverAssignment.driverId || "—"}
              </p>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-lg border border-slate-100 bg-muted/30 p-3 dark:border-slate-800">
              <Clock className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Arrived</p>
                <p className="text-sm">{order.driverAssignment?.arrivedAt || "—"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-slate-100 bg-muted/30 p-3 dark:border-slate-800">
              <Package className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Picked up</p>
                <p className="text-sm">{order.driverAssignment?.pickedUpAt || "—"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-slate-100 bg-muted/30 p-3 dark:border-slate-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Delivered</p>
                <p className="text-sm">{order.driverAssignment?.deliveredAt || "—"}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                order.driverAssignment?.image1Proof
                  ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                  : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
              }`}
            >
              <Camera className="h-3.5 w-3.5" />
              Proof 1 {order.driverAssignment?.image1Proof ? "uploaded" : "required"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-800 dark:bg-slate-800 dark:text-slate-200">
              <Camera className="h-3.5 w-3.5" />
              Proof 2 {order.driverAssignment?.image2Proof ? "uploaded" : "optional"}
            </span>
          </div>
          {order.status === "DELIVERED" && (order.driverAssignment?.image1Proof || order.driverAssignment?.image2Proof) && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {order.driverAssignment?.image1Proof ? (
                <div>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Delivery proof (image 1)
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={order.driverAssignment.image1Proof}
                    alt="Delivery proof 1"
                    className="max-h-52 w-full rounded-md border object-contain bg-muted"
                  />
                </div>
              ) : null}
              {order.driverAssignment?.image2Proof ? (
                <div>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Delivery proof (image 2)
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={order.driverAssignment.image2Proof}
                    alt="Delivery proof 2"
                    className="max-h-52 w-full rounded-md border object-contain bg-muted"
                  />
                </div>
              ) : null}
            </div>
          )}
          {(order.status === "RETURNED" || order.status === "RETURN_DEPOSIT") && (
            <div className="mt-4 space-y-3 rounded-lg border border-rose-200/70 bg-rose-50/50 p-4 dark:border-rose-900/60 dark:bg-rose-950/25">
              <p className="text-sm font-semibold text-foreground">Return — driver details</p>
              <p className="text-sm">
                <span className="text-muted-foreground">Calls to customer before return: </span>
                <span className="font-medium tabular-nums">
                  {order.driverAssignment?.customerCallCountBeforeReturn != null
                    ? String(order.driverAssignment.customerCallCountBeforeReturn)
                    : "—"}
                </span>
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {order.driverAssignment?.image1Proof ? (
                  <div>
                    <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Proof image 1</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={order.driverAssignment.image1Proof}
                      alt="Proof 1"
                      className="max-h-52 w-full rounded-md border object-contain bg-muted"
                    />
                  </div>
                ) : null}
                {order.driverAssignment?.image2Proof ? (
                  <div>
                    <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Proof image 2</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={order.driverAssignment.image2Proof}
                      alt="Proof 2"
                      className="max-h-52 w-full rounded-md border object-contain bg-muted"
                    />
                  </div>
                ) : null}
                {order.driverAssignment?.returnEvidenceImageUrl ? (
                  <div className="sm:col-span-2">
                    <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Return screenshot (gallery)
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={order.driverAssignment.returnEvidenceImageUrl}
                      alt="Return evidence"
                      className="max-h-52 w-full max-w-md rounded-md border object-contain bg-muted"
                    />
                  </div>
                ) : null}
              </div>
            </div>
          )}
        {(order.status === "PENDING_CUSTOMER_APPROVAL" ||
          order.status === "DRIVER_ASSIGNED" ||
          order.status === "DRIVER_ARRIVED") && (
          <div className="mt-3 space-y-2 border-t border-dashed pt-4">
            {order.status === "PENDING_CUSTOMER_APPROVAL" && (
              <button type="button" className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground" onClick={approveDriver}>
                Accept Driver
              </button>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Rejection reason (required if driver arrived)"
              />
              <button type="button" className="rounded-md border px-3 py-2 text-sm whitespace-nowrap" onClick={rejectDriver}>
                Reject Driver
              </button>
            </div>
          </div>
        )}
        </div>
      </section>

      {(order.status === "RETURNED" || order.status === "RETURN_DEPOSIT") && (
        <section className="rounded-lg border p-4">
          <h2 className="mb-3 text-lg font-semibold">Return Flow</h2>
          <p className="text-sm text-muted-foreground">
            Status moves from RETURNED to RETURN_DEPOSIT, then company submits feedback.
          </p>
          {order.status === "RETURN_DEPOSIT" && (
            <div className="mt-3 space-y-2">
              {effectiveReturnDepositFeedback && !returnFeedbackEditing ? (
                <div className="space-y-2 rounded-md border bg-muted/30 px-3 py-3">
                  <p className="whitespace-pre-wrap text-sm">{effectiveReturnDepositFeedback.feedback || "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {effectiveReturnDepositFeedback.conditionIssue
                      ? "Package condition issue reported."
                      : "No package condition issue."}
                  </p>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
                    onClick={() => setReturnFeedbackEditing(true)}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    Edit
                  </button>
                </div>
              ) : (
                <>
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
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="rounded-md border px-3 py-2 text-sm" onClick={() => void submitFeedback()}>
                      Save Feedback
                    </button>
                    {effectiveReturnDepositFeedback && returnFeedbackEditing && (
                      <button
                        type="button"
                        className="rounded-md border border-transparent px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
                        onClick={() => {
                          setReturnFeedbackEditing(false);
                          setFeedback(effectiveReturnDepositFeedback?.feedback || "");
                          setConditionIssue(!!effectiveReturnDepositFeedback?.conditionIssue);
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      )}
      </div>

      <aside className="w-full shrink-0 xl:sticky xl:top-4 xl:w-[380px] xl:self-start">
        {chatCollapsed ? (
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 rounded-xl border bg-card px-4 py-3 text-left shadow-sm transition hover:bg-muted/50 xl:flex-col xl:py-6"
            onClick={() => setChatCollapsed(false)}
          >
            <span className="flex items-center gap-2 font-semibold">
              <MessageCircle className="h-5 w-5 text-sky-600" />
              Chat with driver
            </span>
            <span className="text-xs text-muted-foreground">Click to open</span>
          </button>
        ) : (
          <section
            ref={chatSectionRef}
            className="flex max-h-[min(78vh,720px)] flex-col overflow-hidden rounded-xl border bg-card shadow-md"
          >
            <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <MessageCircle className="h-4 w-4" />
                Chat with driver
              </h2>
              <button
                type="button"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Minimize chat"
                onClick={() => setChatCollapsed(true)}
              >
                <PanelRightClose className="h-4 w-4" />
              </button>
            </div>
            {!chatRoom ? (
              <p className="p-4 text-sm text-muted-foreground">No active chat room yet.</p>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <p className="border-b px-3 py-2 text-xs text-muted-foreground">
                  {chatRoom.driver?.name || "Driver"} · {chatRoom.status}
                </p>
                <div
                  ref={chatScrollRef}
                  className="min-h-[200px] flex-1 space-y-2 overflow-y-auto p-3"
                  onScroll={() => {
                    const el = chatScrollRef.current;
                    if (!el) return;
                    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
                    setIsNearBottom(remaining < 80);
                  }}
                >
                  {chatRoom.messages.map((m) => {
                    const isCompany = m.senderType === "CUSTOMER";
                    return (
                      <div key={m.id} className={`flex w-full ${isCompany ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[min(100%,17rem)] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                            isCompany
                              ? "rounded-br-md bg-primary text-primary-foreground"
                              : "rounded-bl-md border bg-card"
                          }`}
                        >
                          <p
                            className={`text-[11px] ${isCompany ? "text-primary-foreground/80" : "text-muted-foreground"}`}
                          >
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
                <div ref={chatComposerRef} className="flex gap-2 border-t p-3">
                  <input
                    ref={chatInputRef}
                    className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm"
                    value={chatText}
                    onChange={(e) => setChatText(e.target.value)}
                    disabled={!!chatDisabled}
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
                    disabled={!!chatDisabled}
                  >
                    Send
                  </button>
                </div>
                {chatDisabled && (
                  <p className="px-3 pb-3 text-xs text-muted-foreground">Chat is closed for this order.</p>
                )}
              </div>
            )}
          </section>
        )}
      </aside>
    </div>
  );
}
