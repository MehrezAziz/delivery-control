"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { connectSocket, disconnectSocket, getSocket } from "@/lib/socket";
import {
  buildCompanyNotificationInbox,
  excludeChatNotificationsForOrder,
  excludeSupportNotificationsForTicket,
} from "@/lib/company-notification-grouping";
import { getCompanyNotificationHref } from "@/lib/company-notification-routes";
import type { CompanyInboxEntry, CompanyNotificationRow } from "@/lib/company-notification-types";

export function CompanyNotificationBell() {
  const pathname = usePathname() || "";
  /** When viewing an order detail URL, suppress chat notifications for that order in the bell. */
  const suppressChatForOrderId = useMemo(() => {
    const m = pathname.match(/^\/company\/orders\/([0-9a-f-]{36})/i);
    return m?.[1] ?? null;
  }, [pathname]);

  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [rows, setRows] = useState<CompanyNotificationRow[]>([]);
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const suppressChatForOrderIdRef = useRef<string | null>(null);
  suppressChatForOrderIdRef.current = suppressChatForOrderId;

  /** Synced when `/company/support` sets `dc_company_support_ticket_id` (open thread). */
  const [activeSupportTicketId, setActiveSupportTicketId] = useState<string | null>(null);
  useEffect(() => {
    function syncSupportTicketFromStorage() {
      if (typeof sessionStorage === "undefined") return;
      setActiveSupportTicketId(sessionStorage.getItem("dc_company_support_ticket_id"));
    }
    syncSupportTicketFromStorage();
    window.addEventListener("dc-company-support-ticket", syncSupportTicketFromStorage);
    return () => window.removeEventListener("dc-company-support-ticket", syncSupportTicketFromStorage);
  }, []);

  const rowsForBell = useMemo(() => {
    let r = excludeChatNotificationsForOrder(rows, suppressChatForOrderId);
    r = excludeSupportNotificationsForTicket(r, activeSupportTicketId);
    return r;
  }, [rows, suppressChatForOrderId, activeSupportTicketId]);

  const inbox = useMemo(() => buildCompanyNotificationInbox(rowsForBell), [rowsForBell]);

  /** Always uses full DB unread count so badge hits 0 after read / mark-all / thread read. */
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
    function onUnreadRefresh() {
      void loadCount();
      void loadRows();
    }
    window.addEventListener("dc-company-notifications-refresh", onUnreadRefresh);
    return () => window.removeEventListener("dc-company-notifications-refresh", onUnreadRefresh);
  }, [loadCount, loadRows]);

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
          const fromStorage =
            typeof sessionStorage !== "undefined" ? sessionStorage.getItem("dc_company_chat_order_id") : null;
          /** Prefer URL (always set for `/company/orders/[id]`) so we suppress before child page effects run. */
          const activeOrderPage = fromStorage || suppressChatForOrderIdRef.current;
          const isMsg =
            n?.type === "NEW_MESSAGE_FROM_DRIVER" ||
            n?.type === "NEW_MESSAGE_FROM_CUSTOMER" ||
            (n?.title || "").toLowerCase().includes("message");
          const orderIdForChat =
            (n?.relatedEntityType === "Order" || n?.relatedEntityType === "ChatRoom") && n?.relatedEntityId
              ? n.relatedEntityId
              : null;
          /** On this order's page: mark chat thread read immediately (no unread badge / list noise). */
          if (isMsg && activeOrderPage && orderIdForChat && orderIdForChat === activeOrderPage) {
            void fetch("/api/company/notifications/thread/read", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ groupKey: `chat:${activeOrderPage}` }),
            }).then(() => {
              void loadCount();
              window.dispatchEvent(new Event("dc-company-notifications-refresh"));
            });
            return;
          }

          const activeSupport =
            typeof sessionStorage !== "undefined"
              ? sessionStorage.getItem("dc_company_support_ticket_id")
              : null;
          const ticketIdForSupport =
            n?.relatedEntityType === "SupportTicket" && n?.relatedEntityId ? n.relatedEntityId : null;
          if (
            n?.type === "SUPPORT_TICKET_REPLY" &&
            activeSupport &&
            ticketIdForSupport &&
            ticketIdForSupport === activeSupport
          ) {
            void fetch("/api/company/notifications/thread/read", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ groupKey: `support:${activeSupport}` }),
            }).then(() => {
              void loadCount();
              window.dispatchEvent(new Event("dc-company-notifications-refresh"));
            });
            return;
          }

          window.dispatchEvent(new Event("dc-company-notifications-refresh"));
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

    if (entry.kind === "group") {
      const ids = entry.notifications.map((n) => n.id);
      if (entry.unreadCount > 0) {
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
        await fetch(`/api/company/notifications/${n.id}/read`, { method: "PATCH" });
        applyReadToIds([n.id], readAt);
      }
    }

    await loadCount();

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
                await loadCount();
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
