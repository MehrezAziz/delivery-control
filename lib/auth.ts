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
  csRoles?: string[];
}

export async function signToken(payload: AdminPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
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

export async function requireCS(): Promise<AdminPayload> {
  const payload = await requireAuth();
  if (payload.role !== "CUSTOMER_SERVICE") throw new Error("Customer Service only");
  return payload;
}

/** CS JWT only; checks `csRoles` on the token (e.g. MANAGE_DISPUTES). */
export async function requireCustomerServicePermission(permission: string): Promise<AdminPayload> {
  const payload = await requireCS();
  if (!(payload.csRoles || []).includes(permission)) {
    throw new Error("Permission denied");
  }
  return payload;
}

export function hasCSRole(payload: AdminPayload, role: string): boolean {
  return payload.role === "ADMIN" || (payload.csRoles || []).includes(role);
}
