import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: { include: { user: { select: { id: true, firstName: true, secondName: true, phone: true, myEmail: true } } } },
        pickupAddress: { include: { delegation: { include: { governorate: { include: { country: true } } } } } },
        dropoffAddress: { include: { delegation: { include: { governorate: { include: { country: true } } } } } },
        driverAssignment: { include: { driver: { include: { user: { select: { id: true, firstName: true, secondName: true, phone: true } } } } } },
        pricingPolicy: true,
        chatRoom: { include: { messages: { orderBy: { timestamp: "asc" } } } },
        dispute: { include: { customerService: { include: { superUser: { select: { pseudo: true } } } } } },
        cashTransaction: true,
        walletTransactions: true,
        referralCommissions: true,
        rating: true,
        driverLocations: { orderBy: { timestamp: "desc" }, take: 1 },
      },
    });

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    return NextResponse.json({
      ...order,
      price: Number(order.price),
      distanceKm: Number(order.distanceKm),
      weight: Number(order.weight),
      nightFee: Number(order.nightFee),
      extraWeightFee: Number(order.extraWeightFee),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 });
  }
}
