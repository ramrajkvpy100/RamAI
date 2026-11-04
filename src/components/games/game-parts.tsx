"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

/** A centred section heading: — LIKE THIS —. */
export function SectionDivider({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("section-divider", className)}>{children}</p>;
}

/** The primary call to action, with its 3D lip. */
export function LipButton({ className, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...rest} className={cn("btn-lip inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-accent px-6 text-[15px] font-bold tracking-wide text-on-accent disabled:opacity-50", className)}>
      {children}
    </button>
  );
}

export function BackTo({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="mb-3 inline-flex items-center gap-1 text-[14px] font-medium text-fg-2">
      <Icon name="arrow-left" size={15} /> {label}
    </Link>
  );
}

/** A game's end: the score, the XP, the best. */
export function GameOver({ title, score, xp, best, isBest, again, children }: { title: string; score: number; xp: number; best: number; isBest: boolean; again: () => void; children?: ReactNode }) {
  return (
    <div className="panel flex animate-rise flex-col items-center gap-2 p-6 text-center">
      <p className="text-[15px] font-semibold text-fg-2">{title}</p>
      <p className="text-[46px] leading-none font-extrabold tabular">{score.toLocaleString("en-IN")}</p>
      <p className="text-[14px] font-medium">{isBest ? "New personal best" : `Your best: ${best.toLocaleString("en-IN")}`}</p>
      <p className="rounded-full bg-accent-soft px-3 py-1 text-[13px] font-semibold text-accent-text">+{xp} XP</p>
      {children}
      <LipButton onClick={again} className="mt-3 w-full max-w-xs">PLAY AGAIN</LipButton>
      <Link href="/practice" className="mt-1 text-[14px] font-medium text-fg-2 underline">Back to Skills Lab</Link>
    </div>
  );
}
