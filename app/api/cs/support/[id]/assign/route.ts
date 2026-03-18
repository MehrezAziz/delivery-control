import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, hasCSRole } from "@/lib/auth";
import { logAction } from "@/lib/action-log";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  const { id } = await params;

  if (!hasCSRole(auth, "MANAGE_SUPPORT_TICKETS")) {
    return NextResponse.json({ error: "You don't have MANAGE_SUPPORT_TICKETS permission" }, { status: 403 });
  }

  // Only CS can assign to themselves (admin doesn't need to)
  if (auth.role !== "CUSTOMER_SERVICE") {
    return NextResponse.json({ error: "Only customer service agents can assign tickets" }, { status: 400 });
  }

  const ticket = await prisma.supportTicket.findUnique({ where: { id } });
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  if (ticket.assignedTo && ticket.assignedTo !== auth.customerServiceId) {
    return NextResponse.json({ error: "Ticket is already assigned to another agent" }, { status: 400 });
  }

  const updated = await prisma.supportTicket.update({
    where: { id },
    data: {
      assignedTo: auth.customerServiceId,
      status: ticket.status === "OPEN" ? "IN_PROGRESS" : ticket.status,
    },
  });

  try {
    await logAction({
      actorId: auth.superUserId,
      actorRole: "CUSTOMER_SERVICE",
      actionType: "ASSIGN_SUPPORT_TICKET",
      targetType: "SUPPORT_TICKET",
      targetId: id,
      newValue: auth.pseudo,
    });
  } catch (e) { console.error("Log error:", e); }

  return NextResponse.json(updated);
}
