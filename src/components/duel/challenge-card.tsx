"use client";

import { useState } from "react";

import { cn } from "@/lib/cn";
import { useMe } from "@/lib/me-store";

/** "Beat my score": this exact patient, for a colleague to play whenever they open the link. */
export function ChallengeCard({ token, score, className }: { token: string; score: number; className?: string }) {
  const me = useMe();
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  if (!me || me.user.isGuest) return null;
  const text = (url: string) => `I scored ${score}/100 on this patient on RamAI. Same patient, your turn — can you beat it? ${url}`;
  const make = async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/duel/challenge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const data = (await res.json()) as { id?: string; error?: { message?: string } };
      if (!res.ok || !data.id) throw new Error(data.error?.message ?? "Couldn't make the link. Please try again.");
      setLink(`${window.location.origin}/duel/${data.id}`);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Couldn't make the link. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-label="Challenge a colleague" className={cn("flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-4", className)}>
      <div className="min-w-[200px] flex-1">
        <h2 className="text-[15px] font-semibold">⚔️ Challenge a colleague on this exact patient</h2>
        <p className="mt-0.5 text-[13px] leading-5 text-fg-2">They can play it whenever they open the link. You&apos;ll both see who scored higher.</p>
        {note && <p role="alert" className="mt-1 text-[12.5px] text-danger">{note}</p>}
      </div>
      {link ? (
        <a href={`https://wa.me/?text=${encodeURIComponent(text(link))}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-full bg-success px-4 text-[13.5px] font-semibold text-white">Send on WhatsApp</a>
      ) : (
        <button type="button" disabled={busy} onClick={() => void make()} className="h-10 rounded-full bg-accent px-4 text-[13.5px] font-semibold text-on-accent disabled:opacity-60">{busy ? "Making the link…" : "Beat my score"}</button>
      )}
    </section>
  );
}
