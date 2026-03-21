import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await requireAuth();
    const { id } = await params;
    const body = await req.json();

    const dispute = await prisma.dispute.findUnique({ where: { id } });
    if (!dispute) return NextResponse.json({ error: "Dispute not found" }, { status: 404 });

    const updateData: any = {};
    if (body.status) updateData.status = body.status;
    if (body.resolution) updateData.resolution = body.resolution;
    if (body.status === "RESOLVED" || body.status === "CLOSED") updateData.resolvedAt = new Date();
    if (body.assignToMe && payload.customerServiceId) updateData.assignedTo = payload.customerServiceId;

    const updated = await prisma.dispute.update({
      where: { id },
      data: updateData,
      include: {
        order: { include: { customer: { include: { user: { select: { firstName: true, secondName: true } } } } } },
        customerService: { include: { superUser: { select: { pseudo: true } } } },
      },
    });

    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 });
  }
}
