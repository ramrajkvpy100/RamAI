import { NextResponse } from "next/server";

import { AuthError, authenticate, createSession, SESSION_COOKIE, sessionCookieOptions } from "@/server/auth";
import { clearLimit, exhausted, overLimit } from "@/server/rate-limit";
import { apiError, clientIp, crossSite, handleError, parseBody, rateLimited } from "@/lib/server/http";
import { LoginSchema } from "@/lib/server/schemas";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 12);
  if (blocked) return blocked;
  const body = await parseBody(req, LoginSchema);
  if (body instanceof Response) return body;
  const account = `login:${body.login.trim().toLowerCase()}`;
  try {
    if (await overLimit(`login-ip:${clientIp(req)}`, 30, 900_000)) return apiError(429, "RATE_LIMITED", "Too many sign-in attempts. Please wait 15 minutes and try again.");
    // Ten wrong passwords lock the account for 15 minutes — guessing becomes impractical.
    if (await exhausted(account, 10, 900_000)) return apiError(429, "RATE_LIMITED", "Too many wrong passwords for this account. Please wait 15 minutes, or reset your password.");
    const user = await authenticate(body.login, body.password).catch(async (err) => {
      if (err instanceof AuthError) await overLimit(account, 10, 900_000);
      throw err;
    });
    await clearLimit(account);
    const { token, expires } = await createSession(user.id);
    const res = NextResponse.json({ user });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expires));
    return res;
  } catch (err) {
    return handleError(err);
  }
}
