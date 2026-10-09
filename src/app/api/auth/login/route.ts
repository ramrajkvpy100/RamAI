import { NextResponse } from "next/server";

import { authenticate, createSession, SESSION_COOKIE, sessionCookieOptions } from "@/server/auth";
import { crossSite, handleError, parseBody, rateLimited } from "@/lib/server/http";
import { LoginSchema } from "@/lib/server/schemas";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 12);
  if (blocked) return blocked;
  const body = await parseBody(req, LoginSchema);
  if (body instanceof Response) return body;
  try {
    const user = await authenticate(body.login, body.password);
    const { token, expires } = await createSession(user.id);
    const res = NextResponse.json({ user });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expires));
    return res;
  } catch (err) {
    return handleError(err);
  }
}
