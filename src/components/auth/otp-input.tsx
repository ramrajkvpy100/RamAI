"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

export const OTP_LENGTH = 6;

/**
 * Six boxes for the emailed code. Underneath it's one ordinary input, so
 * pasting the whole code, the phone's number pad and "From Mail" autofill
 * (autocomplete="one-time-code") all just work. Calls onComplete once all
 * six digits are in.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
  autoFocus,
}: {
  value: string;
  onChange: (code: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  /** Shakes the boxes and outlines them in red. */
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [shake, setShake] = useState(0);

  useEffect(() => {
    if (invalid) setShake((n) => n + 1);
  }, [invalid]);
  useEffect(() => {
    if (autoFocus) input.current?.focus();
  }, [autoFocus]);

  const change = (raw: string) => {
    const code = raw.replace(/\D/g, "").slice(0, OTP_LENGTH);
    onChange(code);
    if (code.length === OTP_LENGTH && code !== value) onComplete?.(code);
  };

  return (
    <div className={cn("relative", disabled && "opacity-60")}>
      <div key={shake} className={cn("grid grid-cols-6 gap-2 sm:gap-2.5", shake > 0 && invalid && "animate-shake")} aria-hidden>
        {Array.from({ length: OTP_LENGTH }, (_, i) => {
          const digit = value[i];
          const active = focused && !disabled && i === Math.min(value.length, OTP_LENGTH - 1);
          return (
            <div
              key={i}
              className={cn(
                "flex h-14 items-center justify-center rounded-xl border bg-surface text-[24px] font-semibold tabular shadow-sm transition-[border-color,box-shadow] sm:h-[60px]",
                invalid ? "border-danger" : active ? "border-accent-line shadow-[0_0_0_3px_var(--accent-soft)]" : "border-line",
              )}
            >
              {digit ?? (active ? <span className="h-6 w-[2px] animate-[blink_1s_steps(2,start)_infinite] rounded-full bg-accent" /> : null)}
            </div>
          );
        })}
      </div>
      <input
        ref={input}
        value={value}
        onChange={(e) => change(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={OTP_LENGTH}
        aria-label={`${OTP_LENGTH}-digit code`}
        aria-invalid={invalid || undefined}
        className="absolute inset-0 h-full w-full cursor-text rounded-xl bg-transparent text-[16px] text-transparent caret-transparent opacity-0 outline-none selection:bg-transparent"
      />
    </div>
  );
}
