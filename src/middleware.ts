import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/server/jwt";

/**
 * Next.js only runs the Edge middleware when this file is named `middleware.ts`
 * and exports a function named `middleware`. It protects the doctor dashboard —
 * redirecting to /login when the request has no valid session cookie.
 */
export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Surface the authenticated role to downstream server components / handlers.
  const res = NextResponse.next();
  res.headers.set("x-session-role", session.role);
  return res;
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*"],
};
