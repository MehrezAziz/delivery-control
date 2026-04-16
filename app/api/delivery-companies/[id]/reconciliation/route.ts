import { NextRequest, NextResponse } from "next/server";
import { hasCSRole, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    if (auth.role === "CUSTOMER_SERVICE" && !hasCSRole(auth, "SEE_DELIVERY_COMPANY")) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }
    const { id } = await ctx.params;
    const [orders, tx] = await Promise.all([
      prisma.order.findMany({
        where: { deliveryCompanyId: id, sourceType: "DELIVERY_COMPANY" },
        select: { id: true, status: true, price: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.deliveryCompanyTransaction.findMany({
        where: { deliveryCompanyId: id },
        orderBy: { createdAt: "desc" },
        take: 300,
      }),
    ]);
    const orderTotal = orders.reduce((sum, o) => sum + Number(o.price || 0), 0);
    const txTotal = tx.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    return NextResponse.json({ orderTotal, txTotal, difference: orderTotal + txTotal, orders, transactions: tx });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
