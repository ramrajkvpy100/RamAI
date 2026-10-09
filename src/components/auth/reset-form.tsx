"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ClinicalEngineError, resetPassword } from "@/lib/engine-client";

import { AuthFrame, AuthNotice, FormError, PasswordField, PRIMARY_LINK, SubmitButton } from "./auth-ui";

export function ResetForm({ token, valid }: { token: string; valid: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(!valid);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    setError(null);
    try {
      await resetPassword(token, password);
      router.replace("/");
      router.refresh();
    } catch (err) {
      if (err instanceof ClinicalEngineError && err.code === "LINK_EXPIRED") setExpired(true);
      else setError(err instanceof ClinicalEngineError && (err.code === "BAD_INPUT" || err.code === "RATE_LIMITED") ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  };

  return (
    <AuthFrame>
      {expired ? (
        <AuthNotice
          tone="warning"
          title="This link has expired"
          actions={
            <Link href="/forgot-password" className={PRIMARY_LINK}>
              Send a new link
            </Link>
          }
        >
          Reset links work for one hour and only once. Ask for a new one and use the latest email.
        </AuthNotice>
      ) : (
        <>
          <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.03em]">Choose a new password</h1>
          <p className="mt-2 text-[15px] text-fg-2">You'll be signed in, and signed out on every other device.</p>
          <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
            <PasswordField label="New password" value={password} onChange={setPassword} autoComplete="new-password" hint="At least 8 characters." />
            <PasswordField label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
            {error && <FormError>{error}</FormError>}
            <SubmitButton busy={busy} busyLabel="Saving…">
              Save password
            </SubmitButton>
          </form>
        </>
      )}
    </AuthFrame>
  );
}
