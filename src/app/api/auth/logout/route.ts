import { NextResponse } from "next/server";
import { SESSION_COOKIE, getSession } from "@/lib/server/auth";
import { prisma } from "@/lib/db";
import { withRoute } from "@/lib/server/http";

export const POST = withRoute("auth.logout.POST", authLogoutPOST);

async function authLogoutPOST() {
  // Revoke every token issued to this user by bumping their tokenVersion. This
  // turns the stateless JWT into a truly invalidatable session: any other device
  // still holding the old cookie is rejected by requireSession on its next call.
  const session = await getSession();
  if (session?.sub) {
    try {
      await prisma.user.update({
        where: { id: session.sub },
        data: { tokenVersion: { increment: 1 } },
      });
    } catch (err) {
      // Never block logout on a DB hiccup — clearing the cookie below still ends
      // this device's session.
      console.error("[logout] failed to bump tokenVersion:", err);
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
