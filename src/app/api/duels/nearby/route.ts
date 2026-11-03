import { z } from "zod";

import { requireUser } from "@/server/auth";
import { withAvatars } from "@/server/avatars";
import { radar, setHidden } from "@/server/nearby";
import { apiError, crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/duels/nearby — doctors around you with rounded distances, never a position. `?scope=live` skips the slower city list. */
export async function GET(req: Request) {
  const blocked = rateLimited(req, 20);
  if (blocked) return blocked;
  try {
    const user = await requireUser();
    if (user.isGuest) return ok({ doctors: [], sharing: false, hidden: false, needs: "account" });
    const result = await radar(user, { liveOnly: new URL(req.url).searchParams.get("scope") === "live" });
    return ok({ ...result, doctors: await withAvatars(result.doctors, (d) => d.id), ...(result.city ? { city: await withAvatars(result.city, (d) => d.id) } : {}) });
  } catch (err) {
    return handleError(err);
  }
}

const Hide = z.object({ hidden: z.boolean() }).strict();

/** POST /api/duels/nearby — { hidden: true }: "don't show me" to anyone on Near me, and stops any sharing at once. */
export async function POST(req: Request) {
  const blocked = crossSite(req);
  if (blocked) return blocked;
  const body = await parseBody(req, Hide);
  if (body instanceof Response) return body;
  try {
    const user = await requireUser();
    if (user.isGuest) return apiError(403, "SIGNUP_REQUIRED", "Create a free account first.");
    await setHidden(user.id, body.hidden);
    return ok({ hidden: body.hidden, sharing: false });
  } catch (err) {
    return handleError(err);
  }
}
