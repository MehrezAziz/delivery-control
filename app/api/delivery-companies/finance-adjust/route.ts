import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { hasCSRole, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logCompanyAudit } from "@/lib/company-security";
import { emitDepartmentNotification } from "@/lib/company-notifications";
import { logAction } from "@/lib/action-log";
import { enforceCompanyRateLimit, RateLimitError } from "@/lib/company-rate-limit";

function canAdjustFinance(auth: Awaited<ReturnType<typeof requireAuth>>): boolean {
  if (auth.role === "ADMIN") return true;
  return (
    auth.role === "CUSTOMER_SERVICE" &&
    hasCSRole(auth, "SEE_DELIVERY_COMPANY") &&
    hasCSRole(auth, "MANAGE_COMPANY_FINANCE")
  );
}

/**
 * POST — add (positive amountCoins) or withdraw (negative) from a delivery company's main coin balance.
 * Audits to DeliveryCompanyAuditLog + ActionLog; notifies company inbox.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!canAdjustFinance(auth)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await req.json();
    const deliveryCompanyId = String(body?.deliveryCompanyId || "").trim();
    const rawAmount = Number(body?.amountCoins);
    const reason = String(body?.reason || "").trim() || null;

    if (!deliveryCompanyId) {
      return NextResponse.json({ error: "deliveryCompanyId is required" }, { status: 400 });
    }
    if (!Number.isFinite(rawAmount) || rawAmount === 0) {
      return NextResponse.json({ error: "amountCoins must be a non-zero number" }, { status: 400 });
    }

    const amount = Math.round(rawAmount * 100) / 100;

    const idemKeyHeader = req.headers.get("Idempotency-Key") || req.headers.get("idempotency-key");
    if (!idemKeyHeader) {
      return NextResponse.json({ error: "Idempotency-Key header is required" }, { status: 400 });
    }

    enforceCompanyRateLimit(["finance-adjust", deliveryCompanyId, auth.superUserId], 30, 60_000);

    const endpointKey = "delivery-control/delivery-companies/finance-adjust:POST";
    const requestHash = createHash("sha256")
      .update(JSON.stringify({ deliveryCompanyId, amount, reason }))
      .digest("hex");

    const db: any = prisma;
    const existingIdem = await db.deliveryCompanyIdempotencyKey.findFirst({
      where: { deliveryCompanyId, endpointKey, idempotencyKey: idemKeyHeader },
    });
    if (existingIdem) {
      if (existingIdem.requestHash !== requestHash) {
        return NextResponse.json({ error: "Idempotency key used with a different request body" }, { status: 409 });
      }
      if (existingIdem.responseBody) {
        return NextResponse.json(existingIdem.responseBody);
      }
      return NextResponse.json({ error: "Idempotency request is in progress; please retry" }, { status: 409 });
    }

    const result = await db.$transaction(async (tx: any) => {
      const idemRow = await tx.deliveryCompanyIdempotencyKey.create({
        data: {
          deliveryCompanyId,
          actorRef: auth.superUserId,
          endpointKey,
          idempotencyKey: idemKeyHeader,
          requestHash,
          responseStatus: 0,
          responseBody: null,
        },
      });

      const company = await tx.deliveryCompany.findUnique({
        where: { id: deliveryCompanyId },
        select: { id: true, coinBalance: true, lockedCoins: true, name: true },
      });
      if (!company) {
        const err = new Error("Delivery company not found");
        (err as any).statusCode = 404;
        throw err;
      }

      const curBal = Number(company.coinBalance);
      const locked = Number(company.lockedCoins);
      const available = curBal - locked;

      if (amount < 0 && available + amount < 0) {
        const err = new Error("Insufficient available balance (coins not encumbered by locks)");
        (err as any).statusCode = 400;
        throw err;
      }

      const nextBal = Math.round((curBal + amount) * 100) / 100;

      await tx.deliveryCompany.update({
        where: { id: deliveryCompanyId },
        data: { coinBalance: nextBal },
      });

      await tx.deliveryCompanyTransaction.create({
        data: {
          deliveryCompanyId,
          type: "ADMIN_ADJUSTMENT",
          amount,
          balanceAfter: nextBal,
          description:
            amount >= 0
              ? `Staff credit${reason ? `: ${reason}` : ""}`
              : `Staff debit${reason ? `: ${reason}` : ""}`,
        },
      });

      const safe = {
        ok: true,
        deliveryCompanyId,
        companyName: company.name,
        amountCoins: amount,
        balanceAfter: nextBal,
        actorSuperUserId: auth.superUserId,
        actorRole: auth.role,
        reason,
      };

      await tx.deliveryCompanyIdempotencyKey.update({
        where: { id: idemRow.id },
        data: { responseStatus: 200, responseBody: safe },
      });

      return safe;
    });

    await logCompanyAudit(deliveryCompanyId, "COMPANY_FINANCE_ADJUSTED", auth.role, auth.superUserId, {
      amountCoins: amount,
      reason,
      actorEmail: auth.email,
    });

    try {
      await logAction({
        actorId: auth.superUserId,
        actorRole: auth.role === "ADMIN" ? "ADMIN" : "CUSTOMER_SERVICE",
        actionType: "COMPANY_FINANCE_ADJUST",
        targetType: "DELIVERY_COMPANY",
        targetId: deliveryCompanyId,
        newValue: JSON.stringify({ amountCoins: amount, balanceAfter: result.balanceAfter }),
        reason: reason ?? undefined,
      });
    } catch {
      /* non-blocking */
    }

    try {
      await emitDepartmentNotification(deliveryCompanyId, deliveryCompanyId, "COMPANY_FINANCE_ADJUSTED", {
        companyId: deliveryCompanyId,
        amountCoins: amount,
        reason,
        balanceAfter: result.balanceAfter,
        groupKey: `finance-adjust:${deliveryCompanyId}:${Date.now()}`,
      });
    } catch {
      /* non-blocking */
    }

    return NextResponse.json(result);
  } catch (e: unknown) {
    if (e instanceof RateLimitError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "Failed";
    const code = (e as any)?.statusCode;
    const status =
      msg === "Delivery company not found" ? 404 : code === 400 ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
