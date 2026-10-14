import { z } from "zod";

import { withUsage } from "@/engine/providers/usage";
import { coachFor, sessionInfo } from "@/engine/engine";
import type { CaseDebrief } from "@/engine/types";
import { requireUser } from "@/server/auth";
import { getCaseAI, putCaseAI } from "@/server/case-ai";
import { apiError, crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CoachRequest = z.object({ token: z.string().min(20).max(400_000) });

/**
 * POST /api/cases/coach — the debrief's feedback in words, written by the AI
 * after the case ends, then kept. The debrief itself never waits for it.
 */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 30);
  if (blocked) return blocked;
  const body = await parseBody(req, CoachRequest);
  if (body instanceof Response) return body;
  try {
    const user = await requireUser();
    const info = sessionInfo(body.token);
    if (info.userId !== user.id) return apiError(404, "NOT_FOUND", "Not found.");
    const kept = await getCaseAI(info.sessionId, "coach");
    if (kept) return ok({ coach: JSON.parse(kept.data) as CaseDebrief["coach"] });
    const coach = await withUsage({ kind: "coach", sessionId: info.sessionId }, () => coachFor(body.token, user.id));
    if (coach) await putCaseAI(info.sessionId, "coach", user.id, "application/json", JSON.stringify(coach));
    return ok({ coach: coach ?? null });
  } catch (err) {
    return handleError(err);
  }
}
