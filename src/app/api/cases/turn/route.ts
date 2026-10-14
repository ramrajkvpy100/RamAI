import { withUsage } from "@/engine/providers/usage";
import { sessionInfo, submitDoctorAction } from "@/engine/engine";
import type { TeachingPack } from "@/engine/providers/types";
import { getCaseAI } from "@/server/case-ai";
import { requireUser } from "@/server/auth";
import { recordCase } from "@/server/results";
import { crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";
import { TurnSchema } from "@/lib/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Ending an invented case may write its teaching and feedback. */
export const maxDuration = 60;

/** POST /api/cases/turn — one doctor action; closing turns are recorded server-side. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req);
  if (blocked) return blocked;
  const body = await parseBody(req, TurnSchema);
  if (body instanceof Response) return body;
  try {
    // An invented case's teaching, if the background writer has finished it — read alongside the sign-in check.
    const info0 = sessionInfo(body.token);
    const [user, stored] = await Promise.all([requireUser(), info0.generated ? getCaseAI(info0.sessionId, "teaching").catch(() => undefined) : undefined]);
    const teaching = stored ? (JSON.parse(stored.data) as TeachingPack) : undefined;
    const res = await withUsage({ kind: "turn", sessionId: info0.sessionId }, () => submitDoctorAction(body.token, body.input, user.id, user.patientLang, teaching));
    if (res.debrief) {
      const info = sessionInfo(body.token);
      res.rewards = await recordCase(user, info.sessionId, res.debrief, { daily: info.daily, state: res.state });
    }
    return ok(res);
  } catch (err) {
    return handleError(err);
  }
}
