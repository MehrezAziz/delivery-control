import { NextResponse } from "next/server";
import { companyBackendFetch } from "@/lib/company-api";
import { requireCompanyAuth } from "@/lib/company-auth";
import { isMainDepartmentActor } from "@/lib/company-security";

export async function GET() {
  try {
    const auth = await requireCompanyAuth();
    const res = await companyBackendFetch("/profile");
    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    const scoped =
      isMainDepartmentActor(auth)
        ? data
        : (() => {
            const { coinBalance: _cb, lockedCoins: _lc, maxNegativeBalance: _mnb, ...rest } = data as Record<string, unknown>;
            return rest;
          })();
    return NextResponse.json({
      ...scoped,
      actorRole: auth.actorRole || "MAIN_ADMIN",
      departmentId: auth.departmentId || null,
      departmentAccountId: auth.departmentAccountId || null,
    }, { status: res.status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load profile";
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
