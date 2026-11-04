"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { EcgTrace } from "@/components/media/ecg";
import { MedicalIcon } from "@/components/ui/medical-icons";
import { comboMultiplier, finishGame, localStats, RUSH_LEVELS, savedLevel, saveLevel, type Level } from "@/lib/games/score";
import { cn } from "@/lib/cn";
import { success, tap } from "@/lib/haptics";
import type { DrillItem, Modality } from "@/lib/practice";

import { BackTo, GameOver, LevelPicker, LipButton } from "./game-parts";

const MODALITIES: Modality[] = ["clinical", "xray", "ct", "ecg", "smear", "usg"];

async function fetchRound(modality: Modality): Promise<DrillItem[]> {
  const ask = () => fetch("/api/practice/round", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ modality, mode: "rapid" }) });
  let res = await ask();
  // Not signed in: a guest session is enough to play.
  if (res.status === 401) {
    await fetch("/api/auth/guest", { method: "POST" }).catch(() => undefined);
    res = await ask();
  }
  if (!res.ok) return [];
  const data = (await res.json()) as { items?: DrillItem[] };
  return data.items ?? [];
}

const shuffled = <T,>(xs: T[]) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};

/** Fewer choices on easy: the answer and the closest look-alikes, still in their own order. */
function narrowed(item: DrillItem, count: number): DrillItem {
  if (item.options.length <= count) return item;
  const keep = new Set([item.answer]);
  for (let i = 0; keep.size < count && i < item.options.length; i++) keep.add(i);
  const order = [...keep].sort((a, b) => a - b);
  return { ...item, options: order.map((i) => item.options[i]!), answer: order.indexOf(item.answer) };
}

type Stage = "ready" | "loading" | "playing" | "over" | "failed";

/** 60 seconds against the clock, on the Skills Lab's real images. Right: points and time. Wrong: time lost and the combo gone. */
export function ImageRush() {
  const [stage, setStage] = useState<Stage>("ready");
  const [deck, setDeck] = useState<DrillItem[]>([]);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [endsAt, setEndsAt] = useState(0);
  const [now, setNow] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [shake, setShake] = useState(false);
  const [right, setRight] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [gain, setGain] = useState<string | null>(null);
  const [result, setResult] = useState<{ xp: number; best: number; isBest: boolean } | null>(null);
  const [seen, setSeen] = useState<DrillItem[]>([]);
  const [best, setBest] = useState(0);
  const [level, setLevelState] = useState<Level>("medium");
  const rules = RUSH_LEVELS[level];
  const finished = useRef(false);

  useEffect(() => {
    setBest(localStats().best.rush ?? 0);
    setLevelState(savedLevel("rush"));
  }, []);
  const setLevel = (l: Level) => {
    setLevelState(l);
    saveLevel("rush", l);
  };

  const begin = useCallback(async () => {
    tap();
    setStage("loading");
    const rounds = await Promise.all(MODALITIES.map(fetchRound));
    const all = shuffled(rounds.flat()).map((x) => narrowed(x, RUSH_LEVELS[level].options));
    if (all.length < 4) return setStage("failed");
    finished.current = false;
    setDeck(all);
    setI(0);
    setScore(0);
    setStreak(0);
    setRight(0);
    setWrong(0);
    setPicked(null);
    setSeen([]);
    setResult(null);
    setEndsAt(Date.now() + RUSH_LEVELS[level].startMs);
    setNow(Date.now());
    setStage("playing");
  }, [level]);

  // The clock, and the end of the game when it runs out.
  useEffect(() => {
    if (stage !== "playing") return;
    const t = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(t);
  }, [stage]);
  useEffect(() => {
    if (stage !== "playing" || now < endsAt || finished.current) return;
    finished.current = true;
    setResult(finishGame("rush", score));
    setStage("over");
  }, [stage, now, endsAt, score]);

  // The next picture is fetched before it's needed, so the clock isn't spent waiting.
  useEffect(() => {
    const next = deck[i + 1]?.image;
    if (next) new Image().src = next;
  }, [deck, i]);

  const item = deck[i % Math.max(1, deck.length)];

  const answer = (n: number) => {
    if (!item || picked !== null) return;
    setPicked(n);
    setSeen((s) => [...s, item]);
    if (n === item.answer) {
      const nextStreak = streak + 1;
      const points = rules.points * comboMultiplier(nextStreak);
      success();
      setStreak(nextStreak);
      setScore((x) => x + points);
      setRight((x) => x + 1);
      setEndsAt((e) => e + rules.rightMs);
      setGain(`+${points}`);
    } else {
      setStreak(0);
      setWrong((x) => x + 1);
      setEndsAt((e) => e - rules.wrongMs);
      setShake(true);
      setGain(`−${rules.wrongMs / 1000}s`);
    }
    window.setTimeout(() => {
      setShake(false);
      setGain(null);
      setPicked(null);
      setI((x) => x + 1);
    }, n === item.answer ? 350 : 800);
  };

  if (stage === "ready" || stage === "loading" || stage === "failed")
    return (
      <>
        <BackTo href="/practice" label="Skills Lab" />
        <div className="panel flex flex-col items-center gap-3 p-6 text-center">
          <MedicalIcon name="image-rush" size={72} />
          <h1 className="text-[26px] font-bold">Image Rush</h1>
          <p className="text-[15px] leading-6 text-fg-2">Identify medical images against the clock: Radiology, Dermatology and Ophthalmology spotter practice.</p>
          <LevelPicker level={level} onChange={setLevel} line={rules.line} />
          <p className="text-[14px] leading-6">Right: <b>+{rules.points} points</b>. A streak of 3, 6 or 10 pays <b>2×, 3× or 5×</b>. A wrong answer ends the streak.</p>
          {best > 0 && <p className="text-[13.5px] font-medium text-fg-2">Your best: {best.toLocaleString("en-IN")}</p>}
          {stage === "failed" && <p className="text-[14px] text-danger">The images couldn&apos;t load. Check your connection and try again.</p>}
          <LipButton onClick={() => void begin()} disabled={stage === "loading"} className="mt-1 w-full max-w-xs">{stage === "loading" ? "LOADING IMAGES…" : "START RUSH"}</LipButton>
        </div>
      </>
    );

  if (stage === "over" && result)
    return (
      <GameOver title="Time's up" score={score} xp={result.xp} best={result.best} isBest={result.isBest} again={() => void begin()}>
        <p className="text-[14px] text-fg-2">{right} right · {wrong} wrong</p>
        <Credits items={seen} />
      </GameOver>
    );

  if (!item) return null;
  const left = Math.max(0, endsAt - now);
  const multiplier = comboMultiplier(streak);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <p className={cn("w-[74px] text-[28px] leading-none font-extrabold tabular", left < 10_000 && "text-danger")}>{Math.ceil(left / 1000)}s</p>
        <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-3">
          <div className={cn("h-full rounded-full transition-[width] duration-100 ease-linear", left < 10_000 ? "bg-danger" : "bg-accent")} style={{ width: `${Math.min(100, (left / rules.startMs) * 100)}%` }} />
        </div>
        <p className="text-right text-[20px] leading-none font-extrabold tabular">{score.toLocaleString("en-IN")}</p>
      </div>
      <p className="h-5 text-center text-[13.5px] font-semibold">
        {gain ? <span className={gain.startsWith("+") ? "text-success" : "text-danger"}>{gain}</span> : multiplier > 1 ? <span className="text-accent-text">{multiplier}× combo · streak {streak}</span> : streak > 0 ? <span className="text-fg-2">Streak {streak}</span> : null}
      </p>
      <figure className={cn("overflow-hidden rounded-2xl bg-black", shake && "game-shake ring-4 ring-danger")}>
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={item.image} src={item.image} alt="Name this image" className="mx-auto block h-[min(42vh,340px)] w-full object-contain" />
        ) : item.ecg ? (
          <div className="bg-white"><EcgTrace spec={item.ecg} seed={i + 3} className="block h-auto w-full" /></div>
        ) : null}
      </figure>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {item.options.map((o, n) => (
          <button key={o} type="button" onClick={() => answer(n)} disabled={picked !== null} className={cn("pick-card min-h-12 rounded-xl border-2 bg-[var(--surface-solid)] px-3 py-2 text-left text-[14.5px] leading-5 font-medium", picked === null ? "border-line" : n === item.answer ? "border-success bg-success-soft" : picked === n ? "border-danger bg-danger-soft" : "border-line opacity-60")}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The licences ask for credit. During the game a credit would name the answer, so they're all here at the end. */
function Credits({ items }: { items: DrillItem[] }) {
  const credited = [...new Map(items.filter((x) => x.credit).map((x) => [x.credit!.source, x.credit!])).values()];
  if (!credited.length) return null;
  return (
    <details className="mt-2 w-full text-left text-[12px] text-fg-3">
      <summary className="cursor-pointer text-center font-medium">Image credits ({credited.length})</summary>
      <ul className="mt-2 flex flex-col gap-1">
        {credited.map((c) => (
          <li key={c.source}><a href={c.source} target="_blank" rel="noopener noreferrer" className="underline">{c.author} · {c.license}</a></li>
        ))}
      </ul>
    </details>
  );
}
