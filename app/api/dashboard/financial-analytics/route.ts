import { NextRequest, NextResponse } from "next/server";
import { DriverTransactionType, OrderStatus, PaymentType, TransactionStatus } from "@prisma/client";
import { hasCSRole, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";
import { getCsFinancialMaxDays } from "@/lib/cs-financial-policy";

type RangeKey = "day" | "week" | "month" | "year" | "all";
type DateWindow = { startDate: Date | null; endDate: Date };
type DriverCohort = "new" | "experienced" | "all";

type CacheEntry = {
  expiresAt: number;
  payload: unknown;
};

const CACHE_TTL_MS = 60_000;
const analyticsCache = new Map<string, CacheEntry>();

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CS_MAX_RANGE_DAYS = 7;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function clampRange(range: string | null): RangeKey {
  if (range === "day" || range === "week" || range === "month" || range === "year" || range === "all") {
    return range;
  }
  return "week";
}

function computeWindow(range: RangeKey, now: Date): { startDate: Date | null; endDate: Date } {
  const endDate = now;
  if (range === "all") return { startDate: null, endDate };
  const daysByRange: Record<Exclude<RangeKey, "all">, number> = {
    day: 1,
    week: 7,
    month: 30,
    year: 365,
  };
  const days = daysByRange[range];
  const startDate = new Date(endDate.getTime() - (days - 1) * DAY_MS);
  return { startDate: startOfDay(startDate), endDate: endOfDay(endDate) };
}

function parseCustomWindow(startParam: string | null, endParam: string | null): DateWindow | null {
  if (!startParam || !endParam) return null;
  const rawStart = new Date(startParam);
  const rawEnd = new Date(endParam);
  if (Number.isNaN(rawStart.getTime()) || Number.isNaN(rawEnd.getTime())) return null;
  if (rawStart.getTime() > rawEnd.getTime()) return null;
  return { startDate: startOfDay(rawStart), endDate: endOfDay(rawEnd) };
}

function splitWindows(startDate: Date | null, endDate: Date): { prevStartDate: Date | null; prevEndDate: Date | null } {
  if (!startDate) return { prevStartDate: null, prevEndDate: null };
  const duration = endDate.getTime() - startDate.getTime();
  const prevEndDate = new Date(startDate.getTime() - 1);
  const prevStartDate = new Date(prevEndDate.getTime() - duration);
  return { prevStartDate, prevEndDate };
}

function toMoney(input: unknown): number {
  if (input == null) return 0;
  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pctDiff(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function parseListParam(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function parseDriverCohort(value: string | null): DriverCohort {
  if (value === "new" || value === "experienced" || value === "all") return value;
  return "all";
}

function safeIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    const url = new URL(req.url);
    const requestedRange = clampRange(url.searchParams.get("range"));
    const requestedGovernorateIds = parseListParam(url.searchParams.get("governorateIds"));
    const requestedDelegationIds = parseListParam(url.searchParams.get("delegationIds"));
    const requestedStatuses = parseListParam(url.searchParams.get("statuses")).filter((status): status is OrderStatus =>
      [
        "DRAFT",
        "SEARCHING_DRIVER",
        "PENDING_CUSTOMER_APPROVAL",
        "DRIVER_ASSIGNED",
        "DRIVER_ARRIVED",
        "PICKED_UP",
        "DELIVERING",
        "DELIVERED",
        "CANCELLED",
        "REFUNDED",
        "FAILED",
        "DISPUTED",
      ].includes(status),
    );
    const paymentTypes = parseListParam(url.searchParams.get("paymentTypes")).filter((p): p is PaymentType =>
      p === "COD" || p === "WALLET",
    );
    const driverCohort = parseDriverCohort(url.searchParams.get("driverCohort"));
    const requestedCountryId = (url.searchParams.get("countryId") || "").trim() || null;
    const customWindow = parseCustomWindow(
      url.searchParams.get("startDate"),
      url.searchParams.get("endDate"),
    );

    const isAdmin = auth.role === "ADMIN";
    const canManageFinancialReports =
      isAdmin ||
      (auth.role === "CUSTOMER_SERVICE" && hasCSRole(auth, "MANAGE_FINANCIAL_REPORTS"));

    if (!canManageFinancialReports) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    let allowedGovernorateIds: string[] = [];
    let csMaxRangeDays = DEFAULT_CS_MAX_RANGE_DAYS;
    if (!isAdmin) {
      const cs = await prisma.customerService.findUnique({
        where: { id: auth.customerServiceId },
        select: {
          governorates: {
            select: { governorateId: true, governorate: { select: { nameGovernorate: true } } },
          },
        },
      });
      allowedGovernorateIds = (cs?.governorates || []).map((g) => g.governorateId);
      if (auth.customerServiceId) {
        csMaxRangeDays = await getCsFinancialMaxDays(auth.customerServiceId);
      }
      if (allowedGovernorateIds.length === 0) {
        return NextResponse.json({
          meta: {
            role: auth.role,
            scopeLabel: "No governorates assigned",
            governorateCount: 0,
            allowedRanges: ["day", "week"],
            activeRange: "day",
            isScoped: true,
            maxRangeDays: csMaxRangeDays,
          },
          kpis: [],
          chart: { points: [], anomalies: [] },
          governorates: [],
          drillDownRows: [],
          health: [],
          lastUpdatedAt: new Date().toISOString(),
        });
      }
    }

    const allCountries = await prisma.country.findMany({
      select: { id: true, name: true, isoCode: true, currencyCode: true, language: true },
      orderBy: { name: "asc" },
    });
    const tunisia = allCountries.find(
      (country) =>
        country.isoCode.toUpperCase() === "TN" ||
        country.name.toLowerCase().includes("tunisia"),
    );
    const effectiveCountryId = requestedCountryId || tunisia?.id || allCountries[0]?.id || null;

    const effectiveRange: RangeKey = isAdmin
      ? requestedRange
      : (
        requestedRange === "all"
          ? (csMaxRangeDays >= 3650 ? "all" : csMaxRangeDays >= 365 ? "year" : csMaxRangeDays >= 30 ? "month" : csMaxRangeDays >= 7 ? "week" : "day")
          : requestedRange === "year"
            ? (csMaxRangeDays >= 365 ? "year" : csMaxRangeDays >= 30 ? "month" : csMaxRangeDays >= 7 ? "week" : "day")
            : requestedRange === "month"
              ? (csMaxRangeDays >= 30 ? "month" : csMaxRangeDays >= 7 ? "week" : "day")
              : requestedRange === "week"
                ? (csMaxRangeDays >= 7 ? "week" : "day")
                : "day"
      );

    const availableGovernorates = await prisma.governorate.findMany({
      where: isAdmin
        ? (effectiveCountryId ? { countryId: effectiveCountryId } : { id: "__none__" })
        : {
            id: { in: allowedGovernorateIds },
            ...(effectiveCountryId ? { countryId: effectiveCountryId } : {}),
          },
      select: { id: true, nameGovernorate: true, countryId: true },
      orderBy: { nameGovernorate: "asc" },
    });
    const availableGovernorateIds = availableGovernorates.map((gov) => gov.id);
    const effectiveGovernorateIds = requestedGovernorateIds.length
      ? requestedGovernorateIds.filter((id) => availableGovernorateIds.includes(id))
      : availableGovernorateIds;

    const availableDelegations = await prisma.delegation.findMany({
      where: effectiveGovernorateIds.length
        ? { governorateId: { in: effectiveGovernorateIds } }
        : { id: "__none__" },
      select: { id: true, nameDelegation: true, governorateId: true },
      orderBy: { nameDelegation: "asc" },
    });
    const availableDelegationIds = availableDelegations.map((delegation) => delegation.id);
    const effectiveDelegationIds = requestedDelegationIds.length
      ? requestedDelegationIds.filter((id) => availableDelegationIds.includes(id))
      : availableDelegationIds;

    if (!isAdmin && requestedGovernorateIds.length > 0 && effectiveGovernorateIds.length === 0) {
      return NextResponse.json({ error: "Selected governorates are outside your scope." }, { status: 403 });
    }

    const now = new Date();
    const { startDate, endDate } = customWindow || computeWindow(effectiveRange, now);
    const { prevStartDate, prevEndDate } = splitWindows(startDate, endDate);

    if (!isAdmin && startDate && endDate.getTime() - startDate.getTime() > (csMaxRangeDays * DAY_MS - 1)) {
      return NextResponse.json({ error: `Customer Service range must not exceed ${csMaxRangeDays} days.` }, { status: 400 });
    }

    const cacheKey = JSON.stringify({
      role: auth.role,
      superUserId: auth.superUserId,
      csId: auth.customerServiceId ?? null,
      gov: allowedGovernorateIds.sort(),
      effectiveGov: effectiveGovernorateIds.sort(),
      effectiveDeleg: effectiveDelegationIds.sort(),
      range: effectiveRange,
      statuses: requestedStatuses.sort(),
      paymentTypes: paymentTypes.sort(),
      driverCohort,
      countryId: effectiveCountryId,
      customWindow: customWindow ? { startDate: startDate?.toISOString(), endDate: endDate.toISOString() } : null,
      startDate: startDate?.toISOString() ?? null,
      endDate: endDate.toISOString(),
    });
    const cached = analyticsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(cached.payload);
    }

    const orderWhere = {
      ...(startDate ? { createdAt: { gte: startDate, lte: endDate } } : {}),
      ...(requestedStatuses.length ? { status: { in: requestedStatuses } } : {}),
      ...(paymentTypes.length ? { paymentType: { in: paymentTypes } } : {}),
      ...(effectiveCountryId ? { pricingPolicy: { countryId: effectiveCountryId } } : {}),
      ...(driverCohort === "new"
        ? { driverAssignment: { driver: { driverAccount: { completedDeliveries: { lt: 100 } } } } }
        : driverCohort === "experienced"
          ? { driverAssignment: { driver: { driverAccount: { completedDeliveries: { gte: 100 } } } } }
          : {}),
      ...(effectiveDelegationIds.length
        ? {
            OR: [
              { pickupAddress: { delegationId: { in: effectiveDelegationIds } } },
              { dropoffAddress: { delegationId: { in: effectiveDelegationIds } } },
            ],
          }
        : {}),
    };

    const previousOrderWhere = prevStartDate && prevEndDate
      ? {
          createdAt: { gte: prevStartDate, lte: prevEndDate },
          ...(requestedStatuses.length ? { status: { in: requestedStatuses } } : {}),
          ...(paymentTypes.length ? { paymentType: { in: paymentTypes } } : {}),
          ...(effectiveCountryId ? { pricingPolicy: { countryId: effectiveCountryId } } : {}),
          ...(driverCohort === "new"
            ? { driverAssignment: { driver: { driverAccount: { completedDeliveries: { lt: 100 } } } } }
            : driverCohort === "experienced"
              ? { driverAssignment: { driver: { driverAccount: { completedDeliveries: { gte: 100 } } } } }
              : {}),
          ...(effectiveDelegationIds.length
            ? {
                OR: [
                  { pickupAddress: { delegationId: { in: effectiveDelegationIds } } },
                  { dropoffAddress: { delegationId: { in: effectiveDelegationIds } } },
                ],
              }
            : {}),
        }
      : null;

    const [orders, previousOrders, wallets, driverAdjustments, refunds] = await Promise.all([
      prisma.order.findMany({
        where: orderWhere,
        select: {
          id: true,
          createdAt: true,
          status: true,
          paymentType: true,
          price: true,
          customerExtraAmount: true,
          cashTransaction: { select: { platformFee: true, driverNet: true } },
          pricingPolicy: { select: { platformFee: true } },
          driverAssignment: { select: { driverId: true } },
          pickupAddress: { select: { delegation: { select: { governorate: { select: { id: true, nameGovernorate: true } } } } } },
          dropoffAddress: { select: { delegation: { select: { governorate: { select: { id: true, nameGovernorate: true } } } } } },
        },
      }),
      previousOrderWhere
        ? prisma.order.findMany({
            where: previousOrderWhere,
            select: {
              status: true,
              paymentType: true,
              price: true,
              customerExtraAmount: true,
              cashTransaction: { select: { platformFee: true } },
              pricingPolicy: { select: { platformFee: true } },
            },
          })
        : [],
      prisma.digitalWallet.findMany({
        where: effectiveDelegationIds.length
          ? {
              customer: {
                user: {
                  addresses: { some: { delegationId: { in: effectiveDelegationIds } } },
                },
              },
            }
          : {},
        select: { balance: true },
      }),
      prisma.driverTransaction.findMany({
        where: {
          ...(startDate ? { createdAt: { gte: startDate, lte: endDate } } : {}),
          type: DriverTransactionType.ADJUSTMENT,
        },
        select: {
          amount: true,
          createdAt: true,
          account: { select: { driverId: true } },
        },
      }),
      prisma.walletTransaction.findMany({
        where: {
          ...(startDate ? { createdAt: { gte: startDate, lte: endDate } } : {}),
          type: "REFUND",
          status: TransactionStatus.SUCCESS,
        },
        select: { amount: true, createdAt: true },
      }),
    ]);

    const relevantOrders = orders.filter((order) => order.status === "DELIVERED");
    const relevantPreviousOrders = previousOrders.filter((order) => order.status === "DELIVERED");

    const uniqueDriverIds = Array.from(
      new Set(relevantOrders.map((order) => order.driverAssignment?.driverId).filter(Boolean)),
    ) as string[];

    const [driverAccounts, previousRefunds] = await Promise.all([
      prisma.driverAccount.findMany({
        where: uniqueDriverIds.length ? { driverId: { in: uniqueDriverIds } } : { id: "__none__" },
        select: { balance: true },
      }),
      prevStartDate && prevEndDate
        ? prisma.walletTransaction.findMany({
            where: {
              createdAt: { gte: prevStartDate, lte: prevEndDate },
              type: "REFUND",
              status: TransactionStatus.SUCCESS,
            },
            select: { amount: true },
          })
        : [],
    ]);

    const grossRevenue = relevantOrders.reduce((sum, order) => sum + toMoney(order.price) + toMoney(order.customerExtraAmount), 0);
    const netProfit = relevantOrders.reduce((sum, order) => {
      const explicitPlatformFee = toMoney(order.cashTransaction?.platformFee);
      const policyPlatformFee = toMoney(order.pricingPolicy?.platformFee);
      const extraAmount = toMoney(order.customerExtraAmount);
      return sum + (explicitPlatformFee || policyPlatformFee + extraAmount);
    }, 0);

    const previousGrossRevenue = relevantPreviousOrders.reduce((sum, order) => sum + toMoney(order.price) + toMoney(order.customerExtraAmount), 0);
    const previousNetProfit = relevantPreviousOrders.reduce((sum, order) => {
      const explicitPlatformFee = toMoney(order.cashTransaction?.platformFee);
      const policyPlatformFee = toMoney(order.pricingPolicy?.platformFee);
      const extraAmount = toMoney(order.customerExtraAmount);
      return sum + (explicitPlatformFee || policyPlatformFee + extraAmount);
    }, 0);

    const positiveDebtSum = driverAccounts.filter((d) => toMoney(d.balance) > 0).reduce((s, d) => s + toMoney(d.balance), 0);
    const negativeDebtSum = driverAccounts.filter((d) => toMoney(d.balance) < 0).reduce((s, d) => s + toMoney(d.balance), 0);
    const totalDriverDebt = positiveDebtSum + negativeDebtSum;
    const walletTotal = wallets.reduce((sum, wallet) => sum + toMoney(wallet.balance), 0);

    const chartBuckets = new Map<string, number>();
    const drilldown = new Map<string, { date: string; orders: number; payouts: number; refunds: number; adjustments: number; netProfit: number }>();

    for (const order of relevantOrders) {
      const day = startOfDay(order.createdAt).toISOString().slice(0, 10);
      const explicitPlatformFee = toMoney(order.cashTransaction?.platformFee);
      const policyPlatformFee = toMoney(order.pricingPolicy?.platformFee);
      const payout = toMoney(order.cashTransaction?.driverNet);
      const profit = explicitPlatformFee || policyPlatformFee + toMoney(order.customerExtraAmount);

      chartBuckets.set(day, (chartBuckets.get(day) || 0) + profit);
      const row = drilldown.get(day) || { date: day, orders: 0, payouts: 0, refunds: 0, adjustments: 0, netProfit: 0 };
      row.orders += 1;
      row.payouts += payout;
      row.netProfit += profit;
      drilldown.set(day, row);
    }

    for (const tx of refunds) {
      const day = startOfDay(tx.createdAt).toISOString().slice(0, 10);
      const row = drilldown.get(day) || { date: day, orders: 0, payouts: 0, refunds: 0, adjustments: 0, netProfit: 0 };
      row.refunds += toMoney(tx.amount);
      drilldown.set(day, row);
    }

    const scopedDriverIds = new Set(uniqueDriverIds);
    for (const tx of driverAdjustments) {
      if (scopedDriverIds.size > 0 && !scopedDriverIds.has(tx.account.driverId)) continue;
      const day = startOfDay(tx.createdAt).toISOString().slice(0, 10);
      const row = drilldown.get(day) || { date: day, orders: 0, payouts: 0, refunds: 0, adjustments: 0, netProfit: 0 };
      row.adjustments += toMoney(tx.amount);
      drilldown.set(day, row);
    }

    const chartPoints = Array.from(chartBuckets.entries())
      .map(([date, value]) => ({ date, value: Number(value.toFixed(2)) }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const anomalies = chartPoints
      .map((point, idx, arr) => {
        if (idx < 3) return null;
        const baseline = arr.slice(Math.max(0, idx - 3), idx).reduce((s, p) => s + p.value, 0) / 3;
        if (baseline <= 0) return null;
        return point.value > baseline * 1.5 ? point.date : null;
      })
      .filter(Boolean) as string[];

    const refundsCurrent = refunds.reduce((sum, tx) => sum + toMoney(tx.amount), 0);
    const refundsPrevious = previousRefunds.reduce((sum, tx) => sum + toMoney(tx.amount), 0);

    const kpis = [
      {
        key: "grossRevenue",
        label: "Gross Revenue",
        value: Number(grossRevenue.toFixed(2)),
        currency: "TND",
        trendPct: Number(pctDiff(grossRevenue, previousGrossRevenue).toFixed(2)),
      },
      {
        key: "netProfit",
        label: "Net Profit",
        value: Number(netProfit.toFixed(2)),
        currency: "TND",
        trendPct: Number(pctDiff(netProfit, previousNetProfit).toFixed(2)),
      },
      {
        key: "driverDebt",
        label: "Total Driver Debt",
        value: Number(totalDriverDebt.toFixed(2)),
        currency: "TND",
        trendPct: 0,
      },
      {
        key: "positiveDebt",
        label: "Positive Driver Balance",
        value: Number(positiveDebtSum.toFixed(2)),
        currency: "TND",
        trendPct: 0,
      },
      {
        key: "negativeDebt",
        label: "Negative Driver Balance",
        value: Number(negativeDebtSum.toFixed(2)),
        currency: "TND",
        trendPct: 0,
      },
      {
        key: "walletTotal",
        label: "Customer Wallets Total",
        value: Number(walletTotal.toFixed(2)),
        currency: "TND",
        trendPct: 0,
      },
    ];

    const groupedByGovernorate = new Map<string, { governorateId: string; governorateName: string; profit: number; orders: number }>();
    for (const order of relevantOrders) {
      const gov = order.dropoffAddress?.delegation?.governorate || order.pickupAddress?.delegation?.governorate;
      if (!gov) continue;
      const current = groupedByGovernorate.get(gov.id) || {
        governorateId: gov.id,
        governorateName: gov.nameGovernorate,
        profit: 0,
        orders: 0,
      };
      const explicitPlatformFee = toMoney(order.cashTransaction?.platformFee);
      const policyPlatformFee = toMoney(order.pricingPolicy?.platformFee);
      current.profit += explicitPlatformFee || policyPlatformFee + toMoney(order.customerExtraAmount);
      current.orders += 1;
      groupedByGovernorate.set(gov.id, current);
    }
    const governorates = Array.from(groupedByGovernorate.values())
      .sort((a, b) => b.profit - a.profit)
      .map((g) => ({ ...g, profit: Number(g.profit.toFixed(2)) }));

    const drillDownRows = Array.from(drilldown.values()).sort((a, b) => b.date.localeCompare(a.date));
    const drillDownChronological = [...drillDownRows].sort((a, b) => a.date.localeCompare(b.date));

    const debtToProfit = netProfit === 0 ? 0 : Math.abs(negativeDebtSum) / netProfit;
    const walletLiabilityRatio = walletTotal === 0 ? 0 : Math.abs(totalDriverDebt) / walletTotal;
    const totalPayouts = drillDownRows.reduce((sum, row) => sum + row.payouts, 0);
    const payoutEfficiency = grossRevenue === 0 ? 0 : (grossRevenue - totalPayouts) / grossRevenue;
    const cancellationCounts = orders
      .filter((o) => o.status === "CANCELLED" || o.status === "FAILED")
      .reduce(
        (acc, order) => {
          if (order.status === "CANCELLED") acc.cancelled += 1;
          if (order.status === "FAILED") acc.failed += 1;
          return acc;
        },
        { cancelled: 0, failed: 0 },
      );
    const refundCauseBreakdown = refunds.length
      ? [
          { cause: "Wallet Refund", count: refunds.length, amount: Number(refundsCurrent.toFixed(2)) },
        ]
      : [];

    const health = [
      {
        key: "debtToProfit",
        label: "Debt to Profit Ratio",
        value: Number(debtToProfit.toFixed(3)),
        warning: debtToProfit > 1.2,
      },
      {
        key: "walletLiability",
        label: "Wallet Liability Ratio",
        value: Number(walletLiabilityRatio.toFixed(3)),
        warning: walletLiabilityRatio > 0.7,
      },
      {
        key: "refundPressure",
        label: "Refund Pressure",
        value: Number((netProfit === 0 ? 0 : refundsCurrent / netProfit).toFixed(3)),
        warning: refundsCurrent > netProfit * 0.35,
        trendPct: Number(pctDiff(refundsCurrent, refundsPrevious).toFixed(2)),
      },
      {
        key: "payoutEfficiency",
        label: "Driver Payout Efficiency",
        value: Number(payoutEfficiency.toFixed(3)),
        warning: payoutEfficiency < 0.1,
      },
    ];

    const driverDebtSeries = drillDownChronological.reduce<number[]>((acc, row, index) => {
      const prev = index === 0 ? 0 : acc[index - 1];
      acc.push(Number((prev + row.payouts + row.refunds - row.adjustments).toFixed(2)));
      return acc;
    }, []);
    const walletTotalSeries = drillDownChronological.reduce<number[]>((acc, row, index) => {
      const prev = index === 0 ? 0 : acc[index - 1];
      acc.push(Number((prev + row.netProfit - row.refunds + row.adjustments).toFixed(2)));
      return acc;
    }, []);
    const kpiSeries: Record<string, number[]> = {
      grossRevenue: drillDownChronological.map((row) => Number((row.netProfit + row.payouts).toFixed(2))),
      netProfit: drillDownChronological.map((row) => Number(row.netProfit.toFixed(2))),
      driverDebt: driverDebtSeries,
      positiveDebt: drillDownChronological.map((row) => Number(row.payouts.toFixed(2))),
      negativeDebt: drillDownChronological.map((row) => Number(row.refunds.toFixed(2))),
      walletTotal: walletTotalSeries,
    };

    const payload = {
      meta: {
        role: auth.role,
        scopeLabel: isAdmin
          ? "Global platform scope"
          : `Assigned governorates (${allowedGovernorateIds.length})`,
        governorateCount: allowedGovernorateIds.length,
        allowedRanges: isAdmin
          ? ["day", "week", "month", "year", "all"]
          : [
              "day",
              ...(csMaxRangeDays >= 7 ? (["week"] as const) : []),
              ...(csMaxRangeDays >= 30 ? (["month"] as const) : []),
              ...(csMaxRangeDays >= 365 ? (["year"] as const) : []),
              ...(csMaxRangeDays >= 3650 ? (["all"] as const) : []),
            ],
        activeRange: effectiveRange,
        isCustomRange: Boolean(customWindow),
        isScoped: !isAdmin,
        maxRangeDays: isAdmin ? null : csMaxRangeDays,
      },
      locale: {
        locale: allCountries.find((country) => country.id === effectiveCountryId)?.language || "en",
        currencyCode: allCountries.find((country) => country.id === effectiveCountryId)?.currencyCode || "TND",
      },
      selectors: {
        countries: allCountries.map((country) => ({
          id: country.id,
          name: country.name,
          currencyCode: country.currencyCode,
          locale: country.language || "en",
        })),
        governorates: availableGovernorates.map((gov) => ({
          id: gov.id,
          name: gov.nameGovernorate,
          countryId: gov.countryId,
        })),
        delegations: availableDelegations.map((delegation) => ({
          id: delegation.id,
          name: delegation.nameDelegation,
          governorateId: delegation.governorateId,
        })),
      },
      filters: {
        governorateIds: effectiveGovernorateIds,
        delegationIds: effectiveDelegationIds,
        statuses: requestedStatuses,
        paymentTypes,
        driverCohort,
        countryId: effectiveCountryId,
      },
      range: {
        startDate: startDate?.toISOString() ?? null,
        endDate: endDate.toISOString(),
      },
      kpis,
      chart: {
        points: chartPoints,
        anomalies,
      },
      kpiSeries,
      governorates,
      drillDownRows,
      health,
      quality: {
        grossRevenue: Number(grossRevenue.toFixed(2)),
        netProfit: Number(netProfit.toFixed(2)),
        totalPayouts: Number(totalPayouts.toFixed(2)),
        payoutEfficiency: Number(payoutEfficiency.toFixed(3)),
        cancellationCounts,
        refundCauseBreakdown,
        periodComparison: {
          grossRevenuePct: Number(pctDiff(grossRevenue, previousGrossRevenue).toFixed(2)),
          netProfitPct: Number(pctDiff(netProfit, previousNetProfit).toFixed(2)),
        },
      },
      alerts: [
        ...(anomalies.length > 0
          ? [{
              key: "profit_anomalies",
              severity: "high",
              title: "Profit anomaly detected",
              description: `${anomalies.length} anomalous day(s) in selected window.`,
            }]
          : []),
        ...(refundsCurrent > netProfit * 0.35
          ? [{
              key: "refund_pressure",
              severity: "medium",
              title: "Refund pressure threshold exceeded",
              description: "Refunds are above 35% of net profit.",
            }]
          : []),
        ...(Math.abs(negativeDebtSum) > netProfit
          ? [{
              key: "debt_spike",
              severity: "high",
              title: "Driver debt spike",
              description: "Negative driver balances exceed net profit.",
            }]
          : []),
      ],
      lastUpdatedAt: new Date().toISOString(),
    };

    analyticsCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
    try {
      await logAction({
        actorId: auth.superUserId,
        actorRole: auth.role,
        actionType: "VIEW_FINANCIAL_ANALYTICS",
        targetType: "FINANCIAL_DASHBOARD",
        targetId: isAdmin ? "GLOBAL" : auth.customerServiceId || "CS_SCOPE",
        reason: JSON.stringify({
          ip: safeIp(req),
          userAgent: req.headers.get("user-agent") || "unknown",
        }),
        newValue: JSON.stringify({
          range: effectiveRange,
          governorateCount: effectiveGovernorateIds.length,
          filters: {
            statuses: requestedStatuses,
            paymentTypes,
            driverCohort,
            countryId: effectiveCountryId,
            delegationIds: effectiveDelegationIds,
            csMaxRangeDays: isAdmin ? null : csMaxRangeDays,
          },
        }),
      });
    } catch (error) {
      console.error("Failed to log analytics view action", error);
    }

    return NextResponse.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
