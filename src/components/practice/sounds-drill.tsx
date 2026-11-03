"use client";

import { AnswerButton } from "@/components/ui/motion-kit";
import { recordSkill } from "@/lib/skill-progress";
import { CrowdBanner, OptionPct, useCrowd } from "./crowd";
import { ReportProblem } from "@/components/case/report-problem";
import { useEffect, useMemo, useRef, useState } from "react";

import { loud, renderAuscultation, SAMPLE_RATE, toWav } from "@/engine/stethoscope-audio";
import { Phonogram } from "./phonogram";
import type { Auscultation } from "@/engine/types";
import { SOUND_ALSO_TRUE, SOUND_CLUSTERS } from "@/lib/banks/confusable-data";
import { ABDOMEN, ABDOMEN_CASES, ADVANCED_SOUNDS, HEART, HEART_CASES, LUNG_CASES, LUNGS, type SoundItem } from "@/lib/banks/sounds";
import { cn } from "@/lib/cn";
import { pickOptions } from "@/lib/confusable";

export { HEART, LUNGS, HEART_CASES, LUNG_CASES } from "@/lib/banks/sounds";

const shuffle = <T,>(xs: T[]): T[] => [...xs].sort(() => Math.random() - 0.5);

/** Listen (headphones help), name the sound, see why — ten at a time. */
export function SoundsDrill({ level = "full" }: { level?: "basic" | "full" }) {
  const keep = <T extends SoundItem & { base?: string }>(xs: T[]) => (level === "basic" ? xs.filter((x) => !ADVANCED_SOUNDS.has(x.base ?? x.id)) : xs);
  const [kind, setKind] = useState<"heart" | "lungs" | "abdomen">("heart");
  const [group, setGroup] = useState<string | null>(null);
  const [order, setOrder] = useState<(SoundItem & { base: string })[] | null>(null);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [wrong, setWrong] = useState<(SoundItem & { base: string })[]>([]);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  // What this tab has at this level (fixed, so the options don't reshuffle under a finger).
  const pool = useMemo(() => keep(kind === "heart" ? HEART : kind === "lungs" ? LUNGS : ABDOMEN), [kind, level]); // eslint-disable-line react-hooks/exhaustive-deps
  const cases = useMemo(() => keep(kind === "heart" ? HEART_CASES : kind === "lungs" ? LUNG_CASES : ABDOMEN_CASES).filter((c) => !group || c.group === group), [kind, level, group]); // eslint-disable-line react-hooks/exhaustive-deps
  const groups = useMemo(() => [...new Set(pool.map((p) => p.group))], [pool]);

  useEffect(() => {
    setOrder(shuffle(cases).slice(0, 10));
    setWrong([]);
    setI(0);
    setPicked(null);
    setScore(0);
  }, [cases]);

  // Just after switching heart ↔ breath, the old list is still here for one draw: show nothing from it.
  const kindOf = (k: string) => (k === "bowel" || k === "vessel" ? "abdomen" : k);
  const item = order?.[i] && kindOf(order[i].sound.kind) === kind ? order[i] : undefined;
  // Four findings to choose from: this one and three that really sound like it (the answer is the finding).
  const options = useMemo(() => {
    const me = item ? pool.find((p) => p.id === item.base) ?? null : null;
    return me ? pickOptions(me, pool, { clusters: SOUND_CLUSTERS, alsoTrue: SOUND_ALSO_TRUE }).options : [];
  }, [item, pool]);
  const labels = options.map((o) => o.label);
  const crowd = useCrowd(item ? `sound:${item.base}` : "none", labels, item && picked !== null ? options[picked]?.label ?? null : null, item?.label ?? "");
  // The sound itself, made on this device the first time it's played.
  const made = useMemo(() => {
    if (!item) return null;
    const samples = loud(renderAuscultation([item.sound], Math.floor(Math.random() * 1e6)));
    return { samples, url: URL.createObjectURL(new Blob([toWav(samples) as BlobPart], { type: "audio/wav" })) };
  }, [item]);
  const url = made?.url ?? null;
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 self-start rounded-full bg-surface-3 p-1 text-[13px]">
        {(["heart", "lungs", "abdomen"] as const).map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => { setKind(k); setGroup(null); }} className={cn("rounded-full px-4 py-1.5 font-medium", kind === k ? "bg-surface text-fg shadow-sm" : "text-fg-2")}>
            {k === "heart" ? "❤️ Heart" : k === "lungs" ? "🫁 Breath" : "🫃 Abdomen & vessels"}
          </button>
        ))}
      </div>
      {groups.length > 1 && (
        <div role="radiogroup" aria-label="Subcategory" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {[null, ...groups].map((g) => (
            <button key={g ?? "all"} type="button" role="radio" aria-checked={group === g} onClick={() => setGroup(g)} className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium whitespace-nowrap", group === g ? "border-accent-line bg-accent-soft text-accent-text" : "border-line text-fg-2 hover:text-fg")}>
              {g ?? "All"} <span className="text-fg-3 tabular">{g ? pool.filter((p) => p.group === g).length : pool.length}</span>
            </button>
          ))}
        </div>
      )}
      {!order ? (
        <div className="card h-64 animate-pulse" aria-busy="true" />
      ) : !item ? (
        <div className="card flex flex-col items-center gap-3 p-8 text-center">
          <div className="text-[44px] font-bold tabular">{score}/{order.length}</div>
          <div className="flex flex-wrap justify-center gap-2">
            {wrong.length > 0 && <button type="button" onClick={() => { setOrder(wrong); setWrong([]); setI(0); setScore(0); setPicked(null); }} className="h-11 rounded-full bg-accent px-6 text-[14px] font-semibold text-on-accent">↻ Replay the {wrong.length} wrong</button>}
            <button type="button" onClick={() => { setOrder(shuffle(cases).slice(0, 10)); setWrong([]); setI(0); setScore(0); setPicked(null); }} className={cn("h-11 rounded-full px-6 text-[14px] font-semibold", wrong.length ? "bg-surface-3" : "bg-accent text-on-accent")}>Again</button>
          </div>
        </div>
      ) : (
        <article className="card flex flex-col gap-4 p-5">
          <div className="text-[12px] text-fg-3 tabular">Sound {i + 1} of {order.length} · {item.sound.kind === "heart" ? `heart rate ${item.sound.rate}` : item.sound.kind === "lungs" ? `breathing ${item.sound.rate}/min` : `pulse ${item.sound.rate}`} · headphones help</div>
          <button type="button" onClick={() => (audio.current?.paused ? void audio.current.play() : audio.current?.pause())} aria-label={playing ? "Pause the sound" : "Play the sound"} className="mx-auto flex flex-col items-center gap-1">
            <OrganPicture sound={item.sound} playing={playing} />
            <span className="text-[12.5px] font-medium text-fg-2">{playing ? "Listening… tap to pause" : "▶ Tap to listen"}</span>
          </button>
          {made && <Phonogram samples={made.samples} rate={SAMPLE_RATE} audio={audio} playing={playing} />}
          {url && <audio ref={audio} src={url} controls controlsList="nodownload noplaybackrate noremoteplayback" onContextMenu={(e) => e.preventDefault()} loop className="w-full" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />}
          <div className="grid gap-2">
            {options.map((o, n) => {
              const right = o.id === item.base;
              const state = picked === null ? "idle" : right ? "right" : n === picked ? "wrong" : "other";
              return (
                <AnswerButton state={state} picked={picked === n} key={o.id} type="button" disabled={picked !== null} onClick={() => { setPicked(n); if (item) recordSkill(`sound:${item.id}`, right); if (right) setScore((s) => s + 1); else if (item) setWrong((w) => [...w, item]); }} className={cn("min-h-12 rounded-xl border px-4 py-2.5 text-left text-[14.5px]", state === "right" ? "border-success bg-success-soft" : state === "wrong" ? "border-danger bg-danger-soft" : "border-line bg-surface hover:bg-surface-2", state === "other" && "opacity-60")}>
                  {o.label}
                  <OptionPct stats={crowd} option={o.label} />
                </AnswerButton>
              );
            })}
          </div>
          {picked !== null && (
            <section className="selectable animate-reveal rounded-xl border border-line p-4">
              <div className={cn("text-[14px] font-semibold", options[picked]?.id === item.base ? "text-success" : "text-danger")}>{options[picked]?.id === item.base ? "Correct" : `It's ${item.label}`}</div>
              <CrowdBanner stats={crowd} className="mt-2" />
              <p className="mt-2 text-[14px] leading-6">{item.key}</p>
              {options[picked]?.id !== item.base && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[13.5px] leading-6 text-amber-900 dark:bg-amber-400/10 dark:text-amber-100"><b>Why not {options[picked]?.label}?</b> {options[picked]?.key}</p>}
              <p className="mt-2 text-[11.5px] text-fg-3">A teaching simulation of the sound, made by RamAI&apos;s stethoscope engine — real recordings vary. Source for the findings: Macleod&apos;s Clinical Examination.</p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <ReportProblem compact target={{ area: "skills", ref: `Heart & breath sounds · ${item.label}`, details: `Sound: ${item.label}\nOptions: ${options.map((o) => `${o.id === item.base ? "✓ " : ""}${o.label}`).join(" | ")}\nKey: ${item.key}` }} />
                <button type="button" onClick={() => { audio.current?.pause(); setPlaying(false); setPicked(null); setI(i + 1); }} autoFocus className="h-10 rounded-full bg-accent px-5 text-[14px] font-semibold text-on-accent">{i + 1 < order.length ? "Next" : "See your score"}</button>
              </div>
            </section>
          )}
        </article>
      )}
    </div>
  );
}

/** A heart that beats, or lungs that breathe, at the sound's own rate — without giving the answer away. */
function OrganPicture({ sound, playing }: { sound: Auscultation; playing: boolean }) {
  if (sound.kind === "bowel" || sound.kind === "vessel") {
    // The chest piece on the abdomen or neck, pulsing gently with the pulse while it plays.
    return (
      <span className="relative flex h-40 w-40 items-center justify-center">
        <span className={cn("absolute inset-2 rounded-full bg-amber-400/25 blur-2xl transition-opacity", playing ? "opacity-100" : "opacity-40")} />
        <span className="relative text-[88px]" style={playing ? { animation: `ramai-beat ${(60 / sound.rate).toFixed(2)}s ease-in-out infinite` } : undefined} aria-hidden>🩺</span>
      </span>
    );
  }
  const heart = sound.kind === "heart";
  const rate = sound.rate ?? (heart ? 72 : 16);
  const irregular = heart && !!(sound as { irregular?: boolean }).irregular;
  const anim: React.CSSProperties = playing
    ? { animation: `${heart ? (irregular ? "ramai-beat-irregular" : "ramai-beat") : "ramai-breathe"} ${((60 / rate) * (irregular ? 4 : 1)).toFixed(2)}s ease-in-out infinite`, transformOrigin: "50% 60%" }
    : {};
  return (
    <span className="relative flex h-40 w-40 items-center justify-center">
      <span className={cn("absolute inset-2 rounded-full blur-2xl transition-opacity", heart ? "bg-rose-500/30" : "bg-sky-400/30", playing ? "opacity-100" : "opacity-40")} />
      {heart ? (
        <svg viewBox="0 0 100 100" className="ramai-organ-anim relative h-32 w-32 drop-shadow-lg" style={anim} aria-hidden>
          <defs>
            <radialGradient id="ramai-heart-g" cx="40%" cy="35%" r="70%"><stop offset="0%" stopColor="#fb7185" /><stop offset="60%" stopColor="#e11d48" /><stop offset="100%" stopColor="#881337" /></radialGradient>
          </defs>
          <path d="M50 88 C20 66 8 48 12 32 C16 16 36 12 50 28 C64 12 84 16 88 32 C92 48 80 66 50 88 Z" fill="url(#ramai-heart-g)" />
          <path d="M40 22 C42 14 46 10 50 10 M58 20 C60 12 66 8 70 10" stroke="#9f1239" strokeWidth="5" strokeLinecap="round" fill="none" />
          <path d="M28 34 C30 28 34 26 38 26" stroke="#fecdd3" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.7" />
        </svg>
      ) : (
        <svg viewBox="0 0 100 100" className="ramai-organ-anim relative h-32 w-32 drop-shadow-lg" style={anim} aria-hidden>
          <defs>
            <radialGradient id="ramai-lung-g" cx="45%" cy="35%" r="75%"><stop offset="0%" stopColor="#fda4af" /><stop offset="70%" stopColor="#f472b6" /><stop offset="100%" stopColor="#be185d" /></radialGradient>
          </defs>
          <path d="M50 8 V40 M50 40 C46 44 42 46 38 48 M50 40 C54 44 58 46 62 48" stroke="#94a3b8" strokeWidth="5" strokeLinecap="round" fill="none" />
          <path d="M44 30 C30 24 14 40 12 62 C10 82 22 92 36 88 C44 86 46 78 46 66 Z" fill="url(#ramai-lung-g)" />
          <path d="M56 30 C70 24 86 40 88 62 C90 82 78 92 64 88 C56 86 54 78 54 66 Z" fill="url(#ramai-lung-g)" />
        </svg>
      )}
    </span>
  );
}
