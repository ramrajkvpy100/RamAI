import { getCurrentUser } from "@/server/auth";
import { practiceStats } from "@/server/practice";
import { handleError, ok } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/practice/stats — a doctor's drill scores, read after the page has been drawn. */
export async function GET() {
  try {
    const user = await getCurrentUser().catch(() => null);
    return ok({ stats: user ? await practiceStats(user.id) : [] });
  } catch (err) {
    return handleError(err);
  }
}
