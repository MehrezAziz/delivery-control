import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const dispute = await prisma.dispute.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            customer: { include: { user: { select: { firstName: true, secondName: true } }, wallet: true } },
            driverAssignment: { include: { driver: { include: { driverAccount: true } } } },
            pricingPolicy: true,
          },
        },
        customerService: { include: { superUser: { select: { pseudo: true } } } },
      },
    });
    if (!dispute) return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    return NextResponse.json(dispute);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await requireAuth();
    const { id } = await params;
    const body = await req.json();

    const dispute = await prisma.dispute.findUnique({ where: { id } });
    if (!dispute) return NextResponse.json({ error: "Dispute not found" }, { status: 404 });

    // Handle refund request
    if (body.refund === true) {
      return await handleRefund(id, dispute.orderId);
    }

    const updateData: any = {};
    if (body.status) updateData.status = body.status;
    if (body.resolution) updateData.resolution = body.resolution;
    if (body.status === "RESOLVED" || body.status === "CLOSED") updateData.resolvedAt = new Date();
    if (body.assignToMe && payload.customerServiceId) updateData.assignedTo = payload.customerServiceId;

    const updated = await prisma.dispute.update({
      where: { id },
      data: updateData,
      include: {
        order: {
          include: {
            customer: { include: { user: { select: { firstName: true, secondName: true } }, wallet: true } },
            driverAssignment: { include: { driver: { include: { driverAccount: true } } } },
          },
        },
        customerService: { include: { superUser: { select: { pseudo: true } } } },
      },
    });

    // If dispute is resolved/closed without refund, set order status to DELIVERED
    if (body.status === "RESOLVED" || body.status === "CLOSED") {
      await prisma.order.update({
        where: { id: dispute.orderId },
        data: { status: "DELIVERED" },
      });
      // Close the customer-driver chat room
      await prisma.chatRoom.updateMany({
        where: { orderId: dispute.orderId, status: "ACTIVE" },
        data: { status: "CLOSED" },
      });
      // Close related support tickets
      await prisma.supportTicket.updateMany({
        where: { description: { contains: dispute.orderId }, status: { in: ["OPEN", "IN_PROGRESS"] } },
        data: { status: "RESOLVED", resolvedAt: new Date() },
      });
    }

    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 });
  }
}

async function handleRefund(disputeId: string, orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: { include: { wallet: true } },
      driverAssignment: { include: { driver: { include: { driverAccount: true } } } },
    },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (!order.driverAssignment) return NextResponse.json({ error: "No driver assigned" }, { status: 400 });

  const refundAmount = Number(order.price);
  const driverAccount = order.driverAssignment.driver.driverAccount;
  const customerWallet = order.customer.wallet;
  const isWalletPayment = order.paymentType === "WALLET";

  await prisma.$transaction(async (tx) => {
    // 1. Credit customer wallet (refund for WALLET, bonus for COD)
    if (customerWallet) {
      const newBalance = Number(customerWallet.balance) + refundAmount;
      await tx.digitalWallet.update({
        where: { id: customerWallet.id },
        data: { balance: newBalance },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: customerWallet.id,
          orderId,
          type: isWalletPayment ? "REFUND" : "BONUS",
          amount: refundAmount,
          status: "SUCCESS",
          referenceId: orderId,
          referenceType: "ORDER",
          balanceAfter: newBalance,
        },
      });
    }

    // 2. Debit driver account
    if (driverAccount) {
      const newDriverBalance = Number(driverAccount.balance) - refundAmount;
      await tx.driverAccount.update({
        where: { id: driverAccount.id },
        data: { balance: newDriverBalance },
      });
      await tx.driverTransaction.create({
        data: {
          accountId: driverAccount.id,
          type: "DISPUTE_DEBIT",
          amount: -refundAmount,
          referenceId: orderId,
          referenceType: "DISPUTE",
          description: `Dispute refund for order #${orderId.slice(0, 8)}`,
          balanceAfter: newDriverBalance,
        },
      });
    }

    // 3. Update dispute and order status
    await tx.dispute.update({
      where: { id: disputeId },
      data: {
        status: "RESOLVED",
        resolution: isWalletPayment
          ? `Refunded ${refundAmount} coins to customer wallet`
          : `Compensated ${refundAmount} coins to customer wallet (COD order)`,
        resolvedAt: new Date(),
      },
    });
    await tx.order.update({
      where: { id: orderId },
      data: { status: "REFUNDED" },
    });

    // Close chat room on refund
    await tx.chatRoom.updateMany({
      where: { orderId, status: "ACTIVE" },
      data: { status: "CLOSED" },
    });

    // Close related support tickets
    await tx.supportTicket.updateMany({
      where: { description: { contains: orderId }, status: { in: ["OPEN", "IN_PROGRESS"] } },
      data: { status: "CLOSED", resolvedAt: new Date() },
    });
  });

  return NextResponse.json({ message: "Refund processed successfully", amount: refundAmount, type: isWalletPayment ? "REFUND" : "BONUS" });
}
