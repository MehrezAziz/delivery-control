import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCS, hasCSRole } from "@/lib/auth";
import { logAction } from "@/lib/action-log";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCS();
  const { id } = await params;

  if (!hasCSRole(auth, "UPDATE_DRIVER_STATUS")) {
    return NextResponse.json({ error: "You don't have UPDATE_DRIVER_STATUS permission" }, { status: 403 });
  }

  const { status, reason } = await req.json();

  const driver = await prisma.driver.findUnique({
    where: { id },
    include: {
      user: true,
      driverVerifications: { orderBy: { submittedAt: "desc" }, take: 1 },
    },
  });
  if (!driver) {
    return NextResponse.json({ error: "Driver not found" }, { status: 404 });
  }

  // Can't set to INCOMPLETE if has documents
  if (status === "INCOMPLETE" && driver.driverVerifications.length > 0) {
    return NextResponse.json({ error: "Cannot set status to INCOMPLETE when driver has submitted documents" }, { status: 400 });
  }

  const oldStatus = driver.status;

  await prisma.driver.update({
    where: { id },
    data: { status, suspendedAt: status === "SUSPENDED" ? new Date() : undefined },
  });

  // Create restriction if suspending/rejecting
  if (["SUSPENDED", "REJECTED"].includes(status) && reason) {
    const restrictionType = status === "SUSPENDED" ? "SUSPENSION" : "WARNING";
    await prisma.userRestriction.create({
      data: {
        userId: driver.user.id,
        type: restrictionType,
        reason,
        imposedBy: auth.superUserId,
      },
    });
  }

  // Lift restrictions if going back to active statuses
  if (["VERIFIED", "PENDING_REVIEW"].includes(status) && ["SUSPENDED", "REJECTED"].includes(oldStatus)) {
    await prisma.userRestriction.updateMany({
      where: { userId: driver.user.id, liftedAt: null },
      data: { liftedAt: new Date() },
    });
  }

  try {
    await logAction({
      actorId: auth.superUserId,
      actorRole: "CUSTOMER_SERVICE",
      actionType: "UPDATE_DRIVER_STATUS",
      targetType: "DRIVER",
      targetId: id,
      oldValue: oldStatus,
      newValue: status,
      reason,
    });
  } catch (logErr) {
    console.error("Failed to log action:", logErr);
  }

  return NextResponse.json({ success: true });
}
