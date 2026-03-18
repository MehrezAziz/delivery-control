import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCS, hasCSRole } from "@/lib/auth";
import { logAction } from "@/lib/action-log";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCS();
  const { id } = await params;

  if (!hasCSRole(auth, "UPDATE_CUSTOMER_STATUS")) {
    return NextResponse.json({ error: "You don't have UPDATE_CUSTOMER_STATUS permission" }, { status: 403 });
  }

  const { status, reason } = await req.json();

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const oldStatus = customer.customerStatus;

  await prisma.customer.update({
    where: { id },
    data: { customerStatus: status },
  });

  // Create restriction if blocking/suspending
  if (["SUSPENDED", "BLOCKED"].includes(status) && reason) {
    const restrictionType = status === "BLOCKED" ? "BLOCK" : "SUSPENSION";
    await prisma.userRestriction.create({
      data: {
        userId: customer.user.id,
        type: restrictionType,
        reason,
        imposedBy: auth.superUserId,
      },
    });
  }

  // Lift restrictions if going back to active
  if (["ACTIVE", "CREATED", "VERIFIED"].includes(status) && ["SUSPENDED", "BLOCKED"].includes(oldStatus)) {
    await prisma.userRestriction.updateMany({
      where: { userId: customer.user.id, liftedAt: null },
      data: { liftedAt: new Date() },
    });
  }

  try {
    await logAction({
      actorId: auth.superUserId,
      actorRole: "CUSTOMER_SERVICE",
      actionType: "UPDATE_CUSTOMER_STATUS",
      targetType: "CUSTOMER",
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
