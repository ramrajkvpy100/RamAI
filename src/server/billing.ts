/**
 * Billing — Razorpay Checkout with one-time orders (no subscription, no monthly fee).
 *
 *   1. createOrder   — the server prices the order from PRICE_BOOK (never the browser) and asks Razorpay for it.
 *   2. Checkout      — the browser opens Razorpay's own payment window (UPI, cards, netbanking, wallets).
 *   3. verifyPayment — the browser hands back Razorpay's signature; the server checks it, asks Razorpay
 *                      that the payment really is for this order, amount and currency, then grants Pro.
 *   4. handleWebhook — Razorpay tells the server directly (signed with the webhook secret), so a payment
 *                      is recorded even if the buyer closed the tab before step 3. Each event once.
 *
 * Pro is granted in exactly one place (`settle`), inside a transaction, and only when the order moves
 * to "paid" for the first time — so the browser and the webhook can both report the same payment safely.
 *
 * Keys: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET (server-only; the key id is public by
 * design — Checkout needs it). rzp_test_… keys run TEST MODE: no real money moves. Payments in dollars and
 * pounds are refused until RAZORPAY_INTERNATIONAL=1, which is set only after Razorpay enables international
 * cards on the account.
 */
import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import Razorpay from "razorpay";

import { PERIODS, priceFor, type BillingPeriod } from "@/lib/plans";

import type { User } from "./auth";
import { db, tx } from "./db";

export type PaymentMode = "test" | "live";

export const keyId = () => process.env.RAZORPAY_KEY_ID?.trim() ?? "";
export const keySecret = () => process.env.RAZORPAY_KEY_SECRET?.trim() ?? "";
const webhookSecret = () => process.env.RAZORPAY_WEBHOOK_SECRET?.trim() ?? "";

export const paymentsConfigured = () => !!(keyId() && keySecret());
/** TEST MODE with rzp_test_ keys, LIVE with rzp_live_ keys. */
export const paymentMode = (): PaymentMode | null => (!paymentsConfigured() ? null : keyId().startsWith("rzp_live_") ? "live" : "test");
/** Dollars and pounds: only once Razorpay has approved and enabled international cards for the account. */
export const internationalEnabled = () => process.env.RAZORPAY_INTERNATIONAL === "1";
export const demoBillingEnabled = () => process.env.NODE_ENV !== "production" && process.env.RAMAI_DEMO_BILLING === "1";

export type BillingErrorCode = "UNAVAILABLE" | "INTERNATIONAL_UNAVAILABLE" | "GUEST" | "UNKNOWN_ORDER" | "UNVERIFIED" | "PROVIDER" | "AUTH" | "AMOUNT";

export class BillingError extends Error {
  constructor(
    public readonly code: BillingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "BillingError";
  }
}

let cached: { key: string; client: Razorpay } | null = null;
/** The official Razorpay SDK, made once per set of keys. */
export function razorpay(): Razorpay {
  const key = `${keyId()}:${keySecret()}`;
  if (cached?.key !== key) cached = { key, client: new Razorpay({ key_id: keyId(), key_secret: keySecret() }) };
  return cached.client;
}

/** An HMAC-SHA256 signature, compared in constant time (the SDK's helper compares with ===). */
export function signatureValid(message: string, signature: string, secret: string): boolean {
  if (!secret || !signature) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(message).digest("hex"));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** What Razorpay's error says, without anything secret — for our logs only. */
const providerMessage = (err: unknown) => {
  const e = err as { statusCode?: number; error?: { code?: string; description?: string } };
  return e?.error ? `${e.statusCode ?? ""} ${e.error.code ?? ""} ${e.error.description ?? ""}`.trim() : err instanceof Error ? err.message : "unknown error";
};

/** A failed Razorpay call: logged on the server; the buyer gets `message` — or, when Razorpay rejected our keys, a plain "not available". */
export function providerFailure(err: unknown, what: string, message: string): BillingError {
  console.error(`[ramai] razorpay ${what} failed:`, providerMessage(err));
  if ((err as { statusCode?: number })?.statusCode === 401) return new BillingError("AUTH", "Payments aren't available right now. Please try again later.");
  return new BillingError("PROVIDER", message);
}

interface PaymentRow {
  id: string;
  user_id: string;
  order_id: string;
  payment_id: string | null;
  amount: number;
  currency: string;
  period: string;
  status: "created" | "paid" | "failed" | "refunded";
  mode: string | null;
}

export interface CheckoutOrder {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  mode: PaymentMode;
  description: string;
  name: string;
  email: string;
}

/** A new order for Pro — or the buyer's unpaid one from the last half hour, so "Try again" pays the same order. */
export async function createOrder(user: User, period: BillingPeriod): Promise<CheckoutOrder> {
  const mode = paymentMode();
  if (!mode) throw new BillingError("UNAVAILABLE", "Payments aren't available yet.");
  if (user.isGuest) throw new BillingError("GUEST", "Create a free account first, so Pro stays with you.");
  // Priced here, from the price book, in the currency of the country they practise in.
  const price = priceFor(user.country, period);
  if (price.currency !== "INR" && !internationalEnabled()) {
    throw new BillingError("INTERNATIONAL_UNAVAILABLE", "Card payments from outside India open soon. You can keep using RamAI in the meantime.");
  }
  // Razorpay's minimum is 100 paise (or cents/pence); a price below it is a price-book mistake.
  if (!Number.isInteger(price.minor) || price.minor < 100) throw new BillingError("AMOUNT", "This plan can't be bought right now.");
  const description = `RamAI Pro — ${PERIODS[period].days} days`;
  const order = (o: { order_id: string; amount: number; currency: string }): CheckoutOrder => ({
    orderId: o.order_id,
    amount: o.amount,
    currency: o.currency,
    keyId: keyId(),
    mode,
    description,
    name: user.name,
    email: user.email,
  });

  const open = await db.get<{ order_id: string; amount: number; currency: string }>(
    "SELECT order_id, amount, currency FROM payments WHERE user_id = ? AND status IN ('created', 'failed') AND amount = ? AND currency = ? AND period = ? AND mode = ? AND created_at > ? ORDER BY created_at DESC LIMIT 1",
    user.id, price.minor, price.currency, period, mode, Date.now() - 30 * 60_000,
  );
  if (open) return order(open);

  let created: { id: string; amount: number | string; currency: string };
  try {
    created = await razorpay().orders.create({
      amount: price.minor,
      currency: price.currency,
      receipt: `ramai_${randomUUID().slice(0, 18)}`,
      notes: { userId: user.id, period },
    });
  } catch (err) {
    throw providerFailure(err, "order", "We couldn't start the payment. Please try again.");
  }
  const now = Date.now();
  // waiver_at: the buyer asked for Pro to start immediately (recorded as consumer-law evidence).
  await db.run(
    "INSERT INTO payments (id, user_id, provider, order_id, amount, currency, period, status, mode, created_at, updated_at, waiver_at) VALUES (?, ?, 'razorpay', ?, ?, ?, ?, 'created', ?, ?, ?, ?)",
    randomUUID(), user.id, created.id, Number(created.amount), created.currency, period, mode, now, now, now,
  );
  return order({ order_id: created.id, amount: Number(created.amount), currency: created.currency });
}

/**
 * Marks an order paid and grants Pro — once. Both the browser's confirmation and the webhook come
 * here; whichever is first grants the days, the other finds the order already paid.
 */
async function settle(orderId: string, payment: { id: string; method?: string | null }): Promise<"granted" | "already"> {
  return tx(async (t) => {
    const row = await t.get<PaymentRow>("SELECT * FROM payments WHERE order_id = ?", orderId);
    if (!row) throw new BillingError("UNKNOWN_ORDER", "Unknown order.");
    const now = Date.now();
    const claimed = await t.run(
      "UPDATE payments SET status = 'paid', payment_id = ?, method = ?, error = NULL, paid_at = ?, updated_at = ? WHERE order_id = ? AND status IN ('created', 'failed')",
      payment.id, payment.method ?? null, now, now, orderId,
    );
    if (claimed.changes !== 1) return "already";
    const days = row.period === "yearly" ? 365 : PERIODS.monthly.days;
    await t.run(
      // From today, or from the end of the Pro they already have. (A Pro with no end date stays that way.)
      "UPDATE users SET plan = 'pro', plan_expires_at = (CASE WHEN plan = 'pro' AND (plan_expires_at IS NULL OR plan_expires_at > ?) THEN plan_expires_at ELSE ? END) + ? WHERE id = ?",
      now, now, days * 86_400_000, row.user_id,
    );
    return "granted";
  });
}

interface RazorpayPayment {
  id: string;
  order_id: string | null;
  amount: number | string;
  currency: string;
  status: string;
  method?: string;
  error_description?: string | null;
  error_reason?: string | null;
}

/** The payment as Razorpay has it, when it agrees with our order — capturing it if it was only authorised. */
async function confirmedWithRazorpay(row: PaymentRow, paymentId: string): Promise<RazorpayPayment> {
  let p: RazorpayPayment;
  try {
    p = (await razorpay().payments.fetch(paymentId)) as unknown as RazorpayPayment;
  } catch (err) {
    throw providerFailure(err, "payment lookup", "We couldn't reach Razorpay to confirm the payment. It will be confirmed automatically in a few minutes.");
  }
  if (p.order_id !== row.order_id || Number(p.amount) !== row.amount || p.currency !== row.currency) {
    throw new BillingError("UNVERIFIED", "Payment could not be verified.");
  }
  if (p.status === "authorized") {
    // Accounts set to capture manually: take the money now (an uncaptured payment is refunded by Razorpay).
    try {
      p = (await razorpay().payments.capture(paymentId, row.amount, row.currency)) as unknown as RazorpayPayment;
    } catch (err) {
      throw providerFailure(err, "capture", "The payment is being processed. Pro will start as soon as Razorpay confirms it.");
    }
  }
  if (p.status !== "captured") throw new BillingError("UNVERIFIED", "This payment hasn't gone through.");
  return p;
}

/** Checks Razorpay's checkout signature and the payment itself, then grants Pro. */
export async function verifyPayment(user: User, p: { orderId: string; paymentId: string; signature: string }): Promise<{ status: "paid" }> {
  if (!paymentsConfigured()) throw new BillingError("UNAVAILABLE", "Payments aren't available yet.");
  const row = await db.get<PaymentRow>("SELECT * FROM payments WHERE order_id = ? AND user_id = ?", p.orderId, user.id);
  if (!row) throw new BillingError("UNKNOWN_ORDER", "Unknown order.");
  if (!signatureValid(`${p.orderId}|${p.paymentId}`, p.signature, keySecret())) throw new BillingError("UNVERIFIED", "Payment could not be verified.");
  if (row.status === "paid") return { status: "paid" };
  const payment = await confirmedWithRazorpay(row, p.paymentId);
  await settle(row.order_id, payment);
  return { status: "paid" };
}

/** Where a buyer's order stands — for the page to check after a payment (the webhook may have settled it). */
export async function orderStatus(user: User, orderId: string): Promise<PaymentRow["status"] | null> {
  const row = await db.get<{ status: PaymentRow["status"] }>("SELECT status FROM payments WHERE order_id = ? AND user_id = ?", orderId, user.id);
  return row?.status ?? null;
}

/* -------------------------------------------------------------------------- */
/* Webhooks                                                                    */
/* -------------------------------------------------------------------------- */

export const webhookConfigured = () => !!webhookSecret();

interface WebhookBody {
  event: string;
  payload: {
    payment?: { entity: RazorpayPayment };
    order?: { entity: { id: string; status: string } };
    refund?: { entity: { id: string; payment_id: string; amount: number | string; status: string } };
  };
}

export type WebhookOutcome = "processed" | "duplicate" | "ignored";

/**
 * A webhook from Razorpay, already read as the raw text it was signed over. The event is recorded
 * in the same transaction as its effect, so a retry after a failure is processed again, and a
 * second delivery of a processed event changes nothing.
 */
export async function handleWebhook(raw: string, signature: string | null, eventId: string | null): Promise<WebhookOutcome> {
  if (!signatureValid(raw, signature ?? "", webhookSecret())) throw new BillingError("UNVERIFIED", "Invalid signature.");
  let body: WebhookBody;
  try {
    body = JSON.parse(raw) as WebhookBody;
  } catch {
    throw new BillingError("UNVERIFIED", "Invalid body.");
  }
  const payment = body.payload?.payment?.entity;
  const refund = body.payload?.refund?.entity;
  const orderId = payment?.order_id ?? body.payload?.order?.entity?.id ?? null;
  // Razorpay sends an id with every event; without one, the event and payment stand in for it.
  const id = eventId || `${body.event}:${payment?.id ?? refund?.id ?? orderId ?? createHmac("sha256", "id").update(raw).digest("hex")}`;

  return tx(async (t) => {
    const fresh = await t.run("INSERT OR IGNORE INTO payment_events (event_id, event, order_id, payment_id, received_at) VALUES (?, ?, ?, ?, ?)", id, body.event, orderId, payment?.id ?? refund?.payment_id ?? null, Date.now());
    if (fresh.changes !== 1) return "duplicate";
    const row = orderId ? await t.get<PaymentRow>("SELECT * FROM payments WHERE order_id = ?", orderId) : refund ? await t.get<PaymentRow>("SELECT * FROM payments WHERE payment_id = ?", refund.payment_id) : undefined;
    // A gift, not a purchase: recorded as paid once Razorpay has taken it.
    if (!row && orderId && payment?.status === "captured" && (body.event === "payment.captured" || body.event === "order.paid")) {
      const gift = await t.run(
        "UPDATE donations SET status = 'paid', payment_id = ?, paid_at = ? WHERE order_id = ? AND status = 'created' AND amount = ? AND currency = ?",
        payment.id, Date.now(), orderId, Number(payment.amount), payment.currency,
      );
      if (gift.changes === 1) return "processed";
    }
    // Not one of RamAI's orders (another product on the same account): recorded and left alone.
    if (!row) return "ignored";

    switch (body.event) {
      case "payment.captured":
      case "order.paid": {
        if (!payment || Number(payment.amount) !== row.amount || payment.currency !== row.currency || payment.status !== "captured") return "ignored";
        await settle(row.order_id, payment);
        return "processed";
      }
      case "payment.failed": {
        // A failed attempt never undoes a payment that went through (a buyer may fail, then succeed).
        const reason = (payment?.error_description || payment?.error_reason || "Payment failed").slice(0, 300);
        await t.run("UPDATE payments SET status = 'failed', error = ?, updated_at = ? WHERE order_id = ? AND status = 'created'", reason, Date.now(), row.order_id);
        return "processed";
      }
      case "refund.processed": {
        if (!refund || row.status !== "paid") return "ignored";
        // A full refund takes back the days it bought (never below today). A partial one is only recorded.
        const full = Number(refund.amount) >= row.amount;
        const now = Date.now();
        await t.run("UPDATE payments SET status = ?, error = ?, updated_at = ? WHERE order_id = ?", full ? "refunded" : "paid", full ? null : `Partly refunded: ${refund.amount}`, now, row.order_id);
        if (full) {
          const days = row.period === "yearly" ? 365 : PERIODS.monthly.days;
          await t.run("UPDATE users SET plan_expires_at = max(?, plan_expires_at - ?) WHERE id = ? AND plan = 'pro' AND plan_expires_at IS NOT NULL", now, days * 86_400_000, row.user_id);
        }
        return "processed";
      }
      default:
        return "ignored";
    }
  });
}

/* -------------------------------------------------------------------------- */
/* What the pricing page needs to know                                         */
/* -------------------------------------------------------------------------- */

export interface BillingStatus {
  /** Keys set: Checkout can open. */
  available: boolean;
  mode: PaymentMode | null;
  /** Dollars and pounds accepted. */
  international: boolean;
}

export const billingStatus = (): BillingStatus => ({ available: paymentsConfigured(), mode: paymentMode(), international: internationalEnabled() });

/** Development only (RAMAI_DEMO_BILLING=1): Pro without paying. */
export async function extendPro(user: User, days: number) {
  const now = Date.now();
  await db.run(
    "UPDATE users SET plan = 'pro', plan_expires_at = (CASE WHEN plan = 'pro' AND (plan_expires_at IS NULL OR plan_expires_at > ?) THEN plan_expires_at ELSE ? END) + ? WHERE id = ?",
    now, now, days * 86_400_000, user.id,
  );
}
