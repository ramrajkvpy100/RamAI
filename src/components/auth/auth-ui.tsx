"use client";

import Link from "next/link";
import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";

import { Wordmark } from "@/components/brand/wordmark";
import { HeartScene } from "@/components/three/heart-scene";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

/** The sign-in pages' frame: the form on the left, the beating heart on the right. */
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-6 py-6 sm:px-10">
        <Link href="/" aria-label="RamAI — home" className="self-start rounded-lg">
          <Wordmark size="md" />
        </Link>
        <div className="m-auto w-full max-w-[380px] animate-rise py-12">{children}</div>
        <p className="text-[12px] text-fg-3">Clinical simulation for educational purposes. We store only what your account needs.</p>
      </div>

      <div className="ink relative hidden overflow-hidden rounded-none border-0 lg:block">
        <HeartScene className="absolute inset-0" tone="dark" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#070b14] via-[#070b14]/70 to-transparent p-12 pt-32">
          <p className="text-[26px] leading-snug font-semibold tracking-[-0.02em] text-white">Every decision is yours.</p>
          <p className="mt-2 max-w-sm text-[15px] leading-6 text-white/60">No hints. No multiple choice. Just you, the patient, and the consequences.</p>
        </div>
      </div>
    </div>
  );
}

const INPUT = "h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-[15px] shadow-sm outline-none transition-[border-color,box-shadow] placeholder:text-fg-3 focus:border-accent-line focus:shadow-[0_0_0_3px_var(--accent-soft)]";

export function Field({ label, hint, ...input }: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium">{label}</span>
      <input {...input} className={INPUT} />
      {hint && <span className="text-[12px] text-fg-3">{hint}</span>}
    </label>
  );
}

export function PasswordField({
  value,
  onChange,
  autoComplete,
  label = "Password",
  hint,
  aside,
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  label?: string;
  hint?: string;
  /** Shown on the label row, e.g. a "Forgot password?" link. */
  aside?: ReactNode;
}) {
  const [show, setShow] = useState(false);
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-medium">
          {label}
        </label>
        {aside}
      </div>
      <span className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required
          minLength={autoComplete === "new-password" ? 8 : 1}
          className={cn(INPUT, "pr-11")}
        />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute top-1/2 right-1.5 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-fg-3 hover:text-fg">
          <Icon name="eye" size={16} />
        </button>
      </span>
      {hint && <span className="text-[12px] text-fg-3">{hint}</span>}
    </div>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex animate-enter items-start gap-2 rounded-xl bg-danger-soft px-3.5 py-2.5 text-[13.5px] text-danger">
      <Icon name="alert" size={15} className="mt-0.5 shrink-0" />
      {children}
    </p>
  );
}

export function SubmitButton({ busy, children, busyLabel }: { busy: boolean; children: ReactNode; busyLabel: string }) {
  return (
    <button type="submit" disabled={busy} className="shine mt-2 flex h-12 items-center justify-center gap-2 rounded-full text-[15px] font-semibold text-white shadow-glow transition-transform active:scale-[0.99] disabled:opacity-60">
      {busy ? busyLabel : children}
    </button>
  );
}

/** A centred result: an icon, a heading, a line, and what to do next. */
export function AuthNotice({ tone, title, children, actions }: { tone: "success" | "info" | "warning"; title: string; children: ReactNode; actions?: ReactNode }) {
  const icon = tone === "success" ? "check" : tone === "warning" ? "alert" : "mail";
  return (
    <div>
      <span className={cn("flex h-12 w-12 animate-pop items-center justify-center rounded-2xl", tone === "success" ? "bg-success-soft text-success" : tone === "warning" ? "bg-warning-soft text-warning" : "bg-accent-soft text-accent-text")}>
        <Icon name={icon} size={22} strokeWidth={2} />
      </span>
      <h1 className="mt-5 text-[28px] leading-tight font-semibold tracking-[-0.03em]">{title}</h1>
      <div className="mt-2 text-[15px] leading-6 text-fg-2">{children}</div>
      {actions && <div className="mt-7 flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

export const PRIMARY_LINK = "shine inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-[14.5px] font-semibold text-white shadow-glow";
export const SECONDARY_LINK = "inline-flex h-11 items-center justify-center rounded-full px-4 text-[14.5px] font-medium text-fg-2 hover:text-fg";
