import { requireUser } from "@/server/auth";
import { nearbyDoctors } from "@/server/nearby";
import { handleError, ok } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/duels/nearby — doctors near you to play with, the most recently active first. */
export async function GET() {
  try {
    const user = await requireUser();
    if (user.isGuest) return ok({ doctors: [], needs: "account" });
    return ok(await nearbyDoctors(user));
  } catch (err) {
    return handleError(err);
  }
}
