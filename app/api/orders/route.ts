import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const orders = await prisma.order.findMany({
      where: status ? { status: status as any } : undefined,
      include: {
        customer: { include: { user: { select: { id: true, firstName: true, secondName: true, phone: true } } } },
        pickupAddress: { include: { delegation: { include: { governorate: { include: { country: true } } } } } },
        dropoffAddress: { include: { delegation: { include: { governorate: { include: { country: true } } } } } },
        driverAssignment: { include: { driver: { include: { user: { select: { id: true, firstName: true, secondName: true, phone: true } } } } } },
        pricingPolicy: true,
        chatRooms: { where: { status: "ACTIVE" }, take: 1 },
        dispute: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const mapped = orders.map((o: any) => ({
      id: o.id, status: o.status, paymentType: o.paymentType,
      price: Number(o.price), distanceKm: Number(o.distanceKm), weight: Number(o.weight),
      isNightDelivery: o.isNightDelivery, createdAt: o.createdAt,
      deliveryZoneType: o.pricingPolicy?.deliveryZoneType || null,
      customer: o.customer ? {
        id: o.customer.id,
        name: `${o.customer.user.firstName || ""} ${o.customer.user.secondName || ""}`.trim(),
        phone: o.customer.user.phone,
      } : null,
      pickupAddress: o.pickupAddress ? `${o.pickupAddress.delegation.nameDelegation}, ${o.pickupAddress.delegation.governorate.nameGovernorate}` : null,
      dropoffAddress: o.dropoffAddress ? `${o.dropoffAddress.delegation.nameDelegation}, ${o.dropoffAddress.delegation.governorate.nameGovernorate}` : null,
      driver: o.driverAssignment?.driver ? {
        id: o.driverAssignment.driver.id,
        name: `${o.driverAssignment.driver.user.firstName || ""} ${o.driverAssignment.driver.user.secondName || ""}`.trim(),
        phone: o.driverAssignment.driver.user.phone,
      } : null,
      hasChat: (o.chatRooms?.length || 0) > 0,
      hasDispute: !!o.dispute,
      disputeStatus: o.dispute?.status || null,
    }));

    return NextResponse.json(mapped);
  } catch (e: any) {
    const msg = e?.message || "Failed to load orders";
    const status = /unauthorized|admin only|customer service only|permission/i.test(msg) ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
