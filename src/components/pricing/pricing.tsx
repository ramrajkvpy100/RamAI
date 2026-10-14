"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { checkout, ClinicalEngineError, demoUpgrade, orderStatus, verifyPayment, type CheckoutOrder } from "@/lib/engine-client";
import { refreshMe, useMe, type Me } from "@/lib/me-store";
import type { Country } from "@/engine/countries";
import { priceFor, PRO_FOR_EVERYONE } from "@/lib/plans";

import { PlanCards } from "./plan-cards";

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}
interface RazorpayFailure {
  error?: { description?: string; reason?: string; metadata?: { order_id?: string; payment_id?: string } };
}
interface RazorpayCtor {
  new (opts: Record<string, unknown>): { open: () => void; on: (event: "payment.failed", cb: (r: RazorpayFailure) => void) => void };
}

/** What the server says about payments (no secrets — the mode comes from the key's prefix). */
export interface BillingInfo {
  available: boolean;
  mode: "test" | "live" | null;
  international: boolean;
}

function loadRazorpay(): Promise<RazorpayCtor> {
  const w = window as unknown as { Razorpay?: RazorpayCtor };
  if (w.Razorpay) return Promise.resolve(w.Razorpay);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => (w.Razorpay ? resolve(w.Razorpay) : reject(new Error("Razorpay unavailable")));
    s.onerror = () => reject(new Error("Razorpay unavailable"));
    document.body.appendChild(s);
  });
}

/** Where a payment is — every state says what happened and what to do next. */
type Pay =
  | { step: "idle" }
  | { step: "starting" }
  | { step: "open" }
  | { step: "confirming" }
  | { step: "pending"; orderId: string; paymentId: string }
  | { step: "paid" }
  | { step: "cancelled" }
  | { step: "failed"; reason: string; paymentId?: string };

const BTN_DARK = "flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white text-[14px] font-semibold text-[#0b1220] transition-colors hover:bg-white/90 disabled:opacity-60";
const BTN_LIGHT = "flex h-11 w-full items-center justify-center rounded-full border border-line bg-surface text-[14px] font-semibold shadow-sm hover:bg-surface-3";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function Pricing({ initial, visitorCountry = "IN", billing = { available: false, mode: null, international: false } }: { initial: Me | null; /** Without an account: where they're browsing from. */ visitorCountry?: Country; billing?: BillingInfo }) {
  const live = useMe(initial ?? undefined);
  const me = initial ? (live ?? initial) : null;
  const country = me?.user.country ?? visitorCountry;
  const router = useRouter();
  const [pay, setPay] = useState<Pay>({ step: "idle" });
  const [demo, setDemo] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Consumer law (UK/EU digital content): Pro may only start inside the cancellation period if the buyer asks for it.
  const [startNow, setStartNow] = useState(false);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  const price = priceFor(country, "monthly");
  const abroad = price.currency !== "INR";
  const internationalBlocked = abroad && !billing.international;
  const testMode = billing.mode === "test";
  // While Pro is free for everyone, only admins see the checkout — and only in TEST MODE — to try it end to end.
  const testCheckout = PRO_FOR_EVERYONE && testMode && !!me?.admin;
  const busy = pay.step === "starting" || pay.step === "open" || pay.step === "confirming" || pay.step === "pending";

  const done = async () => {
    await refreshMe();
    router.refresh();
    setDemo(false);
    setPay({ step: "paid" });
  };

  /** The browser couldn't confirm it: the webhook may have. Checks for two minutes. */
  const waitForWebhook = async (orderId: string, paymentId: string) => {
    setPay({ step: "pending", orderId, paymentId });
    for (let i = 0; i < 24 && alive.current; i++) {
      await sleep(5000);
      const s = await orderStatus(orderId).catch(() => null);
      if (s?.status === "paid") return done();
      if (s?.status === "failed") return setPay({ step: "failed", reason: "The payment didn't go through.", paymentId });
    }
  };

  const confirm = async (r: RazorpayResponse) => {
    setPay({ step: "confirming" });
    try {
      await verifyPayment({ orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature });
      await done();
    } catch (err) {
      if (err instanceof ClinicalEngineError && (err.code === "PAYMENT_PENDING" || err.retryable)) return waitForWebhook(r.razorpay_order_id, r.razorpay_payment_id);
      setPay({ step: "failed", reason: err instanceof ClinicalEngineError ? err.message : "We couldn't confirm the payment.", paymentId: r.razorpay_payment_id });
    }
  };

  const open = (order: CheckoutOrder, Razorpay: RazorpayCtor) => {
    let failure: Pay | null = null;
    const rzp = new Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: "RamAI",
      description: order.mode === "test" ? `${order.description} (TEST MODE)` : order.description,
      prefill: { name: order.name, email: order.email },
      notes: { product: "RamAI Pro" },
      theme: { color: "#2563eb" },
      // Razorpay lets them try another method inside the window after a failed attempt.
      retry: { enabled: true, max_count: 3 },
      handler: (r: RazorpayResponse) => void confirm(r),
      modal: {
        confirm_close: true,
        // Closed without paying: cancelled — unless an attempt failed first, which says why.
        ondismiss: () => setPay((p) => (p.step === "open" ? (failure ?? { step: "cancelled" }) : p)),
      },
    });
    rzp.on("payment.failed", (r) => {
      failure = { step: "failed", reason: r.error?.description || "The payment didn't go through.", paymentId: r.error?.metadata?.payment_id };
    });
    setPay({ step: "open" });
    rzp.open();
  };

  const upgrade = async () => {
    setNotice(null);
    if (!startNow) {
      setNotice("Please tick the box to confirm Pro should start straight away.");
      return;
    }
    setPay({ step: "starting" });
    try {
      const [res, Razorpay] = await Promise.all([checkout("monthly", true), loadRazorpay()]);
      if (res.mode === "demo") {
        setDemo(true);
        setPay({ step: "idle" });
        return;
      }
      open(res.order, Razorpay);
    } catch (err) {
      setPay({
        step: "failed",
        reason: err instanceof ClinicalEngineError ? err.message : "Razorpay's checkout couldn't load. Check your connection and try again.",
      });
    }
  };

  const activateDemo = async () => {
    try {
      await demoUpgrade();
      await done();
    } catch {
      setNotice("Demo upgrade isn't available.");
    }
  };

  const isPro = me?.user.plan === "pro";
  const until = me?.user.planExpiresAt ? new Date(me.user.planExpiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : null;
  const canPay = !!me && !me.user.isGuest && (billing.available || demo) && !internationalBlocked;
  const label = pay.step === "starting" ? "Opening secure checkout…" : pay.step === "open" ? "Complete the payment in the Razorpay window" : pay.step === "confirming" || pay.step === "pending" ? "Confirming your payment…" : null;

  const buyButton = (text: string, className: string) =>
    internationalBlocked ? (
      <div className="flex min-h-11 items-center justify-center rounded-full bg-white/10 px-4 text-center text-[13px] font-medium text-white/80">Card payments from outside India open soon</div>
    ) : me?.user.isGuest ? (
      <Link href="/signup?next=/pricing" className={BTN_DARK}>
        Create a free account to get Pro
      </Link>
    ) : (
      <button type="button" onClick={() => void upgrade()} disabled={busy || !canPay} className={className}>
        {busy && <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
        {label ?? text}
      </button>
    );

  const proAction = PRO_FOR_EVERYONE && !isPro ? (
    me ? (
      <div className="flex h-11 items-center justify-center gap-2 rounded-full bg-white/10 text-[14px] font-semibold">
        <Icon name="check" size={15} /> Included — free for now
      </div>
    ) : (
      <Link href="/signup" className={BTN_DARK}>
        Start free — Pro included
      </Link>
    )
  ) : !me ? (
    <Link href="/signup?next=/pricing" className={BTN_DARK}>
      Get Pro
    </Link>
  ) : isPro ? (
    <div className="flex flex-col gap-2">
      <div className="flex h-11 items-center justify-center gap-2 rounded-full bg-white/10 text-[14px] font-semibold">
        <Icon name="check" size={15} /> Your plan{until ? ` · until ${until}` : ""}
      </div>
      {!PRO_FOR_EVERYONE && buyButton(`Extend by a month — ${price.label}`, "flex h-9 items-center justify-center gap-2 text-[13px] font-medium text-white/70 hover:text-white disabled:opacity-60")}
    </div>
  ) : (
    buyButton(`Upgrade — ${price.label}`, BTN_DARK)
  );

  const freeAction = !me ? (
    <Link href="/signup" className={BTN_LIGHT}>
      Start free
    </Link>
  ) : (
    <div className="flex h-11 items-center justify-center rounded-full bg-surface-3 text-[14px] font-medium text-fg-2">{isPro || PRO_FOR_EVERYONE ? "Included in Pro" : "Your plan"}</div>
  );

  const showsCheckout = !!me && (!PRO_FOR_EVERYONE || testCheckout);

  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center">
      <h1 className="text-center text-[34px] leading-[1.08] font-semibold tracking-[-0.035em] text-balance sm:text-[44px]">
        Practise without <span className="text-gradient">limits.</span>
      </h1>
      <p className="mt-4 max-w-xl text-center text-[15.5px] leading-7 text-fg-2">Unlimited cases at every level — teaching hospital, national referral centre and global centre of excellence included.</p>
      {PRO_FOR_EVERYONE && (
        <p className="mt-7 flex items-center gap-2 rounded-full bg-success-soft px-4 py-2 text-[13.5px] font-semibold text-success">
          <Icon name="sparkles" size={15} /> Pro is free for everyone right now — no payment needed.
        </p>
      )}

      {showsCheckout && testMode && (
        <p className="mt-6 flex max-w-xl items-center gap-2 rounded-xl border border-dashed border-warning bg-warning-soft px-4 py-2.5 text-[13px] text-fg">
          <Icon name="flask" size={15} className="shrink-0 text-warning" />
          <span>
            <span className="font-semibold">TEST MODE</span> — no real money moves. Pay with Razorpay&apos;s test UPI ID <code className="font-mono">success@razorpay</code> or test card 4111 1111 1111 1111.
          </span>
        </p>
      )}

      <PaymentStatus pay={pay} onRetry={() => void upgrade()} onDismiss={() => setPay({ step: "idle" })} />

      {notice && (
        <p role="alert" className="mt-6 flex items-center gap-2 rounded-xl bg-danger-soft px-4 py-2.5 text-[13.5px] font-medium text-danger">
          <Icon name="alert" size={15} /> {notice}
        </p>
      )}

      {demo && (
        <div className="mt-6 flex w-full max-w-xl flex-col items-center gap-3 rounded-2xl border border-dashed border-warning bg-warning-soft px-5 py-4 text-center sm:flex-row sm:text-left">
          <p className="flex-1 text-[13.5px] text-fg">
            <span className="font-semibold">Development mode.</span> Payments aren&apos;t configured, so Pro can be activated for 30 days without paying.
          </p>
          <button type="button" onClick={() => void activateDemo()} className="h-9 shrink-0 rounded-full bg-fg px-4 text-[13px] font-semibold text-bg">
            Activate demo Pro
          </button>
        </div>
      )}

      {showsCheckout && !me.user.isGuest && !internationalBlocked && (
        <label className="mt-6 flex max-w-xl cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-surface px-4 py-3 text-left text-[13px] leading-5 text-fg-2">
          <input type="checkbox" checked={startNow} onChange={(e) => setStartNow(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]" />
          <span>
            Start Pro as soon as I pay. I understand that where the law gives a 14-day right to cancel digital purchases (such as in the UK or EU),
            I lose it once Pro starts — RamAI&apos;s{" "}
            <Link href="/refund-policy" className="font-medium text-accent-text hover:underline">
              7-day money-back guarantee
            </Link>{" "}
            still applies.
          </span>
        </label>
      )}

      {testCheckout && (
        <div className="mt-4 flex w-full max-w-xl flex-col items-center gap-3 rounded-2xl border border-line bg-surface px-5 py-4 text-center sm:flex-row sm:text-left">
          <p className="flex-1 text-[13px] leading-5 text-fg-2">
            <span className="font-semibold text-fg">Admin test checkout.</span> Only you see this while Pro is free. A test payment adds 30 days of Pro to your account.
          </p>
          <div className="w-full shrink-0 sm:w-56">{buyButton(`Test payment — ${price.label}`, "flex h-10 w-full items-center justify-center gap-2 rounded-full bg-fg px-4 text-[13px] font-semibold text-bg disabled:opacity-60")}</div>
        </div>
      )}

      <div className="mt-8 w-full">
        <PlanCards free={freeAction} pro={proAction} country={country} />
      </div>
      <p className="mt-6 text-center text-[12.5px] leading-6 text-fg-3">
        One-time payment for 30 days — no auto-renewal. UPI, cards, netbanking and wallets through Razorpay. 7-day money-back guarantee.{" "}
        <Link href="/refund-policy" className="underline underline-offset-2 hover:text-fg">
          Refund policy
        </Link>{" "}
        ·{" "}
        <Link href="/terms" className="underline underline-offset-2 hover:text-fg">
          Terms
        </Link>
      </p>
    </div>
  );
}

/** One line for where the payment is: what happened, and the next step. */
function PaymentStatus({ pay, onRetry, onDismiss }: { pay: Pay; onRetry: () => void; onDismiss: () => void }) {
  if (pay.step === "idle" || pay.step === "starting" || pay.step === "open") return null;
  const box = "mt-6 flex w-full max-w-xl flex-col gap-3 rounded-2xl px-5 py-4 text-[13.5px] sm:flex-row sm:items-center";
  const retry = (
    <div className="flex shrink-0 gap-2">
      <button type="button" onClick={onRetry} className="h-9 rounded-full bg-fg px-4 text-[13px] font-semibold text-bg">
        Try again
      </button>
      <button type="button" onClick={onDismiss} className="h-9 rounded-full px-3 text-[13px] font-medium text-fg-2 hover:text-fg">
        Close
      </button>
    </div>
  );
  if (pay.step === "confirming" || pay.step === "pending") {
    return (
      <div role="status" className={`${box} bg-surface-2 text-fg`}>
        <span aria-hidden className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <p className="flex-1">
          {pay.step === "confirming" ? (
            "Payment received — confirming it with Razorpay…"
          ) : (
            <>
              Your payment is being confirmed. This can take a minute — keep this page open, or come back later: Pro starts automatically. Payment ID <code className="font-mono text-[12px]">{pay.paymentId}</code>
            </>
          )}
        </p>
      </div>
    );
  }
  if (pay.step === "paid") {
    return (
      <div role="status" className={`${box} bg-success-soft text-success`}>
        <Icon name="check" size={16} className="shrink-0" />
        <p className="flex-1 font-semibold">Payment successful — you&apos;re on RamAI Pro. Every level is unlocked.</p>
        <Link href="/" className="h-9 shrink-0 rounded-full bg-success px-4 text-[13px] leading-9 font-semibold text-white">
          Start a case
        </Link>
      </div>
    );
  }
  if (pay.step === "cancelled") {
    return (
      <div role="status" className={`${box} bg-surface-2 text-fg`}>
        <Icon name="info" size={16} className="shrink-0 text-fg-2" />
        <p className="flex-1">Payment cancelled — you haven&apos;t been charged.</p>
        {retry}
      </div>
    );
  }
  return (
    <div role="alert" className={`${box} bg-danger-soft text-danger`}>
      <Icon name="alert" size={16} className="shrink-0" />
      <p className="flex-1">
        <span className="font-semibold">Payment failed.</span> {pay.reason} Any money taken for a failed payment is returned by your bank automatically.
        {pay.paymentId && (
          <>
            {" "}
            Reference <code className="font-mono text-[12px]">{pay.paymentId}</code>
          </>
        )}
      </p>
      {retry}
    </div>
  );
}
