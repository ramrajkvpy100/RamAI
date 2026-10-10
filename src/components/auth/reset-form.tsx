"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ClinicalEngineError, resetPassword } from "@/lib/engine-client";

import { AuthFrame, AuthNotice, FormError, PasswordField, PRIMARY_LINK, SECONDARY_LINK, SubmitButton } from "./auth-ui";

/**
 * Choose a new password, from the emailed reset link. Opening the page uses
 * nothing up — the link is only spent when the form is sent — so an email
 * scanner that "clicks" links first can't break it.
 */
export function ResetForm({ tokenHash, code, linkError }: { tokenHash: string | null; code: string | null; linkError: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"form" | "expired" | "missing" | "done">(linkError ? "expired" : tokenHash || code ? "form" : "missing");

  // Supabase reports a dead link in the address's #fragment, which only the browser sees.
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.get("error_code") || hash.get("error")) setState("expired");
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    setError(null);
    try {
      await resetPassword({ password, ...(tokenHash ? { tokenHash } : { code: code ?? undefined }) });
      setState("done");
    } catch (err) {
      if (err instanceof ClinicalEngineError && err.code === "LINK_EXPIRED") setState("expired");
      else setError(err instanceof ClinicalEngineError && (err.code === "BAD_INPUT" || err.code === "RATE_LIMITED" || err.code === "AUTH_UNAVAILABLE") ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame>
      {state === "done" ? (
        <AuthNotice
          tone="success"
          title="Password updated"
          actions={
            <button
              type="button"
              onClick={() => {
                router.replace("/");
                router.refresh();
              }}
              className={PRIMARY_LINK}
            >
              Continue to RamAI
            </button>
          }
        >
          Your new password is saved and you&apos;re signed in. Any other devices using your account will be signed out.
        </AuthNotice>
      ) : state === "expired" || state === "missing" ? (
        <AuthNotice
          tone="warning"
          title={state === "expired" ? "This link has expired" : "Open the link from your email"}
          actions={
            <>
              <Link href="/forgot-password" className={PRIMARY_LINK}>
                Send a new link
              </Link>
              <Link href="/login" className={SECONDARY_LINK}>
                Back to log in
              </Link>
            </>
          }
        >
          {state === "expired"
            ? "Reset links work once, for one hour. Ask for a new one and use the newest email."
            : "To choose a new password, open the reset link we emailed you. No email? Ask for a new link."}
        </AuthNotice>
      ) : (
        <>
          <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.03em]">Choose a new password</h1>
          <p className="mt-2 text-[15px] text-fg-2">You&apos;ll be signed in here, and signed out on your other devices.</p>
          <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
            <PasswordField label="New password" value={password} onChange={setPassword} autoComplete="new-password" hint="At least 8 characters. Avoid common passwords." />
            <PasswordField label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
            {error && <FormError>{error}</FormError>}
            <SubmitButton busy={busy} busyLabel="Saving…">
              Save new password
            </SubmitButton>
          </form>
        </>
      )}
    </AuthFrame>
  );
}
