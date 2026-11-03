import { getMeForApi } from "@/server/me";
import { apiError, ok } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/me — the signed-in user, their progress and today's usage. */
export async function GET() {
  const me = await getMeForApi();
  if (!me) return apiError(401, "UNAUTHENTICATED", "Please log in.");
  if (me === "invite") return apiError(403, "INVITE", "RamAI is invite-only — enter your invite code to join.");
  return ok(me);
}
