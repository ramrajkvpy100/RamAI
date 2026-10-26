"use client";

import Link from "next/link";

import { isDue, useDeck } from "@/lib/revision-deck";

/** On Home: how many revision cards are due — one tap to review them. Hidden when none are. */
export function DeckDue() {
  const due = useDeck().filter((c) => isDue(c)).length;
  if (!due) return null;
  return (
    <Link href="/revision" prefetch className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
      <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/12 text-[20px]">📚</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-semibold">{due} revision {due === 1 ? "card" : "cards"} due</span>
        <span className="block text-[12.5px] text-fg-2">Review them now, before you forget</span>
      </span>
      <span aria-hidden className="text-fg-3">→</span>
    </Link>
  );
}
