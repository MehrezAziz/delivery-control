import { prisma } from "@/lib/prisma";
import PricingClient from "./pricing-client";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const countries = await prisma.country.findMany({
    include: { pricingPolicies: { orderBy: { deliveryZoneType: "asc" } } },
    orderBy: { name: "asc" },
  });

  const serialized = countries.map(c => ({
    id: c.id,
    name: c.name,
    isoCode: c.isoCode,
    currencyCode: c.currencyCode,
    currencySymbol: c.currencySymbol,
    policies: c.pricingPolicies.map(p => ({
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

  return <PricingClient countries={serialized} />;
}
