import { NextResponse } from "next/server";
import { hasCSRole, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth.role === "CUSTOMER_SERVICE" && !hasCSRole(auth, "SEE_DELIVERY_COMPANY")) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }
    const data = await prisma.deliveryCompanyRefundRequest.findMany({
      include: { deliveryCompany: true },
      orderBy: { createdAt: "desc" },
      take: 300,
    });
    return NextResponse.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
