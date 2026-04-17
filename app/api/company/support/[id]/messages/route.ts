import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/company-auth";

async function resolveCompanyUserId(companyId: string): Promise<string> {
  const company = await prisma.deliveryCompany.findUnique({
    where: { id: companyId },
    include: { proxyCustomer: { select: { userId: true } } },
  });
  const userId = company?.proxyCustomer?.userId;
  if (!userId) throw new Error("Company proxy user is not configured");
  return userId;
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireCompanyAuth();
    const userId = await resolveCompanyUserId(auth.companyId);
    const { id } = await context.params;
    const ticket = await prisma.supportTicket.findFirst({
      where: { id, userId },
      include: {
        messages: {
          orderBy: { timestamp: "asc" },
        },
      },
    });
    if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    return NextResponse.json(ticket.messages);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load messages";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireCompanyAuth();
    const userId = await resolveCompanyUserId(auth.companyId);
    const { id } = await context.params;
    const body = await req.json();
    const content = String(body?.content || "").trim();
    if (!content) return NextResponse.json({ error: "content is required" }, { status: 400 });
    const ticket = await prisma.supportTicket.findFirst({
      where: { id, userId },
      select: { id: true, status: true },
    });
    if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    if (ticket.status === "CLOSED") return NextResponse.json({ error: "Ticket is closed" }, { status: 400 });
    const message = await prisma.supportMessage.create({
      data: {
        ticketId: id,
        senderId: userId,
        senderType: "USER",
        content,
      },
    });
    return NextResponse.json(message, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to send message";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
