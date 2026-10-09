"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { COUNTRIES, COUNTRY, type Country } from "@/engine/countries";
import { setPracticeCountry } from "@/lib/case-store";
import { cn } from "@/lib/cn";
import { useMe } from "@/lib/me-store";

/**
 * India / USA / UK — where the player practises. Patients, places, units,
 * money and the names of the care levels follow it. Saved to the account,
 * unless the parent controls it (the sign-up form).
 */
export function CountryPicker({ value, onChange, className }: { value?: Country; onChange?: (country: Country) => void; className?: string }) {
  const me = useMe();
  const router = useRouter();
  const [pending, setPending] = useState<Country | null>(null);
  const current = pending ?? value ?? me?.user.country ?? "IN";
  const choose = async (country: Country) => {
    if (country === current) return;
    if (onChange) return onChange(country);
    setPending(country);
    if (await setPracticeCountry(country)) router.refresh();
    setPending(null);
  };
  return (
    <div role="radiogroup" aria-label="Country you practise in" className={cn("inline-flex rounded-full bg-surface-3 p-0.5", className)}>
      {COUNTRIES.map((country) => (
        <button
          key={country}
          type="button"
          role="radio"
          aria-checked={current === country}
          title={COUNTRY[country].name}
          onClick={() => void choose(country)}
          className={cn(
            "flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-medium transition-colors",
            current === country ? "bg-surface text-fg shadow-sm" : "text-fg-2 hover:text-fg",
            pending === country && "animate-breathe",
          )}
        >
          <span aria-hidden>{COUNTRY[country].flag}</span>
          {COUNTRY[country].short}
        </button>
      ))}
    </div>
  );
}
