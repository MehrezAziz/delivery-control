import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAction } from "@/lib/action-log";

const ZONE_TYPES = ["SAME_DELEGATION", "SAME_GOVERNORATE", "DIFFERENT_GOVERNORATE", "DIFFERENT_COUNTRY"] as const;

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  const { countryIds, zones } = await req.json() as {
    countryIds: string[];
    zones: Record<string, {
      pricePerKm: number; baseFee: number; baseWeight: number;
      extraWeightStep: number; extraWeightPrice: number;
      nightFee: number; platformFee: number; maxNegativeDays: number;
    }>;
  };

  let created = 0;
  let updated = 0;

  for (const countryId of countryIds) {
    for (const zone of ZONE_TYPES) {
      const values = zones[zone];
      if (!values) continue;

      const existing = await prisma.countryPricingPolicy.findFirst({
        where: { countryId, deliveryZoneType: zone },
      });

      if (existing) {
        await prisma.countryPricingPolicy.update({
          where: { id: existing.id },
          data: {
            pricePerKm: values.pricePerKm,
            baseFee: values.baseFee,
            baseWeight: values.baseWeight,
            extraWeightStep: values.extraWeightStep,
            extraWeightPrice: values.extraWeightPrice,
            nightFee: values.nightFee,
            platformFee: values.platformFee,
            maxNegativeDays: values.maxNegativeDays,
          },
        });
        updated++;
      } else {
        await prisma.countryPricingPolicy.create({
          data: {
            countryId,
            deliveryZoneType: zone,
            pricePerKm: values.pricePerKm,
            baseFee: values.baseFee,
            baseWeight: values.baseWeight,
            extraWeightStep: values.extraWeightStep,
            extraWeightPrice: values.extraWeightPrice,
            nightFee: values.nightFee,
            platformFee: values.platformFee,
            maxNegativeDays: values.maxNegativeDays,
          },
        });
        created++;
      }
    }
  }

  await logAction({
    actorId: auth.superUserId,
    actorRole: "ADMIN",
    actionType: "BULK_UPDATE_PRICING",
    targetType: "COUNTRY_PRICING_POLICY",
    targetId: "bulk",
    newValue: JSON.stringify({
      countryIds,
      created,
      updated,
    }),
  });

  return NextResponse.json({ success: true, created, updated });
}
