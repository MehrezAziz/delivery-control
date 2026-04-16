import { NextRequest, NextResponse } from "next/server";
import { companyBackendFetch } from "@/lib/company-api";
import { requireCompanyAuth } from "@/lib/company-auth";
import { ensureCompanyRoleAllowed, isMainDepartmentActor } from "@/lib/company-security";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireCompanyAuth();
    ensureCompanyRoleAllowed(auth, ["MAIN_ADMIN", "DEPT_ADMIN", "DEPT_OPERATOR", "DEPT_VIEWER"]);
    if (!isMainDepartmentActor(auth)) {
      const db: any = prisma;
      const { searchParams } = new URL(req.url);
      const from = searchParams.get("from");
      const to = searchParams.get("to");
      const where: any = {
        deliveryCompanyId: auth.companyId,
        deliveryCompanyDepartmentId: auth.departmentId || "__none__",
      };
      if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt.gte = new Date(`${from}T00:00:00`);
        if (to) where.createdAt.lte = new Date(`${to}T23:59:59`);
      }
      const orders = await db.order.findMany({
        where,
        select: { status: true, price: true },
      });
      return NextResponse.json({
        orders: orders.length,
        delivered: orders.filter((o: any) => o.status === "DELIVERED").length,
        returned: orders.filter((o: any) => o.status === "RETURNED" || o.status === "RETURN_DEPOSIT").length,
        cancelled: orders.filter((o: any) => o.status === "CANCELLED").length,
        grossAmount: orders.reduce((sum: number, o: any) => sum + Number(o.price || 0), 0),
      });
    }

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    const res = await companyBackendFetch(`/stats${suffix}`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load stats";
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
