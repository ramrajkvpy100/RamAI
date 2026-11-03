"use client";

import { useState } from "react";

import { INVITE_LADDER } from "@/lib/plans";

/** Invite colleagues: each one who signs in and finishes a case moves you up the ladder. */

export function InviteCard({ username, credits, friends, code, left }: { username: string; credits: number; friends: number; code: string | null; left: number }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window !== "undefined" ? `${window.location.origin}/invite?${code ? `code=${code}&` : ""}ref=${encodeURIComponent(username)}` : "";
  const share = async () => {
    const text = "I practise clinical cases on RamAI — you're the doctor. It's invite-only; here's my invite:";
    try {
      if (navigator.share) await navigator.share({ title: "RamAI", text, url: link });
      else {
        await navigator.clipboard.writeText(`${text} ${link}`);
        setCopied(true);
      }
    } catch {}
  };
  return (
    <section className="panel p-6" aria-labelledby="invite-heading">
      <h2 id="invite-heading" className="text-[17px] font-semibold">Invite colleagues 🎁</h2>
      <p className="mt-1 text-[14px] leading-6 text-fg-2">A colleague counts once they&apos;ve signed in with your link and finished a case. <b className="text-fg">{friends} so far.</b></p>
      <ol className="mt-4 flex flex-col gap-2">
        {INVITE_LADDER.map((step) => (
          <li key={step.friends} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] ${friends >= step.friends ? "bg-accent-soft text-accent-text" : "bg-surface-2 text-fg-2"}`}>
            <span className="w-14 shrink-0 font-semibold tabular">{friends >= step.friends ? "✓" : `${Math.min(friends, step.friends)}/${step.friends}`}</span>
            <span>{step.perk}</span>
          </li>
        ))}
      </ol>
      <div className="mt-4 grid grid-cols-2 gap-3 text-center">
        <div className="rounded-xl bg-surface-2 p-3"><div className="text-[22px] font-bold tabular">{credits}</div><div className="text-[12px] text-fg-2">free Pro cases left</div></div>
        <div className="rounded-xl bg-surface-2 p-3"><div className="text-[22px] font-bold tabular">{left}</div><div className="text-[12px] text-fg-2">invites left</div></div>
      </div>
      <button type="button" onClick={() => void share()} className="mt-4 h-11 w-full rounded-full bg-accent text-[14px] font-semibold text-on-accent">
        {copied ? "Link copied ✓" : left > 0 ? "Share your invite link" : "Share your link"}
      </button>
    </section>
  );
}
