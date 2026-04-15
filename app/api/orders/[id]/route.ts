import { NextRequest, NextResponse } from "next/server";
import { hasCSRole, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    if (auth.role === "CUSTOMER_SERVICE" && !hasCSRole(auth, "VIEW_DELIVERIES")) {
      return NextResponse.json({ error: "Insufficient permissions: VIEW_DELIVERIES required" }, { status: 403 });
    }
    const { id } = await params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: { include: { user: { select: { id: true, firstName: true, secondName: true, phone: true, myEmail: true } } } },
        pickupAddress: { include: { delegation: { include: { governorate: { include: { country: true } } } } } },
        dropoffAddress: { include: { delegation: { include: { governorate: { include: { country: true } } } } } },
        driverAssignment: { include: { driver: { include: { user: { select: { id: true, firstName: true, secondName: true, phone: true } } } } } },
        pricingPolicy: true,
        chatRooms: {
          orderBy: { createdAt: "desc" },
          include: {
            driver: { include: { user: { select: { id: true, firstName: true, secondName: true, phone: true } } } },
            messages: { orderBy: { timestamp: "asc" } },
          },
        },
        dispute: { include: { customerService: { include: { superUser: { select: { pseudo: true } } } } } },
        cashTransaction: true,
        walletTransactions: true,
        referralCommissions: true,
        rating: true,
        driverLocations: { orderBy: { timestamp: "desc" }, take: 1 },
      },
    });

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    if (auth.role === "CUSTOMER_SERVICE") {
      const cs = await prisma.customerService.findUnique({
        where: { id: auth.customerServiceId },
        select: { governorates: { select: { governorateId: true } } },
      });
      const governorateIds = new Set((cs?.governorates || []).map((g) => g.governorateId));
      const pickupGov = order.pickupAddress?.delegation?.governorate?.id;
      const dropoffGov = order.dropoffAddress?.delegation?.governorate?.id;
      const inScope =
        (pickupGov && governorateIds.has(pickupGov)) ||
        (dropoffGov && governorateIds.has(dropoffGov));
      if (!inScope) {
        return NextResponse.json({ error: "Order out of your governorate scope" }, { status: 403 });
      }
    }

    const chatRoomsHistory = (order.chatRooms || []).map((room) => ({
      id: room.id,
      status: room.status,
      createdAt: room.createdAt,
      driver: room.driver
        ? {
            id: room.driver.id,
            userId: room.driver.userId,
            name: `${room.driver.user?.firstName || ""} ${room.driver.user?.secondName || ""}`.trim() || "Driver",
            phone: room.driver.user?.phone || null,
          }
        : null,
      messages: room.messages || [],
    }));

    return NextResponse.json({
      ...order,
      price: Number(order.price),
      distanceKm: Number(order.distanceKm),
      weight: Number(order.weight),
      nightFee: Number(order.nightFee),
      extraWeightFee: Number(order.extraWeightFee),
      chatRoomsHistory,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load order";
    const status = /unauthorized|admin only|customer service only|permission/i.test(msg) ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
