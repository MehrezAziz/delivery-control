"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Download, Printer, RefreshCw, ShieldCheck, BarChart3, Filter, TrendingUp, MapPin, Calendar, Sparkles, LayoutDashboard, Search, Truck, CreditCard, Package, X, RotateCcw, Globe, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
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
  if (value > 0) return "text-emerald-600 dark:text-emerald-400";
  if (value < 0) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
}

const KPI_ACCENTS = [
  "border-blue-200/70 dark:border-blue-800/40 from-blue-500/8 to-transparent",
  "border-emerald-200/70 dark:border-emerald-800/40 from-emerald-500/8 to-transparent",
  "border-violet-200/70 dark:border-violet-800/40 from-violet-500/8 to-transparent",
  "border-amber-200/70 dark:border-amber-800/40 from-amber-500/8 to-transparent",
  "border-rose-200/70 dark:border-rose-800/40 from-rose-500/8 to-transparent",
];

const KPI_SPARK_COLORS = ["rgb(59,130,246)", "rgb(16,185,129)", "rgb(139,92,246)", "rgb(245,158,11)", "rgb(244,63,94)"];

const STATUS_OPTIONS = ["DELIVERED", "CANCELLED", "FAILED", "REFUNDED", "DRIVER_ASSIGNED", "DELIVERING"] as const;
const PAYMENT_OPTIONS = ["COD", "WALLET"] as const;
const DRIVER_COHORT_OPTIONS = [
  { value: "all" as const, label: "All drivers" },
  { value: "new" as const, label: "New drivers" },
  { value: "experienced" as const, label: "Experienced" },
];

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

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCountryId) count += 1;
    count += selectedGovernorateIds.length;
    count += selectedDelegationIds.length;
    count += selectedStatuses.length;
    count += selectedPaymentTypes.length;
    if (driverCohort !== "all") count += 1;
    return count;
  }, [driverCohort, selectedCountryId, selectedDelegationIds, selectedGovernorateIds, selectedPaymentTypes, selectedStatuses]);

  function clearAllFilters() {
    setSelectedCountryId("");
    setSelectedGovernorateIds([]);
    setSelectedDelegationIds([]);
    setSelectedStatuses([]);
    setSelectedPaymentTypes([]);
    setDriverCohort("all");
    setCountrySearch("");
    setGovernorateSearch("");
    setDelegationSearch("");
  }

  function toggleStatus(status: string) {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
    );
  }

  function togglePaymentType(type: "COD" | "WALLET") {
    setSelectedPaymentTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }

  if (loading && !data) {
    return (
      <div className="min-h-full bg-gradient-to-b from-indigo-50/70 via-background to-background dark:from-indigo-950/15 p-1">
        <div className="space-y-6 max-w-[1400px] mx-auto">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, idx) => (
              <Skeleton key={idx} className="h-36 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const primaryKpi = data?.kpis?.[0];

  return (
    <div className="min-h-full bg-gradient-to-b from-indigo-50/70 via-background to-background dark:from-indigo-950/15">
      <div className="space-y-6 max-w-[1400px] mx-auto">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-indigo-600 via-blue-600 to-slate-700 text-white shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.12),transparent_50%)]" />
          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
              <div className="space-y-3 min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  Operations overview
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
                  <BarChart3 className="h-8 w-8 opacity-90 shrink-0" />
                  Financial Analytics
                </h1>
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-white/15 hover:bg-white/20 text-white border-white/20 gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {data?.meta.role === "ADMIN" ? "Admin scope" : "CS scope"}
                  </Badge>
                  <Badge className="bg-white/10 hover:bg-white/15 text-white/95 border-white/15">
                    {data?.meta.scopeLabel || "Unknown scope"}
                  </Badge>
                  {data?.meta.isScoped && (
                    <Badge className="bg-white/10 text-white/90 border-white/15">
                      Max {data.meta.maxRangeDays} days
                    </Badge>
                  )}
                </div>
                {primaryKpi && (
                  <p className="text-indigo-100 text-sm">
                    Top metric — {primaryKpi.label}:{" "}
                    <span className="font-semibold text-white">{moneyLocalized(primaryKpi.value)}</span>
                  </p>
                )}
              </div>

              {/* Range + refresh */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <div className="flex rounded-lg bg-white/10 p-1 backdrop-blur-sm">
                  {(data?.meta.allowedRanges || ["day", "week"]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      disabled={loading}
                      onClick={() => loadAnalytics(option)}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                        range === option
                          ? "bg-white text-indigo-700 shadow-sm"
                          : "text-white/90 hover:bg-white/10"
                      } disabled:opacity-50`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-white/15 text-white border-white/20 hover:bg-white/25"
                  onClick={() => loadAnalytics(range)}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
          </div>

          {(data?.kpis?.length ?? 0) > 0 && (
            <div className="relative border-t border-white/20 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-white/15">
              {(data?.kpis || []).slice(0, 5).map((kpi) => (
                <div key={kpi.key} className="px-4 py-3 text-center sm:px-5">
                  <p className="text-[10px] uppercase tracking-wide text-indigo-200 truncate">{kpi.label}</p>
                  <p className="text-lg font-bold tabular-nums mt-0.5">{moneyLocalized(kpi.value)}</p>
                  <p className={`text-[10px] mt-0.5 flex items-center justify-center gap-0.5 ${kpi.trendPct >= 0 ? "text-emerald-200" : "text-rose-200"}`}>
                    {kpi.trendPct >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {Math.abs(kpi.trendPct).toFixed(1)}%
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Toolbar: dates, presets, exports */}
        <Card className="overflow-hidden border-indigo-200/50 dark:border-indigo-800/30">
          <div className="h-0.5 bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-500" />
          <CardContent className="pt-5 pb-4">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Date range &amp; exports
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9 rounded-lg border bg-background px-3 text-sm"
                  aria-label="Start date"
                  min={minAllowedIso}
                  max={todayIso}
                />
                <span className="text-muted-foreground text-sm">→</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9 rounded-lg border bg-background px-3 text-sm"
                  aria-label="End date"
                  min={minAllowedIso}
                  max={todayIso}
                />
                <Button
                  variant="default"
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700"
                  disabled={!canApplyCustomWindow() || loading}
                  onClick={() => loadAnalytics(range, { startDate, endDate })}
                >
                  Apply
                </Button>
                <div className="hidden sm:block w-px h-6 bg-border mx-1" />
                <Button variant="outline" size="sm" onClick={toggleSavedPreset}>
                  Save preset
                </Button>
                <Button variant="outline" size="sm" onClick={loadSavedPreset}>
                  Load preset
                </Button>
                <div className="hidden sm:block w-px h-6 bg-border mx-1" />
                <Button variant="outline" size="sm" onClick={() => { window.location.href = buildExportHref("csv"); }}>
                  <Download className="mr-1.5 h-4 w-4" /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => { window.location.href = buildExportHref("xlsx"); }}>
                  <Download className="mr-1.5 h-4 w-4" /> XLSX
                </Button>
                <Button variant="outline" size="sm" onClick={() => { window.location.href = buildExportHref("pdf"); }}>
                  <Printer className="mr-1.5 h-4 w-4" /> PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => { window.location.href = buildExportHref("board"); }}>
                  <Download className="mr-1.5 h-4 w-4" /> Board
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Geographic & operational filters */}
        <Card className="overflow-hidden border-indigo-200/50 dark:border-indigo-800/30 shadow-sm">
          <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-blue-500" />
          <CardHeader className="pb-3 bg-gradient-to-br from-indigo-50/80 via-background to-background dark:from-indigo-950/20">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/40">
                    <Filter className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge className="bg-indigo-600 hover:bg-indigo-600 text-white tabular-nums">
                      {activeFilterCount} active
                    </Badge>
                  )}
                </CardTitle>
                <p className="text-xs text-muted-foreground font-normal mt-2">
                  Refine analytics by geography, delivery status, payment method, and driver cohort.
                </p>
              </div>
              {activeFilterCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300"
                  onClick={clearAllFilters}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Clear all
                </Button>
              )}
            </div>

            {activeFilterCount > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-indigo-100 dark:border-indigo-900/40">
                {selectedCountryId && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCountryId("");
                      setSelectedGovernorateIds([]);
                      setSelectedDelegationIds([]);
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-800 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200"
                  >
                    <Globe className="h-3 w-3" />
                    {data?.selectors?.countries.find((c) => c.id === selectedCountryId)?.name || "Country"}
                    <X className="h-3 w-3 opacity-60" />
                  </button>
                )}
                {selectedGovernorateIds.map((govId) => (
                  <button
                    key={govId}
                    type="button"
                    onClick={() => {
                      setSelectedGovernorateIds((prev) => prev.filter((id) => id !== govId));
                      setSelectedDelegationIds([]);
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200"
                  >
                    <MapPin className="h-3 w-3" />
                    {data?.selectors?.governorates.find((g) => g.id === govId)?.name || govId.slice(0, 8)}
                    <X className="h-3 w-3 opacity-60" />
                  </button>
                ))}
                {selectedDelegationIds.map((delegId) => (
                  <button
                    key={delegId}
                    type="button"
                    onClick={() => setSelectedDelegationIds((prev) => prev.filter((id) => id !== delegId))}
                    className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-0.5 text-xs font-medium text-cyan-800 hover:bg-cyan-100 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200"
                  >
                    <Building2 className="h-3 w-3" />
                    {data?.selectors?.delegations.find((d) => d.id === delegId)?.name || delegId.slice(0, 8)}
                    <X className="h-3 w-3 opacity-60" />
                  </button>
                ))}
                {selectedStatuses.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => toggleStatus(status)}
                    className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-800 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
                  >
                    <Package className="h-3 w-3" />
                    {status.replace(/_/g, " ")}
                    <X className="h-3 w-3 opacity-60" />
                  </button>
                ))}
                {selectedPaymentTypes.map((pt) => (
                  <button
                    key={pt}
                    type="button"
                    onClick={() => togglePaymentType(pt)}
                    className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                  >
                    <CreditCard className="h-3 w-3" />
                    {pt}
                    <X className="h-3 w-3 opacity-60" />
                  </button>
                ))}
                {driverCohort !== "all" && (
                  <button
                    type="button"
                    onClick={() => setDriverCohort("all")}
                    className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                  >
                    <Truck className="h-3 w-3" />
                    {DRIVER_COHORT_OPTIONS.find((o) => o.value === driverCohort)?.label}
                    <X className="h-3 w-3 opacity-60" />
                  </button>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-5 pt-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-indigo-600" />
                Geography
              </p>
              <div className="grid gap-3 lg:grid-cols-5">
                <div className="space-y-2 rounded-xl border border-sky-200/60 bg-gradient-to-br from-sky-50/80 to-transparent dark:from-sky-950/20 dark:border-sky-800/40 p-3 lg:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5" />
                    Country
                  </p>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      placeholder="Search country..."
                      className="h-8 pl-8"
                    />
                  </div>
                  <div className="max-h-36 space-y-1 overflow-y-auto pr-0.5">
                    {visibleCountries.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2 text-center">No country matches.</p>
                    ) : (
                      visibleCountries.map((country) => (
                        <button
                          key={country.id}
                          type="button"
                          className={cn(
                            "w-full rounded-lg border px-2.5 py-2 text-left text-sm transition-all",
                            selectedCountryId === country.id
                              ? "border-indigo-500 bg-indigo-600 text-white shadow-sm"
                              : "hover:bg-muted/60 hover:border-indigo-200",
                          )}
                          onClick={() => {
                            setSelectedCountryId(country.id);
                            setSelectedGovernorateIds([]);
                            setSelectedDelegationIds([]);
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium truncate">{country.name}</span>
                            <span className={cn("text-xs shrink-0", selectedCountryId === country.id ? "text-indigo-100" : "text-muted-foreground")}>
                              {country.currencyCode}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
                <div className="space-y-2 rounded-xl border border-sky-200/60 bg-gradient-to-br from-sky-50/80 to-transparent dark:from-sky-950/20 dark:border-sky-800/40 p-3 lg:col-span-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      Governorates
                      <Badge variant="secondary" className="h-4 px-1.5 text-[10px] tabular-nums">
                        {selectedGovernorateIds.length}
                      </Badge>
                    </p>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={!selectedCountryId || visibleGovernorates.length === 0}
                        onClick={() => {
                          setSelectedGovernorateIds(visibleGovernorates.map((gov) => gov.id));
                          setSelectedDelegationIds([]);
                        }}
                      >
                        All
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
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={governorateSearch}
                      onChange={(e) => setGovernorateSearch(e.target.value)}
                      placeholder="Search governorate..."
                      className="h-8 pl-8"
                      disabled={!selectedCountryId}
                    />
                  </div>
                  <div className="max-h-36 space-y-1 overflow-y-auto pr-0.5">
                    {!selectedCountryId ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">Select a country first.</p>
                    ) : visibleGovernorates.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">No governorate matches.</p>
                    ) : (
                      visibleGovernorates.map((gov) => {
                        const checked = selectedGovernorateIds.includes(gov.id);
                        return (
                          <label
                            key={gov.id}
                            className={cn(
                              "flex cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-2 text-sm transition-all",
                              checked
                                ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30"
                                : "hover:bg-muted/60",
                            )}
                          >
                            <input
                              type="checkbox"
                              className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                              checked={checked}
                              onChange={(e) => {
                                setSelectedGovernorateIds((prev) =>
                                  e.target.checked ? [...prev, gov.id] : prev.filter((id) => id !== gov.id),
                                );
                                setSelectedDelegationIds([]);
                              }}
                            />
                            <span className="truncate">{gov.name}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
                <div className="space-y-2 rounded-xl border border-sky-200/60 bg-gradient-to-br from-sky-50/80 to-transparent dark:from-sky-950/20 dark:border-sky-800/40 p-3 lg:col-span-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5" />
                      Delegations
                      <Badge variant="secondary" className="h-4 px-1.5 text-[10px] tabular-nums">
                        {selectedDelegationIds.length}
                      </Badge>
                    </p>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={selectedGovernorateIds.length === 0 || visibleDelegations.length === 0}
                        onClick={() => setSelectedDelegationIds(visibleDelegations.map((d) => d.id))}
                      >
                        All
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
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={delegationSearch}
                      onChange={(e) => setDelegationSearch(e.target.value)}
                      placeholder="Search..."
                      className="h-8 pl-8"
                      disabled={selectedGovernorateIds.length === 0}
                    />
                  </div>
                  <div className="max-h-36 space-y-1 overflow-y-auto pr-0.5">
                    {selectedGovernorateIds.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">Select governorates first.</p>
                    ) : visibleDelegations.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">No delegation matches.</p>
                    ) : (
                      visibleDelegations.map((delegation) => {
                        const checked = selectedDelegationIds.includes(delegation.id);
                        return (
                          <label
                            key={delegation.id}
                            className={cn(
                              "flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 text-xs transition-all",
                              checked
                                ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30"
                                : "hover:bg-muted/60",
                            )}
                          >
                            <input
                              type="checkbox"
                              className="rounded border-indigo-300 text-indigo-600"
                              checked={checked}
                              onChange={(e) =>
                                setSelectedDelegationIds((prev) =>
                                  e.target.checked
                                    ? [...prev, delegation.id]
                                    : prev.filter((id) => id !== delegation.id),
                                )
                              }
                            />
                            <span className="truncate">{delegation.name}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-indigo-600" />
                Operational filters
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2.5 rounded-xl border bg-gradient-to-br from-violet-50/50 to-transparent dark:from-violet-950/15 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5" />
                    Delivery status
                    <span className="font-normal normal-case text-muted-foreground">
                      ({selectedStatuses.length === 0 ? "All" : selectedStatuses.length})
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedStatuses([])}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-medium border transition-all",
                        selectedStatuses.length === 0
                          ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                          : "border-border hover:bg-muted/60",
                      )}
                    >
                      All
                    </button>
                    {STATUS_OPTIONS.map((status) => {
                      const on = selectedStatuses.includes(status);
                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => toggleStatus(status)}
                          className={cn(
                            "rounded-full px-2.5 py-1 text-xs font-medium border transition-all",
                            on
                              ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                              : "border-border hover:bg-muted/60",
                          )}
                        >
                          {status.replace(/_/g, " ")}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2.5 rounded-xl border bg-gradient-to-br from-emerald-50/50 to-transparent dark:from-emerald-950/15 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" />
                    Payment type
                    <span className="font-normal normal-case text-muted-foreground">
                      ({selectedPaymentTypes.length === 0 ? "All" : selectedPaymentTypes.length})
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedPaymentTypes([])}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-medium border transition-all",
                        selectedPaymentTypes.length === 0
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                          : "border-border hover:bg-muted/60",
                      )}
                    >
                      All
                    </button>
                    {PAYMENT_OPTIONS.map((pt) => {
                      const on = selectedPaymentTypes.includes(pt);
                      return (
                        <button
                          key={pt}
                          type="button"
                          onClick={() => togglePaymentType(pt)}
                          className={cn(
                            "rounded-full px-2.5 py-1 text-xs font-medium border transition-all",
                            on
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                              : "border-border hover:bg-muted/60",
                          )}
                        >
                          {pt === "COD" ? "Cash on delivery" : "Wallet"}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2.5 rounded-xl border bg-gradient-to-br from-amber-50/50 to-transparent dark:from-amber-950/15 p-4 sm:col-span-2 lg:col-span-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5" />
                    Driver cohort
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {DRIVER_COHORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setDriverCohort(opt.value)}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-medium border transition-all",
                          driverCohort === opt.value
                            ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                            : "border-border hover:bg-muted/60",
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {data?.meta.isScoped && startDate && endDate && !canApplyCustomWindow() && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Customer Service custom range must be {maxRangeDays || 7} days or less.
              </p>
            )}
            {data?.meta.isScoped && maxRangeDays && (
              <p className="text-xs text-muted-foreground">
                Allowed window: last {maxRangeDays} day(s), from {minAllowedIso} to {todayIso} (set by admin).
              </p>
            )}
          </CardContent>
        </Card>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      {(data?.alerts || []).length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {(data?.alerts || []).map((alert) => (
            <div
              key={alert.key}
              className="rounded-xl border border-amber-300/60 bg-amber-50/80 p-4 text-sm dark:bg-amber-950/25 flex gap-3"
            >
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{alert.title}</p>
                <p className="text-muted-foreground mt-0.5">{alert.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <TrendingUp className="h-4 w-4 text-indigo-600" />
        Key metrics
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {(data?.kpis || []).map((kpi, idx) => {
          const accent = KPI_ACCENTS[idx % KPI_ACCENTS.length];
          const sparkColor = KPI_SPARK_COLORS[idx % KPI_SPARK_COLORS.length];
          return (
          <Card key={kpi.key} className={`relative overflow-hidden border bg-gradient-to-br ${accent}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {kpi.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums tracking-tight">{moneyLocalized(kpi.value)}</p>
              {(sparklineByKpi[kpi.key] || fallbackSparkline) && (
                <svg viewBox="0 0 180 30" className="mt-3 h-8 w-full opacity-80">
                  <path
                    d={sparklineByKpi[kpi.key] || fallbackSparkline}
                    fill="none"
                    stroke={sparkColor}
                    strokeWidth="2"
                  />
                </svg>
              )}
              <p className={`mt-2 flex items-center gap-1 text-xs font-medium ${trendColor(kpi.trendPct)}`}>
                {kpi.trendPct > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                {Math.abs(kpi.trendPct).toFixed(1)}% vs previous period
              </p>
            </CardContent>
          </Card>
          );
        })}
      </div>

      <Card className="overflow-hidden border-indigo-200/40 dark:border-indigo-800/30">
        <div className="h-0.5 bg-gradient-to-r from-blue-500 to-indigo-500" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-600" />
            Profit curve
          </CardTitle>
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
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">
              Daily drill-down {selectedDate ? `· ${dateLocalized(selectedDate)}` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedRow ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-xl border bg-blue-50/50 dark:bg-blue-950/20 p-3">
                  <p className="text-xs text-muted-foreground">Orders</p>
                  <p className="text-xl font-bold tabular-nums">{selectedRow.orders}</p>
                </div>
                <div className="rounded-xl border bg-violet-50/50 dark:bg-violet-950/20 p-3">
                  <p className="text-xs text-muted-foreground">Payouts</p>
                  <p className="text-xl font-bold tabular-nums">{money(selectedRow.payouts)}</p>
                </div>
                <div className="rounded-xl border bg-rose-50/50 dark:bg-rose-950/20 p-3">
                  <p className="text-xs text-muted-foreground">Refunds</p>
                  <p className="text-xl font-bold tabular-nums">{money(selectedRow.refunds)}</p>
                </div>
                <div className="rounded-xl border bg-amber-50/50 dark:bg-amber-950/20 p-3">
                  <p className="text-xs text-muted-foreground">Adjustments</p>
                  <p className="text-xl font-bold tabular-nums">{money(selectedRow.adjustments)}</p>
                </div>
                <div className="rounded-xl border bg-emerald-50/50 dark:bg-emerald-950/20 p-3">
                  <p className="text-xs text-muted-foreground">Net profit</p>
                  <p className="text-xl font-bold tabular-nums">{money(selectedRow.netProfit)}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Select a point on the chart to view detailed totals.</p>
            )}
            <div className="rounded-xl border overflow-hidden">
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
                      className={`cursor-pointer transition-colors ${selectedDate === row.date ? "bg-indigo-50/70 dark:bg-indigo-950/30" : "hover:bg-muted/40"}`}
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
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4 text-indigo-600" />
                Governorate comparison
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(data?.governorates || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No governorate-level data in this period.</p>
              ) : (
                (data?.governorates || []).slice(0, 8).map((gov, index) => (
                  <div key={gov.governorateId} className="rounded-xl border p-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">
                        <span className="text-muted-foreground mr-1.5">#{index + 1}</span>
                        {gov.governorateName}
                      </p>
                      <p className="text-sm font-bold tabular-nums shrink-0">{moneyLocalized(gov.profit)}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{gov.orders} delivered orders</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-600" />
                Financial health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(data?.health || []).map((metric) => (
                <div
                  key={metric.key}
                  className={`rounded-xl border p-3 ${metric.warning ? "border-amber-300/60 bg-amber-50/40 dark:bg-amber-950/20" : ""}`}
                >
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

      <p className="text-xs text-muted-foreground text-center pb-2">
        Last updated:{" "}
        {data?.lastUpdatedAt
          ? new Intl.DateTimeFormat(latinLocale, {
              dateStyle: "medium",
              timeStyle: "short",
              numberingSystem: "latn",
            }).format(new Date(data.lastUpdatedAt))
          : "—"}
      </p>
      {!!data?.quality && (
        <Card className="overflow-hidden">
          <div className="h-0.5 bg-gradient-to-r from-emerald-500 to-teal-500" />
          <CardHeader>
            <CardTitle className="text-base">Period comparison &amp; quality</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">Gross vs Net</p>
              <p className="font-semibold mt-1">
                {moneyLocalized(data.quality.grossRevenue)} / {moneyLocalized(data.quality.netProfit)}
              </p>
            </div>
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">Cancellation causes</p>
              <p className="font-semibold mt-1">
                Cancelled: {data.quality.cancellationCounts.cancelled}, Failed:{" "}
                {data.quality.cancellationCounts.failed}
              </p>
            </div>
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">Payout efficiency</p>
              <p className="font-semibold mt-1">{(data.quality.payoutEfficiency * 100).toFixed(1)}%</p>
            </div>
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">Period-over-period</p>
              <p className="font-semibold mt-1">
                Gross {data.quality.periodComparison.grossRevenuePct}% · Net{" "}
                {data.quality.periodComparison.netProfitPct}%
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}
