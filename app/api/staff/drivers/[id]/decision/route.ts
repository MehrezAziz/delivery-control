import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasCSRole, requireAuth } from "@/lib/auth";
import { logAction } from "@/lib/action-log";
import { liftAllOpenRestrictionsForUserIds } from "@/lib/lift-open-restrictions";
import { NotificationType, NotificationPriority, NotificationChannel, NotificationDeliveryStatus } from "@prisma/client";

async function initializeVerifiedDriver(driverId: string) {
  await prisma.$transaction(async (tx) => {
    const existingMetrics = await tx.driverPerformanceMetrics.findUnique({ where: { driverId } });
    if (!existingMetrics) {
      await tx.driverPerformanceMetrics.create({
        data: { driverId, totalOrders: 0, completedOrders: 0, cancelledOrders: 0 },
      });
    }

    const existingAccount = await tx.driverAccount.findUnique({ where: { driverId } });
    if (!existingAccount) {
      await tx.driverAccount.create({
        data: { driverId, balance: 0, currency: "TND", completedDeliveries: 0 },
      });
    }
  });
}

async function notifyDriverDecision(input: {
  userId: string;
  driverId: string;
  action: "approve" | "reject";
  reason?: string;
}) {
  const type: NotificationType =
    input.action === "approve" ? NotificationType.VERIFICATION_APPROVED : NotificationType.VERIFICATION_REJECTED;
  const title = input.action === "approve" ? "Verification Approved" : "Verification Rejected";
  const body =
    input.action === "approve"
      ? "Your account verification has been approved by staff."
      : `Your account verification was rejected${input.reason ? `: ${input.reason}` : "."}`;

  await prisma.notification.create({
    data: {
      userId: input.userId,
      userType: "USER",
      title,
      body,
      type,
      priority: NotificationPriority.HIGH,
      channels: [NotificationChannel.IN_APP],
      relatedEntityType: "Driver",
      relatedEntityId: input.driverId,
      deliveryStatus: NotificationDeliveryStatus.SENT,
    },
  });

  const webhookUrl = process.env.VERIFICATION_DECISION_WEBHOOK_URL;
  if (!webhookUrl) return;

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: "driver.verification.decision",
      userId: input.userId,
      driverId: input.driverId,
      action: input.action,
      reason: input.reason || null,
      at: new Date().toISOString(),
    }),
  }).catch(() => undefined);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  const { id } = await params;
  const body = await req.json();
  const action = String(body?.action ?? "").toLowerCase();
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "Action must be approve or reject" }, { status: 400 });
  }

  // Admin can always decide. CS needs account verification + status update permissions.
  if (
    auth.role === "CUSTOMER_SERVICE" &&
    (!hasCSRole(auth, "VERIFY_ACCOUNTS") || !hasCSRole(auth, "UPDATE_DRIVER_STATUS"))
  ) {
    return NextResponse.json(
      { error: "You need VERIFY_ACCOUNTS and UPDATE_DRIVER_STATUS permissions" },
      { status: 403 },
    );
  }

  if (action === "reject" && !reason) {
    return NextResponse.json({ error: "Reason is required for rejection" }, { status: 400 });
  }

  const driver = await prisma.driver.findUnique({
    where: { id },
    include: {
      user: true,
      driverVerifications: {
        orderBy: { submittedAt: "desc" },
        take: 1,
      },
    },
  });
  if (!driver) {
    return NextResponse.json({ error: "Driver not found" }, { status: 404 });
  }

  const latestVerification = driver.driverVerifications[0] ?? null;
  const oldStatus = driver.status;
  const newStatus = action === "approve" ? "VERIFIED" : "REJECTED";

  await prisma.$transaction(async (tx) => {
    await tx.driver.update({
      where: { id },
      data: {
        status: newStatus,
        approvedAt: action === "approve" ? new Date() : null,
      },
    });

    if (latestVerification) {
      if (action === "approve") {
        await tx.driverVerification.update({
          where: { id: latestVerification.id },
          data: { verifiedAt: new Date() },
        });
        await tx.document.updateMany({
          where: { verificationId: latestVerification.id },
          data: { verificationStatus: "VERIFIED" },
        });
      } else {
        await tx.document.updateMany({
          where: { verificationId: latestVerification.id },
          data: { verificationStatus: "REJECTED" },
        });
      }
    }

    if (action === "approve") {
      await liftAllOpenRestrictionsForUserIds(tx, [driver.userId], new Date());
    }

    if (action === "reject") {
      await tx.userRestriction.create({
        data: {
          userId: driver.userId,
          type: "WARNING",
          reason,
          imposedBy: auth.superUserId,
        },
      });
    }
  });

  if (action === "approve") {
    await initializeVerifiedDriver(id);
  }

  try {
    await logAction({
      actorId: auth.superUserId,
      actorRole: auth.role,
      actionType: action === "approve" ? "APPROVE_DRIVER" : "REJECT_DRIVER",
      targetType: "DRIVER",
      targetId: id,
      oldValue: oldStatus,
      newValue: newStatus,
      reason: reason || undefined,
    });
  } catch (e) {
    console.error("Failed to log staff decision:", e);
  }

  await notifyDriverDecision({
    userId: driver.user.id,
    driverId: id,
    action: action as "approve" | "reject",
    reason: reason || undefined,
  });

  return NextResponse.json({ success: true, status: newStatus });
}
