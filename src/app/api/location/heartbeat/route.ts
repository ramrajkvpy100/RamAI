import { z } from "zod";

import { requireUser } from "@/server/auth";
import { optIn, recordHeartbeat, sharingState, stopSharing } from "@/server/nearby";
import { apiError, crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.union([
  z.object({ consent: z.literal(true) }).strict(),
  z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).strict(),
]);

/** GET /api/location/heartbeat — has this doctor turned near-me on? */
export async function GET() {
  try {
    const user = await requireUser();
    return ok({ sharing: user.isGuest ? false : (await sharingState(user.id)).sharing });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/location/heartbeat — { consent: true } turns near-me on; { lat, lng } says "still here" (snapped to the grid before storing). */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 6);
  if (blocked) return blocked;
  const body = await parseBody(req, Body);
  if (body instanceof Response) return body;
  try {
    const user = await requireUser();
    if (user.isGuest) return apiError(403, "SIGNUP_REQUIRED", "Create a free account to play doctors near you.");
    if ("consent" in body) {
      await optIn(user.id);
      return ok({ sharing: true });
    }
    if ((await recordHeartbeat(user, body)) === "not-sharing") return apiError(403, "NOT_SHARING", "Near me is off.");
    return ok({ sharing: true });
  } catch (err) {
    return handleError(err);
  }
}

/** DELETE /api/location/heartbeat — Stop sharing: the row is gone at once. Never rate limited. */
export async function DELETE(req: Request) {
  const blocked = crossSite(req);
  if (blocked) return blocked;
  try {
    const user = await requireUser();
    await stopSharing(user.id);
    return ok({ sharing: false });
  } catch (err) {
    return handleError(err);
  }
}
