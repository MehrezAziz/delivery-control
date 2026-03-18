import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, hasCSRole } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  const { id } = await params;

  if (!hasCSRole(auth, "MANAGE_SUPPORT_TICKETS")) {
    return NextResponse.json({ error: "You don't have MANAGE_SUPPORT_TICKETS permission" }, { status: 403 });
  }

  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, firstName: true, secondName: true, role: true, phone: true, image: true } },
      customerService: { include: { superUser: { select: { pseudo: true } } } },
      messages: { orderBy: { timestamp: "asc" } },
    },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const isAdmin = auth.role === "ADMIN";
  const isAssignedCS = auth.role === "CUSTOMER_SERVICE" && ticket.assignedTo === auth.customerServiceId;

  // If CS but not assigned → hide messages (can only see ticket info)
  if (!isAdmin && !isAssignedCS && ticket.assignedTo) {
    return NextResponse.json({
      ...ticket,
      messages: [],
      _locked: true,
      _lockedMessage: `This ticket is assigned to ${ticket.customerService?.superUser?.pseudo || "another agent"}`,
    });
  }

  return NextResponse.json({ ...ticket, _locked: false, _viewerRole: auth.role });
}
