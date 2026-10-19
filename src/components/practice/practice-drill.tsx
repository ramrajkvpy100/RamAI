"use client";

import { ReportProblem } from "@/components/case/report-problem";
import { useCallback, useEffect, useRef, useState } from "react";

import { EcgTrace } from "@/components/media/ecg";
import { FillingBar } from "@/components/ui/filling-bar";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { MODALITIES, MODALITY_IDS, RAPID_SECONDS, type DrillItem, type Modality, type PracticeMode } from "@/lib/practice";
import { playSfx } from "@/lib/sfx";

interface Stat {
  modality: Modality;
  rounds: number;
  correct: number;
  total: number;
  best: number;
}

const ICON: Record<Modality, "pulse" | "scan" | "layers" | "monitor" | "droplet"> = { ecg: "pulse", xray: "scan", ct: "layers", usg: "monitor", smear: "droplet" };

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) {
    // The server's own words when it gave any (a rate limit, a sign-in problem); a timeout has none.
    const json = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    throw new Error(json?.error?.code === "RATE_LIMITED" && json.error.message ? json.error.message : res.status === 504 ? "Finding the pictures took too long. Please try again — the ones found so far are kept." : "The pictures couldn't be loaded. Please try again.");
  }
  return (await res.json()) as T;
}

/** Practice: pick a modality and a mode, then name what you see — at your own pace, or as many as you can in a minute. */
export function PracticeDrill({ stats: initialStats, level = "full", order = MODALITY_IDS }: { stats: Stat[]; level?: "basic" | "full"; order?: readonly Modality[] }) {
  const [modality, setModality] = useState<Modality>(order[0] ?? "ecg");
  const [mode, setMode] = useState<PracticeMode>("spot");
  const [items, setItems] = useState<DrillItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [right, setRight] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [ends, setEnds] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [over, setOver] = useState(false);
  const [stats, setStats] = useState(initialStats);
  const [readyNote, setReadyNote] = useState<string | null>(null);
  const reported = useRef(false);

  const start = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await post<{ items: DrillItem[]; ready: number; total: number; offline?: boolean }>("/api/practice/round", { modality, mode, level });
      if (r.items.length === 0) {
        setError(r.offline ? "Pictures for this one can't be gathered right now — the picture checker is offline. Try the ECGs meanwhile." : "The pictures for this one are still being gathered. Try the ECGs meanwhile, or come back in a minute.");
        return;
      }
      setReadyNote(r.ready < r.total ? `${r.ready} of ${r.total} diagnoses ready — more pictures are being added.` : null);
      setItems(r.items);
      setIndex(0);
      setPicked(null);
      setRight(0);
      setAnswered(0);
      setOver(false);
      reported.current = false;
      setEnds(mode === "rapid" ? Date.now() + RAPID_SECONDS * 1000 : null);
    } catch (err) {
      setError(err instanceof Error && err.message.length > 3 ? err.message : "The pictures couldn't be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const finish = useCallback(() => {
    setOver(true);
    playSfx("win");
  }, []);

  // Rapid-fire: the clock runs out.
  useEffect(() => {
    if (!ends || over) return;
    const t = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= ends) finish();
    }, 200);
    return () => clearInterval(t);
  }, [ends, over, finish]);

  // A finished round goes on their own record.
  useEffect(() => {
    if (!over || reported.current || answered === 0) return;
    reported.current = true;
    void post("/api/practice/result", { modality, mode, correct: right, total: answered }).catch(() => undefined);
    setStats((st) => {
      const row = st.find((s) => s.modality === modality) ?? { modality, rounds: 0, correct: 0, total: 0, best: 0 };
      const next = { ...row, rounds: row.rounds + 1, correct: row.correct + right, total: row.total + answered, best: mode === "rapid" ? Math.max(row.best, right) : row.best };
      return [next, ...st.filter((s) => s.modality !== modality)];
    });
  }, [over, answered, right, modality, mode]);

  const choose = (i: number) => {
    if (!items || picked !== null || over) return;
    const item = items[index]!;
    const ok = i === item.answer;
    setPicked(i);
    playSfx(ok ? "correct" : "wrong");
    setAnswered((a) => a + 1);
    if (ok) setRight((r) => r + 1);
    // Rapid-fire keeps moving: a beat to see the answer, then the next picture.
    if (mode === "rapid") setTimeout(() => next(), ok ? 450 : 1100);
  };

  const next = () => {
    if (!items) return;
    if (index + 1 >= items.length) return finish();
    setIndex((i) => i + 1);
    setPicked(null);
  };

  if (!items) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {order.map((id) => {
            const st = stats.find((s) => s.modality === id);
            return (
              <button
                key={id}
                type="button"
                aria-pressed={modality === id}
                onClick={() => setModality(id)}
                className={cn("panel flex flex-col items-start gap-2 p-4 text-left transition-colors", modality === id ? "ring-2 ring-accent" : "hover:bg-surface-2")}
              >
                <Icon name={ICON[id]} size={20} className="text-accent-text" />
                <span className="text-[15px] font-semibold">{MODALITIES[id].label}</span>
                <span className="text-[12px] text-fg-3 tabular">{st && st.total ? `${Math.round((st.correct / st.total) * 100)}% · best ${st.best}` : `${MODALITIES[id].items.length} diagnoses`}</span>
              </button>
            );
          })}
        </div>
        <div className="panel flex flex-col gap-4 p-5 sm:p-6">
          <div role="radiogroup" aria-label="Mode" className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["spot", "Spot the diagnosis", "Ten pictures, at your own pace, with the key feature after each."],
                ["rapid", "Rapid-fire", `As many as you can name in ${RAPID_SECONDS} seconds.`],
              ] as const
            ).map(([id, label, note]) => (
              <button key={id} type="button" role="radio" aria-checked={mode === id} onClick={() => setMode(id)} className={cn("flex flex-col items-start rounded-xl border px-4 py-3 text-left", mode === id ? "border-accent-line bg-accent-soft" : "border-line hover:bg-surface-2")}>
                <span className="flex items-center gap-2 text-[14.5px] font-semibold">
                  <Icon name={id === "rapid" ? "bolt" : "eye"} size={15} /> {label}
                </span>
                <span className="mt-0.5 text-[12.5px] text-fg-2">{note}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => void start()} disabled={loading} className="flex h-11 items-center justify-center rounded-full bg-accent text-[14.5px] font-semibold text-on-accent disabled:opacity-60">
            {loading ? "Gathering pictures…" : `Start ${MODALITIES[modality].label} ${mode === "rapid" ? "rapid-fire" : "practice"}`}
          </button>
          {loading && <FillingBar active expectedMs={modality === "ecg" ? 3_000 : 30_000} label="Gathering pictures" />}
          {error && (
            <p role="alert" className="flex items-center gap-2 rounded-xl bg-danger-soft px-3.5 py-2.5 text-[13.5px] text-danger">
              <Icon name="alert" size={15} /> {error}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (over) {
    const pct = answered ? Math.round((right / answered) * 100) : 0;
    return (
      <div className="panel mx-auto flex max-w-lg flex-col items-center gap-3 p-7 text-center">
        <div className="micro text-fg-2">{MODALITIES[modality].label} · {mode === "rapid" ? "rapid-fire" : "spot the diagnosis"}</div>
        <div className="text-[52px] font-semibold tabular">{mode === "rapid" ? right : `${right}/${answered}`}</div>
        <p className="text-[14.5px] text-fg-2">{mode === "rapid" ? `named correctly in ${RAPID_SECONDS} seconds (${pct}% of ${answered})` : pct >= 80 ? "Sharp eyes." : pct >= 50 ? "Good — read the key features of the ones you missed." : "Keep going — the key features are what to remember."}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => void start()} disabled={loading} className="h-10 rounded-full bg-accent px-5 text-[14px] font-semibold text-on-accent">
            {loading ? "Loading…" : "Again"}
          </button>
          <button type="button" onClick={() => setItems(null)} className="h-10 rounded-full bg-surface-3 px-5 text-[14px] font-medium">
            Change
          </button>
        </div>
      </div>
    );
  }

  const item = items[index]!;
  const left = ends ? Math.max(0, Math.ceil((ends - now) / 1000)) : null;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between text-[13px] text-fg-2 tabular">
        <button type="button" onClick={() => setItems(null)} className="flex items-center gap-1.5 font-medium hover:text-fg">
          <Icon name="arrow-left" size={13} /> {MODALITIES[modality].label}
        </button>
        <span>{mode === "rapid" ? `${right} right` : `${index + 1} of ${items.length} · ${right} right`}</span>
        {left !== null && <span className={cn("rounded-full px-2.5 py-0.5 font-semibold", left <= 10 ? "bg-danger-soft text-danger" : "bg-surface-3 text-fg")}>{left}s</span>}
      </div>
      {readyNote && index === 0 && <p className="text-[12px] text-fg-3">{readyNote}</p>}
      <figure className="overflow-hidden rounded-2xl bg-black ring-1 ring-line">
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={item.image} src={item.image} alt={`${MODALITIES[modality].label} to name`} className="mx-auto block max-h-[52dvh] w-auto max-w-full animate-fade object-contain" />
        ) : item.ecg ? (
          <div className="bg-white">
            <EcgTrace spec={item.ecg} seed={index + 3} className="block h-auto w-full" />
          </div>
        ) : null}
        <figcaption className="bg-black px-3 py-1.5 text-[10.5px] text-white/55">
          {item.credit ? `Real image · ${item.credit.author} · ${item.credit.license}, Wikimedia Commons` : "RamAI drawn tracing"}
        </figcaption>
      </figure>
      <div className="grid gap-2 sm:grid-cols-2">
        {item.options.map((o, i) => {
          const state = picked === null ? "idle" : i === item.answer ? "right" : i === picked ? "wrong" : "other";
          return (
            <button
              key={o}
              type="button"
              disabled={picked !== null}
              onClick={() => choose(i)}
              className={cn(
                "rounded-xl border px-4 py-3 text-left text-[14.5px] font-medium transition-colors",
                state === "idle" && "border-line bg-surface hover:border-accent-line hover:bg-accent-soft",
                state === "right" && "border-success bg-success-soft",
                state === "wrong" && "border-danger bg-danger-soft",
                state === "other" && "border-line bg-surface opacity-55",
              )}
            >
              {o}
            </button>
          );
        })}
      </div>
      {picked !== null && mode === "spot" && (
        <div className="panel animate-enter p-4">
          <div className={cn("text-[14px] font-semibold", picked === item.answer ? "text-success" : "text-danger")}>{picked === item.answer ? "Correct" : `It's ${item.options[item.answer]}`}</div>
          <p className="mt-1 text-[14px] leading-6">{item.key}</p>
          {picked !== item.answer && item.keys?.[picked] && (
            <div className="mt-3 rounded-xl border border-amber-300/50 bg-amber-50 px-3.5 py-2.5 dark:border-amber-400/30 dark:bg-amber-400/10">
              <div className="text-[11px] font-bold tracking-[0.08em] text-amber-800 uppercase dark:text-amber-200">Why not {item.options[picked]}?</div>
              <p className="mt-1 text-[13.5px] leading-6 text-amber-900 dark:text-amber-100">{item.options[picked]} would show {item.keys[picked]!.replace(/\.$/, "").replace(/^./, (c) => c.toLowerCase())} — not what this picture shows.</p>
            </div>
          )}
          {item.credit && (
            <a href={item.credit.source} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[12px] text-fg-3 underline">
              Image source
            </a>
          )}
          <div className="mt-3 flex items-center justify-between gap-2">
            <ReportProblem compact target={{ area: "skills", ref: `Spot the diagnosis · ${MODALITIES[modality].label} · ${item.options[item.answer]}`, details: `Picture: ${item.image ?? "drawn ECG"}\nOptions: ${item.options.map((o, n) => `${n === item.answer ? "✓ " : ""}${o}`).join(" | ")}\nKey: ${item.key}` }} />
            <button type="button" onClick={next} autoFocus className="h-10 rounded-full bg-accent px-5 text-[14px] font-semibold text-on-accent">
              {index + 1 < items.length ? "Next" : "See your score"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
