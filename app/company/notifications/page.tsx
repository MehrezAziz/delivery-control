"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildCompanyNotificationInbox } from "@/lib/company-notification-grouping";
import { getCompanyNotificationHref } from "@/lib/company-notification-routes";
import type { CompanyInboxEntry, CompanyNotificationRow } from "@/lib/company-notification-types";

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString();
}

export default function CompanyNotificationsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<CompanyNotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const inbox = useMemo(() => buildCompanyNotificationInbox(rows), [rows]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/company/notifications?limit=100&page=1", { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setRows(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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

    const latest = entry.kind === "group" ? entry.latest : entry.notification;
    const href = getCompanyNotificationHref(latest);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("dc-company-notifications-refresh"));
    }
    if (href) router.push(href);
  };

  if (loading) return <div>Loading notifications...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Company Notifications</h1>
        <button
          className="rounded-md border px-3 py-2 text-sm"
          onClick={async () => {
            await fetch("/api/company/notifications/read-all", { method: "PATCH" });
            await load();
            if (typeof window !== "undefined") {
              window.dispatchEvent(new Event("dc-company-notifications-refresh"));
            }
          }}
        >
          Make all as read
        </button>
      </div>
      <div className="space-y-2">
        {inbox.map((entry) => {
          const latest = entry.kind === "group" ? entry.latest : entry.notification;
          const unread =
            entry.kind === "group" ? entry.unreadCount > 0 : !entry.notification.readAt;
          const badge = entry.kind === "group" && entry.count > 1 ? entry.count : null;
          return (
            <button
              key={entry.kind === "group" ? `g:${entry.threadKey}` : latest.id}
              type="button"
              onClick={() => void onEntryClick(entry)}
              className={`flex w-full items-start gap-3 rounded-md border p-3 text-left transition hover:bg-muted/40 ${
                unread ? "bg-primary/5" : ""
              }`}
            >
              <span className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{latest.title || "Notification"}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatTime(latest.sentAt)}</span>
                </div>
                <p className="text-sm text-muted-foreground">{latest.body || "—"}</p>
              </span>
              {badge != null && (
                <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
        {inbox.length === 0 && <p className="text-sm text-muted-foreground">No notifications yet.</p>}
      </div>
    </div>
  );
}
