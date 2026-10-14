"use client";

import { useState } from "react";

import { loadRazorpay, type RazorpayFailure, type RazorpayResponse } from "@/components/pricing/pricing";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { ClinicalEngineError, donate, verifyDonation } from "@/lib/engine-client";

const PRESETS = [49, 99, 199, 499];
const MIN = 10;
const MAX = 50_000;

type Step = { step: "idle" } | { step: "starting" } | { step: "open" } | { step: "confirming" } | { step: "thanks"; rupees: number; pending?: boolean } | { step: "failed"; reason: string };

const FIELD = "w-full rounded-xl border border-line bg-surface px-3.5 text-[15px] shadow-sm outline-none transition-[border-color,box-shadow] placeholder:text-fg-3 focus:border-accent-line focus:shadow-[0_0_0_3px_var(--accent-soft)]";

/** Give to support RamAI — any amount from ₹10, through Razorpay (UPI, cards, netbanking, wallets). */
export function Donate({ available, testMode, name: defaultName }: { available: boolean; testMode: boolean; name?: string }) {
  const [preset, setPreset] = useState<number | null>(99);
  const [custom, setCustom] = useState("");
  const [name, setName] = useState(defaultName ?? "");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<Step>({ step: "idle" });
  const rupees = preset ?? Math.floor(Number(custom));
  const valid = Number.isInteger(rupees) && rupees >= MIN && rupees <= MAX;
  const busy = state.step === "starting" || state.step === "open" || state.step === "confirming";

  const give = async () => {
    if (!valid || busy) return;
    setState({ step: "starting" });
    try {
      const [{ order }, Razorpay] = await Promise.all([donate({ rupees, name: name.trim() || undefined, message: message.trim() || undefined }), loadRazorpay()]);
      let failure: Step | null = null;
      const rzp = new Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: "RamAI",
        description: order.mode === "test" ? "Support RamAI (TEST MODE)" : "Support RamAI",
        prefill: name.trim() ? { name: name.trim() } : {},
        notes: { kind: "donation" },
        theme: { color: "#2563eb" },
        retry: { enabled: true, max_count: 3 },
        handler: async (r: RazorpayResponse) => {
          setState({ step: "confirming" });
          try {
            await verifyDonation({ orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature });
            setState({ step: "thanks", rupees });
          } catch (err) {
            // Paid, but not confirmed from here: Razorpay tells us directly in a few minutes.
            if (err instanceof ClinicalEngineError && (err.code === "PAYMENT_PENDING" || err.retryable)) setState({ step: "thanks", rupees, pending: true });
            else setState({ step: "failed", reason: err instanceof ClinicalEngineError ? err.message : "We couldn't confirm the payment." });
          }
        },
        modal: { confirm_close: true, ondismiss: () => setState((s) => (s.step === "open" ? (failure ?? { step: "idle" }) : s)) },
      });
      rzp.on("payment.failed", (r: RazorpayFailure) => {
        failure = { step: "failed", reason: r.error?.description || "The payment didn't go through." };
      });
      setState({ step: "open" });
      rzp.open();
    } catch (err) {
      setState({ step: "failed", reason: err instanceof ClinicalEngineError ? err.message : "Razorpay couldn't be loaded. Check your connection and try again." });
    }
  };

  if (state.step === "thanks") {
    return (
      <div role="status" className="flex animate-enter items-start gap-3 rounded-2xl bg-success-soft p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success text-white">
          <Icon name="heart" size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-fg">Thank you for your ₹{state.rupees.toLocaleString("en-IN")} — it means a lot.</div>
          <p className="mt-0.5 text-[13.5px] leading-5 text-fg-2">{state.pending ? "Razorpay is still confirming it; that happens on its own within a few minutes." : "It goes straight into keeping RamAI running and free to start."}</p>
        </div>
        <button type="button" onClick={() => setState({ step: "idle" })} className="shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold text-accent-text hover:bg-surface-3">
          Give again
        </button>
      </div>
    );
  }

  if (!available) {
    return <p className="rounded-xl bg-surface-3 px-4 py-3 text-[14px] text-fg-2">Donations open very soon. Thank you for wanting to help!</p>;
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void give();
      }}
    >
      {testMode && <p className="rounded-xl bg-warning-soft px-3.5 py-2 text-[13px] font-medium text-warning">TEST MODE — no real money moves.</p>}
      <div role="radiogroup" aria-label="Amount" className="flex flex-wrap gap-2">
        {PRESETS.map((amount) => (
          <button
            key={amount}
            type="button"
            role="radio"
            aria-checked={preset === amount}
            onClick={() => setPreset(amount)}
            className={cn("h-11 min-w-[76px] rounded-full border px-4 text-[15px] font-semibold tabular transition-colors", preset === amount ? "border-accent bg-accent text-white" : "border-line bg-surface hover:bg-surface-3")}
          >
            ₹{amount}
          </button>
        ))}
        <label className={cn("flex h-11 items-center gap-1 rounded-full border px-4", preset === null ? "border-accent" : "border-line bg-surface")}>
          <span className="text-[15px] font-semibold text-fg-2">₹</span>
          <input
            inputMode="numeric"
            placeholder="Other"
            aria-label="Another amount, in rupees"
            value={custom}
            onFocus={() => setPreset(null)}
            onChange={(e) => {
              setPreset(null);
              setCustom(e.target.value.replace(/[^\d]/g, "").slice(0, 5));
            }}
            className="w-20 bg-transparent text-[15px] font-semibold tabular outline-none placeholder:font-normal placeholder:text-fg-3"
          />
        </label>
      </div>
      {preset === null && custom && !valid && <p className="text-[13px] text-danger">Between ₹{MIN} and ₹{MAX.toLocaleString("en-IN")}, please.</p>}
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-fg-2">
          Your name <span className="font-normal text-fg-3">(optional)</span>
        </span>
        <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className={cn(FIELD, "h-11 sm:max-w-sm")} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-fg-2">
          A note <span className="font-normal text-fg-3">(optional)</span>
        </span>
        <textarea value={message} maxLength={300} rows={2} onChange={(e) => setMessage(e.target.value)} className={cn(FIELD, "resize-y py-2.5 leading-6")} />
      </label>
      {state.step === "failed" && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft px-3.5 py-2.5 text-[13.5px] text-danger">
          <Icon name="alert" size={15} className="mt-0.5 shrink-0" />
          {state.reason}
        </p>
      )}
      <button type="submit" disabled={!valid || busy} className="bg-ai inline-flex h-11 items-center justify-center gap-2 self-start rounded-full px-6 text-[14.5px] font-semibold text-white shadow-glow transition-opacity disabled:opacity-50">
        <Icon name="heart" size={16} />
        {busy ? (state.step === "confirming" ? "Confirming…" : "Opening Razorpay…") : valid ? `Give ₹${rupees.toLocaleString("en-IN")}` : "Give"}
      </button>
      <p className="text-[12.5px] leading-5 text-fg-3">Paid securely through Razorpay — UPI, cards, netbanking or wallets. A gift doesn&apos;t buy anything.</p>
    </form>
  );
}
