import { NextRequest, NextResponse } from "next/server";
import { companyBackendFetch } from "@/lib/company-api";
import { requireCompanyAuth } from "@/lib/company-auth";
import { ensureCompanyRoleAllowed } from "@/lib/company-security";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireCompanyAuth();
    ensureCompanyRoleAllowed(auth, ["MAIN_ADMIN", "DEPT_ADMIN", "DEPT_OPERATOR"]);
    const body = await req.text();
    const res = await companyBackendFetch("/orders/preview", { method: "POST", body });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to preview order";
    if (/unauthorized/i.test(msg)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (/forbidden|permission/i.test(msg)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (/backend unreachable|fetch failed|ECONNREFUSED/i.test(msg)) {
      return NextResponse.json({ error: "Delivery backend is unavailable" }, { status: 503 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
