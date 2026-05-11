"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function StaffDevicePushPanel() {
  const [registered, setRegistered] = useState(false);
  const [savedPlatform, setSavedPlatform] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [platform, setPlatform] = useState("android");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/staff-fcm", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setRegistered(Boolean(data.registered));
      setSavedPlatform(data.platform ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/auth/staff-fcm", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), platform }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Save failed");
      setMessage(data.message || "Saved");
      setToken("");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function clearToken() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/auth/staff-fcm", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Clear failed");
      setMessage(data.message || "Cleared");
      setToken("");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Clear failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-6 rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
      <div>
        <h2 className="text-lg font-semibold">Staff device (FCM)</h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Register a Firebase Cloud Messaging device token for <strong>this</strong> admin or CS
          account. When a customer or driver submits a fiat payout request, the API can send a push
          to this token in addition to the in-app bell and WebSocket toast. Use the same Firebase
          project as the mobile apps. For quick tests you can paste a token from Logcat, Xcode, or a
          small debug script.
        </p>
      </div>

      <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Status:{" "}
        {registered ? (
          <>
            <span className="font-medium text-foreground">registered</span>
            {savedPlatform ? ` (${savedPlatform})` : ""}
          </>
        ) : (
          <span className="font-medium text-foreground">not registered</span>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="staff-fcm-token">FCM token</Label>
        <Input
          id="staff-fcm-token"
          placeholder="Paste device token…"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          autoComplete="off"
          className="font-mono text-xs"
        />
      </div>

      <div className="space-y-2">
        <Label>Platform</Label>
        <Select
          value={platform}
          onValueChange={(v) => {
            if (v === "android" || v === "ios" || v === "web") setPlatform(v);
          }}
        >
          <SelectTrigger className="w-full max-w-xs">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="android">Android</SelectItem>
            <SelectItem value="ios">iOS</SelectItem>
            <SelectItem value="web">Web (FCM web push)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {message && <p className="text-sm text-green-600 dark:text-green-400">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void save()} disabled={saving || !token.trim()}>
          {saving ? "Saving…" : "Save token"}
        </Button>
        <Button type="button" variant="outline" onClick={() => void clearToken()} disabled={saving || !registered}>
          Clear token
        </Button>
      </div>
    </div>
  );
}
