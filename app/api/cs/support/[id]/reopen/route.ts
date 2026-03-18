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

  const ticket = await prisma.supportTicket.findUnique({ where: { id } });
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const isAdmin = auth.role === "ADMIN";
  const isAssignedCS = auth.role === "CUSTOMER_SERVICE" && ticket.assignedTo === auth.customerServiceId;

  if (!isAdmin && !isAssignedCS) {
    return NextResponse.json({ error: "Only the assigned agent or admin can reopen this ticket" }, { status: 403 });
  }

  const updated = await prisma.supportTicket.update({
    where: { id },
    data: { status: "IN_PROGRESS", resolvedAt: null },
  });

  try {
    await logAction({
      actorId: auth.superUserId,
      actorRole: auth.role,
      actionType: "REOPEN_SUPPORT_TICKET",
      targetType: "SUPPORT_TICKET",
      targetId: id,
      oldValue: "CLOSED",
      newValue: "IN_PROGRESS",
    });
  } catch (e) { console.error("Log error:", e); }

  return NextResponse.json(updated);
}
