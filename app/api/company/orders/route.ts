import { NextRequest, NextResponse } from "next/server";
import { companyBackendFetch } from "@/lib/company-api";
import { requireCompanyAuth } from "@/lib/company-auth";
import { ensureCompanyRoleAllowed, isMainDepartmentActor, logCompanyAudit } from "@/lib/company-security";
import { shouldNotifyMainCompanyInboxForNewOrder } from "@/lib/company-orders-inbox";
import { emitDepartmentNotification } from "@/lib/company-notifications";
import { prisma } from "@/lib/prisma";
import { enforceCompanyRateLimit } from "@/lib/company-rate-limit";

/** Set by the browser only when POST /orders is submitted from the orders UI (tab knows pathname). */
const SUPPRESS_INBOX_HEADER = "x-suppress-company-order-inbox";

export async function GET() {
  try {
    const auth = await requireCompanyAuth();
    ensureCompanyRoleAllowed(auth, ["MAIN_ADMIN", "DEPT_ADMIN", "DEPT_OPERATOR", "DEPT_VIEWER"]);
    const res = await companyBackendFetch("/orders");
    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    const list = Array.isArray(data) ? data : [];
    const filtered = isMainDepartmentActor(auth)
      ? list
      : list.filter((o: any) => {
          if (!auth.departmentId) return false;
          if (o.deliveryCompanyDepartmentId === auth.departmentId) return true;
          const createdDept = o.createdByDepartmentAccount?.department?.id;
          return createdDept === auth.departmentId;
        });
    return NextResponse.json(filtered, { status: res.status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load orders";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireCompanyAuth();
    ensureCompanyRoleAllowed(auth, ["MAIN_ADMIN", "DEPT_ADMIN", "DEPT_OPERATOR"]);
    const idempotencyKey = req.headers.get("Idempotency-Key") || req.headers.get("idempotency-key");
    if (!idempotencyKey) {
      return NextResponse.json({ error: "Idempotency-Key header is required" }, { status: 400 });
    }
    enforceCompanyRateLimit(
      ["company-orders-create", auth.companyId, auth.departmentId || "main", auth.actorRole || "MAIN_ADMIN"],
      30,
      60_000,
    );
    if (!isMainDepartmentActor(auth) && !auth.departmentId) {
      return NextResponse.json({ error: "Department context is missing" }, { status: 403 });
    }
    const bodyObj = await req.json();
    const body = JSON.stringify(bodyObj);
    const suppressNewOrderInbox =
      req.headers.get(SUPPRESS_INBOX_HEADER) === "1" || req.headers.get(SUPPRESS_INBOX_HEADER) === "true";
    const res = await companyBackendFetch("/orders", {
      method: "POST",
      body,
      headers: { "Idempotency-Key": idempotencyKey },
    });
    const data = await res.json();
    if (res.ok && data?.id && !isMainDepartmentActor(auth) && auth.departmentId) {
      const db: any = prisma;
      await db.order.updateMany({
        where: { id: data.id, deliveryCompanyId: auth.companyId },
        data: { deliveryCompanyDepartmentId: auth.departmentId },
      });
    }
    if (res.ok) {
      await logCompanyAudit(
        auth.companyId,
        "COMPANY_ORDER_CREATED",
        "COMPANY",
        auth.departmentAccountId || auth.companyId,
        { orderId: data?.id, departmentId: auth.departmentId || null },
      );
      if (data?.id && (await shouldNotifyMainCompanyInboxForNewOrder(auth))) {
        if (!suppressNewOrderInbox) {
          await emitDepartmentNotification(
            auth.companyId,
            auth.companyId,
            "COMPANY_ORDER_CREATED_MAIN",
            { orderId: data.id },
            { companyAuth: auth },
          );
        }
      }
    }
    return NextResponse.json(data, { status: res.status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create order";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
