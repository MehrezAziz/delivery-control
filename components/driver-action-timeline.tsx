"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type ActionLogItem = {
  id: string;
  actionType: string;
  actorRole: string;
  actorName: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  createdAt: string;
};

export default function DriverActionTimeline({ driverId }: { driverId: string }) {
  const [logs, setLogs] = useState<ActionLogItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadLogs() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/drivers/${driverId}/action-logs`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load action logs");
        return;
      }
      setLogs(data.logs || []);
    } catch {
      setError("Network error while loading action logs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLogs();
  }, [driverId]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Action Timeline</CardTitle>
        {logs === null && (
          <Button size="sm" variant="outline" onClick={loadLogs} disabled={loading}>
            {loading ? "Loading..." : "Load Timeline"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-sm text-red-500">{error}</p>}
        {logs === null && !error && (
          <p className="text-sm text-muted-foreground">
            Load timeline to view all approval/rejection/status actions for this driver.
          </p>
        )}
        {logs?.length === 0 && (
          <p className="text-sm text-muted-foreground">No timeline events found.</p>
        )}
        {logs?.map((log) => (
          <div key={log.id} className="rounded border p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="outline">{log.actionType}</Badge>
              <Badge>{log.actorRole}</Badge>
              <span className="text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</span>
            </div>
            <p>
              <span className="text-muted-foreground">By:</span> {log.actorName}
            </p>
            <p>
              <span className="text-muted-foreground">Status:</span> {log.oldValue || "-"} →{" "}
              {log.newValue || "-"}
            </p>
            {log.reason ? (
              <p>
                <span className="text-muted-foreground">Reason:</span> {log.reason}
              </p>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
