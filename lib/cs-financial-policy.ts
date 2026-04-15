import { prisma } from "@/lib/prisma";

const DEFAULT_MAX_ANALYTICS_DAYS = 7;
const MIN_MAX_ANALYTICS_DAYS = 1;
const MAX_MAX_ANALYTICS_DAYS = 3650;

function keyFor(csId: string) {
  return `cs_financial_max_days:${csId}`;
}

export function clampAnalyticsMaxDays(value: number | null | undefined): number {
  if (!value || Number.isNaN(value)) return DEFAULT_MAX_ANALYTICS_DAYS;
  return Math.max(MIN_MAX_ANALYTICS_DAYS, Math.min(MAX_MAX_ANALYTICS_DAYS, Math.floor(value)));
}

export async function getCsFinancialMaxDays(csId: string): Promise<number> {
  const row = await prisma.systemConfig.findUnique({
    where: { key: keyFor(csId) },
    select: { value: true },
  });
  const parsed = Number(row?.value);
  return clampAnalyticsMaxDays(parsed);
}

export async function setCsFinancialMaxDays(csId: string, days: number, updatedBy: string) {
  const normalized = clampAnalyticsMaxDays(days);
  await prisma.systemConfig.upsert({
    where: { key: keyFor(csId) },
    create: {
      key: keyFor(csId),
      value: String(normalized),
      category: "CUSTOMER_SERVICE",
      description: "Maximum analytics lookback days for this CS user.",
      updatedBy,
    },
    update: {
      value: String(normalized),
      updatedBy,
    },
  });
  return normalized;
}

export const CS_FINANCIAL_POLICY = {
  DEFAULT_MAX_ANALYTICS_DAYS,
  MIN_MAX_ANALYTICS_DAYS,
  MAX_MAX_ANALYTICS_DAYS,
};
