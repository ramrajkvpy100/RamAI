"use client";

import { useEffect, useMemo, useState } from "react";

import { MedicalIcon } from "@/components/ui/medical-icons";
import { CLUE_LABELS, CLUE_POINTS, PROBE_CASES, type ProbeCase } from "@/lib/games/probe";
import { DETECTIVE_LEVELS, finishGame, localStats, savedLevel, saveLevel, type Level } from "@/lib/games/score";
import { cn } from "@/lib/cn";
import { success, tap } from "@/lib/haptics";

import { BackTo, GameOver, LevelPicker, LipButton } from "./game-parts";

const DONE_KEY = "ramai.probe.done";
const readDone = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(DONE_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
};
const shuffled = <T,>(xs: readonly T[]) => [...xs].map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map((x) => x[1]);

/** The next mystery not solved yet; when they're all done, any of them again. */
function nextCase(): ProbeCase {
  const done = readDone();
  const open = PROBE_CASES.filter((c) => !done.includes(c.id));
  const from = open.length ? open : PROBE_CASES;
  return from[Math.floor(Math.random() * from.length)]!;
}

export function Detective() {
  const [mystery, setMystery] = useState<ProbeCase | null>(null);
  const [best, setBest] = useState(0);
  const [solved, setSolved] = useState(0);
  const [level, setLevelState] = useState<Level>("medium");
  useEffect(() => {
    setBest(localStats().best.probe ?? 0);
    setSolved(readDone().length);
    setLevelState(savedLevel("probe"));
  }, []);
  const setLevel = (l: Level) => {
    setLevelState(l);
    saveLevel("probe", l);
  };
  const start = () => {
    tap();
    setMystery(nextCase());
  };
  if (mystery) return <Mystery key={mystery.id} mystery={mystery} level={level} onNext={() => setMystery(nextCase())} />;
  const rules = DETECTIVE_LEVELS[level];
  return (
    <>
      <BackTo href="/practice" label="Skills Lab" />
      <div className="panel flex flex-col items-center gap-3 p-6 text-center">
        <MedicalIcon name="probe" size={72} />
        <h1 className="text-[26px] font-bold">Case Detective</h1>
        <p className="text-[15px] leading-6 text-fg-2">Solve medical mysteries by connecting clues.</p>
        <LevelPicker level={level} onChange={setLevel} line={rules.line} />
        <p className="text-[14px] leading-6">Five clues, worth <b>{Math.round(500 * rules.scale)}</b> down to <b>{Math.round(100 * rules.scale)}</b> points. Lock in early for more.</p>
        <p className="text-[13.5px] font-medium text-fg-2">{solved} of {PROBE_CASES.length} solved{best ? ` · best ${best}` : ""}</p>
        <LipButton onClick={start} className="w-full max-w-xs">START CASE</LipButton>
      </div>
    </>
  );
}

function Mystery({ mystery, level, onNext }: { mystery: ProbeCase; level: Level; onNext: () => void }) {
  const rules = DETECTIVE_LEVELS[level];
  const [shown, setShown] = useState(1);
  const [wrong, setWrong] = useState<string[]>([]);
  const [choice, setChoice] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<"right" | "lost" | null>(null);
  const [result, setResult] = useState<ReturnType<typeof finishGame> | null>(null);
  const [points, setPoints] = useState(0);
  // Easy keeps the answer and the first decoys; the decoys are real look-alikes.
  const options = useMemo(() => shuffled([mystery.answer, ...mystery.decoys.slice(0, rules.options - 1)]), [mystery, rules.options]);
  const worth = (clues: number) => Math.round(CLUE_POINTS[Math.min(clues, 5) - 1]! * rules.scale);

  const end = (right: boolean, score: number) => {
    setOutcome(right ? "right" : "lost");
    setPoints(score);
    setResult(finishGame("probe", score));
    if (right) {
      success();
      try {
        localStorage.setItem(DONE_KEY, JSON.stringify([...new Set([...readDone(), mystery.id])]));
      } catch {}
    }
  };
  const lock = () => {
    if (!choice || outcome) return;
    if (choice === mystery.answer) return end(true, worth(shown));
    const nowWrong = [...wrong, choice];
    setWrong(nowWrong);
    setChoice(null);
    if (nowWrong.length >= rules.guesses) return end(false, 0);
    // A wrong guess with chances left: it costs a clue, and the clue helps.
    setShown((n) => Math.min(5, n + 1));
  };
  const visible = outcome ? 5 : shown;
  const chances = rules.guesses - wrong.length;
  return (
    <div className="flex flex-col gap-3 pb-6">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-fg-2">{mystery.specialty}</p>
        {!outcome && <p className="rounded-full bg-accent-soft px-3 py-1 text-[13px] font-bold text-accent-text tabular">Now worth {worth(shown)}</p>}
      </div>
      <ol className="flex flex-col gap-2">
        {mystery.clues.slice(0, visible).map((clue, n) => (
          <li key={n} className="panel animate-rise p-3.5">
            <p className="mb-1 flex items-center justify-between gap-2 text-[11.5px] font-bold tracking-wide text-fg-2 uppercase">
              <span>Clue {n + 1}: {CLUE_LABELS[n]}</span>
              <span className="tabular">{worth(n + 1)}</span>
            </p>
            <p className="text-[14.5px] leading-[22px]">{clue}</p>
          </li>
        ))}
      </ol>
      {!outcome && shown < 5 && (
        <button type="button" onClick={() => { tap(); setShown((n) => n + 1); }} className="rounded-xl border border-line bg-surface py-2.5 text-[14px] font-semibold">
          Reveal next clue (drops to {worth(shown + 1)})
        </button>
      )}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 flex w-full justify-between text-[14px] font-semibold">
          <span>Your diagnosis</span>
          {!outcome && rules.guesses > 1 && <span className="font-medium text-fg-2">{chances} {chances === 1 ? "guess" : "guesses"} left</span>}
        </legend>
        {options.map((o) => {
          const out = wrong.includes(o);
          return (
            <button key={o} type="button" disabled={!!outcome || out} aria-pressed={choice === o} onClick={() => { tap(); setChoice(o); }} className={cn("pick-card min-h-11 rounded-xl border-2 bg-[var(--surface-solid)] px-3 py-2 text-left text-[14.5px] font-medium", outcome && o === mystery.answer ? "border-success bg-success-soft" : out ? "border-danger bg-danger-soft line-through opacity-70" : outcome ? "border-line opacity-60" : choice === o ? "border-[#2563EB]" : "border-line")}>
              {o}
            </button>
          );
        })}
      </fieldset>
      {!outcome && <LipButton onClick={lock} disabled={!choice} className="w-full">LOCK IN DIAGNOSIS</LipButton>}
      {outcome && result && (
        <GameOver title={outcome === "right" ? `Solved on clue ${shown}` : `It was ${mystery.answer}`} score={points} xp={result.xp} best={result.best} isBest={result.isBest} again={onNext} againLabel="NEXT CASE">
          <p className="mt-1 text-left text-[14.5px] leading-[22px]"><b>Pearl:</b> {mystery.pearl}</p>
        </GameOver>
      )}
    </div>
  );
}
