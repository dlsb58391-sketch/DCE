import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/server/auth";
import { BRANCH_COOKIE, branchCookieOptions } from "@/lib/server/branch-context";
import { loginRateLimiter, clientIp } from "@/lib/server/rate-limit";
import { withRoute } from "@/lib/server/http";

export const POST = withRoute("auth.login.POST", authLoginPOST);

async function authLoginPOST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const identifier = String(body.username ?? body.email ?? "").toLowerCase().trim();
  const password = body.password;
  if (!identifier || !password) return NextResponse.json({ error: "missing" }, { status: 400 });

  // Throttle brute-force attempts per client IP + identifier.
  const rlKey = `login:${clientIp(req)}:${identifier}`;
  const rl = loginRateLimiter.check(rlKey);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "too_many_attempts" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  // Accept either the simple username or the email address.
  const user = await prisma.user.findFirst({
    where: { OR: [{ username: identifier }, { email: identifier }] },
  });
  if (!user) return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });

  const ok = await bcrypt.compare(String(password), user.passwordHash);
  if (!ok) return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });

  // Successful login — clear the throttle counter for this key.
  loginRateLimiter.reset(rlKey);

  const token = await createSessionToken({ sub: user.id, email: user.email, name: user.name, role: user.role, ver: user.tokenVersion });
  const res = NextResponse.json({ ok: true, user: { email: user.email, name: user.name, role: user.role } });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  // Land staff in their assigned branch so reads auto-scope to it. Owners with no
  // home branch keep whatever branch they last picked (cookie untouched).
  if (user.branchId) {
    res.cookies.set(BRANCH_COOKIE, user.branchId, branchCookieOptions);
  }
  return res;
}
