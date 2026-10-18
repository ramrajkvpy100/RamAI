"use client";

import { useState } from "react";

/** Invite friends: each friend who signs up gives you both free Pro cases. */
export function InviteCard({ username, credits, friends }: { username: string; credits: number; friends: number }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window !== "undefined" ? `${window.location.origin}/?ref=${encodeURIComponent(username)}` : `/?ref=${username}`;
  const share = async () => {
    const text = "I practise clinical cases on RamAI — you're the doctor. Sign up with my link and we both get 5 free Pro cases:";
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
      <p className="mt-1 text-[14px] leading-6 text-fg-2">Each friend who signs up with your link gets 5 free Pro cases — and so do you.</p>
      <div className="mt-4 grid grid-cols-2 gap-3 text-center">
        <div className="rounded-xl bg-surface-2 p-3"><div className="text-[22px] font-bold tabular">{credits}</div><div className="text-[12px] text-fg-2">free Pro cases left</div></div>
        <div className="rounded-xl bg-surface-2 p-3"><div className="text-[22px] font-bold tabular">{friends}</div><div className="text-[12px] text-fg-2">friends joined</div></div>
      </div>
      <button type="button" onClick={() => void share()} className="mt-4 h-11 w-full rounded-full bg-accent text-[14px] font-semibold text-on-accent">
        {copied ? "Link copied ✓" : "Share your invite link"}
      </button>
    </section>
  );
}
