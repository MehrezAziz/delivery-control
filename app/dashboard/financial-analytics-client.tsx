"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Download, Printer, RefreshCw, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type RangeKey = "day" | "week" | "month" | "year" | "all";

function sameStringArray(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

type AnalyticsResponse = {
  meta: {
    role: "ADMIN" | "CUSTOMER_SERVICE";
    scopeLabel: string;
    governorateCount: number;
    allowedRanges: RangeKey[];
    activeRange: RangeKey;
    isCustomRange?: boolean;
    isScoped: boolean;
    maxRangeDays: number | null;
  };
  kpis: Array<{ key: string; label: string; value: number; currency: string; trendPct: number }>;
  chart: { points: Array<{ date: string; value: number }>; anomalies: string[] };
  kpiSeries?: Record<string, number[]>;
  locale?: { locale: string; currencyCode: string };
  selectors?: {
    countries: Array<{ id: string; name: string; currencyCode: string; locale: string }>;
    governorates: Array<{ id: string; name: string; countryId: string }>;
    delegations: Array<{ id: string; name: string; governorateId: string }>;
  };
  filters?: {
    governorateIds: string[];
    delegationIds: string[];
    statuses: string[];
    paymentTypes: Array<"COD" | "WALLET">;
    driverCohort: "new" | "experienced" | "all";
    countryId: string | null;
  };
  quality?: {
    grossRevenue: number;
    netProfit: number;
    totalPayouts: number;
    payoutEfficiency: number;
    cancellationCounts: { cancelled: number; failed: number };
    refundCauseBreakdown: Array<{ cause: string; count: number; amount: number }>;
    periodComparison: { grossRevenuePct: number; netProfitPct: number };
  };
  alerts?: Array<{ key: string; severity: "low" | "medium" | "high"; title: string; description: string }>;
  governorates: Array<{ governorateId: string; governorateName: string; profit: number; orders: number }>;
  drillDownRows: Array<{ date: string; orders: number; payouts: number; refunds: number; adjustments: number; netProfit: number }>;
  health: Array<{ key: string; label: string; value: number; warning: boolean; trendPct?: number }>;
  lastUpdatedAt: string;
};

function money(value: number) {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })} TND`;
}

function trendColor(value: number) {
  if (value > 0) return "text-emerald-600";
  if (value < 0) return "text-red-600";
  return "text-muted-foreground";
}

function buildSmoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const current = points[i];
    const cpx = (prev.x + current.x) / 2;
    d += ` Q ${cpx} ${prev.y}, ${current.x} ${current.y}`;
  }
  return d;
}

export default function FinancialAnalyticsClient() {
  const [range, setRange] = useState<RangeKey>("week");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedCountryId, setSelectedCountryId] = useState("");
  const [selectedGovernorateIds, setSelectedGovernorateIds] = useState<string[]>([]);
  const [selectedDelegationIds, setSelectedDelegationIds] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedPaymentTypes, setSelectedPaymentTypes] = useState<Array<"COD" | "WALLET">>([]);
  const [driverCohort, setDriverCohort] = useState<"new" | "experienced" | "all">("all");
  const [countrySearch, setCountrySearch] = useState("");
  const [governorateSearch, setGovernorateSearch] = useState("");
  const [delegationSearch, setDelegationSearch] = useState("");
  const didInitialLoad = useRef(false);
  const autoFetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadAnalytics = useCallback(async (nextRange: RangeKey, custom?: { startDate: string; endDate: string }) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ range: nextRange });
      if (selectedCountryId) params.set("countryId", selectedCountryId);
      if (selectedGovernorateIds.length) params.set("governorateIds", selectedGovernorateIds.join(","));
      if (selectedDelegationIds.length) params.set("delegationIds", selectedDelegationIds.join(","));
      if (selectedStatuses.length) params.set("statuses", selectedStatuses.join(","));
      if (selectedPaymentTypes.length) params.set("paymentTypes", selectedPaymentTypes.join(","));
      if (driverCohort !== "all") params.set("driverCohort", driverCohort);
      if (custom?.startDate && custom?.endDate) {
        params.set("startDate", custom.startDate);
        params.set("endDate", custom.endDate);
      }
      const res = await fetch(`/api/dashboard/financial-analytics?${params.toString()}`);
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Failed to load analytics.");
        setLoading(false);
        return;
      }
      setData(body);
      if (body.filters) {
        const nextGov = body.filters.governorateIds || [];
        const nextDeleg = body.filters.delegationIds || [];
        const nextStatuses = body.filters.statuses || [];
        const nextPaymentTypes = body.filters.paymentTypes || [];
        const nextCohort = body.filters.driverCohort || "all";
        const nextCountryId = body.filters.countryId || "";

        setSelectedGovernorateIds((prev) => (sameStringArray(prev, nextGov) ? prev : nextGov));
        setSelectedDelegationIds((prev) => (sameStringArray(prev, nextDeleg) ? prev : nextDeleg));
        setSelectedStatuses((prev) => (sameStringArray(prev, nextStatuses) ? prev : nextStatuses));
        setSelectedPaymentTypes((prev) => (sameStringArray(prev, nextPaymentTypes) ? prev : nextPaymentTypes));
        setDriverCohort((prev) => (prev === nextCohort ? prev : nextCohort));
        setSelectedCountryId((prev) => (prev === nextCountryId ? prev : nextCountryId));
      }
      setRange(body.meta.activeRange);
      if (body.drillDownRows.length > 0) {
        setSelectedDate((current) =>
          current && body.drillDownRows.some((r: { date: string }) => r.date === current)
            ? current
            : body.drillDownRows[0].date,
        );
      } else {
        setSelectedDate(null);
      }
    } catch {
      setError("Network error while loading analytics.");
    } finally {
      setLoading(false);
    }
  }, [driverCohort, selectedCountryId, selectedDelegationIds, selectedGovernorateIds, selectedPaymentTypes, selectedStatuses]);

  useEffect(() => {
    // Guard against repeated initial fetches when callback deps change.
    if (didInitialLoad.current) return;
    didInitialLoad.current = true;
    loadAnalytics("week");
  }, [loadAnalytics]);

  useEffect(() => {
    if (!didInitialLoad.current) return;
    if (autoFetchTimeoutRef.current) clearTimeout(autoFetchTimeoutRef.current);
    autoFetchTimeoutRef.current = setTimeout(() => {
      loadAnalytics(range);
    }, 250);
    return () => {
      if (autoFetchTimeoutRef.current) clearTimeout(autoFetchTimeoutRef.current);
    };
  }, [
    driverCohort,
    loadAnalytics,
    range,
    selectedCountryId,
    selectedDelegationIds,
    selectedGovernorateIds,
    selectedPaymentTypes,
    selectedStatuses,
  ]);

  const selectedRow = useMemo(
    () => data?.drillDownRows.find((row) => row.date === selectedDate) || null,
    [data, selectedDate],
  );

  const sparklineByKpi = useMemo(() => {
    const result: Record<string, string> = {};
    const seriesEntries = Object.entries(data?.kpiSeries || {});
    for (const [key, values] of seriesEntries) {
      const points = values.map((value, idx) => ({ x: idx * 18, y: value }));
      if (points.length < 2) {
        result[key] = "";
        continue;
      }
      const min = Math.min(...points.map((p) => p.y));
      const max = Math.max(...points.map((p) => p.y));
      const denom = Math.max(1, max - min);
      result[key] = points
        .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${26 - ((p.y - min) / denom) * 22}`)
        .join(" ");
    }
    return result;
  }, [data]);

  const fallbackSparkline = useMemo(() => {
    const points = (data?.chart.points || []).map((p, idx) => ({ x: idx * 18, y: p.value }));
    if (points.length < 2) return "";
    const min = Math.min(...points.map((p) => p.y));
    const max = Math.max(...points.map((p) => p.y));
    const denom = Math.max(1, max - min);
    return points
      .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${26 - ((p.y - min) / denom) * 22}`)
      .join(" ");
  }, [data]);

  function canApplyCustomWindow() {
    if (!startDate || !endDate) return false;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
    if (start.getTime() > end.getTime()) return false;
    if (!data?.meta.isScoped) return true;
    const diff = end.getTime() - start.getTime();
    return diff <= 6 * 24 * 60 * 60 * 1000;
  }

  function buildExportHref(format: "csv" | "pdf" | "xlsx" | "board") {
    const params = new URLSearchParams({ range, format });
    if (selectedCountryId) params.set("countryId", selectedCountryId);
    if (selectedGovernorateIds.length) params.set("governorateIds", selectedGovernorateIds.join(","));
    if (selectedDelegationIds.length) params.set("delegationIds", selectedDelegationIds.join(","));
    if (selectedStatuses.length) params.set("statuses", selectedStatuses.join(","));
    if (selectedPaymentTypes.length) params.set("paymentTypes", selectedPaymentTypes.join(","));
    if (driverCohort !== "all") params.set("driverCohort", driverCohort);
    if (startDate && endDate) {
      params.set("startDate", startDate);
      params.set("endDate", endDate);
    }
    return `/api/dashboard/financial-analytics/export?${params.toString()}`;
  }

  const chartPoints = useMemo(() => {
    const points = data?.chart.points || [];
    if (points.length === 0) return { scaled: [], path: "", areaPath: "", min: 0, max: 0 };
    const width = 860;
    const height = 260;
    const minValue = Math.min(...points.map((p) => p.value));
    const maxValue = Math.max(...points.map((p) => p.value));
    const rangeValue = Math.max(1, maxValue - minValue);
    const scaled = points.map((point, index) => ({
      ...point,
      x: (index / Math.max(1, points.length - 1)) * width,
      y: height - ((point.value - minValue) / rangeValue) * (height - 20) - 10,
    }));
    const path = buildSmoothPath(scaled);
    const areaPath = `${path} L ${scaled[scaled.length - 1].x} ${height} L ${scaled[0].x} ${height} Z`;
    return { scaled, path, areaPath, min: minValue, max: maxValue };
  }, [data]);
  const visibleCountries = useMemo(
    () =>
      (data?.selectors?.countries || []).filter((country) =>
        country.name.toLowerCase().includes(countrySearch.toLowerCase()),
      ),
    [countrySearch, data],
  );
  const visibleGovernorates = useMemo(
    () =>
      (data?.selectors?.governorates || []).filter((gov) =>
        gov.name.toLowerCase().includes(governorateSearch.toLowerCase()),
      ),
    [data, governorateSearch],
  );
  const visibleDelegations = useMemo(
    () =>
      (data?.selectors?.delegations || []).filter((delegation) =>
        delegation.name.toLowerCase().includes(delegationSearch.toLowerCase()),
      ),
    [data, delegationSearch],
  );

  const locale = data?.locale?.locale || "en";
  const currency = data?.locale?.currencyCode || "TND";
  const latinLocale = `${locale}-u-nu-latn`;
  const todayIso = new Date().toISOString().slice(0, 10);
  const maxRangeDays = data?.meta.maxRangeDays ?? null;
  const minAllowedIso = maxRangeDays
    ? new Date(Date.now() - (maxRangeDays - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    : undefined;

  function moneyLocalized(value: number) {
    return new Intl.NumberFormat(latinLocale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
      numberingSystem: "latn",
    }).format(value);
  }

  function dateLocalized(value: string) {
    return new Intl.DateTimeFormat(latinLocale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      numberingSystem: "latn",
    }).format(new Date(value));
  }

  function toggleSavedPreset() {
    if (!data?.filters) return;
    const payload = {
      countryId: selectedCountryId,
      governorateIds: selectedGovernorateIds,
      delegationIds: selectedDelegationIds,
      statuses: selectedStatuses,
      paymentTypes: selectedPaymentTypes,
      driverCohort,
    };
    localStorage.setItem("financial-dashboard-filters", JSON.stringify(payload));
  }

  function loadSavedPreset() {
    const raw = localStorage.getItem("financial-dashboard-filters");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        countryId?: string;
        governorateIds?: string[];
        delegationIds?: string[];
        statuses?: string[];
        paymentTypes?: Array<"COD" | "WALLET">;
        driverCohort?: "new" | "experienced" | "all";
      };
      setSelectedCountryId(parsed.countryId || "");
      setSelectedGovernorateIds(parsed.governorateIds || []);
      setSelectedDelegationIds(parsed.delegationIds || []);
      setSelectedStatuses(parsed.statuses || []);
      setSelectedPaymentTypes(parsed.paymentTypes || []);
      setDriverCohort(parsed.driverCohort || "all");
      loadAnalytics(range);
    } catch {
      // Ignore malformed local preset
    }
  }

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, idx) => <Skeleton key={idx} className="h-32 w-full" />)}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Financial Analytics</h1>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              {data?.meta.role === "ADMIN" ? "Admin scope" : "Customer Service scope"}
            </Badge>
            <Badge variant="secondary">
              Scope: {data?.meta.scopeLabel || "Unknown"}
            </Badge>
            {data?.meta.isScoped && (
              <Badge variant="outline">Max range: {data.meta.maxRangeDays} days</Badge>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(data?.meta.allowedRanges || ["day", "week"]).map((option) => (
            <Button
              key={option}
              variant={range === option ? "default" : "outline"}
              size="sm"
              onClick={() => loadAnalytics(option)}
              disabled={loading}
            >
              {option.toUpperCase()}
            </Button>
          ))}
          <Button variant="outline" size="sm" onClick={() => loadAnalytics(range)} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-9 rounded-md border bg-background px-2 text-sm"
            aria-label="Start date"
            min={minAllowedIso}
            max={todayIso}
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-9 rounded-md border bg-background px-2 text-sm"
            aria-label="End date"
            min={minAllowedIso}
            max={todayIso}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={!canApplyCustomWindow() || loading}
            onClick={() => loadAnalytics(range, { startDate, endDate })}
          >
            Apply Dates
          </Button>
          <Button variant="outline" size="sm" onClick={toggleSavedPreset}>
            Save Preset
          </Button>
          <Button variant="outline" size="sm" onClick={loadSavedPreset}>
            Load Preset
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.location.href = buildExportHref("csv")}>
            <Download className="mr-1 h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.location.href = buildExportHref("xlsx")}>
            <Download className="mr-1 h-4 w-4" /> XLSX
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.location.href = buildExportHref("pdf")}>
            <Printer className="mr-1 h-4 w-4" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.location.href = buildExportHref("board")}>
            <Download className="mr-1 h-4 w-4" /> Board Bundle
          </Button>
        </div>
      </div>
      <div className="grid gap-3 rounded-xl border bg-card/70 p-3 lg:grid-cols-5">
        <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground lg:col-span-5">
          Country: {data?.selectors?.countries.find((country) => country.id === selectedCountryId)?.name || "None"}
          {" | "}
          Governorates: {selectedGovernorateIds.length}
          {" | "}
          Delegations: {selectedDelegationIds.length}
        </div>
        <div className="space-y-2 rounded-lg border p-3 lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Country</p>
          <Input
            value={countrySearch}
            onChange={(e) => setCountrySearch(e.target.value)}
            placeholder="Search country..."
            className="h-8"
          />
          <div className="max-h-36 space-y-1 overflow-y-auto">
            {visibleCountries.length === 0 ? (
              <p className="text-xs text-muted-foreground">No country matches your search.</p>
            ) : (
              visibleCountries.map((country) => (
                <button
                  key={country.id}
                  type="button"
                  className={`w-full rounded-md border px-2 py-1.5 text-left text-sm transition ${selectedCountryId === country.id ? "border-primary bg-primary/10 text-foreground" : "hover:bg-muted/60"}`}
                  onClick={() => {
                    setSelectedCountryId(country.id);
                    setSelectedGovernorateIds([]);
                    setSelectedDelegationIds([]);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span>{country.name}</span>
                    <span className="text-xs text-muted-foreground">{country.currencyCode}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
        <div className="space-y-2 rounded-lg border p-3 lg:col-span-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Governorates ({selectedGovernorateIds.length} selected)
            </p>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={!selectedCountryId || visibleGovernorates.length === 0}
                onClick={() => {
                  const allVisibleIds = visibleGovernorates.map((gov) => gov.id);
                  setSelectedGovernorateIds(allVisibleIds);
                  setSelectedDelegationIds([]);
                }}
              >
                Select all
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={selectedGovernorateIds.length === 0}
                onClick={() => {
                  setSelectedGovernorateIds([]);
                  setSelectedDelegationIds([]);
                }}
              >
                Clear
              </Button>
            </div>
          </div>
          <Input
            value={governorateSearch}
            onChange={(e) => setGovernorateSearch(e.target.value)}
            placeholder="Search governorate..."
            className="h-8"
            disabled={!selectedCountryId}
          />
          <div className="max-h-36 space-y-1 overflow-y-auto">
            {!selectedCountryId ? (
              <p className="text-xs text-muted-foreground">Select a country first.</p>
            ) : visibleGovernorates.length === 0 ? (
              <p className="text-xs text-muted-foreground">No governorate matches your search.</p>
            ) : (
              visibleGovernorates.map((gov) => {
                const checked = selectedGovernorateIds.includes(gov.id);
                return (
                  <label key={gov.id} className="flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm hover:bg-muted/60">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setSelectedGovernorateIds((prev) =>
                          e.target.checked ? [...prev, gov.id] : prev.filter((id) => id !== gov.id),
                        );
                        setSelectedDelegationIds([]);
                      }}
                    />
                    <span>{gov.name}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
        <div className="space-y-2 rounded-lg border p-3 lg:col-span-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Delegations ({selectedDelegationIds.length} selected)
            </p>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={selectedGovernorateIds.length === 0 || visibleDelegations.length === 0}
                onClick={() => setSelectedDelegationIds(visibleDelegations.map((delegation) => delegation.id))}
              >
                Select all
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={selectedDelegationIds.length === 0}
                onClick={() => setSelectedDelegationIds([])}
              >
                Clear
              </Button>
            </div>
          </div>
          <Input
            value={delegationSearch}
            onChange={(e) => setDelegationSearch(e.target.value)}
            placeholder="Search delegation..."
            className="h-8"
            disabled={selectedGovernorateIds.length === 0}
          />
          <div className="max-h-36 space-y-1 overflow-y-auto">
            {selectedGovernorateIds.length === 0 ? (
              <p className="text-xs text-muted-foreground">Select governorates first.</p>
            ) : visibleDelegations.length === 0 ? (
              <p className="text-xs text-muted-foreground">No delegation matches your search.</p>
            ) : (
              visibleDelegations.map((delegation) => {
                const checked = selectedDelegationIds.includes(delegation.id);
                return (
                  <label key={delegation.id} className="flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm hover:bg-muted/60">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setSelectedDelegationIds((prev) =>
                          e.target.checked ? [...prev, delegation.id] : prev.filter((id) => id !== delegation.id),
                        )
                      }
                    />
                    <span>{delegation.name}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      </div>
      <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2 rounded-md border bg-card/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Delivery Status ({selectedStatuses.length === 0 ? "All" : selectedStatuses.length})
          </p>
          <select
            multiple
            className="h-24 w-full rounded-md border bg-background px-2 text-sm"
            value={selectedStatuses.length === 0 ? ["__ALL__"] : selectedStatuses}
            onChange={(e) => {
              const values = Array.from(e.target.selectedOptions).map((opt) => opt.value);
              if (values.includes("__ALL__")) {
                setSelectedStatuses([]);
                return;
              }
              setSelectedStatuses(values);
            }}
          >
            <option value="__ALL__">All status</option>
            {["DELIVERED", "CANCELLED", "FAILED", "REFUNDED", "DRIVER_ASSIGNED", "DELIVERING"].map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2 rounded-md border bg-card/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Payment Types ({selectedPaymentTypes.length === 0 ? "All" : selectedPaymentTypes.length})
          </p>
          <select
            multiple
            className="h-24 w-full rounded-md border bg-background px-2 text-sm"
            value={selectedPaymentTypes.length === 0 ? ["__ALL__"] : selectedPaymentTypes}
            onChange={(e) => {
              const values = Array.from(e.target.selectedOptions).map((opt) => opt.value);
              if (values.includes("__ALL__")) {
                setSelectedPaymentTypes([]);
                return;
              }
              setSelectedPaymentTypes(values as Array<"COD" | "WALLET">);
            }}
          >
            <option value="__ALL__">ALL</option>
            <option value="COD">COD</option>
            <option value="WALLET">WALLET</option>
          </select>
        </div>
        <div className="space-y-2 rounded-md border bg-card/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Driver Type</p>
          <select
            className="h-10 w-full rounded-md border bg-background px-2 text-sm"
            value={driverCohort}
            onChange={(e) => setDriverCohort(e.target.value as "new" | "experienced" | "all")}
          >
            <option value="all">All drivers</option>
            <option value="new">New drivers</option>
            <option value="experienced">Experienced drivers</option>
          </select>
        </div>
      </div>
      {data?.meta.isScoped && startDate && endDate && !canApplyCustomWindow() && (
        <p className="text-xs text-amber-600">
          Customer Service custom range must be {maxRangeDays || 7} days or less.
        </p>
      )}
      {data?.meta.isScoped && maxRangeDays && (
        <p className="text-xs text-muted-foreground">
          Allowed window: last {maxRangeDays} day(s), from {minAllowedIso} to {todayIso} (set by admin).
        </p>
      )}

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {(data?.alerts || []).length > 0 && (
        <div className="grid gap-2 md:grid-cols-2">
          {(data?.alerts || []).map((alert) => (
            <div key={alert.key} className="rounded-lg border border-amber-300/60 bg-amber-50/60 p-3 text-sm dark:bg-amber-950/20">
              <p className="font-semibold">{alert.title}</p>
              <p className="text-muted-foreground">{alert.description}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {(data?.kpis || []).map((kpi) => (
          <Card key={kpi.key} className="relative overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{kpi.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{moneyLocalized(kpi.value)}</p>
              {(sparklineByKpi[kpi.key] || fallbackSparkline) && (
                <svg viewBox="0 0 180 30" className="mt-2 h-8 w-full">
                  <path d={sparklineByKpi[kpi.key] || fallbackSparkline} fill="none" stroke="rgb(59,130,246)" strokeWidth="2" />
                </svg>
              )}
              <p className={`mt-1 flex items-center gap-1 text-xs ${trendColor(kpi.trendPct)}`}>
                {kpi.trendPct > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                {Math.abs(kpi.trendPct).toFixed(1)}% vs previous period
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profit Curve</CardTitle>
        </CardHeader>
        <CardContent>
          {(data?.chart.points.length || 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No delivered-order data for this range. Adjust filters or date window.</p>
          ) : (
            <div className="space-y-3">
              <div className="overflow-x-auto">
                <svg viewBox="0 0 860 260" className="min-w-[760px] w-full">
                  <defs>
                    <linearGradient id="profitFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="rgb(59,130,246)" stopOpacity="0.32" />
                      <stop offset="100%" stopColor="rgb(59,130,246)" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  <path d={chartPoints.areaPath} fill="url(#profitFill)" />
                  <path d={chartPoints.path} fill="none" stroke="rgb(37,99,235)" strokeWidth="3" />
                  {chartPoints.scaled.map((point) => {
                    const anomaly = (data?.chart.anomalies || []).includes(point.date);
                    return (
                      <g key={point.date}>
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r={anomaly ? 5 : 3.5}
                          fill={anomaly ? "rgb(239,68,68)" : "rgb(59,130,246)"}
                          className="cursor-pointer"
                          onClick={() => setSelectedDate(point.date)}
                        />
                        {anomaly && (
                          <text x={point.x + 6} y={point.y - 6} className="fill-red-600 text-[10px]">
                            anomaly
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
              <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground">
                <span>Min: {money(chartPoints.min)}</span>
                <span>Click points to open daily drill-down</span>
                <span>Max: {money(chartPoints.max)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Daily Drill-Down {selectedDate ? `(${selectedDate})` : ""}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedRow ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Orders</p>
                  <p className="text-xl font-semibold">{selectedRow.orders}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Payouts</p>
                  <p className="text-xl font-semibold">{money(selectedRow.payouts)}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Refunds</p>
                  <p className="text-xl font-semibold">{money(selectedRow.refunds)}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Adjustments</p>
                  <p className="text-xl font-semibold">{money(selectedRow.adjustments)}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Net Profit</p>
                  <p className="text-xl font-semibold">{money(selectedRow.netProfit)}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Select a point on the chart to view detailed totals.</p>
            )}
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead className="text-right">Payouts</TableHead>
                    <TableHead className="text-right">Refunds</TableHead>
                    <TableHead className="text-right">Adjustments</TableHead>
                    <TableHead className="text-right">Net Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.drillDownRows || []).slice(0, 15).map((row) => (
                    <TableRow
                      key={row.date}
                      className={selectedDate === row.date ? "bg-blue-50/60 dark:bg-blue-900/20" : ""}
                      onClick={() => setSelectedDate(row.date)}
                    >
                      <TableCell className="font-medium">{dateLocalized(row.date)}</TableCell>
                      <TableCell>{row.orders}</TableCell>
                      <TableCell className="text-right">{money(row.payouts)}</TableCell>
                      <TableCell className="text-right">{money(row.refunds)}</TableCell>
                      <TableCell className="text-right">{money(row.adjustments)}</TableCell>
                      <TableCell className="text-right">{money(row.netProfit)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Governorate Comparison</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(data?.governorates || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No governorate-level data in this period.</p>
              ) : (
                (data?.governorates || []).slice(0, 8).map((gov, index) => (
                  <div key={gov.governorateId} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">
                        #{index + 1} {gov.governorateName}
                      </p>
                      <p className="text-sm font-semibold">{moneyLocalized(gov.profit)}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{gov.orders} delivered orders</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Financial Health</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(data?.health || []).map((metric) => (
                <div key={metric.key} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{metric.label}</p>
                    {metric.warning ? (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" /> Warning
                      </Badge>
                    ) : (
                      <Badge variant="outline">Healthy</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-lg font-semibold">{metric.value}</p>
                  {typeof metric.trendPct === "number" && (
                    <p className={`text-xs ${trendColor(metric.trendPct)}`}>
                      {metric.trendPct >= 0 ? "+" : ""}
                      {metric.trendPct.toFixed(1)}% vs previous period
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Last updated: {data?.lastUpdatedAt
          ? new Intl.DateTimeFormat(latinLocale, {
              dateStyle: "medium",
              timeStyle: "short",
              numberingSystem: "latn",
            }).format(new Date(data.lastUpdatedAt))
          : "-"}
      </p>
      {!!data?.quality && (
        <Card>
          <CardHeader>
            <CardTitle>Period Comparison & Quality</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Gross vs Net</p>
              <p className="font-semibold">{moneyLocalized(data.quality.grossRevenue)} / {moneyLocalized(data.quality.netProfit)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Cancellation Causes</p>
              <p className="font-semibold">Cancelled: {data.quality.cancellationCounts.cancelled}, Failed: {data.quality.cancellationCounts.failed}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Payout Efficiency</p>
              <p className="font-semibold">{(data.quality.payoutEfficiency * 100).toFixed(1)}%</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Period-over-Period</p>
              <p className="font-semibold">Gross {data.quality.periodComparison.grossRevenuePct}% | Net {data.quality.periodComparison.netProfitPct}%</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
