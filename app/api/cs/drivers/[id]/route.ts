import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCS, hasCSRole } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCS();
  const { id } = await params;

  if (!hasCSRole(auth, "READ_DRIVER_PROFILE")) {
    return NextResponse.json({ error: "You don't have READ_DRIVER_PROFILE permission" }, { status: 403 });
  }

  const driver = await prisma.driver.findUnique({
    where: { id },
    include: {
      user: {
        include: {
          addresses: {
            include: {
              delegation: {
                include: { governorate: { include: { country: true } } },
              },
            },
          },
          userRestrictions: { orderBy: { createdAt: "desc" } },
        },
      },
      driverVerifications: {
        orderBy: { submittedAt: "desc" },
        take: 1,
        include: { documents: true },
      },
      driverAccount: true,
      performanceMetrics: true,
    },
  });

  if (!driver) {
    return NextResponse.json({ error: "Driver not found" }, { status: 404 });
  }

  // Calculate days remaining to pay if balance is negative
  let negativeBalanceInfo: { negativeBalanceSince: Date | null; daysRemainingToPay: number; maxNegativeDays: number } | null = null;
  if (driver.driverAccount && Number(driver.driverAccount.balance) < 0) {
    const driverAddress = driver.user.addresses[0];
    if (driverAddress) {
      const pricingPolicy = await prisma.countryPricingPolicy.findFirst({
        where: { countryId: driverAddress.delegation.governorate.country.id, isActive: true },
      });
      if (pricingPolicy) {
        const since = driver.driverAccount.negativeBalanceSince || new Date();
        if (!driver.driverAccount.negativeBalanceSince) {
          await prisma.driverAccount.update({
            where: { id: driver.driverAccount.id },
            data: { negativeBalanceSince: since },
          });
        }
        const daysSinceNegative = Math.floor((Date.now() - new Date(since).getTime()) / (1000 * 60 * 60 * 24));
        negativeBalanceInfo = {
          negativeBalanceSince: since,
          daysRemainingToPay: Math.max(0, pricingPolicy.maxNegativeDays - daysSinceNegative),
          maxNegativeDays: pricingPolicy.maxNegativeDays,
        };
      }
    }
  }

  return NextResponse.json({
    id: driver.id,
    userId: driver.user.id,
    firstName: driver.user.firstName,
    secondName: driver.user.secondName,
    phone: driver.user.phone,
    email: driver.user.googleEmail || driver.user.myEmail,
    gender: driver.user.userGender,
    vehicleType: driver.vehicleType,
    status: driver.status,
    approvedAt: driver.approvedAt,
    description: driver.description,
    createdAt: driver.user.createdAt,
    hasDocuments: driver.driverVerifications.length > 0,
    addresses: driver.user.addresses.map(a => ({
      id: a.id,
      street: a.street,
      delegation: a.delegation.nameDelegation,
      governorate: a.delegation.governorate.nameGovernorate,
      country: a.delegation.governorate.country.name,
      latitude: a.latitude,
      longitude: a.longitude,
    })),
    restrictions: driver.user.userRestrictions.map(r => ({
      id: r.id,
      type: r.type,
      reason: r.reason,
      startDate: r.startDate,
      endDate: r.endDate,
      liftedAt: r.liftedAt,
    })),
    account: driver.driverAccount ? {
      balance: driver.driverAccount.balance,
      completedDeliveries: driver.driverAccount.completedDeliveries,
      ...(negativeBalanceInfo ? {
        negativeBalanceSince: negativeBalanceInfo.negativeBalanceSince,
        daysRemainingToPay: negativeBalanceInfo.daysRemainingToPay,
        maxNegativeDays: negativeBalanceInfo.maxNegativeDays,
      } : {}),
    } : null,
    performance: driver.performanceMetrics ? {
      totalOrders: driver.performanceMetrics.totalOrders,
      completedOrders: driver.performanceMetrics.completedOrders,
      cancelledOrders: driver.performanceMetrics.cancelledOrders,
      avgRating: driver.performanceMetrics.avgRating,
      completionRate: driver.performanceMetrics.completionRate,
    } : null,
  });
}
