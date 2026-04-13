import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const status = req.nextUrl.searchParams.get("status") || undefined;
    const rows = await prisma.orderDriverArrivalConflict.findMany({
      where: status ? { status: status as any } : undefined,
      include: {
        order: {
          include: {
            pickupAddress: { include: { delegation: { include: { governorate: true } } } },
          },
        },
        customer: { include: { user: { select: { firstName: true, secondName: true, phone: true } } } },
        driver: { include: { user: { select: { firstName: true, secondName: true, phone: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ conflicts: rows });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 });
  }
}
