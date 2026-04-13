import { NextRequest, NextResponse } from "next/server";
import { requireCustomerServicePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MANAGE_DISPUTES = "MANAGE_DISPUTES";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireCustomerServicePermission(MANAGE_DISPUTES);
    const status = req.nextUrl.searchParams.get("status") || undefined;

    const cs = await prisma.customerService.findUnique({
      where: { superUserId: auth.superUserId },
      select: { governorates: { select: { governorateId: true } } },
    });
    const govIds = cs?.governorates.map((g) => g.governorateId) ?? [];
    if (govIds.length === 0) {
      return NextResponse.json({ conflicts: [] });
    }

    const rows = await prisma.orderDriverArrivalConflict.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
        order: {
          pickupAddress: {
            delegation: { governorateId: { in: govIds } },
          },
        },
      },
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
