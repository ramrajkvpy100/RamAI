"use client";

import { useMemo, useState } from "react";

import { flashcardsFrom, FLOWCHARTS, type Flowchart } from "@/lib/tools/flowcharts";
import { cn } from "@/lib/cn";
import { tap } from "@/lib/haptics";

import { FlowDiagram } from "./flow-diagram";
import { AiNote, Flashcards, generate, Search, ToolHeader } from "./tool-parts";

/** One chart: the drawing, a walk through it with Yes and No, or drilled as cards. */
export function ChartView({ chart, ai }: { chart: Flowchart; ai?: boolean }) {
  const [view, setView] = useState<"chart" | "cards">("chart");
  const cards = useMemo(() => flashcardsFrom(chart), [chart]);
  return (
    <div className="rounded-2xl border border-line bg-[var(--surface-solid)] p-4">
      <h2 className="text-[19px] leading-tight font-bold">{chart.title}</h2>
      <p className="mt-0.5 text-[12.5px] text-fg-3">Follows {chart.source}. Use your local protocol where it differs.</p>
      <div role="tablist" className="mt-3 flex gap-1 rounded-xl bg-surface-3 p-1 text-[13.5px] font-semibold">
        {([["chart", "Flowchart"], ["cards", `Flashcards (${cards.length})`]] as const).map(([v, t]) => (
          <button key={v} role="tab" type="button" aria-selected={view === v} onClick={() => setView(v)} className={cn("flex-1 rounded-lg px-1.5 py-1.5", view === v && "bg-[var(--surface-solid)] shadow-sm")}>{t}</button>
        ))}
      </div>
      {view === "chart" && <FlowDiagram chart={chart} />}
      {view === "cards" && (
        <div className="mt-3">
          <p className="mb-2 text-[13px] text-fg-2">Management steps that become second nature.</p>
          <Flashcards cards={cards} />
        </div>
      )}
      {ai && <AiNote />}
    </div>
  );
}

export function FlowchartsTool() {
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<Flowchart | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const make = async () => {
    setBusy(true);
    setError(null);
    const r = await generate<Omit<Flowchart, "id" | "specialty">>("flowchart", topic);
    setBusy(false);
    if (r.error || !r.result) return setError(r.error ?? "Please try again.");
    setMade({ ...r.result, id: "ai", specialty: "" });
  };
  const list = FLOWCHARTS.filter((c) => `${c.title} ${c.specialty}`.toLowerCase().includes(filter.trim().toLowerCase()));
  return (
    <div className="pb-6">
      <ToolHeader title="Flowcharts" line={`${FLOWCHARTS.length} ready charts with cut-offs and doses. Or get one for any topic.`} />
      <Search value={topic} onChange={setTopic} onSubmit={() => void make()} busy={busy} action="GET CHART" placeholder="Management of acute pancreatitis…" />
      {error && <p className="mt-2 text-[14px] text-danger">{error}</p>}
      {made && <div className="mt-4"><ChartView key={made.title} chart={made} ai /></div>}
      <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search ready charts" className="mt-6 h-10 w-full rounded-xl border border-line bg-surface px-3 text-[14px] outline-none placeholder:text-fg-3" />
      <div className="mt-3 flex flex-col gap-2">
        {list.map((c) => open === c.id ? <ChartView key={c.id} chart={c} /> : (
          <button key={c.id} type="button" onClick={() => { tap(); setOpen(c.id); }} className="pick-card flex w-full items-center justify-between gap-3 rounded-2xl border border-line bg-[var(--surface-solid)] p-3.5 text-left">
            <span className="text-[15px] font-bold">{c.title}</span>
            <span className="shrink-0 text-[12.5px] text-fg-2">{c.specialty}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
