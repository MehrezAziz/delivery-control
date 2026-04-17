"use client";

import { useEffect, useState } from "react";

type CompanyNotification = {
  id: string;
  title: string;
  body: string;
  sentAt: string;
  readAt: string | null;
};

export default function CompanyNotificationsPage() {
  const [rows, setRows] = useState<CompanyNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/company/notifications?limit=100&page=1", { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setRows(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

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
          }}
        >
          Make all as read
        </button>
      </div>
      <div className="space-y-2">
        {rows.map((n) => (
          <div key={n.id} className={`rounded-md border p-3 ${!n.readAt ? "bg-primary/5" : ""}`}>
            <p className="font-medium">{n.title || "Notification"}</p>
            <p className="text-sm text-muted-foreground">{n.body || "-"}</p>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No notifications yet.</p>}
      </div>
    </div>
  );
}
