import { withUsage } from "@/engine/providers/usage";
import { prepareNext } from "@/server/case-pool";
import { requireUser } from "@/server/auth";
import { totalCasesStarted } from "@/server/results";
import { planFor } from "@/lib/plans";
import { crossSite, handleError, ok, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";
// Inventing a patient takes the model up to about a minute.
export const maxDuration = 60;

/**
 * POST /api/cases/prepare — writes the doctor's next patient ahead of time
 * (their usual choice: their specialty, the right difficulty), so "Next case"
 * starts at once. Asked for by the browser as soon as a case is under way.
 */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 6);
  if (blocked) return blocked;
  try {
    const user = await requireUser();
    const own = user.specialty && user.specialty !== "mixed" ? user.specialty : undefined;
    const newcomer = user.isGuest || (await totalCasesStarted(user.id)) <= 3;
    const status = await withUsage({ kind: "case-start" }, () => prepareNext(user.id, { specialty: own, easy: newcomer, country: user.country, lang: user.patientLang }, { allowedLevels: planFor(user).levels, exclude: [] }));
    return ok({ status });
  } catch (err) {
    return handleError(err);
  }
}
