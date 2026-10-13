import { resumeCase, sessionInfo } from "@/engine/engine";
import type { CaseDebrief } from "@/engine/types";
import { requireUser } from "@/server/auth";
import { getCaseAI } from "@/server/case-ai";
import { crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";
import { ResumeSchema } from "@/lib/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/cases/resume — rebuild authoritative state for a stored session. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req);
  if (blocked) return blocked;
  const body = await parseBody(req, ResumeSchema);
  if (body instanceof Response) return body;
  try {
    const user = await requireUser();
    // A closed case's feedback in words, if the AI has written it.
    const kept = await getCaseAI(sessionInfo(body.token).sessionId, "coach").catch(() => undefined);
    return ok(await resumeCase(body.token, user.id, user.patientLang, kept ? (JSON.parse(kept.data) as CaseDebrief["coach"]) : undefined));
  } catch (err) {
    return handleError(err);
  }
}
