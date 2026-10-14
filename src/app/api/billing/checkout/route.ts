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
      // Razorpay rejected our keys → 401; any other Razorpay failure → 500; a price under 100 paise → 400.
      const status = { GUEST: 403, INTERNATIONAL_UNAVAILABLE: 503, UNAVAILABLE: 503, AMOUNT: 400, AUTH: 401 }[err.code as string] ?? 500;
      const code = err.code === "AUTH" ? "PAYMENT_AUTH" : err.code === "AMOUNT" ? "BAD_AMOUNT" : err.code === "PROVIDER" ? "PAYMENT_ERROR" : err.code;
      return apiError(status, code, err.message);
    }
    return handleError(err);
  }
}
