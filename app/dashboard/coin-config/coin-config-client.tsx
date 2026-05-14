"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  isActive: boolean;
  promoLabel: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export default function CoinConfigClient({
  countries,
  configs,
}: {
  countries: CountryRow[];
  configs: ConfigRow[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [bulkSearch, setBulkSearch] = useState("");
  const [selectedCountryIds, setSelectedCountryIds] = useState<string[]>([]);
  const [bulkFeeBps, setBulkFeeBps] = useState("200");
  const [bulkCoinsPerFiat, setBulkCoinsPerFiat] = useState("1");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkSuccess, setBulkSuccess] = useState("");

  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newCountryId, setNewCountryId] = useState<string>("");
  const [newFeeBps, setNewFeeBps] = useState("200");
  const [newCoinsPerFiat, setNewCoinsPerFiat] = useState("1");
  const [drafts, setDrafts] = useState<Record<string, { fee: string; coins: string; active: boolean; promo: string }>>(
    {},
  );

  const filteredConfigs = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return configs;
    return configs.filter(
      (c) =>
        c.countryName.toLowerCase().includes(q) ||
        c.isoCode.toLowerCase().includes(q) ||
        c.currencyCode.toLowerCase().includes(q),
    );
  }, [configs, search]);

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
    if (!Number.isFinite(fee) || fee < 0 || fee > 10000) {
      alert("Transfer fee (basis points) must be between 0 and 10000.");
      return;
    }
    if (!Number.isFinite(coins) || coins <= 0) {
      alert("Coins per 1.00 fiat must be a positive number.");
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
      active: c.isActive,
      promo: c.promoLabel ?? "",
    };
  }

  function setDraft(id: string, patch: Partial<{ fee: string; coins: string; active: boolean; promo: string }>) {
    setDrafts((prev) => {
      const row = configs.find((x) => x.id === id);
      if (!row) return prev;
      const cur = prev[id] ?? {
        fee: String(row.transferFeeBps),
        coins: String(row.coinsPerFiatUnit),
        active: row.isActive,
        promo: row.promoLabel ?? "",
      };
      return { ...prev, [id]: { ...cur, ...patch } };
    });
  }

  async function saveRow(c: ConfigRow) {
    const d = draftFor(c.id, c);
    const fee = parseInt(d.fee, 10);
    const coins = parseFloat(d.coins);
    if (!Number.isFinite(fee) || fee < 0 || fee > 10000) {
      alert("Transfer fee (basis points) must be between 0 and 10000.");
      return;
    }
    if (!Number.isFinite(coins) || coins <= 0) {
      alert("Coins per 1.00 fiat must be a positive number.");
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
    if (!Number.isFinite(fee) || fee < 0 || fee > 10000) {
      alert("Transfer fee (basis points) must be between 0 and 10000.");
      return;
    }
    if (!Number.isFinite(coins) || coins <= 0) {
      alert("Coins per 1.00 fiat must be a positive number.");
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
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Country coin configuration</h1>

      <div className="text-sm text-muted-foreground max-w-4xl space-y-3">
        <p>
          Each row is a <strong>policy version</strong> for one country (you can keep history with multiple rows). Use{" "}
          <strong>Active</strong> to control which row the platform uses for that country.
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>P2P fee (basis points, “bps”)</strong> — fee on <em>wallet-to-wallet coin sends</em>. Values are in
            1/100 of a percent: <strong>100 bps = 1%</strong>, <strong>200 bps = 2%</strong>. The fee is taken from the{" "}
            <strong>gross</strong> amount the sender pays (recipient receives the net).
          </li>
          <li>
            <strong>Wallet coins per 1.00 local fiat</strong> — when <strong>cash</strong> (e.g. COD) is credited as{" "}
            <strong>wallet coins</strong>, one <strong>1.00</strong> unit of that country’s currency (e.g.{" "}
            <strong>1.00 TND</strong>) converts to this many coins. Example: <strong>10</strong> means 1.00 unit of fiat
            → 10 coins.
          </li>
        </ul>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add the same settings to several countries</CardTitle>
          <p className="text-sm text-muted-foreground">
            Search countries, tick the ones you want, set fee and conversion once, then create one new row per selected
            country (same pattern as bulk country pricing).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Search countries (name, ISO code, currency)…"
            value={bulkSearch}
            onChange={(e) => setBulkSearch(e.target.value)}
            className="max-w-md"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Label className="text-sm">Select countries:</Label>
            <Button type="button" variant="ghost" size="sm" onClick={selectAllFiltered}>
              Select all (filtered)
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={deselectAll}>
              Deselect all
            </Button>
            <span className="text-sm text-muted-foreground">
              {selectedCountryIds.length} selected
            </span>
          </div>
          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto border rounded-md p-3">
            {filteredCountriesForBulk.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCountry(c.id)}
                className={`px-3 py-1 text-sm rounded border transition-colors ${
                  selectedCountryIds.includes(c.id)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border hover:bg-accent"
                }`}
              >
                {c.name} ({c.isoCode})
              </button>
            ))}
          </div>
          {filteredCountriesForBulk.length === 0 ? (
            <p className="text-sm text-muted-foreground">No countries match this search.</p>
          ) : null}
          <Separator />
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2 w-40">
              <Label>P2P fee (bps)</Label>
              <Input type="number" value={bulkFeeBps} onChange={(e) => setBulkFeeBps(e.target.value)} min={0} max={10000} />
              <p className="text-xs text-muted-foreground">e.g. 200 = 2%</p>
            </div>
            <div className="space-y-2 w-44">
              <Label>Coins per 1.00 fiat</Label>
              <Input
                type="number"
                step="0.0001"
                value={bulkCoinsPerFiat}
                onChange={(e) => setBulkCoinsPerFiat(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">1.00 local unit → coins</p>
            </div>
            <Button
              type="button"
              onClick={() => void applyBulkCreate()}
              disabled={bulkLoading || selectedCountryIds.length === 0}
            >
              {bulkLoading ? "Creating…" : `Create for ${selectedCountryIds.length || 0} countries`}
            </Button>
          </div>
          {bulkSuccess ? <p className="text-sm font-medium text-green-600">{bulkSuccess}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add one configuration</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-2 min-w-[200px]">
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
          <div className="space-y-2 w-40">
            <Label>P2P fee (bps)</Label>
            <Input type="number" value={newFeeBps} onChange={(e) => setNewFeeBps(e.target.value)} min={0} max={10000} />
            <p className="text-xs text-muted-foreground">100 = 1%</p>
          </div>
          <div className="space-y-2 w-44">
            <Label>Coins per 1.00 fiat</Label>
            <Input
              type="number"
              step="0.0001"
              value={newCoinsPerFiat}
              onChange={(e) => setNewCoinsPerFiat(e.target.value)}
            />
          </div>
          <Button onClick={() => void createRow()} disabled={creating || !newCountryId || countries.length === 0}>
            {creating ? "Creating…" : "Create"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing rows</CardTitle>
          <p className="text-sm text-muted-foreground">
            Edit and save each row. Multiple rows per country are allowed (history).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Search table (country, ISO, currency code)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
          <div className="overflow-x-auto border rounded-md">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="p-3">Country</th>
                  <th className="p-3 align-top">
                    <div>P2P fee (bps)</div>
                    <div className="text-xs font-normal text-muted-foreground mt-0.5">100 = 1%</div>
                  </th>
                  <th className="p-3 align-top">
                    <div>Coins / 1.00 fiat</div>
                    <div className="text-xs font-normal text-muted-foreground mt-0.5">Cash → coins</div>
                  </th>
                  <th className="p-3">Active</th>
                  <th className="p-3">Promo label</th>
                  <th className="p-3 w-28" />
                </tr>
              </thead>
              <tbody>
                {filteredConfigs.map((c) => {
                  const d = draftFor(c.id, c);
                  return (
                    <tr key={c.id} className="border-b last:border-0 align-top">
                      <td className="p-3">
                        <div className="font-medium">{c.countryName}</div>
                        <div className="text-muted-foreground text-xs">
                          {c.isoCode} · {c.currencyCode}
                        </div>
                        <Badge variant={d.active ? "default" : "secondary"} className="mt-1">
                          {d.active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Input
                          type="number"
                          className="w-24"
                          value={d.fee}
                          onChange={(e) => setDraft(c.id, { fee: e.target.value })}
                          min={0}
                          max={10000}
                        />
                      </td>
                      <td className="p-3">
                        <Input
                          type="number"
                          step="0.0001"
                          className="w-32"
                          value={d.coins}
                          onChange={(e) => setDraft(c.id, { coins: e.target.value })}
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={d.active}
                          onChange={(e) => setDraft(c.id, { active: e.target.checked })}
                          className="h-4 w-4"
                        />
                      </td>
                      <td className="p-3">
                        <Input
                          className="min-w-[140px]"
                          value={d.promo}
                          onChange={(e) => setDraft(c.id, { promo: e.target.value })}
                          placeholder="Optional"
                        />
                      </td>
                      <td className="p-3">
                        <Button size="sm" onClick={() => void saveRow(c)} disabled={savingId === c.id}>
                          {savingId === c.id ? "Saving…" : "Save"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
