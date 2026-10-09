/**
 * Billing — Razorpay orders + signature verification.
 *
 * Live only when RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set. Without them,
 * development can use a clearly-labelled demo upgrade (RAMAI_DEMO_BILLING=1),
 * which is disabled in production.
 */
import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { PRICES, type BillingPeriod } from "@/lib/plans";

import { setPlan, type User } from "./auth";
import { getDb } from "./db";

export const paymentsConfigured = () => !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
export const demoBillingEnabled = () => process.env.NODE_ENV !== "production" && process.env.RAMAI_DEMO_BILLING === "1";

export class BillingError extends Error {}

export async function createOrder(user: User, period: BillingPeriod) {
  if (!paymentsConfigured()) throw new BillingError("Payments are not configured.");
  const price = PRICES[period];
  const receipt = `ramai_${randomUUID().slice(0, 18)}`;
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64")}`,
    },
    body: JSON.stringify({ amount: price.amount * 100, currency: "INR", receipt, notes: { userId: user.id, period } }),
  });
  if (!res.ok) throw new BillingError(`Payment provider responded ${res.status}`);
  const order = (await res.json()) as { id: string; amount: number; currency: string };
  getDb()
    .prepare("INSERT INTO payments (id, user_id, provider, order_id, amount, period, status, created_at) VALUES (?, ?, 'razorpay', ?, ?, ?, 'created', ?)")
    .run(randomUUID(), user.id, order.id, order.amount, period, Date.now());
  return { orderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID!, name: user.name, email: user.email };
}

/** Verifies Razorpay's checkout signature, then activates Pro. */
export function verifyPayment(user: User, p: { orderId: string; paymentId: string; signature: string }) {
  const row = getDb().prepare("SELECT period FROM payments WHERE order_id = ? AND user_id = ?").get(p.orderId, user.id) as { period: BillingPeriod } | undefined;
  if (!row) throw new BillingError("Unknown order.");
  const expected = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET ?? "").update(`${p.orderId}|${p.paymentId}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(p.signature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new BillingError("Payment could not be verified.");
  // Atomic claim: a duplicate or concurrent verify for the same order never extends Pro twice.
  const claimed = getDb().prepare("UPDATE payments SET status = 'paid', payment_id = ? WHERE order_id = ? AND status != 'paid'").run(p.paymentId, p.orderId);
  if (Number(claimed.changes) === 1) extendPro(user, PRICES[row.period].days);
}

export function extendPro(user: User, days: number) {
  const base = user.plan === "pro" && user.planExpiresAt && user.planExpiresAt > Date.now() ? user.planExpiresAt : Date.now();
  setPlan(user.id, "pro", base + days * 86_400_000);
}
