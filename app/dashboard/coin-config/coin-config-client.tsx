"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronDown,
  ChevronUp,
  Coins,
  Copy,
  Filter,
  Globe,
  HelpCircle,
  Layers,
  Plus,
  Save,
  Search,
  Sparkles,
} from "lucide-react";

interface CountryRow {
  id: string;
  name: string;
  isoCode: string;
  currencyCode: string;
  currencySymbol: string;
}

interface ConfigRow {
  id: string;
  countryId: string;
  countryName: string;
  isoCode: string;
  currencyCode: string;
  transferFeeBps: number;
  coinsPerFiatUnit: number;
  withdrawalFeeBps: number;
  isActive: boolean;
  promoLabel: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
}

type ActiveFilter = "all" | "active" | "inactive";

const ACTIVE_FILTERS: { value: ActiveFilter; label: string }[] = [
  { value: "all", label: "All rows" },
  { value: "active", label: "Active only" },
  { value: "inactive", label: "Inactive only" },
];

function bpsToPercentStr(bps: number): string {
  const p = bps / 100;
  if (p === 0) return "0";
  return Number.isInteger(p) ? String(p) : String(Math.round(p * 100) / 100);
}

function percentStrToBps(percent: string): number {
  const p = parseFloat(percent);
  if (!Number.isFinite(p) || p < 0) return NaN;
  return Math.min(10000, Math.round(p * 100));
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export default function CoinConfigClient({
  countries,
  configs,
  stats,
}: {
  countries: CountryRow[];
  configs: ConfigRow[];
  stats: {
    countryCount: number;
    totalConfigs: number;
    activeConfigs: number;
    countriesWithActive: number;
  };
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [bulkSearch, setBulkSearch] = useState("");
  const [selectedCountryIds, setSelectedCountryIds] = useState<string[]>([]);
  const [bulkFeeBps, setBulkFeeBps] = useState("200");
  const [bulkCoinsPerFiat, setBulkCoinsPerFiat] = useState("1");
  const [bulkWithdrawalFee, setBulkWithdrawalFee] = useState("0");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkSuccess, setBulkSuccess] = useState("");
  const [bulkOpen, setBulkOpen] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newCountryId, setNewCountryId] = useState<string>("");
  const [newFeeBps, setNewFeeBps] = useState("200");
  const [newCoinsPerFiat, setNewCoinsPerFiat] = useState("1");
  const [newWithdrawalFee, setNewWithdrawalFee] = useState("0");
  const [drafts, setDrafts] = useState<
    Record<string, { fee: string; coins: string; withdrawalFee: string; active: boolean; promo: string }>
  >({});

  const filteredConfigs = useMemo(() => {
    let result = configs;
    const q = search.toLowerCase().trim();
    if (q) {
      result = result.filter(
        (c) =>
          c.countryName.toLowerCase().includes(q) ||
          c.isoCode.toLowerCase().includes(q) ||
          c.currencyCode.toLowerCase().includes(q),
      );
    }
    if (activeFilter === "active") result = result.filter((c) => c.isActive);
    else if (activeFilter === "inactive") result = result.filter((c) => !c.isActive);
    return result;
  }, [configs, search, activeFilter]);

  const filteredCountriesForBulk = useMemo(() => {
    const q = bulkSearch.toLowerCase().trim();
    if (!q) return countries;
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.isoCode.toLowerCase().includes(q) ||
        c.currencyCode.toLowerCase().includes(q) ||
        c.currencySymbol.toLowerCase().includes(q),
    );
  }, [countries, bulkSearch]);

  function toggleCountry(id: string) {
    setSelectedCountryIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function selectAllFiltered() {
    setSelectedCountryIds(filteredCountriesForBulk.map((c) => c.id));
  }

  function deselectAll() {
    setSelectedCountryIds([]);
  }

  async function applyBulkCreate() {
    setBulkSuccess("");
    if (selectedCountryIds.length === 0) {
      alert("Select at least one country.");
      return;
    }
    const fee = parseInt(bulkFeeBps, 10);
    const coins = parseFloat(bulkCoinsPerFiat);
    const wdBps = percentStrToBps(bulkWithdrawalFee);
    if (!Number.isFinite(fee) || fee < 0 || fee > 10000) {
      alert("Transfer fee (basis points) must be between 0 and 10000.");
      return;
    }
    if (!Number.isFinite(coins) || coins <= 0) {
      alert("Coins per 1.00 fiat must be a positive number.");
      return;
    }
    if (!Number.isFinite(wdBps)) {
      alert("Withdrawal fee (%) must be between 0 and 100.");
      return;
    }
    setBulkLoading(true);
    try {
      const res = await fetch("/api/coin-config/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryIds: selectedCountryIds,
          transferFeeBps: fee,
          coinsPerFiatUnit: coins,
          withdrawalFeeBps: wdBps,
          isActive: true,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; created?: number };
      if (!res.ok) throw new Error(data.error || res.statusText);
      setBulkSuccess(`Created ${data.created ?? selectedCountryIds.length} new configuration row(s).`);
      setSelectedCountryIds([]);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Bulk create failed");
    } finally {
      setBulkLoading(false);
    }
  }

  function draftFor(id: string, c: ConfigRow) {
    const d = drafts[id];
    if (d) return d;
    return {
      fee: String(c.transferFeeBps),
      coins: String(c.coinsPerFiatUnit),
      withdrawalFee: bpsToPercentStr(c.withdrawalFeeBps ?? 0),
      active: c.isActive,
      promo: c.promoLabel ?? "",
    };
  }

  function setDraft(
    id: string,
    patch: Partial<{ fee: string; coins: string; withdrawalFee: string; active: boolean; promo: string }>,
  ) {
    setDrafts((prev) => {
      const row = configs.find((x) => x.id === id);
      if (!row) return prev;
      const cur = prev[id] ?? {
        fee: String(row.transferFeeBps),
        coins: String(row.coinsPerFiatUnit),
        withdrawalFee: bpsToPercentStr(row.withdrawalFeeBps ?? 0),
        active: row.isActive,
        promo: row.promoLabel ?? "",
      };
      return { ...prev, [id]: { ...cur, ...patch } };
    });
  }

  function isDirty(c: ConfigRow) {
    const d = draftFor(c.id, c);
    return (
      d.fee !== String(c.transferFeeBps) ||
      d.coins !== String(c.coinsPerFiatUnit) ||
      d.withdrawalFee !== bpsToPercentStr(c.withdrawalFeeBps ?? 0) ||
      d.active !== c.isActive ||
      d.promo !== (c.promoLabel ?? "")
    );
  }

  async function saveRow(c: ConfigRow) {
    const d = draftFor(c.id, c);
    const fee = parseInt(d.fee, 10);
    const coins = parseFloat(d.coins);
    const wdBps = percentStrToBps(d.withdrawalFee);
    if (!Number.isFinite(fee) || fee < 0 || fee > 10000) {
      alert("Transfer fee (basis points) must be between 0 and 10000.");
      return;
    }
    if (!Number.isFinite(coins) || coins <= 0) {
      alert("Coins per 1.00 fiat must be a positive number.");
      return;
    }
    if (!Number.isFinite(wdBps)) {
      alert("Withdrawal fee (%) must be between 0 and 100.");
      return;
    }
    setSavingId(c.id);
    try {
      const res = await fetch(`/api/coin-config/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transferFeeBps: fee,
          coinsPerFiatUnit: coins,
          withdrawalFeeBps: wdBps,
          isActive: d.active,
          promoLabel: d.promo.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || res.statusText);
      }
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[c.id];
        return next;
      });
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingId(null);
    }
  }

  async function createRow() {
    if (!newCountryId) {
      alert("Choose a country.");
      return;
    }
    const fee = parseInt(newFeeBps, 10);
    const coins = parseFloat(newCoinsPerFiat);
    const wdBps = percentStrToBps(newWithdrawalFee);
    if (!Number.isFinite(fee) || fee < 0 || fee > 10000) {
      alert("Transfer fee (basis points) must be between 0 and 10000.");
      return;
    }
    if (!Number.isFinite(coins) || coins <= 0) {
      alert("Coins per 1.00 fiat must be a positive number.");
      return;
    }
    if (!Number.isFinite(wdBps)) {
      alert("Withdrawal fee (%) must be between 0 and 100.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/coin-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryId: newCountryId,
          transferFeeBps: fee,
          coinsPerFiatUnit: coins,
          withdrawalFeeBps: wdBps,
          isActive: true,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || res.statusText);
      }
      setNewCountryId("");
      setNewFeeBps("200");
      setNewCoinsPerFiat("1");
      setCreateOpen(false);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-orange-50/50 via-background to-background dark:from-orange-950/10">
      <div className="space-y-6 max-w-[1400px] mx-auto">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-orange-500 via-amber-600 to-slate-700 text-white shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.14),transparent_55%)]" />
          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                  <Coins className="h-3.5 w-3.5" />
                  Wallet economics
                </div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Country coin configuration</h1>
                <p className="max-w-xl text-sm text-white/80">
                  Set P2P transfer fees, fiat-to-coin conversion rates, and withdrawal fees per country.
                </p>
              </div>
              <Button
                size="sm"
                className="shrink-0 bg-white text-orange-700 hover:bg-white/90"
                onClick={() => setCreateOpen((o) => !o)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add configuration
              </Button>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Active countries", value: stats.countryCount, icon: Globe },
                { label: "Config rows", value: stats.totalConfigs, icon: Layers },
                { label: "Active rows", value: stats.activeConfigs, icon: Sparkles },
                { label: "Countries configured", value: stats.countriesWithActive, icon: Coins },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="rounded-xl bg-white/10 px-3 py-2.5 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5 text-xs text-white/70">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </div>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Help */}
        <Card className="border-orange-100/60 dark:border-orange-900/30">
          <CardHeader
            className="cursor-pointer select-none py-4"
            onClick={() => setHelpOpen((o) => !o)}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                <HelpCircle className="h-4 w-4 text-orange-600" />
                How coin configuration works
              </CardTitle>
              {helpOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </CardHeader>
          {helpOpen && (
            <CardContent className="pt-0 text-sm text-muted-foreground space-y-3">
              <p>
                Each row is a <strong>policy version</strong> for one country. Multiple rows per country are allowed
                (history). Only one row should be <strong>Active</strong> per country at a time.
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>P2P fee (bps)</strong> — fee on wallet-to-wallet sends. 100 bps = 1%, 200 bps = 2%. Deducted
                  from the gross amount the sender pays.
                </li>
                <li>
                  <strong>Coins per 1.00 fiat</strong> — when cash (e.g. COD) is credited as wallet coins, one unit of
                  local currency converts to this many coins.
                </li>
                <li>
                  <strong>Withdrawal fee (%)</strong> — percentage deducted from the withdrawal amount. 2% on 100 coins
                  → 98 paid out, 100 debited.
                </li>
              </ul>
            </CardContent>
          )}
        </Card>

        {/* Bulk create */}
        <Card className="border-orange-100/60 dark:border-orange-900/30">
          <CardHeader className="cursor-pointer select-none" onClick={() => setBulkOpen((o) => !o)}>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Copy className="h-5 w-5 text-orange-600" />
                  Bulk create for multiple countries
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Select countries, set fees once, and create one row per country.
                </p>
              </div>
              {bulkOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
            </div>
          </CardHeader>
          {bulkOpen && (
            <CardContent className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-md">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search countries (name, ISO, currency)…"
                    value={bulkSearch}
                    onChange={(e) => setBulkSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="tabular-nums">
                    {selectedCountryIds.length} selected
                  </Badge>
                  <Button type="button" variant="outline" size="sm" onClick={deselectAll} disabled={selectedCountryIds.length === 0}>
                    Clear selection
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Choose countries</span>
                    <span className="text-muted-foreground">
                      ({filteredCountriesForBulk.length} visible / {countries.length} total)
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={selectAllFiltered} disabled={filteredCountriesForBulk.length === 0}>
                      Select visible
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={deselectAll} disabled={selectedCountryIds.length === 0}>
                      Deselect all
                    </Button>
                  </div>
                </div>

                {filteredCountriesForBulk.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                    <Globe className="h-10 w-10 opacity-40" />
                    <p>No countries match this search.</p>
                    <Button variant="outline" size="sm" onClick={() => setBulkSearch("")}>
                      Clear search
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto rounded-lg border bg-background/60 p-3">
                    {filteredCountriesForBulk.map((c) => {
                      const selected = selectedCountryIds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleCountry(c.id)}
                          className={`group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                            selected
                              ? "bg-orange-600 text-white border-orange-600"
                              : "bg-card border-border hover:bg-accent"
                          }`}
                        >
                          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                            selected ? "bg-white/20 text-white" : "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
                          }`}>
                            {c.isoCode.slice(0, 2)}
                          </span>
                          <span className="font-medium">{c.name}</span>
                          <span className={`text-xs ${selected ? "text-white/80" : "text-muted-foreground"}`}>
                            {c.currencyCode}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-xl border p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">Bulk values</p>
                    <p className="text-xs text-muted-foreground">
                      These values will be applied to all selected countries by creating new rows.
                    </p>
                  </div>
                  <Badge variant="outline" className="w-fit tabular-nums">
                    P2P fee ≈ {Number.isFinite(parseInt(bulkFeeBps, 10)) ? (parseInt(bulkFeeBps, 10) / 100).toFixed(2) : "—"}%
                    {" · "}
                    Withdrawal ≈ {Number.isFinite(parseFloat(bulkWithdrawalFee)) ? parseFloat(bulkWithdrawalFee).toFixed(2) : "—"}%
                  </Badge>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-4 items-end">
                  <div className="space-y-2">
                    <Label>P2P fee (bps)</Label>
                    <Input
                      type="number"
                      value={bulkFeeBps}
                      onChange={(e) => setBulkFeeBps(e.target.value)}
                      min={0}
                      max={10000}
                    />
                    <p className="text-xs text-muted-foreground">200 = 2%</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Coins per 1.00 fiat</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={bulkCoinsPerFiat}
                      onChange={(e) => setBulkCoinsPerFiat(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Cash credit conversion</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Withdrawal fee (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      max={100}
                      value={bulkWithdrawalFee}
                      onChange={(e) => setBulkWithdrawalFee(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Deducted from payout amount</p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => void applyBulkCreate()}
                    disabled={bulkLoading || selectedCountryIds.length === 0}
                    className="w-full"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    {bulkLoading ? "Creating…" : `Create for ${selectedCountryIds.length || 0} countries`}
                  </Button>
                </div>

                {bulkSuccess ? (
                  <p className="mt-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">{bulkSuccess}</p>
                ) : null}
              </div>
            </CardContent>
          )}
        </Card>

        {/* Single create */}
        {createOpen && (
          <Card className="border-orange-100/60 dark:border-orange-900/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Plus className="h-5 w-5 text-orange-600" />
                Add one configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end">
                <div className="space-y-2 lg:col-span-2">
                  <Label>Country</Label>
                  <Select value={newCountryId || undefined} onValueChange={(v) => setNewCountryId(v ?? "")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map((co) => (
                        <SelectItem key={co.id} value={co.id}>
                          {co.name} ({co.isoCode}) — {co.currencyCode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>P2P fee (bps)</Label>
                  <Input type="number" value={newFeeBps} onChange={(e) => setNewFeeBps(e.target.value)} min={0} max={10000} />
                </div>
                <div className="space-y-2">
                  <Label>Coins / 1.00 fiat</Label>
                  <Input type="number" step="0.0001" value={newCoinsPerFiat} onChange={(e) => setNewCoinsPerFiat(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Withdrawal fee (%)</Label>
                  <Input type="number" step="0.01" min={0} max={100} value={newWithdrawalFee} onChange={(e) => setNewWithdrawalFee(e.target.value)} />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button onClick={() => void createRow()} disabled={creating || !newCountryId || countries.length === 0}>
                  {creating ? "Creating…" : "Create"}
                </Button>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search country, ISO, currency…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                {filteredConfigs.length} of {configs.length} rows
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {ACTIVE_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setActiveFilter(f.value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    activeFilter === f.value
                      ? "bg-orange-600 text-white"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Config table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Configuration rows</CardTitle>
            <p className="text-sm text-muted-foreground">Edit values inline and save each row. Multiple rows per country are allowed.</p>
          </CardHeader>
          <CardContent className="p-0">
            {filteredConfigs.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                <Coins className="h-10 w-10 opacity-40" />
                <p>No configuration rows match your filters.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setActiveFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead>Country</TableHead>
                      <TableHead>
                        <div>P2P fee</div>
                        <div className="text-xs font-normal text-muted-foreground">bps · 100 = 1%</div>
                      </TableHead>
                      <TableHead>
                        <div>Coins / fiat</div>
                        <div className="text-xs font-normal text-muted-foreground">per 1.00 unit</div>
                      </TableHead>
                      <TableHead>
                        <div>Withdrawal</div>
                        <div className="text-xs font-normal text-muted-foreground">%</div>
                      </TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead>Promo</TableHead>
                      <TableHead>Effective</TableHead>
                      <TableHead className="text-right">Save</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredConfigs.map((c) => {
                      const d = draftFor(c.id, c);
                      const dirty = isDirty(c);
                      return (
                        <TableRow key={c.id} className={`align-top hover:bg-muted/30 ${dirty ? "bg-orange-50/50 dark:bg-orange-950/10" : ""}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-700 text-xs font-semibold dark:bg-orange-900/40 dark:text-orange-300">
                                {c.isoCode.slice(0, 2)}
                              </div>
                              <div>
                                <p className="font-medium">{c.countryName}</p>
                                <p className="text-xs text-muted-foreground">{c.isoCode} · {c.currencyCode}</p>
                                <Badge
                                  variant="outline"
                                  className={`mt-1 ${d.active ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}
                                >
                                  {d.active ? "Active" : "Inactive"}
                                </Badge>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              className="w-24 h-8"
                              value={d.fee}
                              onChange={(e) => setDraft(c.id, { fee: e.target.value })}
                              min={0}
                              max={10000}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.0001"
                              className="w-28 h-8"
                              value={d.coins}
                              onChange={(e) => setDraft(c.id, { coins: e.target.value })}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              min={0}
                              max={100}
                              className="w-24 h-8"
                              value={d.withdrawalFee}
                              onChange={(e) => setDraft(c.id, { withdrawalFee: e.target.value })}
                            />
                          </TableCell>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={d.active}
                              onChange={(e) => setDraft(c.id, { active: e.target.checked })}
                              className="h-4 w-4 rounded border-input"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              className="min-w-[120px] h-8"
                              value={d.promo}
                              onChange={(e) => setDraft(c.id, { promo: e.target.value })}
                              placeholder="Optional"
                            />
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(c.effectiveFrom)}
                            {c.effectiveTo ? (
                              <span className="block">→ {formatDate(c.effectiveTo)}</span>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => void saveRow(c)}
                              disabled={savingId === c.id || (!dirty && !!c.id)}
                              variant={dirty ? "default" : "secondary"}
                            >
                              <Save className="h-3.5 w-3.5 mr-1" />
                              {savingId === c.id ? "Saving…" : dirty ? "Save" : "Saved"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
