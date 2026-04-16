import { requireCompanyAuth } from "@/lib/company-auth";

function backendBase() {
  return (process.env.DELIVERY_BACKEND_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function companyBackendFetch(path: string, init?: RequestInit) {
  const auth = await requireCompanyAuth();
  const url = `${backendBase()}/api/v1/company${path}`;
  const headers = new Headers(init?.headers || {});
  headers.set("Authorization", `Bearer ${auth.apiKey}`);
  headers.set("X-Company-Actor-Role", auth.actorRole || "MAIN_ADMIN");
  if (auth.departmentId) headers.set("X-Company-Department-Id", auth.departmentId);
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
