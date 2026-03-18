import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const { email, password, expectedRole } = await req.json();

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

  // Validate role matches what the user selected on the login page
  if (expectedRole && superUser.role !== expectedRole) {
    return NextResponse.json({ error: "This account does not have the selected role" }, { status: 403 });
  }

  const tokenPayload = {
    superUserId: superUser.id,
    adminId: superUser.admin?.id,
    customerServiceId: superUser.customerService?.id,
    role: superUser.role as "ADMIN" | "CUSTOMER_SERVICE",
    pseudo: superUser.pseudo,
    email: superUser.email,
    csRoles: superUser.customerService?.roles || [],
  };

  const token = await signToken(tokenPayload);

  const response = NextResponse.json({ success: true, role: superUser.role });
  response.cookies.set("admin_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
    path: "/",
  });

  return response;
}
