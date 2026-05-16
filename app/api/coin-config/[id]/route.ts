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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  const { id } = await params;
  const body = await req.json();

  const old = await prisma.countryCoinConfig.findUnique({ where: { id } });
  if (!old) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: {
    transferFeeBps?: number;
    coinsPerFiatUnit?: number;
    withdrawalFeeBps?: number;
    isActive?: boolean;
    promoLabel?: string | null;
    effectiveFrom?: Date;
    effectiveTo?: Date | null;
  } = {};
  if (body.transferFeeBps !== undefined) data.transferFeeBps = Number(body.transferFeeBps);
  if (body.coinsPerFiatUnit !== undefined) data.coinsPerFiatUnit = Number(body.coinsPerFiatUnit);
  if (body.withdrawalFeeBps !== undefined) {
    const bps = Math.floor(Number(body.withdrawalFeeBps));
    data.withdrawalFeeBps = Math.min(10000, Math.max(0, bps));
  }
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body.promoLabel !== undefined) data.promoLabel = body.promoLabel === "" ? null : String(body.promoLabel);
  if (body.effectiveFrom != null) data.effectiveFrom = new Date(body.effectiveFrom);
  if (body.effectiveTo !== undefined) {
    data.effectiveTo = body.effectiveTo == null ? null : new Date(body.effectiveTo);
  }

  const row = await prisma.countryCoinConfig.update({
    where: { id },
    data,
    include: { country: true },
  });

  try {
    await logAction({
      actorId: auth.superUserId,
      actorRole: "ADMIN",
      actionType: "UPDATE_COUNTRY_COIN_CONFIG",
      targetType: "COUNTRY_COIN_CONFIG",
      targetId: id,
      oldValue: old ? JSON.stringify(old) : null,
      newValue: JSON.stringify(row),
    });
  } catch (logErr) {
    console.error("Failed to log action:", logErr);
  }

  return NextResponse.json(serializeRow(row));
}
