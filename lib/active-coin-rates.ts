import type { PrismaClient } from "@prisma/client";

/** Latest active `coinsPerFiatUnit` per country (coins per 1.00 local fiat). */
export async function activeCoinsPerFiatByCountry(
  prisma: PrismaClient,
  countryIds: string[],
): Promise<Map<string, number>> {
  if (countryIds.length === 0) return new Map();
  const now = new Date();
  const rows = await prisma.countryCoinConfig.findMany({
    where: {
      countryId: { in: countryIds },
      isActive: true,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
    },
    orderBy: { effectiveFrom: "desc" },
    select: { countryId: true, coinsPerFiatUnit: true },
  });
  const map = new Map<string, number>();
  for (const row of rows) {
    if (map.has(row.countryId)) continue;
    const rate = Number(row.coinsPerFiatUnit);
    if (Number.isFinite(rate) && rate > 0) map.set(row.countryId, rate);
  }
  return map;
}

/** First active country per currency code (for driver accounts without countryId on wallet). */
export async function activeCoinsPerFiatByCurrencyCode(
  prisma: PrismaClient,
  currencyCodes: string[],
): Promise<Map<string, number>> {
  const codes = [...new Set(currencyCodes.filter(Boolean))];
  if (codes.length === 0) return new Map();
  const countries = await prisma.country.findMany({
    where: { currencyCode: { in: codes }, isActive: true },
    select: { id: true, currencyCode: true },
  });
  const byCountry = await activeCoinsPerFiatByCountry(
    prisma,
    countries.map((c) => c.id),
  );
  const byCode = new Map<string, number>();
  for (const c of countries) {
    const rate = byCountry.get(c.id);
    if (rate != null && !byCode.has(c.currencyCode)) byCode.set(c.currencyCode, rate);
  }
  return byCode;
}
