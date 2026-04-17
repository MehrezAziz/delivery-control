import { NextRequest, NextResponse } from "next/server";
import { SupportTicketCategory, SupportTicketPriority } from "@prisma/client";
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

export async function GET() {
  try {
    const auth = await requireCompanyAuth();
    const userId = await resolveCompanyUserId(auth.companyId);
    const rows = await prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { messages: { orderBy: { timestamp: "asc" }, take: 1 } },
      take: 100,
    });
    return NextResponse.json(rows);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load support tickets";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireCompanyAuth();
    const userId = await resolveCompanyUserId(auth.companyId);
    const body = await req.json();
    const description = String(body?.description || "").trim();
    if (description.length < 5) {
      return NextResponse.json({ error: "Description must be at least 5 characters" }, { status: 400 });
    }
    const created = await prisma.$transaction(async (tx) => {
      const ticket = await tx.supportTicket.create({
        data: {
          userId,
          category: SupportTicketCategory.OTHER,
          priority: SupportTicketPriority.MEDIUM,
          description,
        },
      });
      await tx.supportMessage.create({
        data: {
          ticketId: ticket.id,
          senderId: userId,
          senderType: "USER",
          content: description,
        },
      });
      return ticket;
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create support ticket";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
