import { NextResponse } from "next/server";

import type { Country } from "@/engine/countries";
import { createGuest, createSession, getCurrentUser, SESSION_COOKIE, sessionCookieOptions } from "@/server/auth";
import { overLimit } from "@/server/rate-limit";
import { apiError, clientIp, crossSite, handleError, rateLimited } from "@/lib/server/http";
import { GuestSchema } from "@/lib/server/schemas";

export const runtime = "nodejs";

/** POST /api/auth/guest — try the guided demo case without an account. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 5);
  if (blocked) return blocked;
  try {
  if (await overLimit(`guest:${clientIp(req)}`, 20, 3600000)) return apiError(429, "RATE_LIMITED", "Too many demo sessions from this network. Please try again later.");
    const current = await getCurrentUser();
    if (current) return NextResponse.json({ user: current });
    const body = GuestSchema.safeParse(await req.json().catch(() => ({})));
    const user = await createGuest((body.success ? body.data.country : undefined) as Country | undefined);
    const { token, expires } = await createSession(user.id);
    const res = NextResponse.json({ user });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expires));
    return res;
  } catch (err) {
    return handleError(err);
  }
}
