"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Globe,
  HelpCircle,
  RefreshCw,
  Save,
  Smartphone,
  Trash2,
  Wifi,
  XCircle,
} from "lucide-react";

const PLATFORMS = [
  { value: "android", label: "Android", icon: Smartphone },
  { value: "ios", label: "iOS", icon: Smartphone },
  { value: "web", label: "Web (FCM)", icon: Globe },
] as const;

function platformLabel(value: string | null) {
  return PLATFORMS.find((p) => p.value === value)?.label ?? value ?? "—";
}

export function StaffDevicePushPanel() {
  const [registered, setRegistered] = useState(false);
  const [savedPlatform, setSavedPlatform] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [platform, setPlatform] = useState("android");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [helpOpen, setHelpOpen] = useState(false);

  const load = useCallback(async () => {
    setMessage(null);
    try {
      const res = await fetch("/api/auth/staff-fcm", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setRegistered(Boolean(data.registered));
      setSavedPlatform(data.platform ?? null);
    } catch (e: unknown) {
      setMessageType("error");
      setMessage(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/staff-fcm", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), platform }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Save failed");
      setMessageType("success");
      setMessage(data.message || "Device token saved successfully.");
      setToken("");
      await load();
    } catch (e: unknown) {
      setMessageType("error");
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function clearToken() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/staff-fcm", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Clear failed");
      setMessageType("success");
      setMessage(data.message || "Device token cleared.");
      setToken("");
      await load();
    } catch (e: unknown) {
      setMessageType("error");
      setMessage(e instanceof Error ? e.message : "Clear failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-full bg-gradient-to-b from-emerald-50/50 via-background to-background dark:from-emerald-950/10">
        <div className="space-y-6 max-w-[900px] mx-auto">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-emerald-50/50 via-background to-background dark:from-emerald-950/10">
      <div className="space-y-6 max-w-[900px] mx-auto">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-emerald-600 via-teal-600 to-slate-700 text-white shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.14),transparent_55%)]" />
          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                  <Smartphone className="h-3.5 w-3.5" />
                  Firebase Cloud Messaging
                </div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Mobile push (FCM)</h1>
                <p className="max-w-xl text-sm text-white/80">
                  Link this staff account to a device token for payout alerts and other high-priority pushes — in addition to the in-app bell.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="shrink-0 bg-white/15 text-white hover:bg-white/25 border-0"
                onClick={() => void handleRefresh()}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                {
                  label: "Registration",
                  value: registered ? "Active" : "Not set",
                  icon: registered ? CheckCircle2 : XCircle,
                },
                { label: "Platform", value: registered ? platformLabel(savedPlatform) : "—", icon: Smartphone },
                { label: "Delivery", value: "FCM + in-app", icon: Bell },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="rounded-xl bg-white/10 px-3 py-2.5 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5 text-xs text-white/70">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </div>
                  <p className="mt-0.5 text-lg font-semibold">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {message && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm flex items-center gap-2 ${
              messageType === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
                : "border-destructive/50 bg-destructive/10 text-destructive"
            }`}
          >
            {messageType === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            {message}
          </div>
        )}

        {/* Status card */}
        <Card className={registered ? "border-emerald-200/60 dark:border-emerald-900/30" : ""}>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                    registered
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {registered ? <Wifi className="h-6 w-6" /> : <Smartphone className="h-6 w-6 opacity-50" />}
                </div>
                <div>
                  <p className="font-medium">Staff device registration</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {registered
                      ? `This account has an FCM token on ${platformLabel(savedPlatform)}.`
                      : "No device token registered for this account yet."}
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className={
                  registered
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                    : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                }
              >
                {registered ? "Registered" : "Not registered"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Help */}
        <Card className="border-emerald-100/60 dark:border-emerald-900/30">
          <CardHeader
            className="cursor-pointer select-none py-4"
            onClick={() => setHelpOpen((o) => !o)}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                <HelpCircle className="h-4 w-4 text-emerald-600" />
                How staff push works
              </CardTitle>
              {helpOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </CardHeader>
          {helpOpen && (
            <CardContent className="pt-0 text-sm text-muted-foreground space-y-2">
              <p>
                Register a Firebase Cloud Messaging device token for <strong>this</strong> admin or CS account.
                When a customer or driver submits a fiat payout request, the API can send a push to this token in addition to the in-app bell and WebSocket toast.
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Use the same Firebase project as the mobile apps.</li>
                <li>For quick tests, paste a token from Logcat, Xcode, or a debug script.</li>
                <li>Clear the token when switching devices or leaving a test environment.</li>
              </ul>
            </CardContent>
          )}
        </Card>

        {/* Register form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Save className="h-5 w-5 text-emerald-600" />
              Register device token
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="staff-fcm-token">FCM token</Label>
              <Input
                id="staff-fcm-token"
                placeholder="Paste device token from Logcat, Xcode, or FCM debug…"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoComplete="off"
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Token is stored on your staff account and used only for staff-facing alerts.
              </p>
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
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-2 pt-1">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPlatform(p.value)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      platform === p.value
                        ? "bg-emerald-600 text-white"
                        : "bg-muted hover:bg-muted/80 text-muted-foreground"
                    }`}
                  >
                    <p.icon className="h-3 w-3" />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="button" onClick={() => void save()} disabled={saving || !token.trim()}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving…" : "Save token"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="text-red-600 hover:text-red-700"
                onClick={() => void clearToken()}
                disabled={saving || !registered}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear token
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
