import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/auth";
import { withRoute } from "@/lib/server/http";

export const GET = withRoute("auth.me.GET", authMeGET);

async function authMeGET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ user: session });
}
