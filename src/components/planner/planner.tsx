"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { success, tap } from "@/lib/haptics";
import { pendingDoc, saveDoc } from "@/lib/offline-docs";
import { toast } from "@/lib/toast";

/**
 * The planner — built on what research shows works:
 *  · One most important task first ("eat the frog"): the day's biggest win is decided before the day decides for you.
 *  · Habits as implementation intentions — "When ___, I will ___" — which roughly double follow-through (Gollwitzer),
 *    started tiny (a 2-minute version), never missed twice in a row, and given time: ~66 days on average (Lally, 2009).
 *  · An evening review: 3 things that went well (Seligman's "three good things"), 3 that didn't, and 3 improvements —
 *    which become tomorrow's to-dos in one tap.
 * Saved to your account, so it's the same on every device.
 */

interface Todo { id: string; text: string; done: boolean }
interface Day { mit: Todo | null; todos: Todo[]; good: string[]; bad: string[]; better: string[]; habits: Record<string, boolean> }
interface Habit { id: string; name: string; cue: string; tiny: string; created: string }

const EMPTY_DAY: Day = { mit: null, todos: [], good: ["", "", ""], bad: ["", "", ""], better: ["", "", ""], habits: {} };
const uid = () => Math.random().toString(36).slice(2, 10);
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const nice = (k: string) => new Date(`${k}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });

async function load(docs: string[]): Promise<Record<string, unknown>> {
  const r = await fetch(`/api/planner?docs=${encodeURIComponent(docs.join(","))}`, { cache: "no-store" });
  if (!r.ok) throw new Error("load");
  return ((await r.json()) as { docs: Record<string, unknown> }).docs;
}
/** Saved on the phone at once and sent to the account when there's a connection (offline edits aren't lost). */
const save = (doc: string, data: unknown) => saveDoc(doc, data);
const keptHabits = (): Habit[] | null => { try { return JSON.parse(localStorage.getItem("ramai.plan.habits") ?? "null") as Habit[] | null; } catch { return null; } };

export function Planner() {
  const [date, setDate] = useState(() => new Date());
  const today = dayKey(new Date());
  const key = dayKey(date);
  // The review opens by itself in the evening.
  const [review, setReview] = useState(() => new Date().getHours() >= 19);
  const [day, setDay] = useState<Day | null>(null);
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [history, setHistory] = useState<Record<string, Day | null>>({});
  const timer = useRef<number | undefined>(undefined);

  // The day shown and its habits first (one small read); the last 70 days, for streaks, follow in the background.
  useEffect(() => {
    let off = false;
    const kept = (() => { try { return JSON.parse(localStorage.getItem(`ramai.plan.${key}`) ?? "null") as { habits: Habit[]; day: Day } | null; } catch { return null; } })();
    if (kept) { setHabits(kept.habits); setDay({ ...EMPTY_DAY, ...kept.day }); }
    load(["habits", `day:${key}`])
      .then((docs) => {
        if (off) return;
        // Edits made offline that haven't gone up yet win over the account's copy.
        const h = ((pendingDoc("habits") ?? docs.habits) as Habit[] | null) ?? [];
        const d = { ...EMPTY_DAY, ...(((pendingDoc(`day:${key}`) ?? docs[`day:${key}`]) as Day | null) ?? {}) };
        try { localStorage.setItem("ramai.plan.habits", JSON.stringify(h)); } catch {}
        setHabits(h);
        setDay(d);
        try { localStorage.setItem(`ramai.plan.${key}`, JSON.stringify({ habits: h, day: d })); } catch {}
        const past = Array.from({ length: 70 }, (_, n) => `day:${dayKey(addDays(new Date(), -n))}`);
        return load(past).then((more) => !off && setHistory(Object.fromEntries(past.map((p) => [p.slice(4), more[p] as Day | null]))));
      })
      .catch(() => {
        // Offline and this day isn't on the phone yet: a fresh page, with the habits kept from before.
        if (off || kept) return;
        setHabits((pendingDoc("habits") as Habit[] | undefined) ?? keptHabits() ?? []);
        setDay({ ...EMPTY_DAY, ...((pendingDoc(`day:${key}`) as Day | undefined) ?? {}) });
      });
    return () => { off = true; };
  }, [key]);

  // Saved a moment after each change.
  const changeDay = useCallback((next: Day) => {
    setDay(next);
    setHistory((h) => ({ ...h, [key]: next }));
    try { localStorage.setItem(`ramai.plan.${key}`, JSON.stringify({ habits, day: next })); } catch {}
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void save(`day:${key}`, next), 500);
  }, [key, habits]);
  const changeHabits = (next: Habit[]) => {
    setHabits(next);
    try { localStorage.setItem("ramai.plan.habits", JSON.stringify(next)); } catch {}
    void save("habits", next);
  };

  if (!day || !habits) return <div className="flex flex-col gap-3 py-6">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-[22px] bg-surface-3" />)}</div>;

  return (
    <div className="flex flex-col gap-5 py-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Planner</h1>
          <p className="text-[14px] text-fg-2">{key === today ? "Today" : nice(key)}</p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Previous day" onClick={() => setDate((d) => addDays(d, -1))} className="h-9 w-9 rounded-full hover:bg-surface-3">‹</button>
          {key !== today && <button type="button" onClick={() => setDate(new Date())} className="h-9 rounded-full px-3 text-[13px] font-medium hover:bg-surface-3">Today</button>}
          <button type="button" aria-label="Next day" onClick={() => setDate((d) => addDays(d, 1))} className="h-9 w-9 rounded-full hover:bg-surface-3">›</button>
        </div>
      </header>

      {/* One simple page: the one thing, the to-dos, the habits — and the evening review folded away. */}
      <TodayTab day={day} onChange={changeDay} habits={habits} />
      <section>
        <h2 className="mb-2 px-1 text-[15px] font-semibold">🔁 Habits</h2>
        <HabitsTab habits={habits} onChange={changeHabits} day={day} onDay={changeDay} history={history} today={key} />
      </section>
      <details className="panel group p-4" open={review}>
        <summary className="flex cursor-pointer list-none items-center justify-between text-[15px] font-semibold" onClick={(e) => { e.preventDefault(); setReview((r) => !r); }}>
          🌙 Evening review <span className="text-[12.5px] font-normal text-fg-3">{review ? "Hide" : "3 good · 3 not · 3 to improve"}</span>
        </summary>
        {review && <div className="mt-3"><ReviewTab day={day} onChange={changeDay} dateKey={key} /></div>}
      </details>
    </div>
  );
}

function TodayTab({ day, onChange, habits }: { day: Day; onChange: (d: Day) => void; habits: Habit[] }) {
  const [text, setText] = useState("");
  const [mitText, setMitText] = useState("");
  const add = () => {
    const t = text.trim();
    if (!t) return;
    tap();
    onChange({ ...day, todos: [...day.todos, { id: uid(), text: t, done: false }] });
    setText("");
  };
  const toggle = (id: string) => {
    const next = day.todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
    if (next.find((t) => t.id === id)?.done) success();
    onChange({ ...day, todos: next });
  };
  return (
    <div className="flex flex-col gap-4">
      {/* The one thing */}
      <section className="ink relative overflow-hidden rounded-[22px] p-5 text-white">
        <p className="text-[11.5px] font-bold tracking-[0.12em] text-amber-300 uppercase">⭐ Most important today</p>
        {day.mit ? (
          <button type="button" onClick={() => { if (!day.mit!.done) success(); onChange({ ...day, mit: { ...day.mit!, done: !day.mit!.done } }); }} className="mt-2 flex w-full items-start gap-3 text-left">
            <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2", day.mit.done ? "border-amber-300 bg-amber-300 text-[#1e1b4b]" : "border-white/60")}>{day.mit.done ? "✓" : ""}</span>
            <span className={cn("text-[19px] leading-7 font-semibold", day.mit.done && "line-through opacity-70")}>{day.mit.text}</span>
          </button>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); const t = mitText.trim(); if (t) { tap(); onChange({ ...day, mit: { id: uid(), text: t, done: false } }); setMitText(""); } }} className="mt-2 flex gap-2">
            <input value={mitText} onChange={(e) => setMitText(e.target.value)} placeholder="If you did only one thing today…" aria-label="Most important task" className="h-11 min-w-0 flex-1 rounded-full bg-white/12 px-4 text-[15px] text-white outline-none placeholder:text-white/55 focus:bg-white/18" />
            <button type="submit" className="h-11 rounded-full bg-white px-4 text-[14px] font-semibold text-[#312e81]">Set</button>
          </form>
        )}
        {day.mit && <button type="button" onClick={() => onChange({ ...day, mit: null })} className="mt-3 text-[12px] text-white/60 underline">Change it</button>}
        <p className="mt-3 text-[12px] text-white/60">Do this first, before email and messages — the day's biggest win is decided early.</p>
      </section>

      <section className="panel p-4">
        <h2 className="text-[15px] font-semibold">To-do</h2>
        <ul className="mt-2 flex flex-col">
          {day.todos.map((t) => (
            <li key={t.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
              <button type="button" onClick={() => toggle(t.id)} aria-label={t.done ? "Mark not done" : "Mark done"} className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[12px]", t.done ? "border-success bg-success text-white" : "border-line-2")}>{t.done ? "✓" : ""}</button>
              <span className={cn("min-w-0 flex-1 text-[15px]", t.done && "text-fg-3 line-through")}>{t.text}</span>
              <button type="button" onClick={() => onChange({ ...day, mit: t, todos: day.todos.filter((x) => x.id !== t.id) })} title="Make this the most important" className="text-[15px] text-fg-3 hover:text-amber-500">☆</button>
              <button type="button" onClick={() => onChange({ ...day, todos: day.todos.filter((x) => x.id !== t.id) })} aria-label="Delete" className="text-[13px] text-fg-3 hover:text-danger">✕</button>
            </li>
          ))}
        </ul>
        <form onSubmit={(e) => { e.preventDefault(); add(); }} className="mt-2 flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a to-do" aria-label="Add a to-do" className="h-11 min-w-0 flex-1 rounded-full border border-line bg-surface px-4 text-[15px] outline-none focus:border-accent-line" />
          <button type="submit" className="h-11 rounded-full bg-accent px-4 text-[14px] font-semibold text-on-accent">Add</button>
        </form>
      </section>

    </div>
  );
}

function streakOf(id: string, history: Record<string, Day | null>, today: string) {
  // Consecutive days done, counting back from today (today not done yet doesn't break it).
  let n = 0;
  for (let k = 0; k < 70; k++) {
    const d = dayKey(addDays(new Date(`${today}T12:00:00`), -k));
    const done = history[d]?.habits?.[id];
    if (done) n++;
    else if (k > 0) break;
  }
  return n;
}
function missedTwice(id: string, history: Record<string, Day | null>, today: string) {
  const y1 = dayKey(addDays(new Date(`${today}T12:00:00`), -1)), y2 = dayKey(addDays(new Date(`${today}T12:00:00`), -2));
  return !history[y1]?.habits?.[id] && !history[y2]?.habits?.[id];
}

function HabitsTab({ habits, onChange, day, onDay, history, today }: { habits: Habit[]; onChange: (h: Habit[]) => void; day: Day; onDay: (d: Day) => void; history: Record<string, Day | null>; today: string }) {
  const [adding, setAdding] = useState(habits.length === 0);
  const [name, setName] = useState("");
  const [cue, setCue] = useState("");
  const [tiny, setTiny] = useState("");
  const add = () => {
    if (!name.trim()) return;
    tap();
    onChange([...habits, { id: uid(), name: name.trim(), cue: cue.trim(), tiny: tiny.trim(), created: today }]);
    setName(""); setCue(""); setTiny(""); setAdding(false);
  };
  return (
    <div className="flex flex-col gap-3">
      {habits.map((h) => {
        const done = !!day.habits[h.id];
        const streak = streakOf(h.id, { ...history, [today]: day }, today);
        const daysIn = Math.max(1, Math.round((Date.now() - new Date(`${h.created}T00:00:00`).getTime()) / 86_400_000) + 1);
        const warn = !done && daysIn > 2 && missedTwice(h.id, history, today);
        return (
          <article key={h.id} className={cn("panel flex items-start gap-3 px-4 py-3", done && "border-success/40")}>
            <button type="button" onClick={() => { if (!done) success(); onDay({ ...day, habits: { ...day.habits, [h.id]: !done } }); }} aria-label={done ? "Not done today" : "Done today"} className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-[15px]", done ? "border-success bg-success text-white" : "border-line-2")}>{done ? "✓" : ""}</button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-[15.5px] font-semibold">{h.name}</h3>
                {streak > 0 && <span className="rounded-full bg-orange-500/12 px-2 py-0.5 text-[12px] font-semibold text-orange-600 tabular dark:text-orange-300">🔥 {streak}</span>}
              </div>
              {h.cue && <p className="mt-0.5 text-[13px] text-fg-2">When {h.cue}, I will {h.name.toLowerCase()}.</p>}
              {h.tiny && <p className="text-[12.5px] text-fg-3">On a hard day: {h.tiny}</p>}
              {warn && <p className="mt-1 text-[12.5px] font-medium text-amber-700 dark:text-amber-300">Missed two days — never miss twice: do the tiny version today.</p>}
              <p className="mt-0.5 text-[11.5px] text-fg-3 tabular">Day {daysIn} of ~66 to make it automatic</p>
            </div>
            <button type="button" onClick={() => onChange(habits.filter((x) => x.id !== h.id))} aria-label="Remove habit" className="text-[13px] text-fg-3 hover:text-danger">✕</button>
          </article>
        );
      })}
      {adding ? (
        <form onSubmit={(e) => { e.preventDefault(); add(); }} className="panel flex flex-col gap-2.5 p-4">
          <h3 className="text-[15px] font-semibold">New habit</h3>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="The habit — e.g. Revise 10 flashcards" aria-label="Habit" className="h-11 rounded-xl border border-line bg-surface px-3.5 text-[15px] outline-none focus:border-accent-line" />
          <label className="text-[13px] text-fg-2">When will you do it? (after something you already do)
            <input value={cue} onChange={(e) => setCue(e.target.value)} placeholder="e.g. I finish my morning tea" aria-label="Cue" className="mt-1 h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-[15px] outline-none focus:border-accent-line" />
          </label>
          <p className="text-[12px] text-fg-3">Tie it to something you already do — that's what makes habits stick. Start small; never miss twice.</p>
          <div className="flex justify-end gap-2">
            {habits.length > 0 && <button type="button" onClick={() => setAdding(false)} className="h-10 rounded-full px-4 text-[14px] font-medium text-fg-2">Cancel</button>}
            <button type="submit" className="h-10 rounded-full bg-accent px-5 text-[14px] font-semibold text-on-accent">Add habit</button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="h-11 rounded-full border border-dashed border-line-2 text-[14px] font-medium text-fg-2 hover:bg-surface-2">＋ New habit</button>
      )}
    </div>
  );
}

function ThreeLines({ label, hint, emoji, values, onChange }: { label: string; hint: string; emoji: string; values: string[]; onChange: (v: string[]) => void }) {
  return (
    <section className="panel p-4">
      <h3 className="text-[15px] font-semibold">{emoji} {label}</h3>
      <p className="text-[12.5px] text-fg-3">{hint}</p>
      <div className="mt-2 flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <input key={i} value={values[i] ?? ""} onChange={(e) => { const v = [...values]; v[i] = e.target.value.slice(0, 200); onChange(v); }} placeholder={`${i + 1}.`} aria-label={`${label} ${i + 1}`} className="h-11 rounded-xl border border-line bg-surface px-3.5 text-[15px] outline-none focus:border-accent-line" />
        ))}
      </div>
    </section>
  );
}

function ReviewTab({ day, onChange, dateKey }: { day: Day; onChange: (d: Day) => void; dateKey: string }) {
  const filled = useMemo(() => day.better.filter((b) => b.trim()), [day.better]);
  const toTomorrow = async () => {
    const tomorrow = dayKey(addDays(new Date(`${dateKey}T12:00:00`), 1));
    try {
      // Offline: tomorrow as this phone has it.
      const docs = await load([`day:${tomorrow}`]).catch(() => {
        try { return { [`day:${tomorrow}`]: (JSON.parse(localStorage.getItem(`ramai.plan.${tomorrow}`) ?? "null") as { day: Day } | null)?.day ?? null }; } catch { return {}; }
      });
      const t = { ...EMPTY_DAY, ...(((pendingDoc(`day:${tomorrow}`) ?? docs[`day:${tomorrow}`]) as Day | null) ?? {}) };
      const have = new Set(t.todos.map((x) => x.text));
      const next = { ...t, todos: [...t.todos, ...filled.filter((b) => !have.has(b)).map((b) => ({ id: uid(), text: b, done: false }))] };
      await save(`day:${tomorrow}`, next);
      success();
      toast(`Added ${filled.length} to tomorrow's to-do`);
    } catch {
      toast("Couldn't add — try again", { tone: "info" });
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13.5px] text-fg-2">A few minutes each evening. Writing down what went well lifts mood; naming what didn't — and one fix for each — makes tomorrow better.</p>
      <ThreeLines emoji="🌟" label="3 things that went well" hint="Big or small — and why they went well." values={day.good} onChange={(good) => onChange({ ...day, good })} />
      <ThreeLines emoji="🌧️" label="3 things that didn't" hint="Honest, not harsh." values={day.bad} onChange={(bad) => onChange({ ...day, bad })} />
      <ThreeLines emoji="🛠️" label="3 improvements for tomorrow" hint="Small, specific actions — they become tomorrow's to-dos." values={day.better} onChange={(better) => onChange({ ...day, better })} />
      <button type="button" disabled={!filled.length} onClick={() => void toTomorrow()} className="h-12 rounded-full bg-accent text-[15px] font-semibold text-on-accent disabled:opacity-50">
        Add {filled.length || ""} improvement{filled.length === 1 ? "" : "s"} to tomorrow&apos;s to-do →
      </button>
    </div>
  );
}
