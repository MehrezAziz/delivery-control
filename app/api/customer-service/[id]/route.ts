import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAction } from "@/lib/action-log";
import bcrypt from "bcryptjs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    const { id } = await params;
    const body = await req.json();

    const cs = await prisma.customerService.findUnique({
      where: { id },
      include: { superUser: true },
    });
    if (!cs) return NextResponse.json({ error: "CS account not found" }, { status: 404 });

    // Update roles if provided
    if (body.roles && Array.isArray(body.roles)) {
      const oldRoles = cs.roles;
      await prisma.customerService.update({
        where: { id },
        data: { roles: body.roles },
      });

      try {
        await logAction({
          actorId: auth.superUserId,
          actorRole: "ADMIN",
          actionType: "UPDATE_CS_ROLES",
          targetType: "CUSTOMER_SERVICE",
          targetId: id,
          oldValue: JSON.stringify(oldRoles),
          newValue: JSON.stringify(body.roles),
        });
      } catch {}
    }

    // Update password if provided
    if (body.password && typeof body.password === "string" && body.password.length >= 6) {
      const hashedPassword = await bcrypt.hash(body.password, 10);
      await prisma.superUser.update({
        where: { id: cs.superUserId },
        data: { superPassword: hashedPassword },
      });

      try {
        await logAction({
          actorId: auth.superUserId,
          actorRole: "ADMIN",
          actionType: "CHANGE_CS_PASSWORD",
          targetType: "CUSTOMER_SERVICE",
          targetId: id,
          newValue: "Password changed",
        });
      } catch {}
    }

    const updated = await prisma.customerService.findUnique({
      where: { id },
      include: { superUser: true },
    });

    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 });
  }
}
