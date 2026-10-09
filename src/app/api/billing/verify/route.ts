import { requireUser } from "@/server/auth";
import { BillingError, verifyPayment } from "@/server/billing";
import { apiError, crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";
import { VerifySchema } from "@/lib/server/schemas";

export const runtime = "nodejs";

/** POST /api/billing/verify — verifies the Razorpay signature and activates Pro. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 10);
  if (blocked) return blocked;
  const body = await parseBody(req, VerifySchema);
  if (body instanceof Response) return body;
  try {
    const user = await requireUser();
    await verifyPayment(user, body);
    return ok({ ok: true });
  } catch (err) {
    if (err instanceof BillingError) return apiError(400, "PAYMENT_UNVERIFIED", err.message);
    return handleError(err);
  }
}
