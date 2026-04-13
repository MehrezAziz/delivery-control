import { NextRequest, NextResponse } from "next/server";
import type { CustomerStatus, DriverStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logAction } from "@/lib/action-log";
import { liftAllOpenRestrictionsForUserIds } from "@/lib/lift-open-restrictions";
import { notifyCustomerSuspended } from "@/lib/notify-customer-suspended";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  const { id } = await params;
  const body = await req.json();
  const { reason } = body;
  const ut = String(body.userType ?? "")
    .trim()
    .toLowerCase();
  const normalized = String(body.status ?? "")
    .trim()
    .toUpperCase();

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      customer: true,
      driver: { include: { driverVerifications: { orderBy: { submittedAt: "desc" as const }, take: 1 } } },
    },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let oldStatus = "";

  if (ut === "customer" && user.customer) {
    oldStatus = user.customer.customerStatus;
    await prisma.customer.update({
      where: { id: user.customer.id },
      data: { customerStatus: normalized as CustomerStatus },
    });

    if (["SUSPENDED", "BLOCKED"].includes(normalized) && reason) {
      const restrictionType = normalized === "BLOCKED" ? "BLOCK" : "SUSPENSION";
      await prisma.userRestriction.create({
        data: {
          userId: id,
          type: restrictionType,
          reason,
          imposedBy: auth.superUserId,
        },
      });
    }

    if (
      ["ACTIVE", "CREATED", "VERIFIED"].includes(normalized) &&
      ["SUSPENDED", "BLOCKED"].includes(oldStatus)
    ) {
      const now = new Date();
      await prisma.$transaction(async (tx) => {
        await liftAllOpenRestrictionsForUserIds(tx, [id], now);
      });
    }

    if (normalized === "SUSPENDED" && oldStatus !== "SUSPENDED") {
      await notifyCustomerSuspended(id);
    }
  } else if (ut === "driver" && user.driver) {
    const driver = user.driver;
    if (normalized === "INCOMPLETE" && driver.driverVerifications.length > 0) {
      return NextResponse.json(
        { error: "Cannot set status to INCOMPLETE when driver has submitted documents" },
        { status: 400 },
      );
    }

    oldStatus = driver.status;

    await prisma.$transaction(async (tx) => {
      await tx.driver.update({
        where: { id: driver.id },
        data: { status: normalized as DriverStatus },
      });

      if (["SUSPENDED", "REJECTED"].includes(normalized) && reason) {
        const restrictionType = normalized === "SUSPENDED" ? "SUSPENSION" : "WARNING";
        await tx.userRestriction.create({
          data: {
            userId: id,
            type: restrictionType,
            reason,
            imposedBy: auth.superUserId,
          },
        });
      }

      if (["VERIFIED", "PENDING_REVIEW", "INCOMPLETE"].includes(normalized)) {
        const now = new Date();
        await liftAllOpenRestrictionsForUserIds(tx, [id, driver.userId], now);
      }
    });
  } else {
    return NextResponse.json({ error: "Invalid user type" }, { status: 400 });
  }

  try {
    await logAction({
      actorId: auth.superUserId,
      actorRole: auth.role,
      actionType: "UPDATE_USER_STATUS",
      targetType: ut.toUpperCase(),
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
