"use client";

import Link from "next/link";

import { AuthFrame, AuthNotice, PRIMARY_LINK, SECONDARY_LINK } from "./auth-ui";
import { ResendVerification } from "./verify-banner";

export function VerifyResult({ verified, name, canResend }: { verified: boolean; name?: string; canResend: boolean }) {
  return (
    <AuthFrame>
      {verified ? (
        <AuthNotice
          tone="success"
          title="Email verified"
          actions={
            <>
              <Link href="/" className={PRIMARY_LINK}>
                Go to RamAI
              </Link>
              <Link href="/leaderboard" className={SECONDARY_LINK}>
                See your league
              </Link>
            </>
          }
        >
          You're all set{name ? `, Dr. ${name}` : ""}. You now compete in the weekly league, and you can recover your account by email.
        </AuthNotice>
      ) : (
        <AuthNotice
          tone="warning"
          title="This link has expired"
          actions={
            canResend ? (
              <ResendVerification />
            ) : (
              <Link href="/" className={PRIMARY_LINK}>
                Go to RamAI
              </Link>
            )
          }
        >
          Verification links work for 48 hours and only once. {canResend ? "Send yourself a new one." : "Log in to send yourself a new one."}
        </AuthNotice>
      )}
    </AuthFrame>
  );
}
