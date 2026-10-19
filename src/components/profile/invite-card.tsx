"use client";

import { useState } from "react";

/** Invite friends: each friend who signs up gives you both free Pro cases. */
const PRO_AT = 3;

export function InviteCard({ username, credits, friends, code, left }: { username: string; credits: number; friends: number; code: string | null; left: number }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window !== "undefined" ? `${window.location.origin}/invite?${code ? `code=${code}&` : ""}ref=${encodeURIComponent(username)}` : "";
  const share = async () => {
    const text = "I practise clinical cases on RamAI — you're the doctor. It's invite-only; here's my invite. Join with it and we both get 10 free Pro cases:";
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
      <h2 id="invite-heading" className="text-[17px] font-semibold">Invite friends 🎁</h2>
      <p className="mt-1 text-[14px] leading-6 text-fg-2">Each friend who joins with your link: <b className="text-fg">10 free Pro cases for both of you</b>. Your 3rd friend unlocks <b className="text-fg">a month of Pro free</b>.</p>
      <div className="mt-4 flex items-center gap-2" aria-label={`${Math.min(friends, PRO_AT)} of ${PRO_AT} friends towards a month of Pro`}>
        {Array.from({ length: PRO_AT }, (_, i) => (
          <div key={i} className={`h-2 flex-1 rounded-full ${i < friends ? "bg-accent" : "bg-surface-3"}`} />
        ))}
        <span className="ml-1 text-[12.5px] font-semibold whitespace-nowrap">{friends >= PRO_AT ? "Pro unlocked 🎉" : `${friends}/${PRO_AT} → 1 month Pro`}</span>
      </div>
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
