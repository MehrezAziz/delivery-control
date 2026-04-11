import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logAction } from "@/lib/action-log";
import { liftAllOpenRestrictionsForUserIds } from "@/lib/lift-open-restrictions";

async function initializeVerifiedDriver(driverId: string) {
  await prisma.$transaction(async (tx) => {
    // 1. Create DriverPerformanceMetrics
    const existingMetrics = await tx.driverPerformanceMetrics.findUnique({ where: { driverId } });
    if (!existingMetrics) {
      await tx.driverPerformanceMetrics.create({
        data: { driverId, totalOrders: 0, completedOrders: 0, cancelledOrders: 0 },
      });
    }

    // 2. Create DriverAccount
    const existingAccount = await tx.driverAccount.findUnique({ where: { driverId } });
    if (!existingAccount) {
      await tx.driverAccount.create({
        data: { driverId, balance: 0, currency: "TND", completedDeliveries: 0 },
      });
    }

    // 3. Create WeeklyAvailability with default schedule
    const existingAvailability = await tx.weeklyAvailability.findUnique({ where: { driverId } });
    if (!existingAvailability) {
      const weeklyAvailability = await tx.weeklyAvailability.create({
        data: { driverId, status: "ACTIVE" },
      });

      const daysOfWeek = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;
      for (const dayOfWeek of daysOfWeek) {
        const dayAvailability = await tx.dayAvailability.create({
          data: { weeklyAvailabilityId: weeklyAvailability.id, dayOfWeek },
        });
        await tx.timePeriod.create({
          data: {
            dayAvailabilityId: dayAvailability.id,
            startTime: new Date("1970-01-01T09:00:00Z"),
            endTime: new Date("1970-01-01T18:00:00Z"),
          },
        });
      }
    }
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  const { id } = await params;
  const { action, reason } = await req.json();

  const driver = await prisma.driver.findUnique({
    where: { id },
    include: {
      driverVerifications: {
        orderBy: { submittedAt: "desc" as const },
        take: 1,
      },
    },
  });
  if (!driver) return NextResponse.json({ error: "Driver not found" }, { status: 404 });

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

    if (action === "approve") {
      const now = new Date();
      await liftAllOpenRestrictionsForUserIds(tx, [driver.userId], now);
      if (latestVerification) {
        await tx.driverVerification.update({
          where: { id: latestVerification.id },
          data: { verifiedAt: new Date() },
        });
        await tx.document.updateMany({
          where: { verificationId: latestVerification.id },
          data: { verificationStatus: "VERIFIED" },
        });
      }
    }

    if (action === "reject") {
      if (reason) {
        await tx.userRestriction.create({
          data: {
            userId: driver.userId,
            type: "WARNING",
            reason,
            imposedBy: auth.superUserId,
          },
        });
      }
      if (latestVerification) {
        await tx.document.updateMany({
          where: { verificationId: latestVerification.id },
          data: { verificationStatus: "REJECTED" },
        });
      }
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
      reason,
    });
  } catch (logErr) {
    console.error("Failed to log action:", logErr);
  }

  return NextResponse.json({ success: true });
}
