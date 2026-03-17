import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAction } from "@/lib/action-log";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  const { pseudo, email, telephone, password, roles } = await req.json();

  // Check uniqueness
  const existing = await prisma.superUser.findFirst({
    where: { OR: [{ email }, { pseudo }, { telephone }] },
  });
  if (existing) {
    return NextResponse.json({ error: "Email, pseudo, or telephone already exists" }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const superUser = await prisma.superUser.create({
    data: {
      email,
      pseudo,
      telephone,
      superPassword: hashedPassword,
      role: "CUSTOMER_SERVICE",
      customerService: {
        create: { roles },
      },
    },
    include: { customerService: true },
  });

  await logAction({
    actorId: auth.superUserId,
    actorRole: "ADMIN",
    actionType: "CREATE_CUSTOMER_SERVICE",
    targetType: "CUSTOMER_SERVICE",
    targetId: superUser.customerService!.id,
    newValue: JSON.stringify({ pseudo, email, roles }),
  });

  return NextResponse.json({ success: true, id: superUser.customerService!.id });
}
