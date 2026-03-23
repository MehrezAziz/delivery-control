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
            user: { select: { id: true, firstName: true, secondName: true, phone: true } },
          },
        },
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    });

    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    return NextResponse.json({
      id: account.id,
      driverId: account.driver.id,
      balance: Number(account.balance),
      currency: account.currency,
      completedDeliveries: account.completedDeliveries,
      driverName: `${account.driver.user.firstName || ""} ${account.driver.user.secondName || ""}`.trim(),
      phone: account.driver.user.phone,
      driverStatus: account.driver.status,
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
      await tx.driverAccount.update({
        where: { id },
        data: { balance: newBalance },
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
