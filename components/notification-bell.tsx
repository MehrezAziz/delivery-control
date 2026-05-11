"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { connectSocket, disconnectSocket, getSocket } from "@/lib/socket";
import {
  buildCsDisplayNotifications,
  excludeCsSupportTicketWhenViewing,
} from "@/lib/cs-notification-grouping";
import { toast } from "sonner";

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  priority: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  groupKey?: string | null;
  sentAt: string;
  readAt: string | null;
}

interface DisplayNotification extends Notification {
  groupCount?: number;
  groupedIds?: string[];
}

function tryDesktopNotification(notif: Pick<Notification, "id" | "title" | "body">) {
  if (typeof window === "undefined" || typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  if (typeof document !== "undefined" && document.visibilityState === "visible") return;
  try {
    new Notification(notif.title || "Notification", {
      body: (notif.body ?? "").trim() || undefined,
      tag: notif.id,
    });
  } catch {
    // Older browsers / denied after grant
  }
}

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [desktopPerm, setDesktopPerm] = useState<NotificationPermission | "unsupported">("unsupported");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Determine if we're in admin or CS panel
  const isAdmin = pathname.startsWith("/dashboard");
  const basePath = isAdmin ? "/dashboard" : "/cs";

  const suppressCsSupportTicketId = useMemo(() => {
    const m = pathname.match(/^\/cs\/support\/([0-9a-f-]{36})/i);
    return m?.[1] ?? null;
  }, [pathname]);
  const suppressCsSupportTicketIdRef = useRef<string | null>(null);
  suppressCsSupportTicketIdRef.current = suppressCsSupportTicketId;

  useEffect(() => {
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      setDesktopPerm("unsupported");
      return;
    }
    setDesktopPerm(Notification.permission);
  }, []);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/unread-count", {
        credentials: "include",
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(typeof data.count === "number" ? data.count : 0);
      }
    } catch {}
  }, []);

  // Fetch recent notifications
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=10&page=1", {
        credentials: "include",
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        const rows = Array.isArray(json) ? json : json.data ?? [];
        setNotifications(Array.isArray(rows) ? rows : []);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  // Connect WebSocket and listen for notifications
  useEffect(() => {
    async function initSocket() {
      try {
        const meRes = await fetch("/api/auth/me");
        if (!meRes.ok) return;
        const me = await meRes.json();
        if (!me.token) return;

        const socket = connectSocket(me.token);
        socket.on("notification", (notif: Notification) => {
          const activeTicket = suppressCsSupportTicketIdRef.current;
          const isCompanyReply =
            notif.type === "CUSTOMER_REPLIED_TICKET" &&
            notif.relatedEntityType === "SupportTicket" &&
            notif.relatedEntityId &&
            activeTicket &&
            notif.relatedEntityId === activeTicket;
          if (isCompanyReply) {
            void fetch("/api/notifications/thread/read", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ groupKey: `support:${activeTicket}` }),
              credentials: "include",
            }).catch(() => {});
            void fetchUnreadCount();
            return;
          }
          setUnreadCount((c) => c + 1);
          setNotifications((prev) => [notif, ...prev].slice(0, 10));
          toast(notif.title, { description: notif.body });
          tryDesktopNotification(notif);
        });
      } catch {}
    }

    fetchUnreadCount();
    initSocket();

    // Poll unread count every 15s as fallback
    const interval = setInterval(fetchUnreadCount, 15000);

    return () => {
      clearInterval(interval);
      disconnectSocket();
    };
  }, [fetchUnreadCount]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function onCsRefresh() {
      void fetchUnreadCount();
    }
    window.addEventListener("dc-cs-notifications-refresh", onCsRefresh);
    return () => window.removeEventListener("dc-cs-notifications-refresh", onCsRefresh);
  }, [fetchUnreadCount]);

  const handleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen) fetchNotifications();
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch("/api/notifications/read-all", { method: "PATCH", credentials: "include" });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
    } catch {}
  };

  const handleMarkRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "PATCH", credentials: "include" });
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
    } catch {}
  };

  const markManyAsRead = async (ids: string[]) => {
    if (!ids.length) return;
    try {
      await Promise.all(ids.map((id) => fetch(`/api/notifications/${id}/read`, { method: "PATCH", credentials: "include" })));
      const now = new Date().toISOString();
      setUnreadCount((c) => Math.max(0, c - ids.length));
      setNotifications((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, readAt: n.readAt || now } : n)));
    } catch {}
  };

  const handleNotificationClick = async (n: DisplayNotification) => {
    if (!n.readAt) {
      if (n.groupedIds && n.groupedIds.length > 1) await markManyAsRead(n.groupedIds);
      else await handleMarkRead(n.id);
    }
    setIsOpen(false);

    // Navigate based on notification type and relatedEntityType
    if (
      n.type === "CUSTOMER_REJECTED_ARRIVED_DRIVER_CS" ||
      n.type === "ARRIVAL_CONFLICT_DRIVER_FEEDBACK_CS"
    ) {
      router.push(`${basePath}/order-arrival-conflicts`);
    } else if (n.relatedEntityType === 'SupportTicket' && n.relatedEntityId) {
      router.push(`${basePath}/support/${n.relatedEntityId}`);
    } else if (n.relatedEntityType === 'Dispute' && n.relatedEntityId) {
      router.push(`${basePath}/disputes`);
    } else if (
      (n.relatedEntityType === "Order" || n.relatedEntityType === "ChatRoom") &&
      n.relatedEntityId
    ) {
      router.push(`${basePath}/orders/${n.relatedEntityId}`);
    } else if (n.type === 'NEW_DRIVER_REGISTRATION' || n.type === 'DRIVER_DOCUMENTS_SUBMITTED') {
      router.push(`${basePath}/drivers`);
    } else if (n.type === 'LARGE_WITHDRAWAL_REQUEST') {
      if (
        n.relatedEntityType === "WithdrawalRequest" ||
        n.relatedEntityType === "DriverWithdrawalRequest"
      ) {
        router.push(`${basePath}/fiat-withdrawals`);
      } else {
        router.push(`${basePath}/finances`);
      }
    } else if (n.type === 'DRIVER_DEBT_THRESHOLD') {
      router.push(`${basePath}/finances`);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h`;
    return `${Math.floor(diffHr / 24)}d`;
  };

  const priorityColor: Record<string, string> = {
    LOW: "text-zinc-400",
    MEDIUM: "text-blue-500",
    HIGH: "text-orange-500",
    CRITICAL: "text-red-600",
  };

  const displayNotifications = useMemo<DisplayNotification[]>(() => {
    if (isAdmin) return notifications;
    const filtered = excludeCsSupportTicketWhenViewing(notifications, suppressCsSupportTicketId);
    return buildCsDisplayNotifications(filtered);
  }, [notifications, isAdmin, suppressCsSupportTicketId]);

  return (
    <div className="relative" ref={dropdownRef}>
      <Button variant="ghost" size="icon" className="relative" onClick={handleOpen}>
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border bg-popover shadow-lg z-50">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="text-sm font-semibold text-popover-foreground">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs text-blue-600 hover:underline">
                Mark all read
              </button>
            )}
          </div>

          {desktopPerm === "default" && (
            <div className="border-b px-4 py-2 flex flex-col gap-1.5 bg-muted/40">
              <p className="text-[11px] text-muted-foreground leading-snug">
                Get a system notification when something arrives while this tab is in the background.
              </p>
              <button
                type="button"
                className="text-xs font-medium text-blue-600 hover:underline self-start"
                onClick={async () => {
                  try {
                    const p = await Notification.requestPermission();
                    setDesktopPerm(p);
                  } catch {
                    setDesktopPerm("denied");
                  }
                }}
              >
                Enable desktop alerts
              </button>
            </div>
          )}

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-muted-foreground" />
              </div>
            ) : displayNotifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No notifications</div>
            ) : (
              displayNotifications.map((n) => (
                <div
                  key={n.groupedIds?.length ? `g:${n.groupedIds.join(",")}` : n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`flex gap-3 border-b px-4 py-3 cursor-pointer hover:bg-accent transition-colors ${!n.readAt ? "bg-accent/50" : ""}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium truncate text-popover-foreground ${!n.readAt ? "font-semibold" : ""}`}>
                        {n.title || "Notification"}
                      </span>
                      <span className={`text-[10px] font-bold shrink-0 ${priorityColor[n.priority] || "text-muted-foreground"}`}>
                        {n.priority}
                      </span>
                    </div>
                    <p className="text-xs mt-1 line-clamp-3 break-words text-popover-foreground/90">
                      {(n.body ?? "").trim() || "—"}
                    </p>
                    <span className="text-[10px] text-muted-foreground mt-1">{formatTime(n.sentAt)}</span>
                  </div>
                  {n.groupCount && n.groupCount > 1 ? (
                    <div className="mt-1 min-w-5 h-5 px-1 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center">
                      {n.groupCount}
                    </div>
                  ) : !n.readAt ? (
                    <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                  ) : null}
                </div>
              ))
            )}
          </div>
          <div className="border-t px-4 py-2 flex flex-col gap-1">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                router.push(isAdmin ? "/dashboard/device-push" : "/cs/device-push");
              }}
              className="text-xs text-blue-600 hover:underline text-left"
            >
              Mobile push (FCM) for this account
            </button>
            {!isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  router.push("/cs/notifications");
                }}
                className="text-xs text-blue-600 hover:underline text-left"
              >
                View all notifications
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
