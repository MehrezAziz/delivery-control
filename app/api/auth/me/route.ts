import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";

export async function GET() {
  const payload = await verifyToken();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  return NextResponse.json({
    superUserId: payload.superUserId,
    role: payload.role,
    pseudo: payload.pseudo,
    email: payload.email,
    csRoles: payload.csRoles || [],
    token, // For WebSocket authentication
  });
}
