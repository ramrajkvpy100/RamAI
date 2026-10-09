import { requireUser } from "@/server/auth";
import { demoBillingEnabled, extendPro } from "@/server/billing";
import { apiError, crossSite, handleError, ok } from "@/lib/server/http";
import { PRICES } from "@/lib/plans";

export const runtime = "nodejs";

/** POST /api/billing/demo-upgrade — development only: activates Pro without payment. */
export async function POST(req: Request) {
  const blocked = crossSite(req);
  if (blocked) return blocked;
  if (!demoBillingEnabled()) return apiError(404, "NOT_FOUND", "Not found.");
  try {
    const user = await requireUser();
    extendPro(user, PRICES.monthly.days);
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
