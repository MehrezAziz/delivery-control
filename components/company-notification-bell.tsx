"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { connectSocket, disconnectSocket, getSocket } from "@/lib/socket";
import { buildCompanyNotificationInbox } from "@/lib/company-notification-grouping";
import { getCompanyNotificationHref } from "@/lib/company-notification-routes";
import type { CompanyInboxEntry, CompanyNotificationRow } from "@/lib/company-notification-types";

export function CompanyNotificationBell() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [rows, setRows] = useState<CompanyNotificationRow[]>([]);
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);

  const inbox = useMemo(() => buildCompanyNotificationInbox(rows), [rows]);

  const loadCount = useCallback(async () => {
    const res = await fetch("/api/company/notifications/unread-count", { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setCount(Number(data?.count || 0));
  }, []);

  const loadRows = useCallback(async () => {
    const res = await fetch("/api/company/notifications?limit=40&page=1", { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setRows(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    void loadCount();
    const t = setInterval(() => void loadCount(), 12000);
    return () => clearInterval(t);
  }, [loadCount]);

  useEffect(() => {
    let cancelled = false;
    async function initSocket() {
      try {
        const meRes = await fetch("/api/company-auth/me", { cache: "no-store" });
        if (!meRes.ok) return;
        const me = await meRes.json();
        if (!me?.token || cancelled) return;
        const socket = connectSocket(String(me.token));
        socket.on("notification", (n: CompanyNotificationRow) => {
          const activeChat =
            typeof sessionStorage !== "undefined" ? sessionStorage.getItem("dc_company_chat_order_id") : null;
          const isMsg =
            n?.type === "NEW_MESSAGE_FROM_DRIVER" ||
            n?.type === "NEW_MESSAGE_FROM_CUSTOMER" ||
            (n?.title || "").toLowerCase().includes("message");
          if (
            isMsg &&
            activeChat &&
            n?.relatedEntityType === "Order" &&
            n?.relatedEntityId === activeChat
          ) {
            if (n?.id) {
              void fetch(`/api/company/notifications/${n.id}/read`, { method: "PATCH" });
            }
            return;
          }
          void loadCount();
        });
      } catch {
        /* ignore */
      }
    }
    void initSocket();
    return () => {
      cancelled = true;
      const s = getSocket();
      s?.off("notification");
      disconnectSocket();
    };
  }, [loadCount]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!open) return;
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      if (next) void loadRows();
      return next;
    });
  };

  const applyReadToIds = (ids: string[], readAt: string) => {
    setRows((prev) =>
      prev.map((x) => (ids.includes(x.id) ? { ...x, readAt: x.readAt || readAt } : x)),
    );
  };

  const onEntryClick = async (entry: CompanyInboxEntry) => {
    const readAt = new Date().toISOString();
    let markUnreadDelta = 0;

    if (entry.kind === "group") {
      const ids = entry.notifications.map((n) => n.id);
      const toMark = entry.notifications.filter((n) => !n.readAt);
      markUnreadDelta = toMark.length;
      if (toMark.length > 0) {
        await fetch("/api/company/notifications/thread/read", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ groupKey: entry.threadKey }),
        });
        applyReadToIds(ids, readAt);
      }
    } else {
      const n = entry.notification;
      if (!n.readAt) {
        markUnreadDelta = 1;
        await fetch(`/api/company/notifications/${n.id}/read`, { method: "PATCH" });
        applyReadToIds([n.id], readAt);
      }
    }

    if (markUnreadDelta > 0) {
      setCount((c) => Math.max(0, c - markUnreadDelta));
    }

    const latest = entry.kind === "group" ? entry.latest : entry.notification;
    const href = getCompanyNotificationHref(latest);
    setOpen(false);
    if (href) router.push(href);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button type="button" className="relative rounded-md border px-2 py-1" aria-expanded={open} onClick={toggle}>
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1 text-[10px] text-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border bg-popover shadow-lg">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-semibold">Notifications</span>
            <button
              type="button"
              className="text-xs text-primary underline"
              onClick={async () => {
                await fetch("/api/company/notifications/read-all", { method: "PATCH" });
                setRows((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
                setCount(0);
              }}
            >
              Make all as read
            </button>
          </div>
          <div className="max-h-80 overflow-auto">
            {inbox.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">No notifications.</p>
            ) : (
              inbox.map((entry) => {
                const latest = entry.kind === "group" ? entry.latest : entry.notification;
                const unread =
                  entry.kind === "group"
                    ? entry.unreadCount > 0
                    : !entry.notification.readAt;
                const badge = entry.kind === "group" && entry.count > 1 ? entry.count : null;
                return (
                  <button
                    key={entry.kind === "group" ? `g:${entry.threadKey}` : latest.id}
                    type="button"
                    className={`flex w-full items-start gap-2 border-b px-3 py-2 text-left text-sm hover:bg-muted/40 ${
                      unread ? "bg-primary/5" : ""
                    }`}
                    onClick={() => void onEntryClick(entry)}
                  >
                    <span className="min-w-0 flex-1">
                      <p className="font-medium">{latest.title || "Notification"}</p>
                      <p className="text-xs text-muted-foreground">{latest.body || "—"}</p>
                    </span>
                    {badge != null && (
                      <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
          <div className="px-3 py-2">
            <button
              type="button"
              className="text-xs text-primary underline"
              onClick={() => {
                setOpen(false);
                router.push("/company/notifications");
              }}
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
