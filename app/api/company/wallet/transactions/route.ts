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
      const reqs = await db.deliveryCompanyDepartmentBudgetRequest.findMany({
        where: { deliveryCompanyId: auth.companyId, departmentId: auth.departmentId || "__none__" },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      const txLike = reqs.map((r: any) => ({
        id: r.id,
        type: `BUDGET_REQUEST_${r.status}`,
        amount: r.amountCoins,
        description: r.decisionNote || `Priority: ${r.priority}`,
        createdAt: r.createdAt,
      }));
      return NextResponse.json(txLike);
    }
    const res = await companyBackendFetch("/wallet/transactions");
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load wallet transactions";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
