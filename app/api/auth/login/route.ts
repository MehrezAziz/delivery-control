import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";
import bcrypt from "bcryptjs";

async function logLoginAttempt(data: { identifier: string; loginType: string; success: boolean; failReason?: string; ipAddress?: string; userAgent?: string }) {
  try {
    await prisma.loginAttempt.create({ data: {
      identifier: data.identifier, loginType: data.loginType, success: data.success,
      failReason: data.failReason || null, ipAddress: data.ipAddress || null, userAgent: data.userAgent || null,
    }});
  } catch (e) { console.error('Failed to log login attempt:', e); }
}

export async function POST(req: NextRequest) {
  try {
    const { email, password, expectedRole } = await req.json();
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || undefined;

    const superUser = await prisma.superUser.findUnique({
      where: { email },
      include: { admin: true, customerService: true },
    });

    if (!superUser || superUser.status !== "ACTIVE") {
      await logLoginAttempt({ identifier: email, loginType: expectedRole || 'UNKNOWN', success: false, failReason: !superUser ? 'Account not found' : 'Account inactive', ipAddress, userAgent });
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, superUser.superPassword);
    if (!valid) {
      await logLoginAttempt({ identifier: email, loginType: superUser.role, success: false, failReason: 'Invalid password', ipAddress, userAgent });
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Validate role matches what the user selected on the login page
    if (expectedRole && superUser.role !== expectedRole) {
      await logLoginAttempt({ identifier: email, loginType: expectedRole, success: false, failReason: 'Role mismatch', ipAddress, userAgent });
      return NextResponse.json({ error: "This account does not have the selected role" }, { status: 403 });
    }

    await logLoginAttempt({ identifier: email, loginType: superUser.role, success: true, ipAddress, userAgent });

    const tokenPayload = {
      superUserId: superUser.id,
      adminId: superUser.admin?.id,
      customerServiceId: superUser.customerService?.id,
      role: superUser.role as "ADMIN" | "CUSTOMER_SERVICE",
      pseudo: superUser.pseudo,
      email: superUser.email,
      csRoles: (superUser.customerService?.roles || []) as string[],
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
  } catch (e) {
    console.error("[api/auth/login]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
