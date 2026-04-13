import { NextRequest, NextResponse } from "next/server";
import { requireCustomerServicePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";
import { CustomerStatus, DriverStatus, OrderDriverArrivalConflictStatus } from "@prisma/client";

const MANAGE_DISPUTES = "MANAGE_DISPUTES";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireCustomerServicePermission(MANAGE_DISPUTES);
    const { id } = await params;
    const body = await req.json();
    const action = body?.action as string | undefined;
    const note = typeof body?.note === "string" ? body.note.trim() : undefined;

    if (!["FORGIVE", "SUSPEND_CUSTOMER", "SUSPEND_DRIVER"].includes(action || "")) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const cs = await prisma.customerService.findUnique({
      where: { superUserId: auth.superUserId },
      select: { governorates: { select: { governorateId: true } } },
    });
    const govIds = new Set(cs?.governorates.map((g) => g.governorateId) ?? []);
    if (govIds.size === 0) {
      return NextResponse.json({ error: "No governorate coverage" }, { status: 403 });
    }

    const conflict = await prisma.orderDriverArrivalConflict.findUnique({
      where: { id },
      include: {
        customer: true,
        driver: true,
        order: {
          include: {
            pickupAddress: { include: { delegation: true } },
          },
        },
      },
    });
    if (!conflict) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (conflict.status !== OrderDriverArrivalConflictStatus.PENDING) {
      return NextResponse.json({ error: "Already resolved" }, { status: 400 });
    }

    const pickupGovId = conflict.order.pickupAddress?.delegation?.governorateId;
    if (!pickupGovId || !govIds.has(pickupGovId)) {
      return NextResponse.json({ error: "Outside your coverage" }, { status: 403 });
    }

    const statusMap: Record<string, OrderDriverArrivalConflictStatus> = {
      FORGIVE: OrderDriverArrivalConflictStatus.RESOLVED_FORGIVE,
      SUSPEND_CUSTOMER: OrderDriverArrivalConflictStatus.RESOLVED_SUSPEND_CUSTOMER,
      SUSPEND_DRIVER: OrderDriverArrivalConflictStatus.RESOLVED_SUSPEND_DRIVER,
    };

    await prisma.$transaction(async (tx) => {
      await tx.orderDriverArrivalConflict.update({
        where: { id },
        data: {
          status: statusMap[action!],
          resolvedBySuperUserId: auth.superUserId,
          resolvedAt: new Date(),
          resolutionNote: note || null,
        },
      });

      if (action === "SUSPEND_CUSTOMER") {
        await tx.customer.update({
          where: { id: conflict.customerId },
          data: { customerStatus: CustomerStatus.SUSPENDED },
        });
      }
      if (action === "SUSPEND_DRIVER") {
        await tx.driver.update({
          where: { id: conflict.driverId },
          data: { status: DriverStatus.SUSPENDED, suspendedAt: new Date() },
        });
      }
    });

    try {
      await logAction({
        actorId: auth.superUserId,
        actorRole: "CUSTOMER_SERVICE",
        actionType: "RESOLVE_ARRIVAL_CONFLICT",
        targetType: "ORDER_ARRIVAL_CONFLICT",
        targetId: id,
        newValue: JSON.stringify({ action, note }),
      });
    } catch {}

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 });
  }
}
