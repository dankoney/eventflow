import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const protectedPrefixes = ["/dashboard", "/events", "/guests", "/checkin", "/analytics", "/settings"];

function isProtectedPath(pathname: string) {
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
    "/analytics/:path*",
    "/settings",
    "/settings/:path*"
  ]
};
