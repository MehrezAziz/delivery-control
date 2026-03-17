import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logAction } from "@/lib/action-log";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  const { id } = await params;
  const { action, reason, userId } = await req.json();

  const driver = await prisma.driver.findUnique({ where: { id } });
  if (!driver) return NextResponse.json({ error: "Driver not found" }, { status: 404 });

  const oldStatus = driver.status;
  const newStatus = action === "approve" ? "VERIFIED" : "REJECTED";

  // Update driver status (do NOT save reason in description)
  await prisma.driver.update({
    where: { id },
    data: {
      status: newStatus,
      approvedAt: action === "approve" ? new Date() : null,
    },
  });

  // If rejecting, save reason in UserRestriction
  if (action === "reject" && reason) {
    await prisma.userRestriction.create({
      data: {
        userId,
        type: "WARNING",
        reason,
        imposedBy: auth.superUserId,
      },
    });
  }

  await logAction({
    actorId: auth.superUserId,
    actorRole: auth.role,
    actionType: action === "approve" ? "APPROVE_DRIVER" : "REJECT_DRIVER",
    targetType: "DRIVER",
    targetId: id,
    oldValue: oldStatus,
    newValue: newStatus,
    reason,
  });

  return NextResponse.json({ success: true });
}
