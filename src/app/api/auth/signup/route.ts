import { NextResponse } from "next/server";

import type { Country } from "@/engine/countries";
import { appUrl, sendVerification } from "@/server/account";
import { claimGuest, createSession, createUser, getCurrentUser, recordConsent, SESSION_COOKIE, sessionCookieOptions } from "@/server/auth";
import { passwordProblem } from "@/server/passwords";
import { overLimit } from "@/server/rate-limit";
import { apiError, clientIp, crossSite, handleError, rateLimited } from "@/lib/server/http";
import { SignupSchema } from "@/lib/server/schemas";
import { SITE } from "@/lib/site";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 10);
  if (blocked) return blocked;
  const parsed = SignupSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "BAD_INPUT", parsed.error.issues[0]?.message ?? "Check the form.");
  const weak = passwordProblem(parsed.data.password, parsed.data);
  if (weak) return apiError(400, "BAD_INPUT", weak);
  try {
    if (await overLimit(`signup:${clientIp(req)}`, 10, 3_600_000)) return apiError(429, "RATE_LIMITED", "Too many sign-ups from this network. Please try again in an hour.");
    // A guest who signs up keeps the demo case they just played.
    const current = await getCurrentUser();
    const { acceptTerms: _accepted, ...details } = parsed.data;
    const input = { ...details, country: details.country as Country | undefined };
    const user = current?.isGuest ? await claimGuest(current.id, input) : await createUser(input);
    await recordConsent(user.id, SITE.termsVersion);
    const verification = await sendVerification(user, appUrl(req));
    const { token, expires } = await createSession(user.id);
    const res = NextResponse.json({ user, verification });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expires));
    return res;
  } catch (err) {
    return handleError(err);
  }
}
