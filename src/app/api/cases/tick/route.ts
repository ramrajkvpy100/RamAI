import { z } from "zod";

import { advanceRealTime } from "@/engine/engine";
import { requireUser } from "@/server/auth";
import { crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TickSchema = z.object({ token: z.string().min(20).max(400_000) });

/** POST /api/cases/tick — real-time mode: one minute of case time passes. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 20);
  if (blocked) return blocked;
  const body = await parseBody(req, TickSchema);
  if (body instanceof Response) return body;
  try {
    const user = await requireUser();
    return ok(await advanceRealTime(body.token, user.id, user.patientLang));
  } catch (err) {
    return handleError(err);
  }
}
