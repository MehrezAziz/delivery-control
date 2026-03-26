import { NextRequest, NextResponse } from "next/server";
import { requireAuth, hasCSRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";

// GET driver account detail with transactions
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    const { id } = await params;

    if (auth.role === "CUSTOMER_SERVICE") {
      if (!hasCSRole(auth, "VIEW_FINANCIAL_REPORTS") && !hasCSRole(auth, "MANAGE_FINANCIAL_REPORTS")) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
      }
    }

    const account = await prisma.driverAccount.findUnique({
      where: { id },
      include: {
        driver: {
          include: {
            user: {
              include: {
                addresses: {
                  include: { delegation: { include: { governorate: { include: { country: true } } } } },
                  take: 1,
                },
              },
            },
          },
        },
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    });

    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    // Calculate days remaining if balance is negative
    let negativeBalanceInfo: any = undefined;
    if (Number(account.balance) < 0) {
      const driverAddress = (account.driver.user as any).addresses?.[0];
      if (driverAddress) {
        const pricingPolicy = await prisma.countryPricingPolicy.findFirst({
          where: { countryId: driverAddress.delegation.governorate.country.id, isActive: true },
        });
        if (pricingPolicy) {
          const since = account.negativeBalanceSince || new Date();
          if (!account.negativeBalanceSince) {
            await prisma.driverAccount.update({ where: { id: account.id }, data: { negativeBalanceSince: since } });
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
      id: account.id,
      driverId: account.driver.id,
      balance: Number(account.balance),
      currency: account.currency,
      completedDeliveries: account.completedDeliveries,
      driverName: `${account.driver.user.firstName || ""} ${account.driver.user.secondName || ""}`.trim(),
      phone: account.driver.user.phone,
      driverStatus: account.driver.status,
      negativeBalanceInfo,
      transactions: account.transactions.map(t => ({
        id: t.id,
        type: t.type,
        amount: Number(t.amount),
        referenceId: t.referenceId,
        referenceType: t.referenceType,
        description: t.description,
        balanceAfter: Number(t.balanceAfter),
        createdAt: t.createdAt,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 });
  }
}

// PATCH — record a deposit or adjustment (admin or CS with MANAGE_FINANCIAL_REPORTS)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    const { id } = await params;

    // CS needs MANAGE_FINANCIAL_REPORTS to record transactions
    if (auth.role === "CUSTOMER_SERVICE") {
      if (!hasCSRole(auth, "MANAGE_FINANCIAL_REPORTS")) {
        return NextResponse.json({ error: "Insufficient permissions — requires MANAGE_FINANCIAL_REPORTS" }, { status: 403 });
      }
    }

    const body = await req.json();

    const account = await prisma.driverAccount.findUnique({ where: { id } });
    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    const amount = Number(body.amount);
    if (!amount || isNaN(amount)) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const type = body.type || "DEPOSIT";
    if (!["DEPOSIT", "ADJUSTMENT", "BONUS", "PENALTY"].includes(type)) {
      return NextResponse.json({ error: "Invalid transaction type" }, { status: 400 });
    }

    const newBalance = Number(account.balance) + amount;

    await prisma.$transaction(async (tx) => {
      const updateData: any = { balance: newBalance };
      // If balance goes from negative to positive/zero, clear negative tracking and un-pause
      if (Number(account.balance) < 0 && newBalance >= 0) {
        updateData.negativeBalanceSince = null;
        // Un-pause the driver if they were paused
        const driver = await tx.driver.findUnique({ where: { id: account.driverId } });
        if (driver && driver.status === 'PAUSED') {
          await tx.driver.update({ where: { id: driver.id }, data: { status: 'VERIFIED' } });
        }
      }
      await tx.driverAccount.update({
        where: { id },
        data: updateData,
      });
      await tx.driverTransaction.create({
        data: {
          accountId: id,
          type,
          amount,
          description: body.description || `${type} by ${auth.role === "ADMIN" ? "admin" : "CS"}`,
          balanceAfter: newBalance,
          referenceType: "ADMIN_ADJUSTMENT",
        },
      });
    });

    try {
      await logAction({
        actorId: auth.superUserId,
        actorRole: auth.role,
        actionType: `DRIVER_${type}`,
        targetType: "DRIVER_ACCOUNT",
        targetId: id,
        oldValue: String(Number(account.balance)),
        newValue: String(newBalance),
        reason: body.description,
      });
    } catch {}

    return NextResponse.json({ success: true, newBalance });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 });
  }
}
