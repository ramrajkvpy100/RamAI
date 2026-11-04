"use client";

import { useEffect, useState } from "react";

import { LipButton } from "@/components/games/game-parts";
import { cn } from "@/lib/cn";
import { MedicalIcon } from "@/components/ui/medical-icons";
import { PLAYLISTS } from "@/lib/tools/playlists";
import { toast } from "@/lib/toast";

import { AiNote, Flashcards, generate, ToolHeader } from "./tool-parts";

interface Summary {
  title: string;
  notes: string[];
  pearls: string[];
  oneLiners: string[];
  flashcards: { front: string; back: string }[];
}

const asText = (s: Summary) => [s.title, "", "NOTES", ...s.notes.map((x) => `- ${x}`), "", "PEARLS", ...s.pearls.map((x) => `- ${x}`), "", "ONE-LINERS", ...s.oneLiners.map((x) => `- ${x}`)].join("\n");

/** A lecture into notes. If YouTube won't give us the captions, the doctor can paste them: we don't guess what a video says. */
export function YoutubeTool() {
  const [tab, setTab] = useState<"lists" | "sum">("lists");
  const [text, setText] = useState("");
  const [transcript, setTranscript] = useState("");
  const [needs, setNeeds] = useState(false);
  const [videoTitle, setVideoTitle] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [from, setFrom] = useState<string | undefined>();

  const run = async () => {
    setBusy(true);
    setError(null);
    setSummary(null);
    const r = await generate<Summary>("summary", text, needs && transcript.trim() ? transcript : undefined);
    setBusy(false);
    if (r.error) return setError(r.error);
    if (r.needTranscript) {
      setNeeds(true);
      setVideoTitle(r.title ?? null);
      return;
    }
    if (r.result) {
      setSummary(r.result);
      setFrom(r.from);
      setNeeds(false);
    }
  };
  const copy = async () => {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(asText(summary));
      toast("Notes copied");
    } catch {}
  };
  return (
    <div className="pb-6">
      <ToolHeader title="YouTube" line="Good playlists by subject, and bite-sized summaries of any video." />
      <div role="tablist" className="mb-4 flex gap-1 rounded-xl bg-surface-3 p-1 text-[14px] font-semibold">
        {([["lists", "Playlists"], ["sum", "Summarize a video"]] as const).map(([v, t]) => (
          <button key={v} role="tab" type="button" aria-selected={tab === v} onClick={() => setTab(v)} className={cn("flex-1 rounded-lg py-1.5", tab === v && "bg-[var(--surface-solid)] shadow-sm")}>{t}</button>
        ))}
      </div>
      {tab === "lists" ? <Playlists onSummarize={() => setTab("sum")} /> : <>
      <label className="block text-[14px] font-semibold" htmlFor="yt">A YouTube link or a lecture topic</label>
      <input id="yt" value={text} onChange={(e) => { setText(e.target.value); setNeeds(false); }} placeholder="https://youtu.be/… or Heart failure management" className="mt-1.5 h-12 w-full rounded-xl border border-line bg-surface px-3 text-[15px] outline-none placeholder:text-fg-3" />
      {needs && (
        <div className="mt-3 rounded-xl bg-amber-500/10 p-3">
          <p className="text-[14px] leading-5 font-medium">YouTube didn&apos;t share the captions{videoTitle ? ` for “${videoTitle}”` : ""}. On YouTube, tap <b>…more</b>, then <b>Show transcript</b>, copy it and paste it here.</p>
          <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} rows={6} maxLength={24_000} placeholder="Paste the transcript" className="mt-2 w-full rounded-xl border border-line bg-surface p-3 text-[14px] outline-none placeholder:text-fg-3" />
        </div>
      )}
      <LipButton onClick={() => void run()} disabled={busy || text.trim().length < 2 || (needs && transcript.trim().length < 100)} className="mt-3 w-full">{busy ? "SUMMARIZING…" : "SUMMARIZE"}</LipButton>
      {error && <p className="mt-2 text-[14px] text-danger">{error}</p>}
      {summary && (
        <div className="mt-5 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-[20px] leading-tight font-bold">{summary.title}</h2>
            <button type="button" onClick={() => void copy()} className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-[13.5px] font-semibold">Copy notes</button>
          </div>
          {from === "topic" && <p className="rounded-xl bg-surface-3 p-2.5 text-[13px] leading-[19px] text-fg-2">Written from the topic, not from a particular video.</p>}
          <List title="High-yield notes" items={summary.notes} />
          <List title="Clinical pearls" items={summary.pearls} />
          <List title="One-liners" items={summary.oneLiners} />
          <section>
            <h3 className="mb-2 text-[15px] font-bold">Instant flashcards</h3>
            <Flashcards cards={summary.flashcards} />
          </section>
          <AiNote />
        </div>
      )}
      </>}
    </div>
  );
}

function Playlists({ onSummarize }: { onSummarize: () => void }) {
  const [subject, setSubject] = useState(PLAYLISTS[0]!.subject);
  // Your dream branch's playlists open first.
  useEffect(() => {
    try {
      const dream = localStorage.getItem("ramai.dream");
      const mine = PLAYLISTS.find((p) => dream && p.for?.includes(dream));
      if (mine) setSubject(mine.subject);
    } catch {}
  }, []);
  const open = PLAYLISTS.find((p) => p.subject === subject)!;
  return (
    <>
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {PLAYLISTS.map((p) => (
          <button key={p.subject} type="button" aria-pressed={subject === p.subject} onClick={() => setSubject(p.subject)} className={cn("shrink-0 rounded-full border px-3 py-1 text-[13px] font-semibold", subject === p.subject ? "border-transparent bg-[#2563EB] text-white" : "border-line bg-surface text-fg-2")}>{p.subject}</button>
        ))}
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {open.lists.map((l) => (
          <li key={l.id}>
            <a href={`https://www.youtube.com/playlist?list=${l.id}`} target="_blank" rel="noopener noreferrer" className="pick-card flex items-center gap-3 rounded-2xl border border-line bg-[var(--surface-solid)] p-3">
              <MedicalIcon name="youtube" size={44} />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] leading-5 font-bold">{l.title}</span>
                <span className="block text-[13px] text-fg-2">{l.channel}</span>
              </span>
              <span aria-hidden className="text-fg-3">↗</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[13px] leading-[19px] text-fg-2">
        Found a long lecture? <button type="button" onClick={onSummarize} className="font-semibold text-accent-text underline">Summarize it here</button>. These are other creators&apos; channels: RamAI doesn&apos;t make or check these videos.
      </p>
    </>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section>
      <h3 className="mb-1.5 text-[15px] font-bold">{title}</h3>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-[14.5px] leading-[22px]">
        {items.map((x) => <li key={x}>{x}</li>)}
      </ul>
    </section>
  );
}
