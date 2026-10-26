"use client";

import { useMemo, useState } from "react";

import { Rich, RichLines } from "@/components/ui/rich-lines";
import { EmptyState } from "@/components/ui/primitives";
import { grade, isDue, nextIn, removeCard, restoreCard, useDeck, wait, type Card, type CardSource, type Grade } from "@/lib/revision-deck";
import { cn } from "@/lib/cn";
import { tap } from "@/lib/haptics";
import { toast } from "@/lib/toast";

const SOURCES: [CardSource | "all", string][] = [["all", "All"], ["case", "🩺 Cases"], ["skills", "🎯 Skills Lab"], ["exam", "📝 Exams"]];
const GRADES: [Grade, string, string][] = [
  ["again", "Again", "bg-danger-soft text-danger"],
  ["hard", "Hard", "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200"],
  ["good", "Good", "bg-success-soft text-success"],
  ["easy", "Easy", "bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-200"],
];

/** Your deck: review what's due as flashcards (spaced repetition), or browse, search and filter every card. */
export function RevisionDeck() {
  const cards = useDeck();
  const [source, setSource] = useState<CardSource | "all">("all");
  const [q, setQ] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const due = useMemo(() => cards.filter((c) => isDue(c)), [cards]);
  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return [...cards].reverse().filter((c) => (source === "all" || (c.source ?? "case") === source) && words.every((w) => `${c.text} ${c.back ?? ""} ${c.from}`.toLowerCase().includes(w)));
  }, [cards, source, q]);

  if (reviewing) return <Review cards={due} onDone={() => setReviewing(false)} />;

  return (
    <div className="flex flex-col gap-5 py-6">
      <header>
        <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Revision deck</h1>
        <p className="mt-1 text-[14.5px] text-fg-2">Pearls from your cases and the questions you got wrong — reviewed just before you'd forget them. Kept on this phone.</p>
      </header>

      {cards.length > 0 && (
        <section className="ink relative overflow-hidden rounded-[22px] p-5 text-white">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[40px] leading-none font-bold tabular">{due.length}</div>
              <div className="mt-1 text-[13.5px] text-white/75">{due.length === 1 ? "card" : "cards"} due now · {cards.length} in your deck</div>
            </div>
            <button type="button" disabled={!due.length} onClick={() => { tap(); setReviewing(true); }} className="shine h-12 rounded-full px-6 text-[15px] font-semibold text-white shadow-glow disabled:opacity-50">
              {due.length ? "Start review" : "All caught up ✓"}
            </button>
          </div>
        </section>
      )}

      {cards.length === 0 ? (
        <EmptyState icon="book" title="Your deck is empty" body="Questions you get wrong in the Skills Lab and exam practice land here by themselves. You can also tap ☆ Save on any answer, or ＋ Deck next to a pearl after a case." action={{ label: "Open the Skills Lab", href: "/practice" }} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {SOURCES.map(([id, label]) => (
              <button key={id} type="button" aria-pressed={source === id} onClick={() => setSource(id)} className={cn("rounded-full border px-3 py-1.5 text-[13px] font-medium", source === id ? "border-accent-line bg-accent-soft text-accent-text" : "border-line text-fg-2")}>
                {label}
              </button>
            ))}
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your cards" aria-label="Search your cards" className="h-9 min-w-0 flex-1 rounded-full border border-line bg-surface px-3.5 text-[14px] outline-none focus:border-accent-line" />
          </div>
          <ul className="flex flex-col gap-2.5">
            {shown.map((c) => <CardRow key={c.id} c={c} />)}
            {!shown.length && <li className="py-6 text-center text-[14px] text-fg-3">No cards match.</li>}
          </ul>
        </>
      )}
    </div>
  );
}

function CardRow({ c }: { c: Card }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="card flex items-start gap-3 p-4">
      <button type="button" onClick={() => c.back && setOpen((o) => !o)} className="min-w-0 flex-1 text-left">
        <p className="text-[14.5px] leading-6 whitespace-pre-line"><Rich text={c.text} /></p>
        {open && c.back && <RichLines text={c.back} className="mt-2 rounded-xl bg-surface-2 p-3 text-[14px]" />}
        <p className="mt-1 text-[12px] text-fg-3">
          {c.from}
          {c.back && <span className="ml-2 text-accent-text">{open ? "Hide answer" : "Show answer"}</span>}
          {!isDue(c) && c.due && <span className="ml-2">· next in {wait(c.due - Date.now())}</span>}
        </p>
      </button>
      <button type="button" onClick={() => { tap(); removeCard(c.id); toast("Removed from your deck", { tone: "info", action: { label: "Undo", run: () => restoreCard(c) } }); }} aria-label="Remove" className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium text-fg-3 hover:bg-surface-3 hover:text-fg">
        Remove
      </button>
    </li>
  );
}

/** One card at a time: think, show the answer, say how well you knew it. */
function Review({ cards, onDone }: { cards: Card[]; onDone: () => void }) {
  const [queue] = useState(cards);
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const c = queue[i];
  if (!c) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="text-[48px]">🎉</div>
        <h2 className="text-[22px] font-semibold">Review done</h2>
        <p className="text-[14.5px] text-fg-2">{queue.length} {queue.length === 1 ? "card" : "cards"} reviewed. They'll come back when they're due.</p>
        <button type="button" onClick={onDone} className="h-11 rounded-full bg-accent px-6 text-[14.5px] font-semibold text-on-accent">Back to the deck</button>
      </div>
    );
  }
  const answerless = !c.back;
  return (
    <div className="flex flex-col gap-4 py-6">
      <div className="flex items-center justify-between text-[13px] text-fg-2 tabular">
        <button type="button" onClick={onDone} className="rounded-full px-2 py-1 hover:bg-surface-3">← Deck</button>
        <span>{i + 1} / {queue.length}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${(i / queue.length) * 100}%` }} /></div>
      <article key={c.id} className="card animate-enter flex min-h-64 flex-col gap-3 p-5">
        <p className="text-[12px] font-semibold tracking-[0.08em] text-fg-3 uppercase">{c.from}</p>
        <p className="text-[16.5px] leading-7 whitespace-pre-line"><Rich text={c.text} /></p>
        {shown && c.back && <RichLines text={c.back} className="animate-enter mt-1 rounded-xl border border-success/30 bg-success-soft p-3.5 text-[14.5px]" />}
      </article>
      {!shown && !answerless ? (
        <button type="button" autoFocus onClick={() => { tap(); setShown(true); }} className="h-12 rounded-full bg-accent text-[15px] font-semibold text-on-accent">Show answer</button>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {GRADES.map(([g, label, tone]) => (
            <button key={g} type="button" onClick={() => { tap(); grade(c.id, g); setShown(false); setI(i + 1); }} className={cn("flex flex-col items-center rounded-2xl py-2.5 text-[14px] font-semibold", tone)}>
              {label}
              <span className="text-[11px] font-medium opacity-75">{wait(nextIn(c, g))}</span>
            </button>
          ))}
        </div>
      )}
      {answerless && <p className="text-center text-[12.5px] text-fg-3">How well did you remember this?</p>}
    </div>
  );
}
