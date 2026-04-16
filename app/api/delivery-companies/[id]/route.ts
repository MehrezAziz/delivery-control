import { NextRequest, NextResponse } from "next/server";
import { hasCSRole, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const db: any = prisma;
    const auth = await requireAuth();
    if (auth.role === "CUSTOMER_SERVICE" && !hasCSRole(auth, "MANAGE_DELIVERY_COMPANY")) {
      return NextResponse.json({ error: "Insufficient permissions: MANAGE_DELIVERY_COMPANY required" }, { status: 403 });
    }
    const { id } = await ctx.params;
    const body = await req.json();
    const nextPasswordHash = body.password
      ? await bcrypt.hash(String(body.password), 10)
      : undefined;
    const dataWithNewFields = {
      name: body.name,
      contactEmail: body.contactEmail,
      ...(nextPasswordHash !== undefined ? { passwordHash: nextPasswordHash } : {}),
      legalName: body.legalName,
      taxId: body.taxId,
      status: body.status,
      maxNegativeBalance: body.maxNegativeBalance,
      defaultDiscountPercent: body.defaultDiscountPercent,
      proxyCustomerId: body.proxyCustomerId,
    };
    const dataLegacy = {
      name: body.name,
      legalName: body.legalName,
      taxId: body.taxId,
      status: body.status,
      maxNegativeBalance: body.maxNegativeBalance,
      defaultDiscountPercent: body.defaultDiscountPercent,
      proxyCustomerId: body.proxyCustomerId,
    };
    let updated: any;
    try {
      updated = await db.deliveryCompany.update({ where: { id }, data: dataWithNewFields });
    } catch (inner: unknown) {
      const innerMsg = inner instanceof Error ? inner.message : "";
      const isSchemaDrift =
        innerMsg.includes("Unknown argument `contactEmail`") ||
        innerMsg.includes("Unknown argument `passwordHash`");
      if (!isSchemaDrift) throw inner;
      updated = await db.deliveryCompany.update({ where: { id }, data: dataLegacy });
    }
    return NextResponse.json(updated);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to update delivery company";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
