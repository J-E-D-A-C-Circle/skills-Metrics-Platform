import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionUserFromRequest, getDashboardRouteForRole } from "./lib/session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Static assets and internal Next.js routes bypass
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.includes(".") || // files like favicon.ico, images
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/vrs") ||
    pathname.startsWith("/api/uploads") ||
    pathname.startsWith("/api/upload")
  ) {
    return NextResponse.next();
  }

  const session = getSessionUserFromRequest(req);

  // If visiting /login while already authenticated, redirect to appropriate role dashboard
  if (pathname === "/login") {
    if (session) {
      const dest = getDashboardRouteForRole(session.role);
      return NextResponse.redirect(new URL(dest, req.url));
    }
    return NextResponse.next();
  }

  // 1. Guard Administrative Routes
  if (pathname.startsWith("/admin")) {
    if (!session) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (session.role !== "ADMINISTRATOR") {
      // Unauthorized role -> redirect to their assigned workspace
      const redirectUrl = getDashboardRouteForRole(session.role);
      return NextResponse.redirect(new URL(redirectUrl, req.url));
    }

    return NextResponse.next();
  }

  // 2. Guard Technical Officer Routes
  if (pathname.startsWith("/technical-officer")) {
    if (!session) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (session.role !== "TECHNICAL_OFFICER" && session.role !== "ADMINISTRATOR") {
      const redirectUrl = getDashboardRouteForRole(session.role);
      return NextResponse.redirect(new URL(redirectUrl, req.url));
    }

    return NextResponse.next();
  }

  // 2.5. Guard Compliance Manager Routes
  if (pathname.startsWith("/compliance")) {
    if (!session) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (session.role !== "COMPLIANCE_OFFICER" && session.role !== "ADMINISTRATOR") {
      const redirectUrl = getDashboardRouteForRole(session.role);
      return NextResponse.redirect(new URL(redirectUrl, req.url));
    }

    return NextResponse.next();
  }

  // 3. Guard Records Hub (Internal Admin function only)
  if (pathname.startsWith("/records")) {
    if (!session) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("redirect", "/admin");
      return NextResponse.redirect(loginUrl);
    }
    if (session.role !== "ADMINISTRATOR") {
      const redirectUrl = getDashboardRouteForRole(session.role);
      return NextResponse.redirect(new URL(redirectUrl, req.url));
    }
    const adminUrl = new URL("/admin", req.url);
    const q = req.nextUrl.searchParams.get("q");
    if (q) adminUrl.searchParams.set("q", q);
    adminUrl.searchParams.set("section", "records");
    return NextResponse.redirect(adminUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/technical-officer/:path*",
    "/compliance/:path*",
    "/records",
    "/records/:path*",
    "/login",
  ],
};
