import { requireUser } from "@/server/auth";
import { BillingError, createOrder, demoBillingEnabled, paymentsConfigured } from "@/server/billing";
import { apiError, crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";
import { CheckoutSchema } from "@/lib/server/schemas";

export const runtime = "nodejs";

/** POST /api/billing/checkout — a Razorpay order for Pro, priced on the server. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 10);
  if (blocked) return blocked;
  const body = await parseBody(req, CheckoutSchema);
  if (body instanceof Response) return body;
  try {
    const user = await requireUser();
    if (!paymentsConfigured()) {
      return demoBillingEnabled() ? ok({ mode: "demo" }) : apiError(503, "PAYMENTS_UNAVAILABLE", "Payments aren't available yet.");
    }
    return ok({ mode: "razorpay", order: await createOrder(user, body.period) });
  } catch (err) {
    if (err instanceof BillingError) {
      const status = err.code === "GUEST" ? 403 : err.code === "INTERNATIONAL_UNAVAILABLE" || err.code === "UNAVAILABLE" ? 503 : 502;
      return apiError(status, err.code === "PROVIDER" ? "PAYMENT_ERROR" : err.code, err.message);
    }
    return handleError(err);
  }
}
