import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  const superUser = await prisma.superUser.findUnique({
    where: { email },
    include: { admin: true, customerService: true },
  });

  if (!superUser || superUser.status !== "ACTIVE") {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, superUser.superPassword);
  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await signToken({
    superUserId: superUser.id,
    adminId: superUser.admin?.id,
    customerServiceId: superUser.customerService?.id,
    role: superUser.role,
    pseudo: superUser.pseudo,
    email: superUser.email,
  });

  const response = NextResponse.json({ success: true, role: superUser.role });
  response.cookies.set("admin_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return response;
}
