import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "fallback-secret");

export async function middleware(req: NextRequest) {
  const token = req.cookies.get("admin_token")?.value;

  if (req.nextUrl.pathname.startsWith("/dashboard")) {
    if (!token) return NextResponse.redirect(new URL("/login", req.url));
    try {
      await jwtVerify(token, secret);
      return NextResponse.next();
    } catch {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  if (req.nextUrl.pathname === "/login" && token) {
    try {
      await jwtVerify(token, secret);
      return NextResponse.redirect(new URL("/dashboard", req.url));
    } catch { /* invalid token, let them login */ }
  }

  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*", "/login"] };
