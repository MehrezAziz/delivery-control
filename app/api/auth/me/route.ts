import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

export async function GET() {
  const payload = await verifyToken();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    superUserId: payload.superUserId,
    role: payload.role,
    pseudo: payload.pseudo,
    email: payload.email,
    csRoles: payload.csRoles || [],
  });
}
