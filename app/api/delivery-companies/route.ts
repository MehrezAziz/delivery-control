import { NextRequest, NextResponse } from "next/server";
import { hasCSRole, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { filterDeliveryCompanyIdsForCsFinance } from "@/lib/company-finance-delegation";

export async function GET() {
  try {
    const db: any = prisma;
    const auth = await requireAuth();
    if (auth.role === "CUSTOMER_SERVICE" && !hasCSRole(auth, "SEE_DELIVERY_COMPANY")) {
      return NextResponse.json({ error: "Insufficient permissions: SEE_DELIVERY_COMPANY required" }, { status: 403 });
    }
    const scoped = await filterDeliveryCompanyIdsForCsFinance(auth);
    const data = await db.deliveryCompany.findMany({
      where: Array.isArray(scoped) ? { id: { in: scoped } } : {},
      include: {
        addresses: true,
        bankAccounts: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load delivery companies";
    const status = /unauthorized|permission/i.test(msg) ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const db: any = prisma;
    const auth = await requireAuth();
    if (auth.role === "CUSTOMER_SERVICE" && !hasCSRole(auth, "MANAGE_DELIVERY_COMPANY")) {
      return NextResponse.json({ error: "Insufficient permissions: MANAGE_DELIVERY_COMPANY required" }, { status: 403 });
    }
    const body = await req.json();
    if (!body?.name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const dataWithNewFields = {
      name: body.name,
      contactEmail: body.contactEmail || null,
      passwordHash: body.password ? await bcrypt.hash(String(body.password), 10) : null,
      legalName: body.legalName || null,
      taxId: body.taxId || null,
      proxyCustomerId: body.proxyCustomerId || null,
      maxNegativeBalance: body.maxNegativeBalance ?? 0,
      defaultDiscountPercent: body.defaultDiscountPercent ?? null,
      coinBalance: body.coinBalance ?? 0,
    };
    const dataLegacy = {
      name: body.name,
      legalName: body.legalName || null,
      taxId: body.taxId || null,
      proxyCustomerId: body.proxyCustomerId || null,
      maxNegativeBalance: body.maxNegativeBalance ?? 0,
      defaultDiscountPercent: body.defaultDiscountPercent ?? null,
      coinBalance: body.coinBalance ?? 0,
    };
    let created: any;
    try {
      created = await db.deliveryCompany.create({ data: dataWithNewFields });
    } catch (inner: unknown) {
      const innerMsg = inner instanceof Error ? inner.message : "";
      const isSchemaDrift =
        innerMsg.includes("Unknown argument `contactEmail`") ||
        innerMsg.includes("Unknown argument `passwordHash`");
      if (!isSchemaDrift) throw inner;
      created = await db.deliveryCompany.create({ data: dataLegacy });
    }
    return NextResponse.json(created, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create delivery company";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
