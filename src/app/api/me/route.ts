import { getCurrentUser } from "@/server/auth";
import { meFor } from "@/server/me";
import { apiError, ok } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/me — the signed-in user, their progress and today's usage. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError(401, "UNAUTHENTICATED", "Please log in.");
  return ok(await meFor(user));
}
