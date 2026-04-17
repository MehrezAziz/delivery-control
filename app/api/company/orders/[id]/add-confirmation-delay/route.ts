import { NextRequest, NextResponse } from "next/server";
import { companyBackendFetch } from "@/lib/company-api";
import { requireCompanyAuth } from "@/lib/company-auth";
import { ensureCompanyRoleAllowed } from "@/lib/company-security";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireCompanyAuth();
    ensureCompanyRoleAllowed(auth, ["MAIN_ADMIN", "DEPT_ADMIN", "DEPT_OPERATOR"]);
    const { id } = await params;
    const bodyObj = await req.json();
    const body = JSON.stringify({
      minutesToAdd: Number(bodyObj?.minutesToAdd ?? 0),
    });
    const res = await companyBackendFetch(`/orders/${id}/add-confirmation-delay`, {
      method: "POST",
      body,
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to update confirmation delay";
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
