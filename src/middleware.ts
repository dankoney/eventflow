import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const protectedPrefixes = ["/dashboard", "/events", "/guests", "/checkin", "/deliveries", "/analytics", "/settings", "/superadmin"];

/**
 * Guest-facing ballot + results live under `/events/[id]/poll` (same URL prefix as
 * the dashboard's `/events/[id]/…` routes). They must stay public — voters authenticate
 * with the OTP gate on the page, not the org NextAuth session.
 */
function isPublicEventBallotPath(pathname: string) {
  return /^\/events\/[^/]+\/poll(\/.*)?$/i.test(pathname);
}

function isProtectedPath(pathname: string) {
  if (isPublicEventBallotPath(pathname)) return false;
  return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function hasSessionCookie(request: NextRequest) {
  const names = [
    "authjs.session-token",
    "__Secure-authjs.session-token",
    "next-auth.session-token",
    "__Secure-next-auth.session-token"
  ];
  return names.some((name) => request.cookies.has(name));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  if (!hasSessionCookie(request)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/events/:path*",
    "/guests/:path*",
    "/checkin",
    "/checkin/:path*",
    "/deliveries",
    "/deliveries/:path*",
    "/analytics/:path*",
    "/settings",
    "/settings/:path*",
    "/superadmin",
    "/superadmin/:path*"
  ]
};
