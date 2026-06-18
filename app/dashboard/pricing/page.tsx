import { prisma } from "@/lib/prisma";
import PricingClient from "./pricing-client";

export const dynamic = "force-dynamic";

const ZONE_TYPES = [
  "SAME_DELEGATION",
  "SAME_GOVERNORATE",
  "DIFFERENT_GOVERNORATE",
  "DIFFERENT_COUNTRY",
] as const;

export default async function PricingPage() {
  const countries = await prisma.country.findMany({
    include: { pricingPolicies: { orderBy: { deliveryZoneType: "asc" } } },
    orderBy: { name: "asc" },
  });

  const serialized = countries.map((c) => ({
    id: c.id,
    name: c.name,
    isoCode: c.isoCode,
    currencyCode: c.currencyCode,
    currencySymbol: c.currencySymbol,
    policies: c.pricingPolicies.map((p) => ({
      id: p.id,
      deliveryZoneType: p.deliveryZoneType,
      pricePerKm: Number(p.pricePerKm),
      baseFee: Number(p.baseFee),
      baseWeight: Number(p.baseWeight),
      extraWeightStep: Number(p.extraWeightStep),
      extraWeightPrice: Number(p.extraWeightPrice),
      nightFee: Number(p.nightFee),
      platformFee: Number(p.platformFee),
      maxNegativeDays: p.maxNegativeDays,
      isActive: p.isActive,
    })),
  }));

  const totalPolicies = countries.reduce((s, c) => s + c.pricingPolicies.length, 0);
  const activePolicies = countries.reduce(
    (s, c) => s + c.pricingPolicies.filter((p) => p.isActive).length,
    0,
  );
  const fullyConfigured = countries.filter((c) => {
    const zones = new Set(c.pricingPolicies.map((p) => p.deliveryZoneType));
    return ZONE_TYPES.every((z) => zones.has(z));
  }).length;

  return (
    <PricingClient
      countries={serialized}
      stats={{
        countryCount: countries.length,
        totalPolicies,
        activePolicies,
        fullyConfigured,
      }}
    />
  );
}
