import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";
import { CustomerStatus, DriverStatus, OrderDriverArrivalConflictStatus } from "@prisma/client";
import { notifyCustomerSuspended } from "@/lib/notify-customer-suspended";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    const { id } = await params;
    const body = await req.json();
    const action = body?.action as string | undefined;
    const note = typeof body?.note === "string" ? body.note.trim() : undefined;
    const validActions = ["FORGIVE", "SUSPEND_CUSTOMER", "SUSPEND_DRIVER"] as const;
    const isResolveAction = !!action && validActions.includes(action as any);

    if (!isResolveAction && note === undefined) {
      return NextResponse.json({ error: "Provide action or note" }, { status: 400 });
    }

    const conflict = await prisma.orderDriverArrivalConflict.findUnique({
      where: { id },
      include: { customer: true, driver: true },
    });
    if (!conflict) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (isResolveAction && conflict.status !== OrderDriverArrivalConflictStatus.PENDING) {
      return NextResponse.json({ error: "Already resolved" }, { status: 400 });
    }

    const statusMap: Record<string, OrderDriverArrivalConflictStatus> = {
      FORGIVE: OrderDriverArrivalConflictStatus.RESOLVED_FORGIVE,
      SUSPEND_CUSTOMER: OrderDriverArrivalConflictStatus.RESOLVED_SUSPEND_CUSTOMER,
      SUSPEND_DRIVER: OrderDriverArrivalConflictStatus.RESOLVED_SUSPEND_DRIVER,
    };

    if (isResolveAction) {
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
    } else {
      await prisma.orderDriverArrivalConflict.update({
        where: { id },
        data: { resolutionNote: note || null },
      });
    }

    try {
      await logAction({
        actorId: auth.superUserId,
        actorRole: "ADMIN",
        actionType: "RESOLVE_ARRIVAL_CONFLICT",
        targetType: "ORDER_ARRIVAL_CONFLICT",
        targetId: id,
        newValue: JSON.stringify({ action: isResolveAction ? action : null, note }),
      });
    } catch {}

    if (action === "SUSPEND_CUSTOMER") {
      await notifyCustomerSuspended(conflict.customer.userId);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 });
  }
}
