import { NextRequest, NextResponse } from "next/server";
import { hasCSRole, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    if (auth.role === "CUSTOMER_SERVICE" && !hasCSRole(auth, "MANAGE_DELIVERY_COMPANY")) {
      return NextResponse.json({ error: "Insufficient permissions: MANAGE_DELIVERY_COMPANY required" }, { status: 403 });
    }
    const { id } = await ctx.params;
    const body = await req.json();
    const updated = await prisma.deliveryCompany.update({
      where: { id },
      data: {
        name: body.name,
        legalName: body.legalName,
        taxId: body.taxId,
        status: body.status,
        maxNegativeBalance: body.maxNegativeBalance,
        defaultDiscountPercent: body.defaultDiscountPercent,
        proxyCustomerId: body.proxyCustomerId,
      },
    });
    return NextResponse.json(updated);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to update delivery company";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
