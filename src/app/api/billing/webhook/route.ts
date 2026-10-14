import { BillingError, handleWebhook, webhookConfigured } from "@/server/billing";

export const runtime = "nodejs";

/**
 * POST /api/billing/webhook — Razorpay's server-to-server notifications (payment.captured, order.paid,
 * payment.failed, refund.processed). Public by design: the signature over the raw body, made with
 * RAZORPAY_WEBHOOK_SECRET, is the permission. Razorpay retries anything that isn't a 2xx.
 */
export async function POST(req: Request) {
  if (!webhookConfigured()) return new Response("Webhook not configured", { status: 503 });
  const raw = await req.text();
  if (raw.length > 200_000) return new Response("Too large", { status: 413 });
  try {
    const outcome = await handleWebhook(raw, req.headers.get("x-razorpay-signature"), req.headers.get("x-razorpay-event-id"));
    return Response.json({ ok: true, outcome });
  } catch (err) {
    if (err instanceof BillingError) return new Response("Invalid signature", { status: 400 });
    console.error("[ramai] razorpay webhook failed:", err instanceof Error ? err.message : err);
    // Not recorded (the transaction rolled back): Razorpay will send it again.
    return new Response("Error", { status: 500 });
  }
}
