"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { caseSnapshot, dismissError, startCase, useCase } from "@/lib/case-store";
import type { CaseChoice } from "@/lib/engine-client";

export interface Gate {
  code: "PRO_REQUIRED" | "DAILY_LIMIT" | "SIGNUP_REQUIRED";
  message: string;
}

/** Starts a case and routes to it; plan limits open the upgrade sheet instead of an error. */
export function useLauncher() {
  const router = useRouter();
  const { starting } = useCase();
  const [gate, setGate] = useState<Gate | null>(null);
  const [error, setError] = useState<string | null>(null);

  const launch = useCallback(
    async (choice: CaseChoice = {}) => {
      setError(null);
      if (await startCase(choice)) {
        router.push("/case");
        return true;
      }
      const err = caseSnapshot().error;
      if (err?.code === "PRO_REQUIRED" || err?.code === "DAILY_LIMIT" || err?.code === "SIGNUP_REQUIRED") setGate({ code: err.code, message: err.message });
      else if (err) setError(err.message);
      dismissError();
      return false;
    },
    [router],
  );

  return { launch, starting, gate, setGate, closeGate: useCallback(() => setGate(null), []), error };
}
