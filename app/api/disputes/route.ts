import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const disputes = await prisma.dispute.findMany({
      where: status ? { status: status as any } : undefined,
      include: {
        order: {
          include: {
            customer: { include: { user: { select: { firstName: true, secondName: true, phone: true } } } },
            driverAssignment: { include: { driver: { include: { user: { select: { firstName: true, secondName: true } } } } } },
          },
        },
        customerService: { include: { superUser: { select: { pseudo: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(disputes);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 });
  }
}
