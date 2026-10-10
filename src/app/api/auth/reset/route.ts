import { NextResponse } from "next/server";

import { resetPassword } from "@/server/account";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/server/auth";
import { passwordProblem } from "@/server/passwords";
import { overLimit } from "@/server/rate-limit";
import { apiError, clientIp, crossSite, handleError, rateLimited } from "@/lib/server/http";
import { ResetSchema } from "@/lib/server/schemas";

export const runtime = "nodejs";

/** POST /api/auth/reset — sets a new password from an emailed link, then signs in. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 10);
  if (blocked) return blocked;
  const parsed = ResetSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "BAD_INPUT", parsed.error.issues[0]?.message ?? "Check the form.");
  const weak = passwordProblem(parsed.data.password);
  if (weak) return apiError(400, "BAD_INPUT", weak);
  try {
    if (await overLimit(`reset:${clientIp(req)}`, 10, 3_600_000)) return apiError(429, "RATE_LIMITED", "Too many attempts. Please try again in an hour.");
    const user = await resetPassword(parsed.data.token, parsed.data.password);
    if (!user) return apiError(400, "LINK_EXPIRED", "This link has expired or was already used. Ask for a new one.");
    const { token, expires } = await createSession(user.id);
    const res = NextResponse.json({ user });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expires));
    return res;
  } catch (err) {
    return handleError(err);
  }
}
