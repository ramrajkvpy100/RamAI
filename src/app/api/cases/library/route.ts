import { caseAvailability } from "@/engine/engine";
import { handleError, ok } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/cases/library — case counts per specialty, mode and level (never ids). */
export async function GET() {
  try {
    return ok(await caseAvailability());
  } catch (err) {
    return handleError(err);
  }
}
