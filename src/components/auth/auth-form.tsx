"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { CountryPicker } from "@/components/app/country-picker";
import { countryFromLocale, type Country } from "@/engine/countries";
import { ClinicalEngineError, login, signup } from "@/lib/engine-client";

import { AuthFrame, Field, FormError, PasswordField, SubmitButton } from "./auth-ui";

type Mode = "login" | "signup";

export function AuthForm({ mode, next }: { mode: Mode; next: string }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", username: "", email: "", login: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [country, setCountry] = useState<Country>("IN");
  const [agreed, setAgreed] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  // A first guess from the browser's language; the player can change it below.
  useEffect(() => setCountry(countryFromLocale(navigator.language)), []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") await login({ login: form.login.trim(), password: form.password });
      else await signup({ name: form.name.trim(), username: form.username.trim(), email: form.email.trim(), password: form.password, country, acceptTerms: true });
      router.replace(next);
      router.refresh();
    } catch (err) {
      const code = err instanceof ClinicalEngineError ? err.code : "UNKNOWN";
      setError(code === "NETWORK" || code === "ENGINE_UNAVAILABLE" || code === "UNKNOWN" ? "Something went wrong. Please try again." : (err as Error).message);
      setBusy(false);
    }
  };

  const nextQuery = next !== "/" ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <AuthFrame>
      <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.03em]">{mode === "login" ? "Welcome back, doctor." : "Create your account"}</h1>
      <p className="mt-2 text-[15px] text-fg-2">{mode === "login" ? "Your next patient is waiting." : "3 free cases every day. No card needed."}</p>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-4" noValidate={false}>
        {mode === "signup" ? (
          <>
            <Field label="Full name" value={form.name} onChange={(e) => set("name")(e.target.value)} autoComplete="name" required minLength={2} maxLength={60} placeholder="Asha Verma" />
            <Field label="Username" value={form.username} onChange={(e) => set("username")(e.target.value)} autoComplete="username" required minLength={3} maxLength={24} pattern="[a-zA-Z0-9._]+" placeholder="asha.verma" hint="Shown on leaderboards." />
            <Field label="Email" type="email" value={form.email} onChange={(e) => set("email")(e.target.value)} autoComplete="email" required maxLength={120} placeholder="you@example.com" hint="We'll send a link to verify it." />
            <PasswordField value={form.password} onChange={set("password")} autoComplete="new-password" hint="At least 8 characters." />
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium">Where you practise</span>
              <CountryPicker value={country} onChange={setCountry} className="self-start" />
              <span className="text-[12px] text-fg-3">Patients, units and money follow it. Change it any time.</span>
            </div>
          </>
        ) : (
          <>
            <Field label="Email or username" value={form.login} onChange={(e) => set("login")(e.target.value)} autoComplete="username" required minLength={3} maxLength={120} />
            <PasswordField
              value={form.password}
              onChange={set("password")}
              autoComplete="current-password"
              aside={
                <Link href="/forgot-password" className="text-[12.5px] font-medium text-accent-text hover:underline">
                  Forgot password?
                </Link>
              }
            />
          </>
        )}

        {error && <FormError>{error}</FormError>}

        {mode === "signup" && (
          <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-5 text-fg-2">
            <input type="checkbox" required checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]" />
            <span>
              I'm 18 or over, I agree to the{" "}
              <Link href="/terms" target="_blank" className="font-medium text-accent-text underline-offset-2 hover:underline">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" target="_blank" className="font-medium text-accent-text underline-offset-2 hover:underline">
                Privacy policy
              </Link>
              , and I understand RamAI is for education only — not medical advice.
            </span>
          </label>
        )}
        <SubmitButton busy={busy} busyLabel={mode === "login" ? "Logging in…" : "Creating account…"}>
          {mode === "login" ? "Log in" : "Create account"}
        </SubmitButton>

      </form>

      <p className="mt-6 text-center text-[13.5px] text-fg-2">
        {mode === "login" ? "New to RamAI? " : "Already have an account? "}
        <Link href={`${mode === "login" ? "/signup" : "/login"}${nextQuery}`} className="font-semibold text-accent-text hover:underline">
          {mode === "login" ? "Create an account" : "Log in"}
        </Link>
      </p>
    </AuthFrame>
  );
}
