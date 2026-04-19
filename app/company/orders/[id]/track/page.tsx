"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, Navigation } from "lucide-react";

const TRACKING_LIVE_STATUSES = new Set(["DRIVER_ARRIVED", "PICKED_UP", "DELIVERING"]);

type TrackingPayload = {
  status?: string;
  driverLocation?: { latitude: number; longitude: number; timestamp: string } | null;
  pickupAddress?: {
    street?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    delegation?: string | null;
    governorate?: string | null;
  } | null;
  dropoffAddress?: {
    street?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    delegation?: string | null;
    governorate?: string | null;
  } | null;
  error?: string;
};

export default function CompanyOrderTrackPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [payload, setPayload] = useState<TrackingPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/company/orders", { cache: "no-store" });
        const list = await res.json();
        if (!res.ok || !Array.isArray(list)) {
          setErr("Could not load order");
          return;
        }
        const o = list.find((x: { id: string; status?: string; trackingToken?: string | null }) => x.id === params.id);
        if (!o?.trackingToken) {
          setErr("No tracking code on this order yet.");
          return;
        }
        if (!TRACKING_LIVE_STATUSES.has(String(o.status || ""))) {
          setErr(
            "Live tracking is only available while the driver has arrived and the order is in progress (arrived, picked up, or delivering).",
          );
          return;
        }
        if (!cancelled) setToken(String(o.trackingToken));
      } catch {
        setErr("Failed to load order");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const poll = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/public/tracking/${encodeURIComponent(token)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setPayload({ error: data?.message || data?.error || "Tracking unavailable" });
        return;
      }
      setPayload(data);
      setErr(null);
    } catch {
      setPayload({ error: "Network error" });
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    void poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [token, poll]);

  const loc = payload?.driverLocation;
  const osmHref =
    loc && typeof loc.latitude === "number" && typeof loc.longitude === "number"
      ? `https://www.openstreetmap.org/?mlat=${loc.latitude}&mlon=${loc.longitude}#map=16/${loc.latitude}/${loc.longitude}`
      : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Live tracking</h1>
        <button
          type="button"
          className="text-sm text-primary underline-offset-4 hover:underline"
          onClick={() => router.push(`/company/orders/${params.id}`)}
        >
          ← Back to order
        </button>
      </div>

      {err && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {err}
        </div>
      )}

      {token && (
        <p className="font-mono text-xs text-muted-foreground">
          Token: <span className="select-all">{token}</span>
        </p>
      )}

      {payload?.error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm">{payload.error}</div>
      )}

      {payload && !payload.error && (
        <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-sm">
            Status:{" "}
            <span className="font-semibold">{String(payload.status || "—").replace(/_/g, " ")}</span>
          </p>
          {loc ? (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Navigation className="h-4 w-4 text-sky-600" />
                <span className="font-mono tabular-nums">
                  {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Updated: {new Date(loc.timestamp).toLocaleString()}
              </p>
              {osmHref && (
                <a
                  href={osmHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  <MapPin className="h-4 w-4" />
                  Open map
                </a>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Waiting for driver location…</p>
          )}
          {(payload.pickupAddress || payload.dropoffAddress) && (
            <div className="mt-4 space-y-2 border-t pt-3 text-sm">
              {payload.pickupAddress && (
                <p>
                  <span className="text-muted-foreground">Pickup: </span>
                  {payload.pickupAddress.street || "—"}
                  {payload.pickupAddress.delegation ? ` · ${payload.pickupAddress.delegation}` : ""}
                </p>
              )}
              {payload.dropoffAddress && (
                <p>
                  <span className="text-muted-foreground">Dropoff: </span>
                  {payload.dropoffAddress.street || "—"}
                  {payload.dropoffAddress.delegation ? ` · ${payload.dropoffAddress.delegation}` : ""}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Map refreshes every few seconds while tracking is active.{" "}
        <Link href={`/company/orders/${params.id}`} className="text-primary underline-offset-2 hover:underline">
          Order details
        </Link>
      </p>
    </div>
  );
}
