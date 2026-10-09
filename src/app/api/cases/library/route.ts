import { caseAvailability } from "@/engine/engine";
import { getCurrentUser } from "@/server/auth";
import { handleError, ok } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/cases/library — case counts per specialty, mode and level in the player's country (never ids). */
export async function GET() {
  try {
    const user = await getCurrentUser();
    return ok(await caseAvailability(user?.country));
  } catch (err) {
    return handleError(err);
  }
}
