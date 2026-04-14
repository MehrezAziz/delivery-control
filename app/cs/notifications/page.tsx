"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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

interface DisplayNotification extends Notification {
  groupCount?: number;
  groupedIds?: string[];
}

const CS_GROUP_TYPES = new Set(["NEW_SUPPORT_TICKET", "NEW_ORDER_FOR_CUSTOMER_SERVICE"]);

export default function CsNotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=100&page=1", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = await res.json();
      const rows = Array.isArray(json) ? json : json.data ?? [];
      setNotifications(Array.isArray(rows) ? rows : []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const displayNotifications = useMemo<DisplayNotification[]>(() => {
    const grouped: DisplayNotification[] = [];
    const groupedByType = new Map<string, DisplayNotification>();
    for (const n of notifications) {
      const canGroup = !n.readAt && CS_GROUP_TYPES.has(n.type);
      if (!canGroup) {
        grouped.push(n);
        continue;
      }
      const existing = groupedByType.get(n.type);
      if (!existing) {
        const first: DisplayNotification = { ...n, groupCount: 1, groupedIds: [n.id] };
        groupedByType.set(n.type, first);
        grouped.push(first);
      } else {
        existing.groupCount = (existing.groupCount || 1) + 1;
        existing.groupedIds = [...(existing.groupedIds || []), n.id];
      }
    }
    return grouped.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
  }, [notifications]);

  const markOneAsRead = useCallback(async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "PATCH", credentials: "include" });
      const now = new Date().toISOString();
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: n.readAt || now } : n)));
    } catch {}
  }, []);

  const markManyAsRead = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    try {
      await Promise.all(ids.map((id) => fetch(`/api/notifications/${id}/read`, { method: "PATCH", credentials: "include" })));
      const now = new Date().toISOString();
      setNotifications((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, readAt: n.readAt || now } : n)));
    } catch {}
  }, []);

  const routeForNotification = (n: DisplayNotification): string => {
    if (n.groupCount && n.groupCount > 1) {
      if (n.type === "NEW_SUPPORT_TICKET") return "/cs/support";
      if (n.type === "NEW_ORDER_FOR_CUSTOMER_SERVICE") return "/cs/orders";
    }
    if (n.relatedEntityType === "SupportTicket" && n.relatedEntityId) return `/cs/support/${n.relatedEntityId}`;
    if (n.relatedEntityType === "Order" && n.relatedEntityId) return `/cs/orders/${n.relatedEntityId}`;
    return "/cs";
  };

  const handleClick = async (n: DisplayNotification) => {
    if (!n.readAt) {
      if (n.groupedIds && n.groupedIds.length > 1) await markManyAsRead(n.groupedIds);
      else await markOneAsRead(n.id);
    }
    router.push(routeForNotification(n));
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Notifications</h1>
        <button
          onClick={fetchNotifications}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
        >
          Refresh
        </button>
      </div>

      <div className="rounded-lg border bg-card">
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading...</div>
        ) : displayNotifications.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No notifications</div>
        ) : (
          <div>
            {displayNotifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full border-b px-4 py-3 text-left hover:bg-accent ${!n.readAt ? "bg-accent/50" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm ${!n.readAt ? "font-semibold" : "font-medium"}`}>
                      {n.title || "Notification"}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {(n.body ?? "").trim() || "—"}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{formatTime(n.sentAt)}</p>
                  </div>
                  {!n.readAt ? (
                    n.groupCount && n.groupCount > 1 ? (
                      <span className="mt-1 min-w-5 rounded-full bg-blue-500 px-1.5 py-0.5 text-center text-[10px] font-bold text-white">
                        {n.groupCount}
                      </span>
                    ) : (
                      <span className="mt-2 h-2 w-2 rounded-full bg-blue-500" />
                    )
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
