import { BillingError } from "@/server/billing";
import { verifyDonation } from "@/server/donations";
import { apiError, crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";
import { VerifySchema } from "@/lib/server/schemas";

export const runtime = "nodejs";

/** POST /api/donate/verify — checks Razorpay's signature and the payment, then records the gift. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 20);
  if (blocked) return blocked;
  const body = await parseBody(req, VerifySchema);
  if (body instanceof Response) return body;
  try {
    return ok(await verifyDonation(body));
  } catch (err) {
    if (err instanceof BillingError) {
      if (err.code === "PROVIDER") return apiError(500, "PAYMENT_PENDING", err.message);
      if (err.code === "AUTH") return apiError(401, "PAYMENT_AUTH", err.message);
      return apiError(400, "PAYMENT_UNVERIFIED", err.message);
    }
    return handleError(err);
  }
}
