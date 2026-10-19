"use client";

import Link from "next/link";
import { useState } from "react";

import { Wordmark } from "@/components/brand/wordmark";

/** The front door while RamAI is invite-only: an invite code, or sign in. */
export function InviteGate({ next, signedInNeedsCode }: { next: string; signedInNeedsCode: boolean }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/access/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      window.location.href = signedInNeedsCode ? next : `/signup?next=${encodeURIComponent(next)}`;
      return;
    }
    const j = (await res?.json().catch(() => null)) as { error?: { message?: string } } | null;
    setError(j?.error?.message ?? "That didn't work — check the code and try again.");
  };
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-bg px-5 py-12">
      <div className="w-full max-w-sm text-center">
        <Wordmark className="mx-auto" />
        <h1 className="mt-8 text-[26px] font-semibold tracking-[-0.02em]">RamAI is invite-only</h1>
        <p className="mt-2 text-[14.5px] leading-6 text-fg-2">
          {signedInNeedsCode ? "Your account needs an invite code to continue." : "Clinical cases where you're the doctor — for invited doctors and students. Enter your invite code to join."}
        </p>
        <form
          className="mt-6 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 12))}
            placeholder="INVITE CODE"
            autoFocus
            autoComplete="off"
            className="h-14 rounded-2xl border border-line bg-surface px-4 text-center text-[20px] font-semibold tracking-[0.25em] outline-none focus:border-accent-line"
            aria-label="Invite code"
          />
          <button type="submit" disabled={busy || code.replace(/-/g, "").length < 6} className="h-12 rounded-full bg-accent text-[15px] font-semibold text-on-accent disabled:opacity-50">
            {busy ? "Checking…" : "Join with this code"}
          </button>
          {error && <p className="text-[13px] text-danger">{error}</p>}
        </form>
        {!signedInNeedsCode && (
          <p className="mt-6 text-[13.5px] text-fg-2">
            Already invited? <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-accent-text underline">Sign in</Link>
          </p>
        )}
        <p className="mt-10 text-[12px] text-fg-3">No code? Ask the doctor who told you about RamAI.</p>
      </div>
    </main>
  );
}
