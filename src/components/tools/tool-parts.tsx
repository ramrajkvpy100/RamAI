"use client";

import { useState } from "react";

import { BackTo, LipButton } from "@/components/games/game-parts";
import { cn } from "@/lib/cn";
import { tap } from "@/lib/haptics";

/** Asks the server for AI study material. A clear message on anything that goes wrong. */
export async function generate<T>(kind: "mnemonic" | "flowchart" | "summary" | "notes", text: string, transcript?: string): Promise<{ result?: T; needTranscript?: boolean; from?: string; title?: string | null; error?: string }> {
  try {
    const res = await fetch("/api/tools/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, text, ...(transcript ? { transcript } : {}) }) });
    const data = (await res.json().catch(() => ({}))) as { result?: T; needTranscript?: boolean; from?: string; title?: string | null; error?: { message?: string } | string; message?: string };
    if (res.status === 401) return { error: "Sign in free to use the AI tools. The ready-made galleries are open to everyone." };
    if (!res.ok) return { error: (typeof data.error === "object" ? data.error?.message : data.error) ?? data.message ?? "That didn't work. Please try again." };
    return { result: data.result, needTranscript: data.needTranscript, from: data.from, title: data.title };
  } catch {
    return { error: "No connection. Please try again." };
  }
}

export function AiNote() {
  return <p className="mt-2 text-[12px] leading-[18px] text-fg-3">Written by AI. Check doses and details against your guideline or a senior before you rely on them.</p>;
}

export function ToolHeader({ title, line }: { title: string; line: string }) {
  return (
    <>
      <BackTo href="/tools" label="Learning Tools" />
      <h1 className="text-[26px] leading-tight font-bold">{title}</h1>
      <p className="mt-0.5 mb-4 text-[14.5px] text-fg-2">{line}</p>
    </>
  );
}

/** Flashcards to tap through: the front, then the back. */
export function Flashcards({ cards }: { cards: { front: string; back: string }[] }) {
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  if (!cards.length) return null;
  const card = cards[Math.min(i, cards.length - 1)]!;
  const go = (d: number) => {
    tap();
    setOpen(false);
    setI((n) => (n + d + cards.length) % cards.length);
  };
  return (
    <div>
      <button type="button" onClick={() => { tap(); setOpen((o) => !o); }} className={cn("pick-card flex min-h-[150px] w-full flex-col justify-center rounded-2xl border-2 p-4 text-center", open ? "border-[#2563EB] bg-accent-soft" : "border-line bg-[var(--surface-solid)]")}>
        <span className="mb-1 text-[11px] font-bold tracking-wider text-fg-3 uppercase">{open ? "Answer" : "Question · tap to flip"}</span>
        <span className="text-[15px] leading-[22px] font-medium whitespace-pre-line">{open ? card.back : card.front}</span>
      </button>
      <div className="mt-2 flex items-center justify-between text-[14px] font-medium">
        <button type="button" onClick={() => go(-1)} className="rounded-lg px-3 py-1.5 text-fg-2">← Back</button>
        <span className="text-fg-2 tabular">{Math.min(i, cards.length - 1) + 1} / {cards.length}</span>
        <button type="button" onClick={() => go(1)} className="rounded-lg px-3 py-1.5 text-accent-text">Next →</button>
      </div>
    </div>
  );
}

export function Search({ value, onChange, onSubmit, placeholder, busy, action }: { value: string; onChange: (s: string) => void; onSubmit: () => void; placeholder: string; busy: boolean; action: string }) {
  return (
    <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); if (value.trim().length >= 2 && !busy) onSubmit(); }}>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={200} className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-[15px] outline-none placeholder:text-fg-3" />
      <LipButton type="submit" disabled={busy || value.trim().length < 2}>{busy ? "WRITING…" : action}</LipButton>
    </form>
  );
}
