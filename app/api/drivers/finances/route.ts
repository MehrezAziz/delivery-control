import { NextRequest, NextResponse } from "next/server";
import { requireAuth, hasCSRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();

    // Admin always has access; CS needs VIEW_FINANCIAL_REPORTS or MANAGE_FINANCIAL_REPORTS
    if (auth.role === "CUSTOMER_SERVICE") {
      if (!hasCSRole(auth, "VIEW_FINANCIAL_REPORTS") && !hasCSRole(auth, "MANAGE_FINANCIAL_REPORTS")) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
      }
    }

    const drivers = await prisma.driverAccount.findMany({
      include: {
        driver: {
          include: {
            user: { select: { id: true, firstName: true, secondName: true, phone: true, image: true } },
          },
        },
      },
      orderBy: { balance: "asc" },
    });

    const result = drivers.map(da => ({
      id: da.id,
      driverId: da.driver.id,
      balance: Number(da.balance),
      currency: da.currency,
      completedDeliveries: da.completedDeliveries,
      driverName: `${da.driver.user.firstName || ""} ${da.driver.user.secondName || ""}`.trim() || "Unknown",
      phone: da.driver.user.phone,
      driverStatus: da.driver.status,
      createdAt: da.createdAt,
    }));

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 });
  }
}
