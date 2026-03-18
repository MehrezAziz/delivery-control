import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, hasCSRole } from "@/lib/auth";
import { logAction } from "@/lib/action-log";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  const { id } = await params;

  if (!hasCSRole(auth, "MANAGE_SUPPORT_TICKETS")) {
    return NextResponse.json({ error: "You don't have MANAGE_SUPPORT_TICKETS permission" }, { status: 403 });
  }

  const ticket = await prisma.supportTicket.findUnique({ where: { id } });
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  if (ticket.status === "CLOSED") return NextResponse.json({ error: "Ticket is closed" }, { status: 400 });

  const isAdmin = auth.role === "ADMIN";
  const isAssignedCS = auth.role === "CUSTOMER_SERVICE" && ticket.assignedTo === auth.customerServiceId;

  // Only admin or assigned CS can send messages
  if (!isAdmin && !isAssignedCS && ticket.assignedTo) {
    return NextResponse.json({ error: "Only the assigned agent or admin can send messages" }, { status: 403 });
  }

  // Auto-assign if CS and not assigned yet
  if (auth.role === "CUSTOMER_SERVICE" && !ticket.assignedTo) {
    await prisma.supportTicket.update({
      where: { id },
      data: { assignedTo: auth.customerServiceId, status: "IN_PROGRESS" },
    });
  }

  const { content, image } = await req.json();

  const senderType = isAdmin ? "ADMIN" : "CUSTOMER_SERVICE";

  const message = await prisma.supportMessage.create({
    data: {
      ticketId: id,
      senderId: auth.superUserId,
      senderType,
      content,
      image,
    },
  });

  try {
    await logAction({
      actorId: auth.superUserId,
      actorRole: auth.role,
      actionType: "SEND_SUPPORT_MESSAGE",
      targetType: "SUPPORT_TICKET",
      targetId: id,
      newValue: content.length > 100 ? content.slice(0, 100) + "..." : content,
    });
  } catch (e) { console.error("Log error:", e); }

  return NextResponse.json(message);
}
