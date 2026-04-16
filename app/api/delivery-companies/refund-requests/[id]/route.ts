import { NextRequest, NextResponse } from "next/server";
import { hasCSRole, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";
import { enforceCompanyRateLimit, RateLimitError } from "@/lib/company-rate-limit";
import { emitDepartmentNotification } from "@/lib/company-notifications";
import { logCompanyAudit } from "@/lib/company-security";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    if (auth.role === "CUSTOMER_SERVICE" && !hasCSRole(auth, "MANAGE_DELIVERY_COMPANY")) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }
    const { id } = await ctx.params;
    const body = await req.json();
    const nextStatus = body.status as "APPROVED" | "REJECTED" | "PAID" | "FAILED";

    const idemKeyHeader = req.headers.get("Idempotency-Key") || req.headers.get("idempotency-key");
    if (!idemKeyHeader) {
      return NextResponse.json({ error: "Idempotency-Key header is required" }, { status: 400 });
    }

    const existingRequest = await prisma.deliveryCompanyRefundRequest.findUnique({
      where: { id },
      select: { deliveryCompanyId: true },
    });
    if (!existingRequest) return NextResponse.json({ error: "Refund request not found" }, { status: 404 });

    const mainDept = await prisma.deliveryCompanyAddress.findFirst({
      where: { deliveryCompanyId: existingRequest.deliveryCompanyId, isMainDepartment: true },
      select: { id: true },
    });

    enforceCompanyRateLimit(
      ["delivery-companies-refund-decision", existingRequest.deliveryCompanyId, auth.superUserId, id],
      20,
      60_000,
    );

    const endpointKey = "delivery-control/admin/delivery-companies/refund-requests:PATCH";
    const requestHash = createHash("sha256")
      .update(JSON.stringify({ id, nextStatus }) + "|" + String(existingRequest.deliveryCompanyId))
      .digest("hex");

    const existingIdem = await prisma.deliveryCompanyIdempotencyKey.findFirst({
      where: { deliveryCompanyId: existingRequest.deliveryCompanyId, endpointKey, idempotencyKey: idemKeyHeader },
    });
    if (existingIdem) {
      if (existingIdem.requestHash !== requestHash) {
        return NextResponse.json({ error: "Idempotency key used with a different request body" }, { status: 409 });
      }
      if (existingIdem.responseBody) return NextResponse.json(existingIdem.responseBody);
      return NextResponse.json({ error: "Idempotency request is in progress; please retry" }, { status: 409 });
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const idemRow = await tx.deliveryCompanyIdempotencyKey.create({
        data: {
          deliveryCompanyId: existingRequest.deliveryCompanyId,
          actorRef: auth.superUserId,
          endpointKey,
          idempotencyKey: idemKeyHeader,
          requestHash,
          responseStatus: 0,
          responseBody: null,
        },
      });

      const updatedTx = await tx.deliveryCompanyRefundRequest.update({
        where: { id },
        data: {
          status: nextStatus,
          approvedBy: auth.superUserId,
          processedAt: new Date(),
        },
      });

      const safeUpdated = {
        ...updatedTx,
        amountCoins: String((updatedTx as any).amountCoins ?? ""),
        createdAt: updatedTx.createdAt?.toISOString?.() ?? null,
        processedAt: updatedTx.processedAt?.toISOString?.() ?? null,
      };

      await tx.deliveryCompanyIdempotencyKey.update({
        where: { id: idemRow.id },
        data: { responseStatus: 200, responseBody: safeUpdated },
      });

      return safeUpdated;
    });

    const decision = nextStatus === "PAID" ? "APPROVE" : "REJECT";
    await logCompanyAudit(
      existingRequest.deliveryCompanyId,
      "REFUND_REQUEST_DECIDED",
      "COMPANY",
      auth.superUserId,
      { requestId: id, decision, refundStatus: nextStatus },
    );
    if (mainDept?.id) {
      try {
        await emitDepartmentNotification(existingRequest.deliveryCompanyId, mainDept.id, "REFUND_REQUEST_DECIDED", {
          requestId: id,
          decision,
          status: nextStatus,
        });
      } catch {
        // non-blocking notification dispatch
      }
    }

    return NextResponse.json(result);
  } catch (e: unknown) {
    if (e instanceof RateLimitError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
