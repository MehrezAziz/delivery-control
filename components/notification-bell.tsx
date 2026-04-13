"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { connectSocket, disconnectSocket, getSocket } from "@/lib/socket";
import { toast } from "sonner";

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  priority: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  sentAt: string;
  readAt: string | null;
}

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Determine if we're in admin or CS panel
  const isAdmin = pathname.startsWith("/dashboard");
  const basePath = isAdmin ? "/dashboard" : "/cs";

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
          setUnreadCount((c) => c + 1);
          setNotifications((prev) => [notif, ...prev].slice(0, 10));
          toast(notif.title, { description: notif.body });
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

  const handleNotificationClick = async (n: Notification) => {
    if (!n.readAt) await handleMarkRead(n.id);
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
    } else if (n.relatedEntityType === 'Order' && n.relatedEntityId) {
      router.push(`${basePath}/orders/${n.relatedEntityId}`);
    } else if (n.type === 'NEW_DRIVER_REGISTRATION' || n.type === 'DRIVER_DOCUMENTS_SUBMITTED') {
      router.push(`${basePath}/drivers`);
    } else if (n.type === 'LARGE_WITHDRAWAL_REQUEST' || n.type === 'DRIVER_DEBT_THRESHOLD') {
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

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-muted-foreground" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No notifications</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
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
                  {!n.readAt && <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
