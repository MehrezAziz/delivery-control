import { NextResponse } from "next/server";
import { companyBackendFetch } from "@/lib/company-api";
import { requireCompanyAuth } from "@/lib/company-auth";
import { ensureCompanyRoleAllowed } from "@/lib/company-security";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireCompanyAuth();
    ensureCompanyRoleAllowed(auth, ["MAIN_ADMIN", "DEPT_ADMIN", "DEPT_OPERATOR", "DEPT_VIEWER"]);
    const { id } = await params;
    const res = await companyBackendFetch(`/orders/${id}/chat`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load chat";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
