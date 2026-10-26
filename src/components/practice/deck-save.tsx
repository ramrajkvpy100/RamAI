"use client";

import { useEffect, useState } from "react";

import { addQuestion, inDeck, removeCard, type CardSource } from "@/lib/revision-deck";
import { tap } from "@/lib/haptics";
import { cn } from "@/lib/cn";

const frontOf = (stem: string, options: string[]) => (options.length ? `${stem}\n${options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join("\n")}` : stem);
const idOf = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 120);

/** After answering: ☆ Save to the revision deck — a wrong answer is saved by itself, to come back for review. */
export function DeckSave({ stem, options, answer, explanation, from, source, wrong }: { stem: string; options: string[]; answer: string; explanation: string; from: string; source: CardSource; wrong: boolean }) {
  const front = frontOf(stem, options);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (wrong) addQuestion(stem, options, answer, explanation, from, source);
    setSaved(inDeck(front));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [front, wrong]);
  return (
    <button
      type="button"
      onClick={() => {
        tap();
        if (saved) removeCard(idOf(front));
        else addQuestion(stem, options, answer, explanation, from, source);
        setSaved(!saved);
      }}
      className={cn("rounded-full border px-3 py-1.5 text-[12.5px] font-medium", saved ? "border-accent-line bg-accent-soft text-accent-text" : "border-line text-fg-2 hover:bg-surface-2")}
    >
      {saved ? (wrong ? "✓ In your deck — to review" : "✓ Saved") : "☆ Save to deck"}
    </button>
  );
}
