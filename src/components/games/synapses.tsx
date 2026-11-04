"use client";

import { useEffect, useMemo, useState } from "react";

import { MedicalIcon } from "@/components/ui/medical-icons";
import { checkTiles, shuffledTiles, SYNAPSE_BOARDS, TIER_POINTS, TIERS, type SynapseBoard, type SynapseGroup, type Tier } from "@/lib/games/synapses";
import { finishGame, localStats } from "@/lib/games/score";
import { cn } from "@/lib/cn";
import { success, tap } from "@/lib/haptics";

import { BackTo, GameOver, LipButton } from "./game-parts";

const TIER_STYLE: Record<Tier, string> = {
  Easy: "bg-emerald-500 text-white",
  Medium: "bg-amber-400 text-[#3d2c00]",
  Hard: "bg-blue-600 text-white",
  Master: "bg-violet-600 text-white",
};
const MISTAKES = 4;
const DONE_KEY = "ramai.synapses.done";

const readDone = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(DONE_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
};

export function Synapses() {
  const [board, setBoard] = useState<SynapseBoard | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [seed, setSeed] = useState(1);
  useEffect(() => setDone(readDone()), []);
  const open = (b: SynapseBoard) => {
    tap();
    setSeed(Date.now() >>> 0);
    setBoard(b);
  };
  if (board) return <Board key={`${board.id}${seed}`} board={board} seed={seed} onBack={() => { setBoard(null); setDone(readDone()); }} onAgain={() => { setSeed(Date.now() >>> 0); setDone(readDone()); }} />;
  return (
    <>
      <BackTo href="/practice" label="Skills Lab" />
      <div className="mb-4 flex items-center gap-3">
        <MedicalIcon name="synapses" size={56} />
        <div>
          <h1 className="text-[26px] leading-tight font-bold">Synapses</h1>
          <p className="text-[14px] leading-5 text-fg-2">Group medical concepts that belong together.</p>
        </div>
      </div>
      <p className="mb-3 text-[13.5px] text-fg-2">{done.length} of {SYNAPSE_BOARDS.length} boards solved · best {localBest()}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {SYNAPSE_BOARDS.map((b) => (
          <button key={b.id} type="button" onClick={() => open(b)} className="pick-card flex items-center justify-between gap-3 rounded-2xl border border-line bg-[var(--surface-solid)] p-3.5 text-left">
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold">{b.title}</span>
              <span className="block text-[12.5px] text-fg-2">{b.specialty}</span>
            </span>
            {done.includes(b.id) && <span className="shrink-0 rounded-full bg-success-soft px-2 py-0.5 text-[11.5px] font-semibold text-success">Solved</span>}
          </button>
        ))}
      </div>
    </>
  );
}

const localBest = () => (typeof window === "undefined" ? 0 : (localStats().best.synapses ?? 0)).toLocaleString("en-IN");

function Board({ board, seed, onBack, onAgain }: { board: SynapseBoard; seed: number; onBack: () => void; onAgain: () => void }) {
  const tiles = useMemo(() => shuffledTiles(board, seed), [board, seed]);
  const [picked, setPicked] = useState<string[]>([]);
  const [solved, setSolved] = useState<{ group: SynapseGroup; tier: Tier }[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof finishGame> | null>(null);
  const [score, setScore] = useState(0);

  const taken = new Set(solved.flatMap((x) => x.group.tiles));
  const left = tiles.filter((t) => !taken.has(t));
  const lost = mistakes >= MISTAKES;
  const over = lost || solved.length === 4;

  useEffect(() => {
    if (!over || result) return;
    const points = solved.reduce((n, x) => n + TIER_POINTS[x.tier], 0) + (lost ? 0 : (MISTAKES - mistakes) * 25);
    setScore(points);
    setResult(finishGame("synapses", points));
    if (!lost) {
      success();
      try {
        localStorage.setItem(DONE_KEY, JSON.stringify([...new Set([...readDone(), board.id])]));
      } catch {}
    }
  }, [over, result, solved, lost, mistakes, board.id]);

  const toggle = (t: string) => {
    tap();
    setNote(null);
    setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : p.length < 4 ? [...p, t] : p));
  };
  const connect = () => {
    const { group, tier, closest } = checkTiles(board, picked);
    if (group && tier) {
      success();
      setSolved((s) => [...s, { group, tier }].sort((a, b) => TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier)));
      setPicked([]);
      setNote(null);
      return;
    }
    setMistakes((m) => m + 1);
    setShake(true);
    setNote(closest === 3 ? "One away." : "Not a group.");
    window.setTimeout(() => setShake(false), 340);
  };

  const shown = lost ? board.groups.map((group, n) => ({ group, tier: TIERS[n]! })) : solved;
  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={onBack} className="self-start text-[14px] font-medium text-fg-2">← All boards</button>
      <h1 className="text-[22px] font-bold">{board.title}</h1>
      <div className="flex flex-col gap-2">
        {shown.map(({ group, tier }) => (
          <div key={group.name} className={cn("animate-rise rounded-xl px-3 py-2.5 text-center", TIER_STYLE[tier])}>
            <p className="text-[11px] font-bold tracking-wider uppercase opacity-85">{tier}</p>
            <p className="text-[14.5px] leading-5 font-bold">{group.name}</p>
            <p className="text-[12.5px] leading-[18px]">{group.tiles.join(" · ")}</p>
          </div>
        ))}
      </div>
      {!over && (
        <>
          <div className={cn("grid grid-cols-4 gap-1.5", shake && "game-shake")}>
            {left.map((t) => (
              <button key={t} type="button" aria-pressed={picked.includes(t)} onClick={() => toggle(t)} className={cn("pick-card flex min-h-[76px] items-center justify-center rounded-xl border-2 px-1 py-1.5 text-center text-[11.5px] leading-[14px] font-semibold [overflow-wrap:anywhere] sm:text-[13px] sm:leading-4", picked.includes(t) ? "border-[#2563EB] bg-[#2563EB] text-white" : "border-line bg-[var(--surface-solid)]")}>
                {t}
              </button>
            ))}
          </div>
          <p className="flex items-center justify-between text-[13.5px] text-fg-2">
            <span>Mistakes left: <b className="text-fg">{MISTAKES - mistakes}</b></span>
            {note && <span className="font-semibold text-danger">{note}</span>}
          </p>
          <LipButton onClick={connect} disabled={picked.length !== 4} className="w-full">CONNECT SYNAPSES</LipButton>
        </>
      )}
      {over && result && <GameOver title={lost ? "Out of mistakes" : "Board solved"} score={score} xp={result.xp} best={result.best} isBest={result.isBest} again={onAgain} />}
    </div>
  );
}
