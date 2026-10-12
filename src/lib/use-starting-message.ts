"use client";

import { useEffect, useState } from "react";

/** What's happening while a new patient is invented — about half a minute, so the doctor can see it's working. */
const STAGES: [seconds: number, label: string][] = [
  [0, "Choosing your patient…"],
  [6, "Writing the history and examination…"],
  [15, "Running the investigations…"],
  [23, "A consultant is checking the case…"],
  [42, "Almost ready…"],
];

export function useStartingMessage(starting: boolean): string {
  const [since, setSince] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!starting) return setSince(null);
    const t0 = Date.now();
    setSince(t0);
    setNow(t0);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [starting]);
  const elapsed = since === null ? 0 : (now - since) / 1000;
  return [...STAGES].reverse().find(([s]) => elapsed >= s)?.[1] ?? STAGES[0]![1];
}
