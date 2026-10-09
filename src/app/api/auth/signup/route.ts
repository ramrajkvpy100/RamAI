import { NextResponse } from "next/server";

import type { Country } from "@/engine/countries";
import { appUrl, sendVerification } from "@/server/account";
import { claimGuest, createSession, createUser, getCurrentUser, SESSION_COOKIE, sessionCookieOptions } from "@/server/auth";
import { apiError, crossSite, handleError, rateLimited } from "@/lib/server/http";
import { SignupSchema } from "@/lib/server/schemas";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 10);
  if (blocked) return blocked;
  const parsed = SignupSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "BAD_INPUT", parsed.error.issues[0]?.message ?? "Check the form.");
  try {
    // A guest who signs up keeps the demo case they just played.
    const current = await getCurrentUser();
    const input = { ...parsed.data, country: parsed.data.country as Country | undefined };
    const user = current?.isGuest ? await claimGuest(current.id, input) : await createUser(input);
    const verification = await sendVerification(user, appUrl(req));
    const { token, expires } = createSession(user.id);
    const res = NextResponse.json({ user, verification });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expires));
    return res;
  } catch (err) {
    return handleError(err);
  }
}
