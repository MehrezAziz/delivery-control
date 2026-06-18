"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Filter,
  Globe,
  Layers,
  MapPin,
  Search,
  Settings2,
  Sparkles,
} from "lucide-react";
import PricingForm from "./pricing-form";

const ZONE_TYPES = [
  "SAME_DELEGATION",
  "SAME_GOVERNORATE",
  "DIFFERENT_GOVERNORATE",
  "DIFFERENT_COUNTRY",
] as const;

interface PolicyData {
  id: string;
  deliveryZoneType: string | null;
  pricePerKm: number;
  baseFee: number;
  baseWeight: number;
  extraWeightStep: number;
  extraWeightPrice: number;
  nightFee: number;
  platformFee: number;
  maxNegativeDays: number;
  isActive: boolean;
}

interface CountryData {
  id: string;
  name: string;
  isoCode: string;
  currencyCode: string;
  currencySymbol: string;
  policies: PolicyData[];
}

type ConfigFilter = "all" | "complete" | "incomplete";

const CONFIG_FILTERS: { value: ConfigFilter; label: string }[] = [
  { value: "all", label: "All countries" },
  { value: "complete", label: "Fully configured" },
  { value: "incomplete", label: "Missing zones" },
];

const emptyValues = {
  pricePerKm: 0,
  baseFee: 0,
  baseWeight: 0,
  extraWeightStep: 0,
  extraWeightPrice: 0,
  nightFee: 0,
  platformFee: 0,
  maxNegativeDays: 0,
};

const fields = [
  { key: "pricePerKm", label: "Price/Km", step: "0.01" },
  { key: "baseFee", label: "Base Fee", step: "0.01" },
  { key: "baseWeight", label: "Base Weight (kg)", step: "0.01" },
  { key: "extraWeightStep", label: "Extra Weight Step", step: "0.01" },
  { key: "extraWeightPrice", label: "Extra Weight Price", step: "0.01" },
  { key: "nightFee", label: "Night Fee", step: "0.01" },
  { key: "platformFee", label: "Platform Fee", step: "0.01" },
  { key: "maxNegativeDays", label: "Max Negative Days", step: "1" },
] as const;

const ZONE_BADGE: Record<string, string> = {
  SAME_DELEGATION: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  SAME_GOVERNORATE: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  DIFFERENT_GOVERNORATE: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  DIFFERENT_COUNTRY: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
};

function isFullyConfigured(policies: PolicyData[]) {
  const zones = new Set(policies.map((p) => p.deliveryZoneType));
  return ZONE_TYPES.every((z) => zones.has(z));
}

function policyCountForCountry(policies: PolicyData[]) {
  return policies.filter((p) => p.isActive).length;
}

export default function PricingClient({
  countries,
  stats,
}: {
  countries: CountryData[];
  stats: {
    countryCount: number;
    totalPolicies: number;
    activePolicies: number;
    fullyConfigured: number;
  };
}) {
  const [search, setSearch] = useState("");
  const [configFilter, setConfigFilter] = useState<ConfigFilter>("all");
  const [defaults, setDefaults] = useState<Record<string, typeof emptyValues>>(
    Object.fromEntries(ZONE_TYPES.map((z) => [z, { ...emptyValues }])),
  );
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [applyLoading, setApplyLoading] = useState(false);
  const [defaultsLoading, setDefaultsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [bulkOpen, setBulkOpen] = useState(true);
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set());
  const router = useRouter();

  const filtered = useMemo(() => {
    let result = countries;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.isoCode.toLowerCase().includes(q) ||
          c.currencyCode.toLowerCase().includes(q),
      );
    }
    if (configFilter === "complete") result = result.filter((c) => isFullyConfigured(c.policies));
    else if (configFilter === "incomplete") result = result.filter((c) => !isFullyConfigured(c.policies));
    return result;
  }, [countries, search, configFilter]);

  function handleDefaultChange(zone: string, key: string, value: string) {
    setDefaults((prev) => ({
      ...prev,
      [zone]: {
        ...prev[zone],
        [key]: key === "maxNegativeDays" ? parseInt(value) || 0 : parseFloat(value) || 0,
      },
    }));
  }

  function toggleCountry(id: string) {
    setSelectedCountries((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  function selectAllFiltered() {
    setSelectedCountries(filtered.map((c) => c.id));
  }

  function deselectAll() {
    setSelectedCountries([]);
  }

  function toggleExpand(id: string) {
    setExpandedCountries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function applyToCountries(countryIds: string[]) {
    setSuccessMsg("");
    const body = {
      countryIds,
      zones: Object.fromEntries(ZONE_TYPES.map((z) => [z, defaults[z]])),
    };
    const res = await fetch("/api/pricing/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      setSuccessMsg(
        `Pricing policies applied successfully (${data.created} created, ${data.updated} updated)`,
      );
      setSelectedCountries([]);
      router.refresh();
    }
    return res.ok;
  }

  async function handleApplyAll() {
    setDefaultsLoading(true);
    await applyToCountries(countries.map((c) => c.id));
    setDefaultsLoading(false);
  }

  async function handleApplySelected() {
    if (selectedCountries.length === 0) return;
    setApplyLoading(true);
    await applyToCountries(selectedCountries);
    setApplyLoading(false);
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-indigo-50/50 via-background to-background dark:from-indigo-950/10">
      <div className="space-y-6 max-w-[1400px] mx-auto">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-indigo-600 via-violet-600 to-slate-700 text-white shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.14),transparent_55%)]" />
          <div className="relative p-6 sm:p-8">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                <Settings2 className="h-3.5 w-3.5" />
                Delivery pricing
              </div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Country pricing policies</h1>
              <p className="max-w-xl text-sm text-white/80">
                Configure per-zone delivery rates, weight surcharges, night fees, and platform fees for each country.
              </p>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Countries", value: stats.countryCount, icon: Globe },
                { label: "Total policies", value: stats.totalPolicies, icon: Layers },
                { label: "Active policies", value: stats.activePolicies, icon: Sparkles },
                { label: "Fully configured", value: stats.fullyConfigured, icon: MapPin },
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

        {/* Bulk apply */}
        <Card className="border-indigo-100/60 dark:border-indigo-900/30">
          <CardHeader
            className="cursor-pointer select-none"
            onClick={() => setBulkOpen((o) => !o)}
          >
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Copy className="h-5 w-5 text-indigo-600" />
                  Bulk apply defaults
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Set default values for all four zone types, then apply to all or selected countries.
                </p>
              </div>
              {bulkOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
          {bulkOpen && (
            <CardContent className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-2">
                {ZONE_TYPES.map((zone) => (
                  <div
                    key={zone}
                    className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3"
                  >
                    <Badge variant="outline" className={ZONE_BADGE[zone]}>
                      {zone.replace(/_/g, " ")}
                    </Badge>
                    <div className="grid gap-2 grid-cols-2">
                      {fields.map((f) => (
                        <div key={f.key} className="space-y-1">
                          <Label className="text-xs text-muted-foreground">{f.label}</Label>
                          <Input
                            type="number"
                            step={f.step}
                            value={defaults[zone][f.key as keyof typeof emptyValues]}
                            onChange={(e) => handleDefaultChange(zone, f.key, e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={handleApplyAll} disabled={defaultsLoading}>
                  {defaultsLoading ? "Applying..." : "Save to ALL countries"}
                </Button>
                <Button
                  onClick={handleApplySelected}
                  disabled={applyLoading || selectedCountries.length === 0}
                  variant="outline"
                >
                  {applyLoading
                    ? "Applying..."
                    : `Apply to selected (${selectedCountries.length})`}
                </Button>
              </div>

              {successMsg && (
                <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">{successMsg}</p>
              )}

              <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Label className="text-sm font-medium">Select countries for bulk apply</Label>
                  <Button variant="ghost" size="sm" onClick={selectAllFiltered}>
                    Select visible ({filtered.length})
                  </Button>
                  <Button variant="ghost" size="sm" onClick={deselectAll}>
                    Deselect all
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                  {countries.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCountry(c.id)}
                      className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                        selectedCountries.includes(c.id)
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-card border-border hover:bg-accent"
                      }`}
                    >
                      {c.name} ({c.isoCode})
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by country, ISO, or currency…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                {filtered.length} of {countries.length} countries
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {CONFIG_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setConfigFilter(f.value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    configFilter === f.value
                      ? "bg-indigo-600 text-white"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Per-country */}
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
              <Globe className="h-10 w-10 opacity-40" />
              <p>No countries match your search or filters.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setConfigFilter("all");
                }}
              >
                Clear filters
              </Button>
            </CardContent>
          </Card>
        ) : (
          filtered.map((country) => {
            const complete = isFullyConfigured(country.policies);
            const activeCount = policyCountForCountry(country.policies);
            const expanded = expandedCountries.has(country.id);

            return (
              <Card key={country.id} className="overflow-hidden">
                <CardHeader
                  className="cursor-pointer hover:bg-muted/30 transition-colors pb-3"
                  onClick={() => toggleExpand(country.id)}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-semibold text-sm dark:bg-indigo-900/40 dark:text-indigo-300">
                        {country.isoCode.slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                          {country.name}
                          <Badge variant="outline">{country.isoCode}</Badge>
                          <span className="text-sm font-normal text-muted-foreground">
                            {country.currencyCode} ({country.currencySymbol})
                          </span>
                        </CardTitle>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <Badge
                            variant="outline"
                            className={
                              complete
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                            }
                          >
                            {complete ? "4/4 zones" : `${country.policies.length}/4 zones`}
                          </Badge>
                          <Badge variant="secondary">{activeCount} active</Badge>
                        </div>
                      </div>
                    </div>
                    {expanded ? (
                      <ChevronUp className="h-5 w-5 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
                    )}
                  </div>
                </CardHeader>
                {expanded && (
                  <CardContent className="pt-0 border-t bg-muted/10">
                    <div className="grid gap-4 lg:grid-cols-2 pt-4">
                      {ZONE_TYPES.map((zone) => {
                        const policy = country.policies.find((p) => p.deliveryZoneType === zone);
                        return (
                          <PricingForm
                            key={zone}
                            countryId={country.id}
                            zoneType={zone}
                            policy={
                              policy
                                ? {
                                    id: policy.id,
                                    pricePerKm: policy.pricePerKm,
                                    baseFee: policy.baseFee,
                                    baseWeight: policy.baseWeight,
                                    extraWeightStep: policy.extraWeightStep,
                                    extraWeightPrice: policy.extraWeightPrice,
                                    nightFee: policy.nightFee,
                                    platformFee: policy.platformFee,
                                    maxNegativeDays: policy.maxNegativeDays,
                                    isActive: policy.isActive,
                                  }
                                : null
                            }
                          />
                        );
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
