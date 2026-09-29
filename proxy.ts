import { NextResponse, type NextRequest } from "next/server";

/**
 * Auth gate (Next.js 16 Proxy): signed-out users hitting the dashboard are
 * redirected to /auth?returnTo=… so sign-in lands them back where they started.
 */
const PROTECTED_PREFIXES = ["/dashboard"];
const AUTH_PAGE = "/auth";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (!isProtected) return NextResponse.next();

  const hasSession = Boolean(request.cookies.get("softcape_session")?.value);
  if (hasSession) return NextResponse.next();

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = AUTH_PAGE;
  loginUrl.search = "";
  loginUrl.searchParams.set("returnTo", `${pathname}${search || ""}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/dashboard/:path*", "/dashboard"],
};
