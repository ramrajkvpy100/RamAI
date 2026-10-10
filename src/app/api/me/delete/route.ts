import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser, SESSION_COOKIE } from "@/server/auth";
import { deleteAccount, passwordMatches } from "@/server/privacy";
import { overLimit } from "@/server/rate-limit";
import { apiError, clientIp, crossSite, handleError, parseBody, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";

const DeleteSchema = z.object({ password: z.string().max(200).optional() });

/** POST /api/me/delete — permanently deletes the signed-in account (the password confirms it). */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 5);
  if (blocked) return blocked;
  const body = await parseBody(req, DeleteSchema);
  if (body instanceof Response) return body;
  try {
    const user = await requireUser();
    if (await overLimit(`delete:${clientIp(req)}`, 10, 3_600_000)) return apiError(429, "RATE_LIMITED", "Too many attempts. Please try again in an hour.");
    if (!user.isGuest && !(body.password && (await passwordMatches(user.id, body.password)))) {
      return apiError(401, "INVALID", "That password isn't right.");
    }
    await deleteAccount(user.id);
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(SESSION_COOKIE);
    return res;
  } catch (err) {
    return handleError(err);
  }
}
