"use client";

import { useState } from "react";

import { LipButton } from "@/components/games/game-parts";
import { cn } from "@/lib/cn";
import { tap } from "@/lib/haptics";

import { AiNote, Flashcards, generate, ToolHeader } from "./tool-parts";

interface Made {
  title: string;
  flashcards: { front: string; back: string }[];
  mcqs: { stem: string; options: string[]; answer: number; why: string }[];
  map: { concept: string; links: { to: string; how: string }[] }[];
}

const MAX = 20_000;

export function NotesTool() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<Made | null>(null);
  const [tab, setTab] = useState<"cards" | "mcq" | "map">("cards");

  const pick = async (file?: File) => {
    if (!file) return;
    if (!/\.(txt|md|markdown)$/i.test(file.name) && !file.type.startsWith("text/")) return setError("Please choose a .txt or .md file, or paste your notes.");
    setError(null);
    setText((await file.text()).slice(0, MAX));
  };
  const run = async () => {
    setBusy(true);
    setError(null);
    const r = await generate<Made>("notes", text);
    setBusy(false);
    if (r.error || !r.result) return setError(r.error ?? "Please try again.");
    setMade(r.result);
    setTab("cards");
  };
  return (
    <div className="pb-6">
      <ToolHeader title="Create smart notes" line="Turn your notes into flashcards, questions and concept maps." />
      <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, MAX))} rows={9} placeholder="Paste your notes here" className="w-full rounded-xl border border-line bg-surface p-3 text-[14.5px] leading-[21px] outline-none placeholder:text-fg-3" />
      <div className="mt-1 flex items-center justify-between text-[13px] text-fg-2">
        <label className="cursor-pointer font-semibold text-accent-text underline">
          Upload .txt or .md
          <input type="file" accept=".txt,.md,.markdown,text/*" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
        </label>
        <span className="tabular">{text.length.toLocaleString("en-IN")} / {MAX.toLocaleString("en-IN")}</span>
      </div>
      <LipButton onClick={() => void run()} disabled={busy || text.trim().length < 100} className="mt-3 w-full">{busy ? "WORKING ON IT…" : "MAKE STUDY SET"}</LipButton>
      {text.trim().length > 0 && text.trim().length < 100 && <p className="mt-1.5 text-[13px] text-fg-2">A bit more, please: at least 100 characters.</p>}
      {error && <p className="mt-2 text-[14px] text-danger">{error}</p>}
      {made && (
        <div className="mt-5">
          <h2 className="text-[20px] leading-tight font-bold">{made.title}</h2>
          <div role="tablist" className="mt-3 flex gap-1 rounded-xl bg-surface-3 p-1 text-[13.5px] font-semibold">
            {([["cards", `Flashcards (${made.flashcards.length})`], ["mcq", `MCQs (${made.mcqs.length})`], ["map", "Concept map"]] as const).map(([v, t]) => (
              <button key={v} role="tab" type="button" aria-selected={tab === v} onClick={() => setTab(v)} className={cn("flex-1 rounded-lg px-1 py-1.5", tab === v && "bg-[var(--surface-solid)] shadow-sm")}>{t}</button>
            ))}
          </div>
          <div className="mt-3">
            {tab === "cards" && <Flashcards cards={made.flashcards} />}
            {tab === "mcq" && <div className="flex flex-col gap-3">{made.mcqs.map((q) => <Mcq key={q.stem} q={q} />)}</div>}
            {tab === "map" && (
              <ul className="flex flex-col gap-2">
                {made.map.map((c) => (
                  <li key={c.concept} className="rounded-xl border border-line bg-[var(--surface-solid)] p-3">
                    <p className="inline-block rounded-lg bg-[#2563EB] px-2.5 py-1 text-[14px] font-bold text-white">{c.concept}</p>
                    <ul className="mt-2 flex flex-col gap-1 border-l-2 border-[#2563EB]/40 pl-3 text-[14px] leading-5">
                      {c.links.map((l) => <li key={`${l.how}${l.to}`}><span className="text-fg-2">{l.how} →</span> <b>{l.to}</b></li>)}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <AiNote />
        </div>
      )}
    </div>
  );
}

function Mcq({ q }: { q: Made["mcqs"][number] }) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className="rounded-xl border border-line bg-[var(--surface-solid)] p-3">
      <p className="text-[14.5px] leading-[21px] font-semibold">{q.stem}</p>
      <div className="mt-2 flex flex-col gap-1.5">
        {q.options.map((o, i) => (
          <button key={o} type="button" disabled={picked !== null} onClick={() => { tap(); setPicked(i); }} className={cn("rounded-lg border-2 px-2.5 py-2 text-left text-[14px]", picked === null ? "border-line" : i === q.answer ? "border-success bg-success-soft" : picked === i ? "border-danger bg-danger-soft" : "border-line opacity-60")}>{o}</button>
        ))}
      </div>
      {picked !== null && <p className="mt-2 text-[13.5px] leading-5 text-fg-2">{q.why}</p>}
    </div>
  );
}
