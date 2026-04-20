import type { CompanyPayload } from "@/lib/company-auth";
import { requireCompanyAuth } from "@/lib/company-auth";

function backendBase() {
  return (process.env.DELIVERY_BACKEND_URL || "http://localhost:3000").replace(/\/$/, "");
}

function buildCompanyAuthHeaders(auth: CompanyPayload, initHeaders?: HeadersInit) {
  const headers = new Headers(initHeaders || {});
  headers.set("Authorization", `Bearer ${auth.apiKey}`);
  headers.set("X-Company-Actor-Role", auth.actorRole || "MAIN_ADMIN");
  if (auth.departmentId) headers.set("X-Company-Department-Id", auth.departmentId);
  if (auth.departmentAccountId) {
    headers.set("X-Company-Department-Account-Id", auth.departmentAccountId);
  }
  return headers;
}

/**
 * Same as {@link companyBackendFetch} but uses an already-resolved portal session (no `cookies()`).
 * Use from async work that must run after the route response is returned, or when you already have `auth`.
 */
export async function companyBackendFetchWithAuth(auth: CompanyPayload, path: string, init?: RequestInit) {
  const url = `${backendBase()}/api/v1/company${path}`;
  const headers = buildCompanyAuthHeaders(auth, init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  try {
    const res = await fetch(url, { ...init, headers, cache: "no-store" });
    return res;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown upstream fetch error";
    throw new Error(`Delivery backend unreachable: ${msg}`);
  }
}

export async function companyBackendFetch(path: string, init?: RequestInit) {
  const auth = await requireCompanyAuth();
  const url = `${backendBase()}/api/v1/company${path}`;
  const headers = buildCompanyAuthHeaders(auth, init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  try {
    const res = await fetch(url, { ...init, headers, cache: "no-store" });
    return res;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown upstream fetch error";
    throw new Error(`Delivery backend unreachable: ${msg}`);
  }
}
