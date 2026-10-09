import { resumeCase } from "@/engine/engine";
import { requireUser } from "@/server/auth";
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
    return ok(await resumeCase(body.token, user.id, user.patientLang));
  } catch (err) {
    return handleError(err);
  }
}
