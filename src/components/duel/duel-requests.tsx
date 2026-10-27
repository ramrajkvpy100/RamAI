"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { success, tap } from "@/lib/haptics";

interface Req { id: string; duelId: string; from: string; at: number }

/** A doctor near you asked you to play the same patient: a card at the bottom, Play or Not now. */
export function DuelRequests() {
  const router = useRouter();
  const [reqs, setReqs] = useState<Req[]>([]);
  useEffect(() => {
    let off = false;
    const check = () => {
      if (document.hidden || !navigator.onLine) return;
      fetch("/api/duels/requests", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { requests: Req[] } | null) => {
          if (off || !d) return;
          setReqs((was) => {
            if (d.requests.some((r) => !was.some((w) => w.id === r.id))) success();
            return d.requests;
          });
        })
        .catch(() => undefined);
    };
    check();
    const t = setInterval(check, 45_000);
    document.addEventListener("visibilitychange", check);
    return () => { off = true; clearInterval(t); document.removeEventListener("visibilitychange", check); };
  }, []);
  const r = reqs[0];
  if (!r) return null;
  const answer = (accept: boolean) => {
    tap();
    setReqs((x) => x.filter((y) => y.id !== r.id));
    void fetch("/api/duels/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id, accept }) }).catch(() => undefined);
    if (accept) router.push(`/duel/${r.duelId}`);
  };
  return (
    <div role="alert" className="fixed inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] z-40 mx-auto max-w-md animate-enter rounded-2xl border border-accent-line bg-surface p-3.5 shadow-2xl sm:bottom-6">
      <p className="text-[14.5px] font-semibold">⚔️ {r.from} challenges you</p>
      <p className="mt-0.5 text-[13px] text-fg-2">A doctor near you wants to play the same patient — who scores higher?</p>
      <div className="mt-2.5 flex gap-2">
        <button type="button" onClick={() => answer(false)} className="h-10 flex-1 rounded-full border border-line text-[14px] font-medium">Not now</button>
        <button type="button" onClick={() => answer(true)} className="h-10 flex-1 rounded-full bg-accent text-[14px] font-semibold text-on-accent">Play ⚔️</button>
      </div>
    </div>
  );
}
