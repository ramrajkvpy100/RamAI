import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { deleteSession, SESSION_COOKIE } from "@/server/auth";
import { crossSite } from "@/lib/server/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const blocked = crossSite(req);
  if (blocked) return blocked;
  const jar = await cookies();
  deleteSession(jar.get(SESSION_COOKIE)?.value);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
