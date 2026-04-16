import { NextRequest, NextResponse } from "next/server";
import { hasCSRole, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    if (auth.role === "CUSTOMER_SERVICE" && !hasCSRole(auth, "MANAGE_DELIVERY_COMPANY")) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }
    const { id } = await ctx.params;
    const body = await req.json();
    const nextStatus = body.status as "APPROVED" | "REJECTED" | "PAID" | "FAILED";
    const updated = await prisma.deliveryCompanyRefundRequest.update({
      where: { id },
      data: {
        status: nextStatus,
        approvedBy: auth.superUserId,
        processedAt: new Date(),
      },
    });
    return NextResponse.json(updated);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
