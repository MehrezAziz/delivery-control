import { NextResponse } from "next/server";
import { companyBackendFetch } from "@/lib/company-api";
import { requireCompanyAuth } from "@/lib/company-auth";
import { ensureCompanyRoleAllowed, logCompanyAudit } from "@/lib/company-security";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireCompanyAuth();
    ensureCompanyRoleAllowed(auth, ["MAIN_ADMIN", "DEPT_ADMIN", "DEPT_OPERATOR"]);
    const { id } = await params;
    const body = await req.json();
    const res = await companyBackendFetch(`/orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok) {
      await logCompanyAudit(
        auth.companyId,
        "COMPANY_ORDER_UPDATED_SEARCHING",
        "COMPANY",
        auth.departmentAccountId || auth.companyId,
        { orderId: id, departmentId: auth.departmentId || null },
      );
    }
    return NextResponse.json(data, { status: res.status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to update order";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireCompanyAuth();
    ensureCompanyRoleAllowed(auth, ["MAIN_ADMIN", "DEPT_ADMIN", "DEPT_OPERATOR"]);
    const { id } = await params;
    const res = await companyBackendFetch(`/orders/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      await logCompanyAudit(
        auth.companyId,
        "COMPANY_ORDER_DELETED_SEARCHING",
        "COMPANY",
        auth.departmentAccountId || auth.companyId,
        { orderId: id, departmentId: auth.departmentId || null },
      );
    }
    return NextResponse.json(data, { status: res.status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to cancel order";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
