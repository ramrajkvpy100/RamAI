import { requireUser } from "@/server/auth";
import { dueReviews, specialtyStats } from "@/server/review";
import { handleError, ok } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/review — diagnoses due for another look, and the doctor's averages by specialty. */
export async function GET() {
  try {
    const user = await requireUser();
    const [due, specialties] = await Promise.all([dueReviews(user.id), specialtyStats(user.id)]);
    return ok({ due, specialties });
  } catch (err) {
    return handleError(err);
  }
}
