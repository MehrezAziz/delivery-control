import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logAction } from "@/lib/action-log";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  const { id } = await params;
  const { status, userType, reason } = await req.json();

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      customer: true,
      driver: { include: { driverVerification: true } },
    },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let oldStatus = "";

  if (userType === "customer" && user.customer) {
    oldStatus = user.customer.customerStatus;
    await prisma.customer.update({ where: { id: user.customer.id }, data: { customerStatus: status } });
  } else if (userType === "driver" && user.driver) {
    // Check: can't set to INCOMPLETE if driver has documents
    if (status === "INCOMPLETE" && user.driver.driverVerification) {
      return NextResponse.json({ error: "Cannot set status to INCOMPLETE when driver has submitted documents" }, { status: 400 });
    }
    oldStatus = user.driver.status;
    await prisma.driver.update({ where: { id: user.driver.id }, data: { status } });
  } else {
    return NextResponse.json({ error: "Invalid user type" }, { status: 400 });
  }

  // Create restriction if blocking/suspending/rejecting (save reason in UserRestriction, not Driver.description)
  if (["SUSPENDED", "BLOCKED", "REJECTED"].includes(status) && reason) {
    const restrictionType = status === "BLOCKED" ? "BLOCK" : status === "SUSPENDED" ? "SUSPENSION" : "WARNING";
    await prisma.userRestriction.create({
      data: {
        userId: id,
        type: restrictionType,
        reason,
        imposedBy: auth.superUserId,
      },
    });
  }

  // If lifting restriction (going from SUSPENDED/BLOCKED to ACTIVE/CREATED), mark old restrictions as lifted
  if (["ACTIVE", "CREATED", "VERIFIED"].includes(status) && ["SUSPENDED", "BLOCKED"].includes(oldStatus)) {
    await prisma.userRestriction.updateMany({
      where: { userId: id, liftedAt: null },
      data: { liftedAt: new Date() },
    });
  }

  await logAction({
    actorId: auth.superUserId,
    actorRole: auth.role,
    actionType: "UPDATE_USER_STATUS",
    targetType: userType.toUpperCase(),
    targetId: id,
    oldValue: oldStatus,
    newValue: status,
    reason,
  });

  return NextResponse.json({ success: true });
}
