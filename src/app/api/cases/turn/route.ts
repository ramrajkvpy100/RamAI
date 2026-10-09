import { sessionInfo, submitDoctorAction } from "@/engine/engine";
import { requireUser } from "@/server/auth";
import { recordCase } from "@/server/results";
import { crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";
import { TurnSchema } from "@/lib/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/cases/turn — one doctor action; closing turns are recorded server-side. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req);
  if (blocked) return blocked;
  const body = await parseBody(req, TurnSchema);
  if (body instanceof Response) return body;
  try {
    const user = await requireUser();
    const res = await submitDoctorAction(body.token, body.input, user.id, user.patientLang);
    if (res.debrief) res.rewards = await recordCase(user, sessionInfo(body.token).sessionId, res.debrief);
    return ok(res);
  } catch (err) {
    return handleError(err);
  }
}
