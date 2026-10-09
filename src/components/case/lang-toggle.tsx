"use client";

import { useState } from "react";

import type { PatientLang } from "@/engine/types";
import { setPatientLanguage } from "@/lib/case-store";
import { cn } from "@/lib/cn";
import { useMe } from "@/lib/me-store";

const LABEL: Record<PatientLang, string> = { en: "English", hinglish: "Hinglish" };

/**
 * English / Hinglish for what patients and families say. Saved to the account;
 * an open case re-renders in the new language straight away.
 */
export function LangToggle({ value, tone = "default", className }: { value?: PatientLang; tone?: "default" | "dark"; className?: string }) {
  const me = useMe();
  const [pending, setPending] = useState<PatientLang | null>(null);
  const current = pending ?? value ?? me?.user.patientLang ?? "en";
  const choose = async (lang: PatientLang) => {
    if (lang === current) return;
    setPending(lang);
    await setPatientLanguage(lang);
    setPending(null);
  };
  return (
    <div role="radiogroup" aria-label="Language patients speak" className={cn("inline-flex rounded-full p-0.5", tone === "dark" ? "bg-white/10" : "bg-surface-3", className)}>
      {(Object.keys(LABEL) as PatientLang[]).map((lang) => (
        <button
          key={lang}
          type="button"
          role="radio"
          aria-checked={current === lang}
          onClick={() => void choose(lang)}
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[11.5px] font-medium transition-colors",
            current === lang ? (tone === "dark" ? "bg-white text-[#0b1220]" : "bg-surface text-fg shadow-sm") : tone === "dark" ? "text-white/65 hover:text-white" : "text-fg-2 hover:text-fg",
            pending === lang && "animate-breathe",
          )}
        >
          {LABEL[lang]}
        </button>
      ))}
    </div>
  );
}
