import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, hasCSRole } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();

  if (!hasCSRole(auth, "MANAGE_SUPPORT_TICKETS")) {
    return NextResponse.json({ error: "You don't have MANAGE_SUPPORT_TICKETS permission" }, { status: 403 });
  }

  const status = req.nextUrl.searchParams.get("status");

  const tickets = await prisma.supportTicket.findMany({
    where: status ? { status: status as any } : undefined,
    include: {
      user: { select: { id: true, firstName: true, secondName: true, role: true, phone: true } },
      customerService: { include: { superUser: { select: { pseudo: true } } } },
      messages: { orderBy: { timestamp: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(tickets);
}
