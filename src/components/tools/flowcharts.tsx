"use client";

import { useMemo, useState } from "react";

import { flashcardsFrom, FLOWCHARTS, type Flowchart, type FlowNode } from "@/lib/tools/flowcharts";
import { cn } from "@/lib/cn";
import { tap } from "@/lib/haptics";

import { AiNote, Flashcards, generate, Search, ToolHeader } from "./tool-parts";

const KIND_STYLE: Record<FlowNode["kind"], string> = {
  question: "border-amber-400 bg-amber-400/10",
  step: "border-blue-500 bg-blue-500/10",
  end: "border-emerald-500 bg-emerald-500/10",
};

/** One chart: walk it with Yes and No, or switch to the whole chart, or drill it as cards. */
export function ChartView({ chart, ai }: { chart: Flowchart; ai?: boolean }) {
  const [view, setView] = useState<"walk" | "all" | "cards">("walk");
  const [path, setPath] = useState<string[]>([chart.nodes[0]!.id]);
  const byId = useMemo(() => new Map(chart.nodes.map((n) => [n.id, n])), [chart]);
  const cards = useMemo(() => flashcardsFrom(chart), [chart]);
  const go = (id?: string) => {
    if (!id) return;
    tap();
    setPath((p) => [...p, id]);
  };
  const now = byId.get(path[path.length - 1]!)!;
  return (
    <div className="rounded-2xl border border-line bg-[var(--surface-solid)] p-4">
      <h2 className="text-[19px] leading-tight font-bold">{chart.title}</h2>
      <p className="mt-0.5 text-[12.5px] text-fg-3">Follows {chart.source}. Use your local protocol where it differs.</p>
      <div role="tablist" className="mt-3 flex gap-1 rounded-xl bg-surface-3 p-1 text-[13.5px] font-semibold">
        {([["walk", "Step by step"], ["all", "Whole chart"], ["cards", `Flashcards (${cards.length})`]] as const).map(([v, t]) => (
          <button key={v} role="tab" type="button" aria-selected={view === v} onClick={() => setView(v)} className={cn("flex-1 rounded-lg px-1.5 py-1.5", view === v && "bg-[var(--surface-solid)] shadow-sm")}>{t}</button>
        ))}
      </div>
      {view === "walk" && (
        <div className="mt-3 flex flex-col items-stretch">
          {path.slice(0, -1).map((id, i) => (
            <div key={`${id}${i}`} className="flex flex-col items-center">
              <p className="w-full rounded-xl border border-line px-3 py-1.5 text-[12.5px] leading-[18px] text-fg-2">{byId.get(id)!.text}</p>
              <span aria-hidden className="py-0.5 text-[12px] font-bold text-fg-3">{byId.get(id)!.yes === path[i + 1] ? "Yes ↓" : byId.get(id)!.no === path[i + 1] ? "No ↓" : "↓"}</span>
            </div>
          ))}
          <Box node={now} />
          {now.kind === "question" && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => go(now.yes)} className="btn-lip min-h-11 rounded-xl bg-emerald-600 text-[15px] font-extrabold text-white [--lip:#047857]">YES</button>
              <button type="button" onClick={() => go(now.no)} className="btn-lip min-h-11 rounded-xl bg-rose-600 text-[15px] font-extrabold text-white [--lip:#be123c]">NO</button>
            </div>
          )}
          {now.kind === "step" && <button type="button" onClick={() => go(now.next)} className="btn-lip mt-3 min-h-11 rounded-xl bg-accent text-[15px] font-extrabold text-on-accent">NEXT</button>}
          {path.length > 1 && <button type="button" onClick={() => setPath([chart.nodes[0]!.id])} className="mt-3 text-[13.5px] font-medium text-fg-2 underline">Start again</button>}
        </div>
      )}
      {view === "all" && (
        <ol className="mt-3 flex flex-col gap-2">
          {chart.nodes.map((n, i) => (
            <li key={n.id}>
              <Box node={n} number={i + 1} />
              {n.kind === "question" && <p className="mt-1 pl-1 text-[12.5px] font-semibold text-fg-2">Yes → box {chart.nodes.findIndex((x) => x.id === n.yes) + 1} · No → box {chart.nodes.findIndex((x) => x.id === n.no) + 1}</p>}
              {n.kind === "step" && <p className="mt-1 pl-1 text-[12.5px] font-semibold text-fg-2">Then → box {chart.nodes.findIndex((x) => x.id === n.next) + 1}</p>}
            </li>
          ))}
        </ol>
      )}
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

function Box({ node, number }: { node: FlowNode; number?: number }) {
  return (
    <div className={cn("rounded-xl border-2 px-3 py-2.5", KIND_STYLE[node.kind])}>
      <p className="text-[14.5px] leading-[21px] font-semibold">{number ? `${number}. ` : ""}{node.text}</p>
      {node.dose && <p className="mt-1 rounded-lg bg-[var(--surface-solid)] px-2 py-1 text-[13px] leading-[18px] font-medium">💊 {node.dose}</p>}
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
