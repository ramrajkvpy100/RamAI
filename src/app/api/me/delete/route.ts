import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { endGuestSession, requireUser } from "@/server/auth";
import { deleteAccount, passwordMatches } from "@/server/privacy";
import { authConfigured, supabaseServer } from "@/server/supabase";
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
    if (!user.isGuest && !(body.password && (await passwordMatches(user.email, body.password)))) {
      return apiError(401, "INVALID", "That password isn't right.");
    }
    // Every session ends first (while the sign-in still exists), then the data goes.
    if (!user.isGuest && authConfigured()) await (await supabaseServer()).auth.signOut({ scope: "global" }).catch(() => undefined);
    await deleteAccount(user.id);
    await endGuestSession();
    const jar = await cookies();
    for (const c of jar.getAll()) if (c.name.startsWith("sb-")) jar.delete(c.name);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
