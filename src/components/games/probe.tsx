"use client";

import { useEffect, useMemo, useState } from "react";

import { MedicalIcon } from "@/components/ui/medical-icons";
import { CLUE_LABELS, CLUE_POINTS, PROBE_CASES, type ProbeCase } from "@/lib/games/probe";
import { finishGame, localStats } from "@/lib/games/score";
import { cn } from "@/lib/cn";
import { success, tap } from "@/lib/haptics";

import { BackTo, GameOver, LipButton } from "./game-parts";

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

export function Probe() {
  const [mystery, setMystery] = useState<ProbeCase | null>(null);
  const [best, setBest] = useState(0);
  const [solved, setSolved] = useState(0);
  useEffect(() => {
    setBest(localStats().best.probe ?? 0);
    setSolved(readDone().length);
  }, []);
  const start = () => {
    tap();
    setMystery(nextCase());
  };
  if (mystery) return <Mystery key={mystery.id} mystery={mystery} onNext={() => setMystery(nextCase())} />;
  return (
    <>
      <BackTo href="/practice" label="Skills Lab" />
      <div className="panel flex flex-col items-center gap-3 p-6 text-center">
        <MedicalIcon name="probe" size={72} />
        <h1 className="text-[26px] font-bold">Probe</h1>
        <p className="text-[15px] leading-6 text-fg-2">Solve medical mysteries by connecting clues.</p>
        <p className="text-[14px] leading-6">Five clues, worth <b>500</b>, <b>400</b>, <b>300</b>, <b>200</b> and <b>100</b> points. Lock in early for more. One wrong diagnosis ends the case.</p>
        <p className="text-[13.5px] font-medium text-fg-2">{solved} of {PROBE_CASES.length} solved{best ? ` · best ${best}` : ""}</p>
        <LipButton onClick={start} className="w-full max-w-xs">START CASE</LipButton>
      </div>
    </>
  );
}

function Mystery({ mystery, onNext }: { mystery: ProbeCase; onNext: () => void }) {
  const [shown, setShown] = useState(1);
  const [picked, setPicked] = useState<string | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const [result, setResult] = useState<ReturnType<typeof finishGame> | null>(null);
  const options = useMemo(() => shuffled([mystery.answer, ...mystery.decoys]), [mystery]);
  const right = picked === mystery.answer;
  const points = picked && right ? CLUE_POINTS[shown - 1]! : 0;

  const lock = () => {
    if (!choice || picked) return;
    setPicked(choice);
    const correct = choice === mystery.answer;
    const score = correct ? CLUE_POINTS[shown - 1]! : 0;
    setResult(finishGame("probe", score));
    if (correct) {
      success();
      try {
        localStorage.setItem(DONE_KEY, JSON.stringify([...new Set([...readDone(), mystery.id])]));
      } catch {}
    }
  };
  const visible = picked ? 5 : shown;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-fg-2">{mystery.specialty}</p>
        {!picked && <p className="rounded-full bg-accent-soft px-3 py-1 text-[13px] font-bold text-accent-text tabular">Now worth {CLUE_POINTS[shown - 1]}</p>}
      </div>
      <ol className="flex flex-col gap-2">
        {mystery.clues.slice(0, visible).map((clue, n) => (
          <li key={n} className="panel animate-rise p-3.5">
            <p className="mb-1 flex items-center justify-between gap-2 text-[11.5px] font-bold tracking-wide text-fg-2 uppercase">
              <span>Clue {n + 1}: {CLUE_LABELS[n]}</span>
              <span className="tabular">{CLUE_POINTS[n]}</span>
            </p>
            <p className="text-[14.5px] leading-[22px]">{clue}</p>
          </li>
        ))}
      </ol>
      {!picked && shown < 5 && (
        <button type="button" onClick={() => { tap(); setShown((n) => n + 1); }} className="rounded-xl border border-line bg-surface py-2.5 text-[14px] font-semibold">
          Reveal next clue (drops to {CLUE_POINTS[shown]})
        </button>
      )}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-[14px] font-semibold">Your diagnosis</legend>
        {options.map((o) => (
          <button key={o} type="button" disabled={!!picked} aria-pressed={choice === o} onClick={() => { tap(); setChoice(o); }} className={cn("pick-card min-h-11 rounded-xl border-2 bg-[var(--surface-solid)] px-3 py-2 text-left text-[14.5px] font-medium", picked ? (o === mystery.answer ? "border-success bg-success-soft" : o === picked ? "border-danger bg-danger-soft" : "border-line opacity-60") : choice === o ? "border-[#2563EB]" : "border-line")}>
            {o}
          </button>
        ))}
      </fieldset>
      {!picked && <LipButton onClick={lock} disabled={!choice} className="w-full">LOCK IN DIAGNOSIS</LipButton>}
      {picked && result && (
        <GameOver title={right ? `Correct on clue ${shown}` : `It was ${mystery.answer}`} score={points} xp={result.xp} best={result.best} isBest={result.isBest} again={onNext}>
          <p className="mt-1 text-left text-[14.5px] leading-[22px]"><b>Pearl:</b> {mystery.pearl}</p>
        </GameOver>
      )}
    </div>
  );
}
