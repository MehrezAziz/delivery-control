import { NextRequest, NextResponse } from "next/server";
import { hasCSRole, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const parsedStatus =
      status && (Object.values(OrderStatus) as string[]).includes(status)
        ? (status as OrderStatus)
        : null;

    let scopeWhere: Record<string, unknown> = {};
    if (auth.role === "CUSTOMER_SERVICE") {
      if (!hasCSRole(auth, "VIEW_DELIVERIES")) {
        return NextResponse.json({ error: "Insufficient permissions: VIEW_DELIVERIES required" }, { status: 403 });
      }
      const cs = await prisma.customerService.findUnique({
        where: { id: auth.customerServiceId },
        select: { governorates: { select: { governorateId: true } } },
      });
      const governorateIds = (cs?.governorates || []).map((g) => g.governorateId);
      if (governorateIds.length === 0) {
        return NextResponse.json([]);
      }
      scopeWhere = {
        OR: [
          { pickupAddress: { delegation: { governorateId: { in: governorateIds } } } },
          { dropoffAddress: { delegation: { governorateId: { in: governorateIds } } } },
        ],
      };
    }

    const orders = await prisma.order.findMany({
      where: {
        ...(parsedStatus ? { status: parsedStatus } : {}),
        ...scopeWhere,
      },
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

    const mapped = orders.map((o) => ({
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
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load orders";
    const status = /unauthorized|admin only|customer service only|permission/i.test(msg) ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
