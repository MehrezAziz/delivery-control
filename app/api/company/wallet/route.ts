import { NextResponse } from "next/server";
import { companyBackendFetch } from "@/lib/company-api";
import { requireCompanyAuth } from "@/lib/company-auth";
import { ensureCompanyRoleAllowed, isMainDepartmentActor } from "@/lib/company-security";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const auth = await requireCompanyAuth();
    ensureCompanyRoleAllowed(auth, ["MAIN_ADMIN", "DEPT_ADMIN", "DEPT_OPERATOR", "DEPT_VIEWER"]);
    if (!isMainDepartmentActor(auth)) {
      const db: any = prisma;
      const deptWallet = await db.deliveryCompanyDepartmentBudgetWallet.findUnique({
        where: { departmentId: auth.departmentId || "__none__" },
      });
      return NextResponse.json({
        balance: Number(deptWallet?.availableCoins || 0),
        locked: Number(deptWallet?.lockedCoins || 0),
        maxNegativeBalance: 0,
        availableCapacity: Number(deptWallet?.availableCoins || 0) - Number(deptWallet?.lockedCoins || 0),
        isDepartmentScoped: true,
      });
    }
    const res = await companyBackendFetch("/wallet");
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load wallet";
    if (/unauthorized/i.test(msg)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (/forbidden|permission/i.test(msg)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (/backend unreachable|fetch failed|ECONNREFUSED/i.test(msg)) {
      return NextResponse.json({ error: "Delivery backend is unavailable" }, { status: 503 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
