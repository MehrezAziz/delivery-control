import { NextRequest, NextResponse } from "next/server";
import type { DriverStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCS, hasCSRole } from "@/lib/auth";
import { logAction } from "@/lib/action-log";
import { liftAllOpenRestrictionsForUserIds } from "@/lib/lift-open-restrictions";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCS();
  const { id } = await params;

  if (!hasCSRole(auth, "UPDATE_DRIVER_STATUS")) {
    return NextResponse.json({ error: "You don't have UPDATE_DRIVER_STATUS permission" }, { status: 403 });
  }

  const { status, reason } = await req.json();
  const normalized = String(status ?? "")
    .trim()
    .toUpperCase();

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

  if (normalized === "INCOMPLETE" && driver.driverVerifications.length > 0) {
    return NextResponse.json({ error: "Cannot set status to INCOMPLETE when driver has submitted documents" }, { status: 400 });
  }

  const oldStatus = driver.status;

  await prisma.$transaction(async (tx) => {
    await tx.driver.update({
      where: { id },
      data: {
        status: normalized as DriverStatus,
        suspendedAt: normalized === "SUSPENDED" ? new Date() : undefined,
      },
    });

    if (["SUSPENDED", "REJECTED"].includes(normalized) && reason) {
      const restrictionType = normalized === "SUSPENDED" ? "SUSPENSION" : "WARNING";
      await tx.userRestriction.create({
        data: {
          userId: driver.userId,
          type: restrictionType,
          reason,
          imposedBy: auth.superUserId,
        },
      });
    }

    if (["VERIFIED", "PENDING_REVIEW", "INCOMPLETE"].includes(normalized)) {
      const now = new Date();
      await liftAllOpenRestrictionsForUserIds(tx, [driver.userId, driver.user.id], now);
    }
  });

  try {
    await logAction({
      actorId: auth.superUserId,
      actorRole: "CUSTOMER_SERVICE",
      actionType: "UPDATE_DRIVER_STATUS",
      targetType: "DRIVER",
      targetId: id,
      oldValue: oldStatus,
      newValue: normalized,
      reason,
    });
  } catch (logErr) {
    console.error("Failed to log action:", logErr);
  }

  return NextResponse.json({ success: true });
}
