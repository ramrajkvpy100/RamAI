/**
 * Donations — a gift to support RamAI, paid through the same Razorpay Checkout as Pro.
 *
 *   1. createDonation — the amount is checked here (₹10 to ₹50,000, whole rupees), never trusted from
 *                       the page, and Razorpay is asked for an order marked as a donation.
 *   2. verifyDonation — Razorpay's signature is checked, and the payment itself fetched, before the
 *                       gift is recorded as paid. The webhook records it too, if the tab was closed.
 *
 * A gift buys nothing: no plan changes. Anyone may give, signed in or not.
 */
import "server-only";

import { randomUUID } from "node:crypto";

import { db } from "./db";
import { BillingError, keyId, keySecret, paymentMode, providerFailure, razorpay, signatureValid, type PaymentMode } from "./billing";

/** Whole rupees a gift may be, inclusive. */
export const DONATION_MIN = 10;
export const DONATION_MAX = 50_000;

export interface DonationOrder {
  orderId: string;
  amount: number;
  currency: "INR";
  keyId: string;
  mode: PaymentMode;
}

/** A Razorpay order for a gift of `rupees`. */
export async function createDonation(input: { rupees: number; name?: string; message?: string; userId?: string | null }): Promise<DonationOrder> {
  const mode = paymentMode();
  if (!mode) throw new BillingError("UNAVAILABLE", "Donations aren't open yet.");
  const { rupees } = input;
  if (!Number.isInteger(rupees) || rupees < DONATION_MIN || rupees > DONATION_MAX) {
    throw new BillingError("AMOUNT", `Please choose between ₹${DONATION_MIN} and ₹${DONATION_MAX.toLocaleString("en-IN")}.`);
  }
  const amount = rupees * 100;
  let created: { id: string; amount: number | string; currency: string };
  try {
    created = await razorpay().orders.create({
      amount,
      currency: "INR",
      receipt: `ramai_gift_${randomUUID().slice(0, 12)}`,
      notes: { kind: "donation", ...(input.userId ? { userId: input.userId } : {}) },
    });
  } catch (err) {
    throw providerFailure(err, "donation order", "We couldn't start the payment. Please try again.");
  }
  await db.run(
    "INSERT INTO donations (order_id, user_id, name, message, amount, currency, status, mode, created_at) VALUES (?, ?, ?, ?, ?, 'INR', 'created', ?, ?)",
    created.id, input.userId ?? null, input.name?.trim() || null, input.message?.trim() || null, Number(created.amount), mode, Date.now(),
  );
  return { orderId: created.id, amount: Number(created.amount), currency: "INR", keyId: keyId(), mode };
}

/** Checks Razorpay's signature and the payment, then records the gift as paid (once). */
export async function verifyDonation(p: { orderId: string; paymentId: string; signature: string }): Promise<{ status: "paid" }> {
  if (!paymentMode()) throw new BillingError("UNAVAILABLE", "Donations aren't open yet.");
  const row = await db.get<{ amount: number; currency: string; status: string }>("SELECT amount, currency, status FROM donations WHERE order_id = ?", p.orderId);
  if (!row) throw new BillingError("UNKNOWN_ORDER", "Unknown order.");
  if (!signatureValid(`${p.orderId}|${p.paymentId}`, p.signature, keySecret())) throw new BillingError("UNVERIFIED", "Payment could not be verified.");
  if (row.status === "paid") return { status: "paid" };
  let payment: { order_id: string | null; amount: number | string; currency: string; status: string };
  try {
    payment = (await razorpay().payments.fetch(p.paymentId)) as unknown as typeof payment;
    if (payment.status === "authorized") payment = (await razorpay().payments.capture(p.paymentId, row.amount, row.currency)) as unknown as typeof payment;
  } catch (err) {
    throw providerFailure(err, "donation lookup", "We couldn't reach Razorpay to confirm it. It will be confirmed automatically in a few minutes.");
  }
  if (payment.order_id !== p.orderId || Number(payment.amount) !== row.amount || payment.currency !== row.currency || payment.status !== "captured") {
    throw new BillingError("UNVERIFIED", "This payment hasn't gone through.");
  }
  await db.run("UPDATE donations SET status = 'paid', payment_id = ?, paid_at = ? WHERE order_id = ? AND status = 'created'", p.paymentId, Date.now(), p.orderId);
  return { status: "paid" };
}

export interface DonationSummary {
  count: number;
  /** Rupees, paid gifts in live mode. */
  total: number;
  recent: { name: string | null; message: string | null; rupees: number; paidAt: number; mode: string }[];
}

/** Admins: what's been given. */
export async function donationSummary(): Promise<DonationSummary> {
  const [sum, recent] = await Promise.all([
    db.get<{ n: number; total: number | null }>("SELECT COUNT(*) AS n, SUM(amount) AS total FROM donations WHERE status = 'paid' AND mode = 'live'"),
    db.all<{ name: string | null; message: string | null; amount: number; paid_at: number; mode: string }>("SELECT name, message, amount, paid_at, mode FROM donations WHERE status = 'paid' ORDER BY paid_at DESC LIMIT 50"),
  ]);
  return {
    count: Number(sum?.n ?? 0),
    total: Math.round(Number(sum?.total ?? 0) / 100),
    recent: recent.map((r) => ({ name: r.name, message: r.message, rupees: Math.round(r.amount / 100), paidAt: r.paid_at, mode: r.mode })),
  };
}
