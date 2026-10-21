import { ACCESS_COOKIE, inviteOnly, validAccessCookie } from "@/lib/server/access-cookie";
import { cookies } from "next/headers";
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
  // Invite-only: guest play only for a browser that has redeemed an invite code (Google Play's reviewers, a doctor
  // trying it first) — everyone else signs up with a code.
  if (inviteOnly() && !(await validAccessCookie((await cookies()).get(ACCESS_COOKIE)?.value))) return apiError(403, "INVITE", "RamAI is invite-only — enter your invite code first.");
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
