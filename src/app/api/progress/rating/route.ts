import { handleError, ok } from "@/lib/server/http";
import { requireUser } from "@/server/auth";
import { progressFor } from "@/server/progress";
import { keepRating, ratingPercentile } from "@/server/results";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/progress/rating — where this doctor's rating stands among all rated doctors. */
export async function GET() {
  try {
    const user = await requireUser();
    if (user.isGuest) return ok({ doctors: 0, top: null });
    const { rating, ratedCases } = await progressFor(user.id);
    if (ratedCases) await keepRating(user.id, rating);
    return ok(await ratingPercentile(rating));
  } catch (err) {
    return handleError(err);
  }
}
