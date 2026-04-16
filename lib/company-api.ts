import { requireCompanyAuth } from "@/lib/company-auth";

function backendBase() {
  return (process.env.DELIVERY_BACKEND_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function companyBackendFetch(path: string, init?: RequestInit) {
  const auth = await requireCompanyAuth();
  const url = `${backendBase()}/api/v1/company${path}`;
  const headers = new Headers(init?.headers || {});
  headers.set("Authorization", `Bearer ${auth.apiKey}`);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(url, { ...init, headers, cache: "no-store" });
  return res;
}
