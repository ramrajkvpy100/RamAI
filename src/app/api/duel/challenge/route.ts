import { z } from "zod";

import { sessionInfo } from "@/engine/engine";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { createChallenge } from "@/server/duels";
import { apiError, crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({ token: z.string().min(1).max(200_000) });

/** POST /api/duel/challenge — a finished case becomes "beat my score": the same patient, whenever a colleague opens the link. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 10);
  if (blocked) return blocked;
  const body = await parseBody(req, Schema);
  if (body instanceof Response) return body;
  try {
    const user = await requireUser();
    if (user.isGuest) return apiError(403, "GUEST", "Sign in to challenge a colleague.");
    const info = sessionInfo(body.token);
    if (info.userId !== user.id) return apiError(403, "FORBIDDEN", "That isn't your case.");
    const played = await db.get<{ score: number }>("SELECT score FROM results WHERE user_id = ? AND session_id = ?", user.id, info.sessionId);
    if (!played) return apiError(409, "NOT_FINISHED", "Finish the case first.");
    return ok({ id: await createChallenge({ id: user.id, name: user.name || user.username || "Doctor" }, info.src, played.score) });
  } catch (err) {
    return handleError(err);
  }
}
