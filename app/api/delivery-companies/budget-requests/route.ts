import { NextResponse } from "next/server";
import { hasCSRole, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCsAssignedGovernorateIds } from "@/lib/cs-department-account-scope";

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth.role === "CUSTOMER_SERVICE" && !hasCSRole(auth, "SEE_DELIVERY_COMPANY")) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }
    const db: any = prisma;
    const where: Record<string, unknown> = {};
    if (auth.role === "CUSTOMER_SERVICE") {
      const govIds = await getCsAssignedGovernorateIds(auth);
      if (govIds !== "all") {
        if (govIds.length === 0) return NextResponse.json([]);
        where.department = {
          delegation: { governorateId: { in: govIds } },
        };
      }
    }

    const rows = await db.deliveryCompanyDepartmentBudgetRequest.findMany({
      where,
      include: {
        deliveryCompany: { select: { id: true, name: true } },
        department: {
          select: {
            id: true,
            label: true,
            isMainDepartment: true,
            delegation: { select: { id: true, nameDelegation: true, governorateId: true } },
          },
        },
        requestedByAccount: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return NextResponse.json(rows);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    const status = /unauthorized/i.test(msg) || /permission/i.test(msg) ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
