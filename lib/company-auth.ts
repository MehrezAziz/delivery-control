import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "fallback-secret");

export interface CompanyPayload {
  companyId: string;
  companyName: string;
  apiKey: string;
  actorRole?: "MAIN_ADMIN" | "DEPT_ADMIN" | "DEPT_OPERATOR" | "DEPT_VIEWER";
  departmentId?: string | null;
  departmentAccountId?: string | null;
}

export async function signCompanyToken(payload: CompanyPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyCompanyToken(): Promise<CompanyPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("company_token")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as CompanyPayload;
  } catch {
    return null;
  }
}

export async function requireCompanyAuth(): Promise<CompanyPayload> {
  const payload = await verifyCompanyToken();
  if (!payload) throw new Error("Unauthorized");
  return payload;
}
