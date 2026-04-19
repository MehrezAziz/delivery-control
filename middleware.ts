import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "fallback-secret");

interface TokenPayload {
  role: "ADMIN" | "CUSTOMER_SERVICE";
  csRoles?: string[];
}

interface CompanyTokenPayload {
  companyId: string;
  companyName: string;
  apiKey: string;
}

async function getPayload(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

async function getCompanyPayload(token: string): Promise<CompanyTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as CompanyTokenPayload;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const token = req.cookies.get("admin_token")?.value;

  // Protect /dashboard routes — admin only, except CS with explicit roles (see below).
  if (req.nextUrl.pathname.startsWith("/dashboard")) {
    if (!token) return NextResponse.redirect(new URL("/login", req.url));
    const payload = await getPayload(token);
    if (!payload) return NextResponse.redirect(new URL("/login", req.url));
    if (payload.role !== "ADMIN") {
      const path = req.nextUrl.pathname;
      const roles = payload.csRoles || [];
      const isFinancialDashboardRoot = path === "/dashboard";
      const canViewFinancialDashboard =
        payload.role === "CUSTOMER_SERVICE" && isFinancialDashboardRoot && roles.includes("MANAGE_FINANCIAL_REPORTS");
      const canCompanyFinance =
        payload.role === "CUSTOMER_SERVICE" &&
        path.startsWith("/dashboard/delivery-companies/budgets") &&
        roles.includes("MANAGE_COMPANY_FINANCE") &&
        roles.includes("SEE_DELIVERY_COMPANY");
      if (!canViewFinancialDashboard && !canCompanyFinance) {
        return NextResponse.redirect(new URL("/login", req.url));
      }
    }
    return NextResponse.next();
  }

  // Protect /cs routes — customer service only
  if (req.nextUrl.pathname.startsWith("/cs")) {
    if (!token) return NextResponse.redirect(new URL("/login", req.url));
    const payload = await getPayload(token);
    if (!payload) return NextResponse.redirect(new URL("/login", req.url));
    if (payload.role !== "CUSTOMER_SERVICE") return NextResponse.redirect(new URL("/login", req.url));
    return NextResponse.next();
  }

  // Protect /company routes — delivery company token only
  if (req.nextUrl.pathname.startsWith("/company")) {
    if (req.nextUrl.pathname.startsWith("/company/login")) return NextResponse.next();
    const companyToken = req.cookies.get("company_token")?.value;
    if (!companyToken) return NextResponse.redirect(new URL("/company/login", req.url));
    const payload = await getCompanyPayload(companyToken);
    if (!payload?.companyId) return NextResponse.redirect(new URL("/company/login", req.url));
    return NextResponse.next();
  }

  // If on login page, always allow access (user may need to re-authenticate)
  if (req.nextUrl.pathname.startsWith("/login")) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*", "/cs/:path*", "/company/:path*"] };
