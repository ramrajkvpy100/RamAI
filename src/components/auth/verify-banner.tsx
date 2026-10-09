"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { ClinicalEngineError, requestVerification } from "@/lib/engine-client";
import type { Me } from "@/lib/me-store";
import { cn } from "@/lib/cn";

type SendState = { kind: "idle" } | { kind: "busy" } | { kind: "sent"; devLink?: string } | { kind: "error"; message: string };

/** Sends a fresh verification link. Without an email provider (local use), offers the link directly. */
export function ResendVerification({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<SendState>({ kind: "idle" });
  const send = async () => {
    setState({ kind: "busy" });
    try {
      const res = await requestVerification();
      if (res.verified) return window.location.reload();
      setState({ kind: "sent", devLink: res.devLink });
    } catch (err) {
      setState({ kind: "error", message: err instanceof ClinicalEngineError && err.code !== "NETWORK" ? err.message : "Couldn't send it. Please try again." });
    }
  };
  if (state.kind === "sent") {
    return (
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
        <span className="flex items-center gap-1.5 font-medium text-success">
          <Icon name="check" size={14} strokeWidth={2.2} /> Sent — check your inbox
        </span>
        {state.devLink && (
          <a href={state.devLink} className="font-semibold text-accent-text underline-offset-2 hover:underline" title="Email isn't configured on this server, so the link is shown here">
            Open link (no email set up)
          </a>
        )}
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <button
        type="button"
        onClick={() => void send()}
        disabled={state.kind === "busy"}
        className={cn("inline-flex items-center gap-1.5 rounded-full font-semibold transition-colors disabled:opacity-60", compact ? "h-8 bg-fg px-3.5 text-[12.5px] text-bg hover:opacity-90" : "h-11 bg-fg px-5 text-[14px] text-bg hover:opacity-90")}
      >
        {state.kind === "busy" ? "Sending…" : "Send verification email"}
      </button>
      {state.kind === "error" && <span className="text-[12.5px] text-danger">{state.message}</span>}
    </span>
  );
}

const DISMISS_KEY = "ramai.verify.dismissed";

/** A gentle, dismissible reminder for unverified accounts; guests get a sign-up nudge instead. */
export function VerifyBanner({ me }: { me: Me }) {
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      setHidden(sessionStorage.getItem(DISMISS_KEY) === me.user.id);
    } catch {
      setHidden(false);
    }
  }, [me.user.id]);

  if (me.user.emailVerified && !me.user.isGuest) return null;
  if (hidden) return null;
  const dismiss = () => {
    setHidden(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, me.user.id);
    } catch {}
  };

  return (
    <div role="status" className="mb-5 flex animate-enter flex-col gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 shadow-sm sm:flex-row sm:items-center">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-text">
        <Icon name={me.user.isGuest ? "user" : "mail"} size={17} />
      </span>
      <div className="min-w-0 flex-1 text-[13.5px] leading-5">
        {me.user.isGuest ? (
          <>
            <div className="font-semibold">You're trying RamAI as a guest</div>
            <div className="text-fg-2">Create a free account to keep your progress, build a streak and join the weekly league.</div>
          </>
        ) : (
          <>
            <div className="font-semibold">Verify your email to join the weekly league</div>
            <div className="truncate text-fg-2">
              We sent a link to <span className="font-medium text-fg">{me.user.email}</span>. It also lets you reset your password.
            </div>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        {me.user.isGuest ? (
          <Link href="/signup" className="bg-ai inline-flex h-8 items-center rounded-full px-3.5 text-[12.5px] font-semibold text-white">
            Create free account
          </Link>
        ) : (
          <ResendVerification compact />
        )}
        <button type="button" onClick={dismiss} aria-label="Dismiss" className="flex h-8 w-8 items-center justify-center rounded-full text-fg-3 hover:bg-surface-3 hover:text-fg">
          <Icon name="x" size={14} />
        </button>
      </div>
    </div>
  );
}
