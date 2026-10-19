"use client";

import { useEffect, useState } from "react";

export type CareerStage = "student" | "intern" | "resident" | "specialist" | "radiologist";

let cached: CareerStage | null | undefined;
const listeners = new Set<(s: CareerStage | null) => void>();

/** The doctor's career stage (from the specialty sheet), fetched once per page load. */
export function useCareerStage(): CareerStage | null | undefined {
  const [stage, setStage] = useState(cached);
  useEffect(() => {
    listeners.add(setStage);
    if (cached === undefined) {
      fetch("/api/me/stage")
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { stage?: CareerStage | null } | null) => setCareerStage(j?.stage ?? null, false))
        .catch(() => setCareerStage(null, false));
    }
    return () => void listeners.delete(setStage);
  }, []);
  return stage;
}

export function setCareerStage(stage: CareerStage | null, save = true) {
  cached = stage;
  for (const l of listeners) l(stage);
  if (save && stage) void fetch("/api/me/stage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage }) }).catch(() => undefined);
}
