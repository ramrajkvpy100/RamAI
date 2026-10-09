"use client";

import Link from "next/link";
import { useState } from "react";

import { ClinicalEngineError, forgotPassword } from "@/lib/engine-client";

import { AuthFrame, AuthNotice, Field, FormError, SECONDARY_LINK, SubmitButton } from "./auth-ui";

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof ClinicalEngineError && err.code === "RATE_LIMITED" ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame>
      {sent ? (
        <AuthNotice
          tone="info"
          title="Check your email"
          actions={
            <Link href="/login" className={SECONDARY_LINK}>
              Back to log in
            </Link>
          }
        >
          If an account exists for <span className="font-medium text-fg">{email.trim()}</span>, a link to reset your password is on its way. It works for one hour.
        </AuthNotice>
      ) : (
        <>
          <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.03em]">Forgot your password?</h1>
          <p className="mt-2 text-[15px] text-fg-2">Enter your account email and we'll send you a link to choose a new one.</p>
          <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
            <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required maxLength={120} placeholder="you@example.com" autoFocus />
            {error && <FormError>{error}</FormError>}
            <SubmitButton busy={busy} busyLabel="Sending…">
              Send reset link
            </SubmitButton>
          </form>
          <p className="mt-6 text-center text-[13.5px] text-fg-2">
            Remembered it?{" "}
            <Link href="/login" className="font-semibold text-accent-text hover:underline">
              Log in
            </Link>
          </p>
        </>
      )}
    </AuthFrame>
  );
}
