import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "fallback-secret");

export interface AdminPayload {
  superUserId: string;
  adminId?: string;
  customerServiceId?: string;
  role: "ADMIN" | "CUSTOMER_SERVICE";
  pseudo: string;
  email: string;
}

export async function signToken(payload: AdminPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyToken(): Promise<AdminPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as AdminPayload;
  } catch {
    return null;
  }
}

export async function requireAuth(): Promise<AdminPayload> {
  const payload = await verifyToken();
  if (!payload) throw new Error("Unauthorized");
  return payload;
}

export async function requireAdmin(): Promise<AdminPayload> {
  const payload = await requireAuth();
  if (payload.role !== "ADMIN") throw new Error("Admin only");
  return payload;
}
