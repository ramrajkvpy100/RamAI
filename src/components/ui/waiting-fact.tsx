"use client";

import { useEffect, useState } from "react";

import { nextFact } from "@/lib/medical-facts";
import { cn } from "@/lib/cn";

/** While the app waits: a small MBBS-level fact, a new one every 7 seconds, fading softly between them. */
export function WaitingFact({ className, tone = "plain" }: { className?: string; tone?: "plain" | "light" }) {
  const [fact, setFact] = useState<string | null>(null);
  const [shown, setShown] = useState(true);
  useEffect(() => {
    setFact(nextFact());
    const t = window.setInterval(() => {
      setShown(false);
      window.setTimeout(() => {
        setFact((f) => nextFact(f ?? undefined));
        setShown(true);
      }, 350);
    }, 7000);
    return () => window.clearInterval(t);
  }, []);
  if (!fact) return null;
  return (
    <p aria-live="polite" className={cn("text-[13px] leading-5 transition-opacity duration-300", shown ? "opacity-100" : "opacity-0", tone === "light" ? "text-white/85" : "text-fg-2", className)}>
      <span className={cn("mr-1 font-semibold", tone === "light" ? "text-white" : "text-accent-text")}>💡 Did you know?</span>
      {fact}
    </p>
  );
}
