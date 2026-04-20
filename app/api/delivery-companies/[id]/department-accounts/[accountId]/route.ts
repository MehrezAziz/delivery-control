import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { hasCSRole, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertCsCanAccessDepartmentAccount } from "@/lib/cs-department-account-scope";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string; accountId: string }> }) {
  try {
    const auth = await requireAuth();
    if (auth.role === "CUSTOMER_SERVICE" && !hasCSRole(auth, "MANAGE_DELIVERY_COMPANY")) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }
    const { id: companyId, accountId } = await ctx.params;
    if (auth.role === "CUSTOMER_SERVICE") {
      await assertCsCanAccessDepartmentAccount(auth, companyId, accountId);
    }
    const body = await req.json();
    const db: any = prisma;
    const data: any = {};
    if (body.email) data.email = String(body.email).toLowerCase().trim();
    if (body.role) data.role = body.role;
    if (body.status) data.status = body.status;
    if (body.password) data.passwordHash = await bcrypt.hash(String(body.password), 10);
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No changes" }, { status: 400 });
    }
    const updated = await db.deliveryCompanyDepartmentAccount.updateMany({
      where: { id: accountId, deliveryCompanyId: companyId },
      data,
    });
    if (!updated.count) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const row = await db.deliveryCompanyDepartmentAccount.findUnique({ where: { id: accountId } });
    return NextResponse.json(row);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    if (/do not have access/i.test(msg)) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
