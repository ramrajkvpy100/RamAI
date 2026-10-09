"use client";

import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { PLANS, PRICES } from "@/lib/plans";

import type { Gate } from "./use-launcher";

export function UpgradeSheet({ gate, onClose }: { gate: Gate | null; onClose: () => void }) {
  if (gate?.code === "SIGNUP_REQUIRED") return <SignupSheet gate={gate} onClose={onClose} />;
  const daily = gate?.code === "DAILY_LIMIT";
  return (
    <Sheet open={!!gate} onClose={onClose} title={daily ? "That's today's free cases" : "Unlock with Pro"} placement="center">
      <div className="flex flex-col items-center pb-1 text-center">
        <span className="bg-ai flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-glow">
          <Icon name="crown" size={26} strokeWidth={1.8} />
        </span>
        <p className="mt-4 max-w-sm text-[14.5px] leading-6 text-fg-2">{gate?.message}</p>
        <ul className="mt-5 flex w-full flex-col gap-2 text-left">
          {PLANS.pro.features.slice(0, 3).map((f) => (
            <li key={f} className="flex items-center gap-2.5 rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13.5px]">
              <Icon name="check" size={14} strokeWidth={2.2} className="text-success" />
              {f}
            </li>
          ))}
        </ul>
        <Link href="/pricing" className="shine mt-6 flex h-12 w-full items-center justify-center rounded-full text-[15px] font-semibold text-white shadow-glow">
          Go Pro — from ₹{Math.round(PRICES.yearly.amount / 12)}/month
        </Link>
        <button type="button" onClick={onClose} className="mt-2 h-10 text-[13.5px] font-medium text-fg-2 hover:text-fg">
          Not now
        </button>
      </div>
    </Sheet>
  );
}

/** Guests have played the demo; everything else starts with a free account. */
function SignupSheet({ gate, onClose }: { gate: Gate; onClose: () => void }) {
  return (
    <Sheet open onClose={onClose} title="Create your free account" placement="center">
      <div className="flex flex-col items-center pb-1 text-center">
        <span className="bg-ai flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-glow">
          <Icon name="user" size={26} strokeWidth={1.8} />
        </span>
        <p className="mt-4 max-w-sm text-[14.5px] leading-6 text-fg-2">{gate.message}</p>
        <ul className="mt-5 flex w-full flex-col gap-2 text-left">
          {["3 free cases every day", "Your demo case, streak and XP are kept", "Weekly leagues and ranks"].map((f) => (
            <li key={f} className="flex items-center gap-2.5 rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13.5px]">
              <Icon name="check" size={14} strokeWidth={2.2} className="text-success" />
              {f}
            </li>
          ))}
        </ul>
        <Link href="/signup" className="shine mt-6 flex h-12 w-full items-center justify-center rounded-full text-[15px] font-semibold text-white shadow-glow">
          Create free account
        </Link>
        <button type="button" onClick={onClose} className="mt-2 h-10 text-[13.5px] font-medium text-fg-2 hover:text-fg">
          Not now
        </button>
      </div>
    </Sheet>
  );
}
