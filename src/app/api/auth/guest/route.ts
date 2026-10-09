import { NextResponse } from "next/server";

import type { Country } from "@/engine/countries";
import { createGuest, createSession, getCurrentUser, SESSION_COOKIE, sessionCookieOptions } from "@/server/auth";
import { crossSite, handleError, rateLimited } from "@/lib/server/http";
import { GuestSchema } from "@/lib/server/schemas";

export const runtime = "nodejs";

/** POST /api/auth/guest — try the guided demo case without an account. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 5);
  if (blocked) return blocked;
  try {
    const current = await getCurrentUser();
    if (current) return NextResponse.json({ user: current });
    const body = GuestSchema.safeParse(await req.json().catch(() => ({})));
    const user = createGuest((body.success ? body.data.country : undefined) as Country | undefined);
    const { token, expires } = createSession(user.id);
    const res = NextResponse.json({ user });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expires));
    return res;
  } catch (err) {
    return handleError(err);
  }
}
