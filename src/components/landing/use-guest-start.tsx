"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { SpecialtySheet } from "@/components/home/specialty-sheet";
import { caseSnapshot, hydrate, startCase } from "@/lib/case-store";
import { countryFromLocale } from "@/engine/countries";
import { startGuest } from "@/lib/engine-client";
import type { PreferredSpecialty } from "@/lib/specialty";

/**
 * Playing as a guest: a guest account at once, the doctor's specialty (or
 * "rather not say" — mixed cases), then the guided demo, which can be skipped.
 */
export function useGuestStart() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState<{ specialty: PreferredSpecialty | null } | null>(null);

  const demo = useCallback(async () => {
    setBusy(true);
    if (await startCase({ tutorial: true })) {
      router.push("/case");
      return;
    }
    setError(caseSnapshot().error?.message ?? "The demo couldn't start. Please try again.");
    setBusy(false);
  }, [router]);

  const begin = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const { user } = await startGuest(countryFromLocale(navigator.language));
      hydrate(user.id);
      setBusy(false);
      // Asked first, like any new doctor (a returning guest who already said goes straight on).
      if (user.specialty == null) setAsking({ specialty: null });
      else await demo();
    } catch {
      setError("Couldn't start as a guest. Please try again.");
      setBusy(false);
    }
  }, [demo]);

  const sheet = asking ? (
    <SpecialtySheet
      open
      current={asking.specialty}
      onClose={() => {
        setAsking(null);
        void demo();
      }}
    />
  ) : null;

  return { begin, busy, error, sheet };
}
