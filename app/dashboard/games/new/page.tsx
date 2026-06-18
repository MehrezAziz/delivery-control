"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MultiImageUpload } from "@/components/admin/image-upload";
import { cn } from "@/lib/utils";
import { ArrowLeft, Gamepad2, Search, Sparkles, Globe, Settings2 } from "lucide-react";

const PLACEMENTS_CUSTOMER = [
  "CUSTOMER_HOME",
  "CUSTOMER_WALLET",
  "CUSTOMER_ORDERS",
  "CUSTOMER_PROFILE",
  "CUSTOMER_SETTINGS",
  "CUSTOMER_SUPPORT",
];
const PLACEMENTS_DRIVER = [
  "DRIVER_HOME",
  "DRIVER_EARNINGS",
  "DRIVER_TRANSACTIONS",
  "DRIVER_PROFILE",
  "DRIVER_SETTINGS",
  "DRIVER_SUPPORT",
  "DRIVER_MY_ORDERS",
];

export default function NewGamePage() {
  const router = useRouter();
  const [countries, setCountries] = useState<{ id: string; name: string }[]>([]);
  const [countrySearch, setCountrySearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    isActive: false,
    scheduleMode: "ALL_DAYS",
    periodMode: "DAILY",
    customPeriodDays: 5,
    customPeriodAnchor: "FIXED_BLOCKS",
    questionsPerDay: 5,
    requireCompletedOrder: false,
    winnerSelectionMode: "RANDOM",
    coinCreditMode: "AUTO_ON_CONFIRM",
    winnerPoolMode: "COMBINED",
    customerButtonPlacement: "CUSTOMER_HOME",
    driverButtonPlacement: "DRIVER_HOME",
    countryIds: [] as string[],
    prizeTiers: [{ rank: 1, prizeType: "COINS", coinAmount: 1000, prizeLabel: "1st prize" }],
    bannerImageUrls: [] as string[],
  });

  useEffect(() => {
    void fetch("/api/countries")
      .then((r) => r.json())
      .then((rows) => setCountries(rows))
      .catch(() => setCountries([]));
  }, []);

  const submit = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setCreatedCode(data.accessCodePlain);
      setTimeout(() => router.push(`/dashboard/games/${data.id}`), 1500);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to create game");
    } finally {
      setSaving(false);
    }
  };

  const filteredCountries = countries.filter((c) =>
    c.name.toLowerCase().includes(countrySearch.trim().toLowerCase()),
  );

  return (
    <div className="min-h-full bg-gradient-to-b from-violet-50/50 via-background to-background dark:from-violet-950/10">
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-violet-600 via-purple-600 to-slate-700 text-white shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.12),transparent_50%)]" />
          <div className="relative p-6 sm:p-8 space-y-3">
            <Link
              href="/dashboard/games"
              className={cn(
                buttonVariants({ variant: "secondary", size: "sm" }),
                "bg-white/15 text-white border-white/20 hover:bg-white/25",
              )}
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              Back to games
            </Link>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" />
              Quiz game setup
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
              <Gamepad2 className="h-8 w-8 opacity-90" />
              New quiz game
            </h1>
            <p className="text-violet-100 text-sm max-w-xl">
              Configure basics, placements, participating countries, and optional banner images. You can fine-tune
              questions and draws after creation.
            </p>
          </div>
        </div>

        {createdCode && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
            <span className="font-semibold">Access code (share on social):</span> {createdCode}
            <p className="text-xs mt-1 text-emerald-600 dark:text-emerald-400">Redirecting to game editor…</p>
          </div>
        )}

        <Card className="overflow-hidden border-violet-200/50 dark:border-violet-800/30">
          <div className="h-0.5 bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500" />
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-violet-600" />
              Basics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Summer quiz 2026"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Short description shown to players"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Questions per day</Label>
              <Input
                type="number"
                min={1}
                value={form.questionsPerDay}
                onChange={(e) => setForm({ ...form, questionsPerDay: Number(e.target.value) })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Customer button placement</Label>
                <select
                  className="w-full border rounded-lg h-10 px-3 bg-background text-sm"
                  value={form.customerButtonPlacement}
                  onChange={(e) => setForm({ ...form, customerButtonPlacement: e.target.value })}
                >
                  {PLACEMENTS_CUSTOMER.map((p) => (
                    <option key={p} value={p}>
                      {p.replace(/CUSTOMER_/g, "").replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Driver button placement</Label>
                <select
                  className="w-full border rounded-lg h-10 px-3 bg-background text-sm"
                  value={form.driverButtonPlacement}
                  onChange={(e) => setForm({ ...form, driverButtonPlacement: e.target.value })}
                >
                  {PLACEMENTS_DRIVER.map((p) => (
                    <option key={p} value={p}>
                      {p.replace(/DRIVER_/g, "").replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
              <Label className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-violet-600" />
                Countries that can participate
                <Badge variant="secondary" className="tabular-nums">{form.countryIds.length}</Badge>
              </Label>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={countrySearch}
                  onChange={(e) => setCountrySearch(e.target.value)}
                  placeholder="Search countries…"
                  className="pl-9"
                />
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-1">
                {filteredCountries.map((c) => {
                  const on = form.countryIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          countryIds: on
                            ? form.countryIds.filter((id) => id !== c.id)
                            : [...form.countryIds, c.id],
                        })
                      }
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium border transition-all",
                        on
                          ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                          : "border-border hover:bg-muted/60",
                      )}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <MultiImageUpload
              label="Banner images (optional)"
              values={form.bannerImageUrls}
              onChange={(urls) => setForm({ ...form, bannerImageUrls: urls })}
              hint="Shown on the game landing screen. Up to 8 images."
              max={8}
            />

            <div className="flex flex-col gap-3 pt-2">
              <label className="flex items-center gap-2.5 text-sm rounded-lg border p-3 cursor-pointer hover:bg-muted/30 transition-colors">
                <input
                  type="checkbox"
                  className="rounded"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                <span>
                  <span className="font-medium">Active</span>
                  <span className="block text-xs text-muted-foreground">Players can see and join this game</span>
                </span>
              </label>
              <label className="flex items-center gap-2.5 text-sm rounded-lg border p-3 cursor-pointer hover:bg-muted/30 transition-colors">
                <input
                  type="checkbox"
                  className="rounded"
                  checked={form.requireCompletedOrder}
                  onChange={(e) => setForm({ ...form, requireCompletedOrder: e.target.checked })}
                />
                <span>
                  <span className="font-medium">Require delivered order to win</span>
                  <span className="block text-xs text-muted-foreground">Winners must have at least one completed delivery</span>
                </span>
              </label>
            </div>

            <Button
              onClick={() => void submit()}
              disabled={saving || !form.name.trim()}
              className="w-full sm:w-auto bg-violet-600 hover:bg-violet-700"
              size="lg"
            >
              {saving ? "Creating…" : "Create game"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
