"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { ClinicalEngineError, confirmLink, resendCode, verifyCode } from "@/lib/engine-client";
import { clearPending, readPending, savePending, type PendingVerification } from "@/lib/pending-verification";

import { AuthFrame, AuthNotice, Field, FormError, PRIMARY_LINK, SECONDARY_LINK, SubmitButton } from "./auth-ui";
import { OTP_LENGTH, OtpInput } from "./otp-input";

/** Supabase's minimum gap between codes, and how long a code lasts (its defaults). */
const COOLDOWN_S = 60;
const CODE_LIFETIME_MS = 60 * 60_000;

type View = "loading" | "code" | "ask-email" | "link" | "link-done" | "link-expired" | "verified";

const friendly = (err: unknown) =>
  err instanceof ClinicalEngineError && err.code !== "NETWORK" && err.code !== "ENGINE_UNAVAILABLE" && err.code !== "UNKNOWN" ? err.message : "Something went wrong. Please try again.";

/**
 * "Check your email": the six-digit code from the sign-up email. Also finishes
 * a confirmation link from Supabase's default email (?code=…), and shows an
 * expired link clearly.
 */
export function VerifyForm({ linkCode, linkError }: { linkCode: string | null; linkError: boolean }) {
  const router = useRouter();
  const [view, setView] = useState<View>("loading");
  const [pending, setPending] = useState<PendingVerification | null>(null);
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [wrongTries, setWrongTries] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const linkStarted = useRef(false);

  // What to show: a confirmation link, an expired link, the code boxes, or a box for the email.
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (linkError || hash.get("error_code") || hash.get("error")) return setView("link-expired");
    if (linkCode) return setView("link");
    const p = readPending();
    setPending(p);
    setView(p ? "code" : "ask-email");
  }, [linkCode, linkError]);

  // The resend countdown.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const done = useCallback(
    (next: string) => {
      clearPending();
      setView("verified");
      router.replace(next);
      router.refresh();
    },
    [router],
  );

  // A confirmation link: finish it here (only in a real browser — link scanners don't run scripts).
  useEffect(() => {
    if (view !== "link" || !linkCode || linkStarted.current) return;
    linkStarted.current = true;
    confirmLink(linkCode)
      .then(() => done(readPending()?.next ?? "/"))
      .catch((err) => setView(err instanceof ClinicalEngineError && err.code === "LINK_EXPIRED" ? "link-done" : "link-expired"));
  }, [view, linkCode, done]);

  const submit = async (value = code) => {
    if (!pending || busy) return;
    if (value.length !== OTP_LENGTH) return setError(`Enter all ${OTP_LENGTH} digits.`);
    setBusy(true);
    setError(null);
    setInvalid(false);
    setNotice(null);
    try {
      await verifyCode(pending.email, value);
      done(pending.next);
    } catch (err) {
      setBusy(false);
      setCode("");
      if (err instanceof ClinicalEngineError && err.code === "CODE_INVALID") {
        // Supabase answers the same for a wrong code and an old one — the time since it was sent tells them apart.
        const old = pending.sentAt > 0 && Date.now() - pending.sentAt > CODE_LIFETIME_MS;
        setInvalid(true);
        setWrongTries((n) => n + 1);
        setError(old ? "This code has expired — codes last one hour. Send yourself a new one below." : "That code isn't right. Check the newest email from RamAI and try again.");
      } else setError(friendly(err));
    }
  };

  const resend = async (to = pending?.email ?? email.trim()) => {
    if (!to || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    setInvalid(false);
    try {
      await resendCode(to);
      const p = { email: to, sentAt: Date.now(), next: pending?.next ?? "/" };
      savePending(p);
      setPending(p);
      setCode("");
      setWrongTries(0);
      setView("code");
      setNotice(`A new code is on its way to ${to}. Only the newest code works.`);
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  };

  const wait = pending ? Math.max(0, Math.ceil((pending.sentAt + COOLDOWN_S * 1000 - now) / 1000)) : 0;

  if (view === "loading" || view === "link" || view === "verified") {
    return (
      <AuthFrame>
        <div className="flex items-center gap-3 text-[15px] text-fg-2" role="status">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-hidden />
          {view === "verified" ? "Verified — opening RamAI…" : view === "link" ? "Confirming your email…" : "Loading…"}
        </div>
      </AuthFrame>
    );
  }

  if (view === "link-done" || view === "link-expired") {
    return (
      <AuthFrame>
        {view === "link-done" ? (
          <AuthNotice tone="success" title="Email confirmed" actions={<Link href="/login" className={PRIMARY_LINK}>Log in</Link>}>
            Your email address is confirmed. Log in with your email and password to continue.
          </AuthNotice>
        ) : (
          <AuthNotice
            tone="warning"
            title="This link has expired"
            actions={
              <>
                <button type="button" onClick={() => setView("ask-email")} className={PRIMARY_LINK}>
                  Get a new code
                </button>
                <Link href="/login" className={SECONDARY_LINK}>
                  Log in
                </Link>
              </>
            }
          >
            Links and codes work once, for one hour. Ask for a new code — or, if you've already confirmed your email, just log in.
          </AuthNotice>
        )}
      </AuthFrame>
    );
  }

  if (view === "ask-email" || !pending) {
    return (
      <AuthFrame>
        <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.03em]">Verify your email</h1>
        <p className="mt-2 text-[15px] text-fg-2">Enter the email you signed up with and we&apos;ll send you a new 6-digit code.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void resend(email.trim());
          }}
          className="mt-8 flex flex-col gap-4"
        >
          <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required maxLength={120} placeholder="you@example.com" autoFocus />
          {error && <FormError>{error}</FormError>}
          <SubmitButton busy={busy} busyLabel="Sending…">
            Send code
          </SubmitButton>
        </form>
        <p className="mt-6 text-center text-[13.5px] text-fg-2">
          Already verified?{" "}
          <Link href="/login" className="font-semibold text-accent-text hover:underline">
            Log in
          </Link>
        </p>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame>
      <span className="flex h-12 w-12 animate-pop items-center justify-center rounded-2xl bg-accent-soft text-accent-text">
        <Icon name="mail" size={22} strokeWidth={2} />
      </span>
      <h1 className="mt-5 text-[30px] leading-tight font-semibold tracking-[-0.03em]">Check your email</h1>
      <p className="mt-2 text-[15px] leading-6 text-fg-2">
        We sent a {OTP_LENGTH}-digit code to <span className="font-medium break-all text-fg">{pending.email}</span>. Enter it below to verify your account.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="mt-8 flex flex-col gap-4"
      >
        <OtpInput value={code} onChange={(v) => (setCode(v), setInvalid(false))} onComplete={(v) => void submit(v)} disabled={busy} invalid={invalid} autoFocus />
        {error && <FormError>{error}</FormError>}
        {notice && !error && (
          <p role="status" className="flex animate-enter items-start gap-2 rounded-xl bg-success-soft px-3.5 py-2.5 text-[13.5px] text-success">
            <Icon name="check" size={15} className="mt-0.5 shrink-0" />
            {notice}
          </p>
        )}
        <SubmitButton busy={busy} busyLabel="Checking…">
          Verify email
        </SubmitButton>
      </form>

      <div className="mt-6 flex flex-col items-center gap-1.5 text-center text-[13.5px] text-fg-2">
        <span>
          Didn&apos;t get it? Check spam or promotions{wrongTries >= 3 ? ", or send a new code" : ""}.
        </span>
        <button type="button" onClick={() => void resend()} disabled={busy || wait > 0} className="font-semibold text-accent-text hover:underline disabled:cursor-default disabled:text-fg-3 disabled:no-underline">
          {wait > 0 ? `Resend code in 0:${String(wait).padStart(2, "0")}` : "Resend code"}
        </button>
        <Link href="/signup" onClick={clearPending} className="mt-2 text-[12.5px] text-fg-3 hover:text-fg">
          Wrong email? Start again
        </Link>
      </div>
    </AuthFrame>
  );
}
