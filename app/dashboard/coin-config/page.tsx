import { prisma } from "@/lib/prisma";
import CoinConfigClient from "./coin-config-client";

export const dynamic = "force-dynamic";

export default async function CoinConfigPage() {
  const countries = await prisma.country.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      isoCode: true,
      currencyCode: true,
      currencySymbol: true,
    },
  });

  const configRows = await prisma.countryCoinConfig.findMany({
    include: { country: true },
    orderBy: { effectiveFrom: "desc" },
  });

  const sorted = [...configRows].sort((a, b) => {
    const byName = a.country.name.localeCompare(b.country.name);
    if (byName !== 0) return byName;
    return b.effectiveFrom.getTime() - a.effectiveFrom.getTime();
  });

  const serialized = sorted.map((r) => ({
    id: r.id,
    countryId: r.countryId,
    countryName: r.country.name,
    isoCode: r.country.isoCode,
    currencyCode: r.country.currencyCode,
    transferFeeBps: r.transferFeeBps,
    coinsPerFiatUnit: Number(r.coinsPerFiatUnit),
    withdrawalFeeBps: r.withdrawalFeeBps ?? 0,
    isActive: r.isActive,
    promoLabel: r.promoLabel,
    effectiveFrom: r.effectiveFrom.toISOString(),
    effectiveTo: r.effectiveTo?.toISOString() ?? null,
  }));

  const activeConfigs = serialized.filter((c) => c.isActive).length;
  const countriesWithActive = new Set(
    serialized.filter((c) => c.isActive).map((c) => c.countryId),
  ).size;

  return (
    <CoinConfigClient
      countries={countries}
      configs={serialized}
      stats={{
        countryCount: countries.length,
        totalConfigs: serialized.length,
        activeConfigs,
        countriesWithActive,
      }}
    />
  );
}
