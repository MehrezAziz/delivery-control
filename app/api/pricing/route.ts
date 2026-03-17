import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAction } from "@/lib/action-log";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  const body = await req.json();

  const policy = await prisma.countryPricingPolicy.create({
    data: {
      countryId: body.countryId,
      deliveryZoneType: body.deliveryZoneType,
      pricePerKm: body.pricePerKm,
      baseFee: body.baseFee,
      baseWeight: body.baseWeight,
      extraWeightStep: body.extraWeightStep,
      extraWeightPrice: body.extraWeightPrice,
      nightFee: body.nightFee,
      platformFee: body.platformFee,
      maxNegativeDays: body.maxNegativeDays,
      isActive: body.isActive ?? true,
    },
  });

  await logAction({
    actorId: auth.superUserId,
    actorRole: "ADMIN",
    actionType: "CREATE_PRICING_POLICY",
    targetType: "COUNTRY_PRICING_POLICY",
    targetId: policy.id,
    newValue: JSON.stringify(body),
  });

  return NextResponse.json(policy);
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin();
  const body = await req.json();
  const { id, countryId: _countryId, deliveryZoneType, isActive, ...data } = body;

  const old = await prisma.countryPricingPolicy.findUnique({ where: { id } });

  const policy = await prisma.countryPricingPolicy.update({
    where: { id },
    data: { ...data, deliveryZoneType, isActive },
  });

  await logAction({
    actorId: auth.superUserId,
    actorRole: "ADMIN",
    actionType: "UPDATE_PRICING_POLICY",
    targetType: "COUNTRY_PRICING_POLICY",
    targetId: id,
    oldValue: old ? JSON.stringify(old) : null,
    newValue: JSON.stringify(policy),
  });

  return NextResponse.json(policy);
}
