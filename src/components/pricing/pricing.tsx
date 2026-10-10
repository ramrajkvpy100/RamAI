"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Icon } from "@/components/ui/icon";
import { checkout, ClinicalEngineError, demoUpgrade, verifyPayment } from "@/lib/engine-client";
import { refreshMe, useMe, type Me } from "@/lib/me-store";
import { PRICES, type BillingPeriod } from "@/lib/plans";

import { PeriodToggle, PlanCards } from "./plan-cards";

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}
interface RazorpayCtor {
  new (opts: Record<string, unknown>): { open: () => void; on: (event: string, cb: () => void) => void };
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

const BTN_DARK = "flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white text-[14px] font-semibold text-[#0b1220] transition-colors hover:bg-white/90 disabled:opacity-60";
const BTN_LIGHT = "flex h-11 w-full items-center justify-center rounded-full border border-line bg-surface text-[14px] font-semibold shadow-sm hover:bg-surface-3";

export function Pricing({ initial }: { initial: Me | null }) {
  const live = useMe(initial ?? undefined);
  const me = initial ? (live ?? initial) : null;
  const router = useRouter();
  const [period, setPeriod] = useState<BillingPeriod>("yearly");
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  // Consumer law (UK/EU digital content): Pro may only start inside the cancellation period if the buyer asks for it.
  const [startNow, setStartNow] = useState(false);

  const done = async () => {
    await refreshMe();
    router.refresh();
    setDemo(false);
    setMessage({ tone: "success", text: "You're on RamAI Pro. Every level is unlocked." });
  };

  const upgrade = async () => {
    setBusy(true);
    setMessage(null);
    try {
      if (!startNow) {
        setMessage({ tone: "error", text: "Please tick the box to confirm Pro should start straight away." });
        return;
      }
      const res = await checkout(period, true);
      if (res.mode === "demo") {
        setDemo(true);
        return;
      }
      const Razorpay = await loadRazorpay();
      const rzp = new Razorpay({
        key: res.order.keyId,
        order_id: res.order.orderId,
        amount: res.order.amount,
        currency: res.order.currency,
        name: "RamAI",
        description: `RamAI Pro — ${period === "yearly" ? "1 year" : "1 month"}`,
        prefill: { name: res.order.name, email: res.order.email },
        theme: { color: "#2563eb" },
        handler: async (r: RazorpayResponse) => {
          try {
            await verifyPayment({ orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature });
            await done();
          } catch (err) {
            setMessage({ tone: "error", text: err instanceof ClinicalEngineError ? err.message : "We couldn't confirm the payment. Please keep your Razorpay payment ID for reference." });
          }
        },
      });
      rzp.open();
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof ClinicalEngineError ? err.message : "Payments aren't available right now." });
    } finally {
      setBusy(false);
    }
  };

  const activateDemo = async () => {
    setBusy(true);
    try {
      await demoUpgrade();
      await done();
    } catch {
      setMessage({ tone: "error", text: "Demo upgrade isn't available." });
    } finally {
      setBusy(false);
    }
  };

  const isPro = me?.user.plan === "pro";
  const until = me?.user.planExpiresAt ? new Date(me.user.planExpiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : null;

  const proAction = !me ? (
    <Link href="/signup?next=/pricing" className={BTN_DARK}>
      Get Pro
    </Link>
  ) : isPro ? (
    <div className="flex flex-col gap-2">
      <div className="flex h-11 items-center justify-center gap-2 rounded-full bg-white/10 text-[14px] font-semibold">
        <Icon name="check" size={15} /> Your plan{until ? ` · until ${until}` : ""}
      </div>
      <button type="button" onClick={() => void upgrade()} disabled={busy} className="h-9 text-[13px] font-medium text-white/70 hover:text-white">
        Extend by {period === "yearly" ? "a year" : "a month"} — {PRICES[period].label}
      </button>
    </div>
  ) : (
    <button type="button" onClick={() => void upgrade()} disabled={busy} className={BTN_DARK}>
      {busy ? "Opening checkout…" : `Upgrade — ${PRICES[period].label}`}
    </button>
  );

  const freeAction = !me ? (
    <Link href="/signup" className={BTN_LIGHT}>
      Start free
    </Link>
  ) : (
    <div className="flex h-11 items-center justify-center rounded-full bg-surface-3 text-[14px] font-medium text-fg-2">{isPro ? "Included in Pro" : "Your plan"}</div>
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center">
      <h1 className="text-center text-[34px] leading-[1.08] font-semibold tracking-[-0.035em] text-balance sm:text-[44px]">
        Practise without <span className="text-gradient">limits.</span>
      </h1>
      <p className="mt-4 max-w-xl text-center text-[15.5px] leading-7 text-fg-2">Unlimited cases at every level — teaching hospital, national referral centre and global centre of excellence included.</p>
      <div className="mt-8">
        <PeriodToggle value={period} onChange={setPeriod} />
      </div>

      {message && (
        <p role="status" className={`mt-6 flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-medium ${message.tone === "success" ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
          <Icon name={message.tone === "success" ? "check" : "alert"} size={15} />
          {message.text}
        </p>
      )}

      {demo && (
        <div className="mt-6 flex w-full max-w-xl flex-col items-center gap-3 rounded-2xl border border-dashed border-warning bg-warning-soft px-5 py-4 text-center sm:flex-row sm:text-left">
          <p className="flex-1 text-[13.5px] text-fg">
            <span className="font-semibold">Development mode.</span> Payments aren&apos;t configured, so Pro can be activated for 30 days without paying.
          </p>
          <button type="button" onClick={() => void activateDemo()} disabled={busy} className="h-9 shrink-0 rounded-full bg-fg px-4 text-[13px] font-semibold text-bg">
            Activate demo Pro
          </button>
        </div>
      )}

      {me && (
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

      <div className="mt-8 w-full">
        <PlanCards period={period} free={freeAction} pro={proAction} />
      </div>
      <p className="mt-6 text-center text-[12.5px] leading-6 text-fg-3">
        One-time payment for 30 or 365 days — no auto-renewal. 7-day money-back guarantee.{" "}
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
