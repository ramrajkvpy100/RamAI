import { createHmac } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createGuest, createProfile, findUserById, type User } from "@/server/auth";
import { createOrder, handleWebhook, orderStatus, verifyPayment } from "@/server/billing";
import { db } from "@/server/db";

process.env.RAMAI_DB_PATH = ":memory:";
process.env.RAZORPAY_KEY_ID = "rzp_test_ramai";
process.env.RAZORPAY_KEY_SECRET = "test-secret";
process.env.RAZORPAY_WEBHOOK_SECRET = "hook-secret";

/** Razorpay's API, as the SDK would return it — no network in tests. */
const razorpay = vi.hoisted(() => ({
  orders: [] as { amount: number; currency: string }[],
  payments: new Map<string, { id: string; order_id: string; amount: number; currency: string; status: string; method: string }>(),
}));
vi.mock("razorpay", () => ({
  default: class {
    orders = {
      create: async (o: { amount: number; currency: string }) => {
        razorpay.orders.push(o);
        return { id: `order_${razorpay.orders.length}`, amount: o.amount, currency: o.currency, status: "created" };
      },
    };
    payments = {
      fetch: async (id: string) => {
        const p = razorpay.payments.get(id);
        if (!p) throw { statusCode: 400, error: { code: "BAD_REQUEST_ERROR", description: "The id provided does not exist" } };
        return p;
      },
      capture: async (id: string) => {
        const p = razorpay.payments.get(id)!;
        p.status = "captured";
        return p;
      },
    };
  },
}));

const sign = (message: string, secret: string) => createHmac("sha256", secret).update(message).digest("hex");
const checkoutSignature = (orderId: string, paymentId: string) => sign(`${orderId}|${paymentId}`, "test-secret");
const hook = (event: string, payload: object, id: string) => {
  const raw = JSON.stringify({ entity: "event", event, payload });
  return handleWebhook(raw, sign(raw, "hook-secret"), id);
};
const DAY = 86_400_000;

let asha: User;
let john: User;

beforeAll(async () => {
  asha = await createProfile({ email: "asha@example.com", username: "asha.v", name: "Asha Verma" });
  john = await createProfile({ email: "john@example.com", username: "johnd", name: "John Doe" });
  await db.run("UPDATE users SET country = 'US' WHERE id = ?", john.id);
  john = (await findUserById(john.id))!;
});

beforeEach(async () => {
  await db.run("DELETE FROM payments");
  await db.run("UPDATE users SET plan = 'free', plan_expires_at = NULL");
  delete process.env.RAZORPAY_INTERNATIONAL;
});

describe("orders", () => {
  it("are priced on the server, in the doctor's currency, and reused for a retry", async () => {
    const order = await createOrder(asha, "monthly");
    expect(order).toMatchObject({ amount: 29_900, currency: "INR", keyId: "rzp_test_ramai", mode: "test" });
    expect(razorpay.orders.at(-1)).toMatchObject({ amount: 29_900, currency: "INR" });
    // "Try again" within half an hour pays the same order instead of making another.
    expect((await createOrder(asha, "monthly")).orderId).toBe(order.orderId);
    expect(await db.get("SELECT status, mode FROM payments WHERE order_id = ?", order.orderId)).toMatchObject({ status: "created", mode: "test" });
  });

  it("refuse dollars and pounds until international payments are enabled", async () => {
    await expect(createOrder(john, "monthly")).rejects.toMatchObject({ code: "INTERNATIONAL_UNAVAILABLE" });
    process.env.RAZORPAY_INTERNATIONAL = "1";
    expect(await createOrder(john, "monthly")).toMatchObject({ amount: 499, currency: "USD" });
  });

  it("need an account, not a guest", async () => {
    await expect(createOrder(await createGuest(), "monthly")).rejects.toMatchObject({ code: "GUEST" });
  });
});

describe("checkout confirmation", () => {
  it("checks the signature and the payment with Razorpay, then grants 30 days of Pro once", async () => {
    const { orderId } = await createOrder(asha, "monthly");
    razorpay.payments.set("pay_A", { id: "pay_A", order_id: orderId, amount: 29_900, currency: "INR", status: "captured", method: "upi" });
    await expect(verifyPayment(asha, { orderId, paymentId: "pay_A", signature: "0".repeat(64) })).rejects.toMatchObject({ code: "UNVERIFIED" });
    expect((await findUserById(asha.id))!.plan).toBe("free");

    await verifyPayment(asha, { orderId, paymentId: "pay_A", signature: checkoutSignature(orderId, "pay_A") });
    const first = (await findUserById(asha.id))!;
    expect(first.plan).toBe("pro");
    expect(Math.abs(first.planExpiresAt! - (Date.now() + 30 * DAY))).toBeLessThan(5000);
    expect(await db.get("SELECT status, payment_id, method FROM payments WHERE order_id = ?", orderId)).toMatchObject({ status: "paid", payment_id: "pay_A", method: "upi" });

    // The same confirmation again, and the webhook for it: no extra days.
    await verifyPayment(first, { orderId, paymentId: "pay_A", signature: checkoutSignature(orderId, "pay_A") });
    expect(await hook("payment.captured", { payment: { entity: razorpay.payments.get("pay_A") } }, "evt_dup_A")).toBe("processed");
    expect((await findUserById(asha.id))!.planExpiresAt).toBe(first.planExpiresAt);
  });

  it("refuses a validly signed payment that isn't for this order's amount", async () => {
    const { orderId } = await createOrder(asha, "monthly");
    razorpay.payments.set("pay_B", { id: "pay_B", order_id: orderId, amount: 100, currency: "INR", status: "captured", method: "card" });
    await expect(verifyPayment(asha, { orderId, paymentId: "pay_B", signature: checkoutSignature(orderId, "pay_B") })).rejects.toMatchObject({ code: "UNVERIFIED" });
    expect((await findUserById(asha.id))!.plan).toBe("free");
  });

  it("captures a payment that was only authorised", async () => {
    const { orderId } = await createOrder(asha, "monthly");
    razorpay.payments.set("pay_C", { id: "pay_C", order_id: orderId, amount: 29_900, currency: "INR", status: "authorized", method: "card" });
    await verifyPayment(asha, { orderId, paymentId: "pay_C", signature: checkoutSignature(orderId, "pay_C") });
    expect(razorpay.payments.get("pay_C")!.status).toBe("captured");
    expect((await findUserById(asha.id))!.plan).toBe("pro");
  });

  it("never confirms someone else's order", async () => {
    const { orderId } = await createOrder(asha, "monthly");
    await expect(verifyPayment(john, { orderId, paymentId: "pay_X", signature: checkoutSignature(orderId, "pay_X") })).rejects.toMatchObject({ code: "UNKNOWN_ORDER" });
    expect(await orderStatus(john, orderId)).toBeNull();
  });
});

describe("webhooks", () => {
  it("reject a body that isn't signed with the webhook secret", async () => {
    const raw = JSON.stringify({ event: "payment.captured", payload: {} });
    await expect(handleWebhook(raw, sign(raw, "wrong"), "evt_1")).rejects.toMatchObject({ code: "UNVERIFIED" });
    await expect(handleWebhook(raw, null, "evt_1")).rejects.toMatchObject({ code: "UNVERIFIED" });
  });

  it("grant Pro when the buyer closed the tab before confirming — and process each event once", async () => {
    const { orderId } = await createOrder(asha, "monthly");
    const payment = { id: "pay_D", order_id: orderId, amount: 29_900, currency: "INR", status: "captured", method: "upi" };
    expect(await hook("payment.captured", { payment: { entity: payment } }, "evt_D")).toBe("processed");
    const after = (await findUserById(asha.id))!;
    expect(after.plan).toBe("pro");
    expect(await orderStatus(asha, orderId)).toBe("paid");
    expect(await hook("payment.captured", { payment: { entity: payment } }, "evt_D")).toBe("duplicate");
    expect(await hook("order.paid", { payment: { entity: payment }, order: { entity: { id: orderId, status: "paid" } } }, "evt_D2")).toBe("processed");
    expect((await findUserById(asha.id))!.planExpiresAt).toBe(after.planExpiresAt);
  });

  it("record a failed attempt without undoing a payment that went through", async () => {
    const { orderId } = await createOrder(asha, "monthly");
    const failed = { id: "pay_E1", order_id: orderId, amount: 29_900, currency: "INR", status: "failed", error_description: "Payment was declined by the bank" };
    await hook("payment.failed", { payment: { entity: failed } }, "evt_E1");
    expect(await db.get("SELECT status, error FROM payments WHERE order_id = ?", orderId)).toMatchObject({ status: "failed", error: "Payment was declined by the bank" });
    // They try again on the same order, and it works; a late failure event changes nothing.
    await hook("payment.captured", { payment: { entity: { ...failed, id: "pay_E2", status: "captured" } } }, "evt_E2");
    await hook("payment.failed", { payment: { entity: { ...failed, id: "pay_E3" } } }, "evt_E3");
    expect(await db.get("SELECT status, error FROM payments WHERE order_id = ?", orderId)).toMatchObject({ status: "paid", error: null });
  });

  it("take back the days of a fully refunded payment", async () => {
    const { orderId } = await createOrder(asha, "monthly");
    await hook("payment.captured", { payment: { entity: { id: "pay_F", order_id: orderId, amount: 29_900, currency: "INR", status: "captured" } } }, "evt_F");
    await hook("refund.processed", { refund: { entity: { id: "rfnd_F", payment_id: "pay_F", amount: 29_900, status: "processed" } } }, "evt_F2");
    expect(await orderStatus(asha, orderId)).toBe("refunded");
    expect((await findUserById(asha.id))!.planExpiresAt!).toBeLessThan(Date.now() + 5000);
  });

  it("leave orders that aren't RamAI's alone", async () => {
    expect(await hook("payment.captured", { payment: { entity: { id: "pay_G", order_id: "order_elsewhere", amount: 100, currency: "INR", status: "captured" } } }, "evt_G")).toBe("ignored");
  });
});
