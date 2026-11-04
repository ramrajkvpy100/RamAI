"use client";

import { useEffect, useMemo, useState } from "react";

import { MedicalIcon } from "@/components/ui/medical-icons";
import { BOARD_PEARLS, checkTiles, shuffledTiles, SYNAPSE_BOARDS, TIER_POINTS, TIERS, type SynapseBoard, type SynapseGroup, type Tier } from "@/lib/games/synapses";
import { CLUSTER_LEVELS, finishGame, savedLevel, saveLevel, type Level } from "@/lib/games/score";
import { cn } from "@/lib/cn";
import { success, tap } from "@/lib/haptics";

import { BackTo, GameOver, LevelPicker, LipButton } from "./game-parts";

const TIER_STYLE: Record<Tier, string> = {
  Easy: "bg-emerald-500 text-white",
  Medium: "bg-amber-400 text-[#3d2c00]",
  Hard: "bg-blue-600 text-white",
  Master: "bg-violet-600 text-white",
};
const DONE_KEY = "ramai.synapses.done";
const readDone = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(DONE_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
};
const ALL = "All";

/** 16 tiles, 4 hidden groups. Pick the level and the board, then connect them. */
export function Clusters() {
  const [board, setBoard] = useState<SynapseBoard | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [seed, setSeed] = useState(1);
  const [level, setLevelState] = useState<Level>("medium");
  const [subject, setSubject] = useState(ALL);
  useEffect(() => {
    setDone(readDone());
    setLevelState(savedLevel("synapses"));
  }, []);
  const setLevel = (l: Level) => {
    setLevelState(l);
    saveLevel("synapses", l);
  };
  const open = (b: SynapseBoard) => {
    tap();
    setSeed(Date.now() >>> 0);
    setBoard(b);
  };
  const random = () => {
    const finished = readDone();
    const fresh = SYNAPSE_BOARDS.filter((b) => !finished.includes(b.id) && b.id !== board?.id);
    const from = fresh.length ? fresh : SYNAPSE_BOARDS;
    open(from[Math.floor(Math.random() * from.length)]!);
  };
  const subjects = useMemo(() => [ALL, ...new Set(SYNAPSE_BOARDS.map((b) => b.specialty))], []);
  if (board) return <Board key={`${board.id}${seed}`} board={board} seed={seed} level={level} onBack={() => { setBoard(null); setDone(readDone()); }} onNext={random} />;
  return (
    <>
      <BackTo href="/practice" label="Skills Lab" />
      <div className="mb-4 flex items-center gap-3">
        <MedicalIcon name="synapses" size={56} />
        <div>
          <h1 className="text-[26px] leading-tight font-bold">Clusters</h1>
          <p className="text-[14px] leading-5 text-fg-2">Find the 4 hidden groups of 4.</p>
        </div>
      </div>
      <LevelPicker level={level} onChange={setLevel} line={CLUSTER_LEVELS[level].line} />
      <LipButton onClick={random} className="mt-3 w-full">PLAY A NEW BOARD</LipButton>
      <p className="mt-5 mb-2 text-[13.5px] font-medium text-fg-2">{done.length} of {SYNAPSE_BOARDS.length} boards solved</p>
      <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {subjects.map((x) => (
          <button key={x} type="button" aria-pressed={subject === x} onClick={() => setSubject(x)} className={cn("shrink-0 rounded-full border px-3 py-1 text-[13px] font-semibold", subject === x ? "border-transparent bg-[#2563EB] text-white" : "border-line bg-surface text-fg-2")}>{x}</button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-2 pb-6 sm:grid-cols-2">
        {SYNAPSE_BOARDS.filter((b) => subject === ALL || b.specialty === subject).map((b) => (
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

function Board({ board, seed, level, onBack, onNext }: { board: SynapseBoard; seed: number; level: Level; onBack: () => void; onNext: () => void }) {
  const rules = CLUSTER_LEVELS[level];
  const [order, setOrder] = useState(() => shuffledTiles(board, seed));
  const [picked, setPicked] = useState<string[]>([]);
  const [solved, setSolved] = useState<{ group: SynapseGroup; tier: Tier }[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [tried, setTried] = useState<string[]>([]);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hinted, setHinted] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof finishGame> | null>(null);
  const [score, setScore] = useState(0);

  const taken = new Set(solved.flatMap((x) => x.group.tiles));
  const left = order.filter((t) => !taken.has(t));
  const lost = mistakes >= rules.mistakes;
  const over = lost || solved.length === 4;

  useEffect(() => {
    if (!over || result) return;
    const earned = solved.reduce((n, x) => n + TIER_POINTS[x.tier], 0) + (lost ? 0 : (rules.mistakes - mistakes) * 25) - hintsUsed * 50;
    const points = Math.max(0, Math.round(earned * rules.scale));
    setScore(points);
    setResult(finishGame("synapses", points));
    if (!lost) {
      success();
      try {
        localStorage.setItem(DONE_KEY, JSON.stringify([...new Set([...readDone(), board.id])]));
      } catch {}
    }
  }, [over, result, solved, lost, mistakes, hintsUsed, rules, board.id]);

  const toggle = (t: string) => {
    tap();
    setNote(null);
    setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : p.length < 4 ? [...p, t] : p));
  };
  const connect = () => {
    const key = [...picked].sort().join("|");
    // The same four again isn't a new mistake.
    if (tried.includes(key)) return setNote("You've already tried those four.");
    const { group, tier, closest } = checkTiles(board, picked);
    if (group && tier) {
      success();
      setSolved((s) => [...s, { group, tier }]);
      setPicked([]);
      setNote(null);
      setHinted(null);
      return;
    }
    setTried((x) => [...x, key]);
    setMistakes((m) => m + 1);
    setShake(true);
    setNote(rules.oneAway && closest === 3 ? "One away." : "Not a group.");
    window.setTimeout(() => setShake(false), 340);
  };
  const shuffle = () => {
    tap();
    setOrder((o) => shuffledTiles(board, (Date.now() + o.length) >>> 0));
  };
  const hint = () => {
    const open = board.groups.find((g) => !solved.some((x) => x.group.name === g.name));
    if (!open) return;
    tap();
    setHintsUsed((n) => n + 1);
    setHinted(open.name);
  };

  const shown = lost ? board.groups.map((group, n) => ({ group, tier: TIERS[n]! })) : solved;
  const hintsLeft = rules.hints - hintsUsed;
  return (
    <div className="flex flex-col gap-3 pb-6">
      <button type="button" onClick={onBack} className="self-start text-[14px] font-medium text-fg-2">← All boards</button>
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-[22px] leading-tight font-bold">{board.title}</h1>
        <span className="shrink-0 text-[12.5px] font-semibold text-fg-2">{board.specialty}</span>
      </div>
      {rules.names && !over && (
        <ul className="rounded-xl bg-surface-3 p-2.5 text-[13px] leading-[19px]">
          {board.groups.map((g) => {
            const got = solved.some((x) => x.group.name === g.name);
            return <li key={g.name} className={got ? "text-fg-3 line-through" : "font-medium"}>{g.name}</li>;
          })}
        </ul>
      )}
      {hinted && !over && <p className="rounded-xl bg-amber-500/10 p-2.5 text-[13.5px] leading-[19px]">One group is: <b>{hinted}</b></p>}
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
          <div className="flex items-center justify-between gap-2 text-[13.5px]">
            <span className="flex items-center gap-1" role="img" aria-label={`${rules.mistakes - mistakes} mistakes left`}>
              {Array.from({ length: rules.mistakes }, (_, i) => <span key={i} className={cn("h-2.5 w-2.5 rounded-full", i < rules.mistakes - mistakes ? "bg-[#2563EB]" : "bg-surface-3")} />)}
            </span>
            {note && <span className="font-semibold text-danger">{note}</span>}
          </div>
          <div className="grid grid-cols-3 gap-2 text-[13.5px] font-semibold">
            <button type="button" onClick={shuffle} className="min-h-10 rounded-xl border border-line bg-surface">Shuffle</button>
            <button type="button" onClick={() => setPicked([])} disabled={!picked.length} className="min-h-10 rounded-xl border border-line bg-surface disabled:opacity-50">Deselect</button>
            <button type="button" onClick={hint} disabled={hintsLeft < 1} className="min-h-10 rounded-xl border border-line bg-surface disabled:opacity-50">{rules.hints ? `Hint (${Math.max(0, hintsLeft)})` : "No hints"}</button>
          </div>
          <LipButton onClick={connect} disabled={picked.length !== 4} className="w-full">CONNECT</LipButton>
        </>
      )}
      {over && result && (
        <GameOver title={lost ? "Out of mistakes" : "Board solved"} score={score} xp={result.xp} best={result.best} isBest={result.isBest} again={onNext} againLabel="NEXT BOARD">
          {BOARD_PEARLS[board.id] && <p className="mt-1 text-left text-[14.5px] leading-[22px]"><b>Pearl:</b> {BOARD_PEARLS[board.id]}</p>}
        </GameOver>
      )}
    </div>
  );
}
