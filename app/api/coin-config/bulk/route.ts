import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAction } from "@/lib/action-log";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  const body = await req.json() as {
    countryIds?: string[];
    transferFeeBps?: number;
    coinsPerFiatUnit?: number;
    isActive?: boolean;
    promoLabel?: string | null;
  };

  const countryIds = [...new Set((body.countryIds ?? []).filter((id) => typeof id === "string" && id.length > 0))];
  if (countryIds.length === 0) {
    return NextResponse.json({ error: "Select at least one country." }, { status: 400 });
  }

  const transferFeeBps = body.transferFeeBps ?? 200;
  const coinsPerFiatUnit = body.coinsPerFiatUnit ?? 1;
  if (!Number.isFinite(transferFeeBps) || transferFeeBps < 0 || transferFeeBps > 10000) {
    return NextResponse.json({ error: "Transfer fee (bps) must be between 0 and 10000." }, { status: 400 });
  }
  if (!Number.isFinite(coinsPerFiatUnit) || coinsPerFiatUnit <= 0) {
    return NextResponse.json({ error: "Coins per fiat unit must be a positive number." }, { status: 400 });
  }

  const isActive = body.isActive ?? true;
  const promoLabel = body.promoLabel?.trim() ? String(body.promoLabel).trim() : null;

  const result = await prisma.countryCoinConfig.createMany({
    data: countryIds.map((countryId) => ({
      countryId,
      transferFeeBps,
      coinsPerFiatUnit,
      isActive,
      promoLabel,
    })),
  });

  try {
    await logAction({
      actorId: auth.superUserId,
      actorRole: "ADMIN",
      actionType: "BULK_CREATE_COUNTRY_COIN_CONFIG",
      targetType: "COUNTRY_COIN_CONFIG",
      targetId: "bulk",
      newValue: JSON.stringify({
        countryIds,
        count: result.count,
        transferFeeBps,
        coinsPerFiatUnit,
        isActive,
      }),
    });
  } catch (logErr) {
    console.error("Failed to log action:", logErr);
  }

  return NextResponse.json({ success: true, created: result.count });
}
