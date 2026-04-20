"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatCoinsCeil3 } from "@/lib/format-coins";

type CompanyProfile = { id: string; name: string; coinBalance: string | number; onboardingCompleted?: boolean };
type Stats = {
  orders?: number;
  delivered?: number;
  returned?: number;
  cancelled?: number;
  grossAmount?: string | number;
  amountHold?: string | number;
};
type CompanyMe = { actorRole?: "MAIN_ADMIN" | "DEPT_ADMIN" | "DEPT_OPERATOR" | "DEPT_VIEWER" };

export default function CompanyDashboardPage() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [walletInfo, setWalletInfo] = useState<{ balance: number; locked: number; availableCapacity: number } | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [me, setMe] = useState<CompanyMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [p, w, s, me] = await Promise.all([
        fetch("/api/company/profile").then((x) => x.json()),
        fetch("/api/company/wallet").then((x) => x.json()),
        fetch("/api/company/stats").then((x) => x.json()),
        fetch("/api/company-auth/me").then((x) => x.json()),
      ]);
      setProfile({ ...p, onboardingCompleted: !!me?.onboardingCompleted });
      setMe(me || null);
      setWalletInfo(w || null);
      setStats(s || {});
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const walletBalance = useMemo(() => Number(walletInfo?.balance || profile?.coinBalance || 0), [walletInfo, profile]);
  const amountHoldDisplay = useMemo(() => {
    const locked = Number(walletInfo?.locked ?? stats?.amountHold ?? 0);
    return Number.isFinite(locked) ? locked : 0;
  }, [walletInfo?.locked, stats?.amountHold]);
  const isMain = (me?.actorRole || "MAIN_ADMIN") === "MAIN_ADMIN";

  if (loading) return <div>Loading company dashboard...</div>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Company</p>
          <p className="text-lg font-semibold">{profile?.name || "-"}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Wallet Balance</p>
          <p className="text-lg font-semibold">{formatCoinsCeil3(walletBalance)} coins</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Delivered</p>
          <p className="text-lg font-semibold">{stats?.delivered || 0}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Returned</p>
          <p className="text-lg font-semibold">{stats?.returned || 0}</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Available Capacity</p>
          <p className="text-lg font-semibold">{formatCoinsCeil3(walletInfo?.availableCapacity || 0)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Amount Hold</p>
          <p className="text-lg font-semibold">{formatCoinsCeil3(amountHoldDisplay)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Coins reserved on in-flight orders (locked wallet balance until delivery completes).
          </p>
        </div>
      </div>
      {message && <div className="rounded-md border bg-muted px-3 py-2 text-sm">{message}</div>}
      {!profile?.onboardingCompleted && (
        <div className="rounded-md border border-amber-400/70 bg-amber-500/10 px-3 py-2 text-sm text-foreground">
          Company onboarding is incomplete.
          <Link href="/company/setup" className="ml-2 underline">Open Setup Wizard</Link>
        </div>
      )}
      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-lg font-semibold">Quick Actions</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link className="rounded-md border px-3 py-2 hover:bg-muted" href="/company/orders">Manage Orders</Link>
          <Link className="rounded-md border px-3 py-2 hover:bg-muted" href="/company/departments">Manage Departments</Link>
          <Link className="rounded-md border px-3 py-2 hover:bg-muted" href="/company/wallet">Wallet Ledger</Link>
          {isMain && <Link className="rounded-md border px-3 py-2 hover:bg-muted" href="/company/refunds">Refund Requests</Link>}
          {isMain && <Link className="rounded-md border px-3 py-2 hover:bg-muted" href="/company/api-keys">API Keys</Link>}
          {isMain && <Link className="rounded-md border px-3 py-2 hover:bg-muted" href="/company/setup">Setup Wizard</Link>}
        </div>
      </section>
    </div>
  );
}
