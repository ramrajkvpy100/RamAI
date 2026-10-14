import { requireUser } from "@/server/auth";
import { BillingError, verifyPayment } from "@/server/billing";
import { apiError, crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";
import { VerifySchema } from "@/lib/server/schemas";

export const runtime = "nodejs";

/** POST /api/billing/verify — checks Razorpay's signature and the payment itself, then activates Pro. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 20);
  if (blocked) return blocked;
  const body = await parseBody(req, VerifySchema);
  if (body instanceof Response) return body;
  try {
    const user = await requireUser();
    return ok(await verifyPayment(user, body));
  } catch (err) {
    if (err instanceof BillingError) {
      // Razorpay couldn't be reached: the payment may well be fine — the page waits for the webhook.
      if (err.code === "PROVIDER") return apiError(500, "PAYMENT_PENDING", err.message);
      if (err.code === "AUTH") return apiError(401, "PAYMENT_AUTH", err.message);
      // A signature that doesn't match, or a payment that doesn't agree with the order (missing fields are a 400 from parseBody).
      return apiError(400, "PAYMENT_UNVERIFIED", err.message);
    }
    return handleError(err);
  }
}
