import { randomUUID } from "node:crypto";

import { z } from "zod";

import { sessionInfo } from "@/engine/engine";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { apiError, crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";

const Schema = z.object({
  token: z.string().min(20).max(400_000),
  kind: z.enum(["report", "feedback"]),
  rating: z.union([z.literal(1), z.literal(-1)]).optional(),
  reason: z.string().trim().max(600).default(""),
});

/** POST /api/cases/feedback — "Report this case" (an error in it) or thumbs up/down after the debrief. Kept for the weekly review. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 10);
  if (blocked) return blocked;
  const body = await parseBody(req, Schema);
  if (body instanceof Response) return body;
  try {
    const user = await requireUser();
    const info = sessionInfo(body.token);
    if (info.userId !== user.id) return apiError(404, "NOT_FOUND", "Not found.");
    if (body.kind === "report" && body.reason.length < 3) return apiError(400, "BAD_REQUEST", "Say what's wrong, in a few words.");
    await db.run(
      "INSERT INTO case_feedback (id, user_id, session_id, case_ref, kind, rating, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      randomUUID(), user.id, info.sessionId, info.learnKey, body.kind, body.rating ?? null, body.reason, Date.now(),
    );
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
