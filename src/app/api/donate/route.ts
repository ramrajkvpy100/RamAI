import { getCurrentUser } from "@/server/auth";
import { BillingError } from "@/server/billing";
import { createDonation } from "@/server/donations";
import { apiError, crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";
import { DonateSchema } from "@/lib/server/schemas";

export const runtime = "nodejs";

/** POST /api/donate — a Razorpay order for a gift; the amount is checked here, not trusted from the page. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 10);
  if (blocked) return blocked;
  const body = await parseBody(req, DonateSchema);
  if (body instanceof Response) return body;
  try {
    const user = await getCurrentUser().catch(() => null);
    return ok({ order: await createDonation({ ...body, userId: user && !user.isGuest ? user.id : null }) });
  } catch (err) {
    if (err instanceof BillingError) {
      const status = { UNAVAILABLE: 503, AMOUNT: 400, AUTH: 401 }[err.code as string] ?? 500;
      const code = err.code === "UNAVAILABLE" ? "PAYMENTS_UNAVAILABLE" : err.code === "AUTH" ? "PAYMENT_AUTH" : err.code === "AMOUNT" ? "BAD_AMOUNT" : "PAYMENT_ERROR";
      return apiError(status, code, err.message);
    }
    return handleError(err);
  }
}
