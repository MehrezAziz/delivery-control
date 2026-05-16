import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAction } from "@/lib/action-log";

function serializeRow<T extends { coinsPerFiatUnit: unknown }>(r: T) {
  return {
    ...r,
    coinsPerFiatUnit: Number((r as { coinsPerFiatUnit: { toString(): string } }).coinsPerFiatUnit),
  };
}

export async function GET() {
  await requireAdmin();
  const rows = await prisma.countryCoinConfig.findMany({
    include: { country: true },
    orderBy: { effectiveFrom: "desc" },
  });
  const sorted = [...rows].sort((a, b) => {
    const byName = a.country.name.localeCompare(b.country.name);
    if (byName !== 0) return byName;
    return b.effectiveFrom.getTime() - a.effectiveFrom.getTime();
  });
  return NextResponse.json(sorted.map(serializeRow));
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  const body = await req.json();

  const row = await prisma.countryCoinConfig.create({
    data: {
      countryId: body.countryId,
      transferFeeBps: body.transferFeeBps ?? 200,
      coinsPerFiatUnit: body.coinsPerFiatUnit ?? 1,
      withdrawalFeeBps: body.withdrawalFeeBps ?? 0,
      isActive: body.isActive ?? true,
      promoLabel: body.promoLabel ?? null,
      effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : new Date(),
      effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null,
    },
    include: { country: true },
  });

  try {
    await logAction({
      actorId: auth.superUserId,
      actorRole: "ADMIN",
      actionType: "CREATE_COUNTRY_COIN_CONFIG",
      targetType: "COUNTRY_COIN_CONFIG",
      targetId: row.id,
      newValue: JSON.stringify(body),
    });
  } catch (logErr) {
    console.error("Failed to log action:", logErr);
  }

  return NextResponse.json(serializeRow(row));
}
