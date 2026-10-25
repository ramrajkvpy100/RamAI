"use client";

import { recordSkill } from "@/lib/skill-progress";
import { ReportProblem } from "@/components/case/report-problem";
import { useEffect, useMemo, useRef, useState } from "react";

import { loud, renderAuscultation, toWav } from "@/engine/stethoscope-audio";
import type { Auscultation } from "@/engine/types";
import { cn } from "@/lib/cn";

interface SoundItem {
  id: string;
  label: string;
  sound: Auscultation;
  key: string;
}

/** Heart and breath sounds, made by RamAI's stethoscope engine in the browser (no AI, nothing downloaded). */
export const HEART: SoundItem[] = [
  { id: "normal-heart", label: "Normal heart sounds", sound: { kind: "heart", rate: 72 }, key: "Crisp S1 and S2 with silent systole and diastole." },
  { id: "as", label: "Aortic stenosis (ejection systolic murmur)", sound: { kind: "heart", rate: 76, murmur: { phase: "systolic", shape: "diamond" } }, key: "A crescendo–decrescendo (diamond) murmur between S1 and S2, loudest at the right upper sternal edge, radiating to the carotids." },
  { id: "mr", label: "Mitral regurgitation (pansystolic murmur)", sound: { kind: "heart", rate: 84, murmur: { phase: "systolic", shape: "plateau" } }, key: "A plateau murmur filling all of systole, loudest at the apex, radiating to the axilla." },
  { id: "ar", label: "Aortic regurgitation (early diastolic murmur)", sound: { kind: "heart", rate: 78, murmur: { phase: "diastolic", shape: "decrescendo" } }, key: "A soft, high-pitched decrescendo murmur starting just after S2, best heard sitting forward in expiration." },
  { id: "ms", label: "Mitral stenosis (mid-diastolic rumble)", sound: { kind: "heart", rate: 88, murmur: { phase: "diastolic", shape: "rumble" } }, key: "A low-pitched rumble in mid-diastole at the apex, best with the bell, patient on the left side." },
  { id: "s3", label: "S3 gallop", sound: { kind: "heart", rate: 104, s3: true }, key: "An extra low sound just after S2 ('Ken-tuc-ky') — volume overload, heart failure." },
  { id: "s4", label: "S4 gallop", sound: { kind: "heart", rate: 80, s4: true }, key: "An extra sound just before S1 ('Ten-nes-see') — a stiff ventricle (hypertension, LVH)." },
  { id: "rub", label: "Pericardial friction rub", sound: { kind: "heart", rate: 96, rub: true }, key: "A scratchy, leathery sound with the heartbeat — pericarditis." },
  { id: "af", label: "Atrial fibrillation (irregularly irregular)", sound: { kind: "heart", rate: 118, irregular: true }, key: "Beats at completely irregular intervals with varying loudness of S1." },
  { id: "muffled", label: "Muffled heart sounds", sound: { kind: "heart", rate: 120, soft: true }, key: "Faint, distant heart sounds — pericardial effusion or tamponade (with hypotension and raised JVP: Beck's triad)." },
];

export const LUNGS: SoundItem[] = [
  { id: "vesicular", label: "Normal vesicular breathing", sound: { kind: "lungs", rate: 14, breath: "vesicular" }, key: "Soft, rustling inspiration fading early in expiration, with no gap." },
  { id: "fine", label: "Fine crackles", sound: { kind: "lungs", rate: 20, breath: "vesicular", crackles: "fine" }, key: "Fine, high-pitched end-inspiratory crackles ('Velcro') — pulmonary fibrosis or early pulmonary oedema." },
  { id: "coarse", label: "Coarse crackles", sound: { kind: "lungs", rate: 22, breath: "vesicular", crackles: "coarse" }, key: "Low-pitched, bubbling crackles that may change with coughing — secretions: bronchiectasis, pneumonia." },
  { id: "wheeze", label: "Wheeze", sound: { kind: "lungs", rate: 24, breath: "vesicular", wheeze: true }, key: "Musical, mainly expiratory sounds with a prolonged expiration — asthma or COPD." },
  { id: "stridor", label: "Stridor", sound: { kind: "lungs", rate: 28, breath: "vesicular", stridor: true }, key: "A harsh, high-pitched inspiratory sound — upper airway obstruction (an emergency)." },
  { id: "bronchial", label: "Bronchial breathing", sound: { kind: "lungs", rate: 24, breath: "bronchial" }, key: "Loud, hollow breath sounds with a gap between inspiration and expiration — consolidation." },
  { id: "absent", label: "Absent breath sounds", sound: { kind: "lungs", rate: 26, breath: "absent" }, key: "No breath sounds over one area — pneumothorax, large effusion or collapse." },
  { id: "pleural-rub", label: "Pleural rub", sound: { kind: "lungs", rate: 20, breath: "vesicular", rub: true }, key: "A creaking sound at the end of inspiration and the start of expiration — pleurisy." },
];

const shuffle = <T,>(xs: T[]): T[] => [...xs].sort(() => Math.random() - 0.5);

/**
 * Each sound heard in different patients: the same finding at different heart or breathing rates, as it varies at
 * the bedside — 50 heart and 56 breath sound cases. (The answer is the finding, whatever the rate.)
 */
const HEART_RATES = [0.7, 0.85, 1, 1.2, 1.4];
const LUNG_RATES = [0.7, 0.8, 0.9, 1, 1.15, 1.3, 1.5];
const vary = (xs: SoundItem[], rates: number[]): (SoundItem & { base: string })[] =>
  xs.flatMap((x) => rates.map((r, n) => ({ ...x, base: x.id, id: `${x.id}@${n}`, sound: { ...x.sound, rate: Math.round(x.sound.rate * r) } as Auscultation })));
export const HEART_CASES = vary(HEART, HEART_RATES);
export const LUNG_CASES = vary(LUNGS, LUNG_RATES);

/** Listen (headphones help), name the sound, see why — ten at a time. */
/** Harder to tell apart — residents and specialists only. */
const ADVANCED = new Set(["ar", "ms", "s4", "rub", "pleural-rub", "coarse"]);

export function SoundsDrill({ level = "full" }: { level?: "basic" | "full" }) {
  const keep = <T extends SoundItem & { base?: string }>(xs: T[]) => (level === "basic" ? xs.filter((x) => !ADVANCED.has(x.base ?? x.id)) : xs);
  const [kind, setKind] = useState<"heart" | "lungs">("heart");
  const [order, setOrder] = useState<(SoundItem & { base: string })[] | null>(null);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [wrong, setWrong] = useState<(SoundItem & { base: string })[]>([]);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setOrder(shuffle(keep(kind === "heart" ? HEART_CASES : LUNG_CASES)).slice(0, 10));
    setI(0);
    setPicked(null);
    setScore(0);
  }, [kind]);

  // Just after switching heart ↔ breath, the old list is still here for one draw: show nothing from it.
  const item = order?.[i]?.sound.kind === kind ? order[i] : undefined;
  const pool = keep(kind === "heart" ? HEART : LUNGS);
  const cases = keep(kind === "heart" ? HEART_CASES : LUNG_CASES);
  // Four findings to choose from: this one and three others (the answer is the finding).
  const options = useMemo(() => (item ? shuffle([pool.find((p) => p.id === item.base), ...shuffle(pool.filter((p) => p.id !== item.base)).slice(0, 3)].filter((x): x is SoundItem => !!x)) : []), [item, pool]);
  // The sound itself, made on this device the first time it's played.
  const url = useMemo(() => {
    if (!item) return null;
    const wav = toWav(loud(renderAuscultation([item.sound], Math.floor(Math.random() * 1e6))));
    return URL.createObjectURL(new Blob([wav as BlobPart], { type: "audio/wav" }));
  }, [item]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 self-start rounded-full bg-surface-3 p-1 text-[13px]">
        {(["heart", "lungs"] as const).map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={cn("rounded-full px-4 py-1.5 font-medium", kind === k ? "bg-surface text-fg shadow-sm" : "text-fg-2")}>
            {k === "heart" ? "❤️ Heart sounds" : "🫁 Breath sounds"}
          </button>
        ))}
      </div>
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
          <div className="text-[12px] text-fg-3 tabular">Sound {i + 1} of {order.length} · {item.sound.kind === "heart" ? `heart rate ${item.sound.rate}` : `breathing ${item.sound.rate}/min`} · headphones help</div>
          <button type="button" onClick={() => (audio.current?.paused ? void audio.current.play() : audio.current?.pause())} aria-label={playing ? "Pause the sound" : "Play the sound"} className="mx-auto flex flex-col items-center gap-1">
            <OrganPicture sound={item.sound} playing={playing} />
            <span className="text-[12.5px] font-medium text-fg-2">{playing ? "Listening… tap to pause" : "▶ Tap to listen"}</span>
          </button>
          {url && <audio ref={audio} src={url} controls controlsList="nodownload noplaybackrate noremoteplayback" onContextMenu={(e) => e.preventDefault()} loop className="w-full" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />}
          <div className="grid gap-2">
            {options.map((o, n) => {
              const right = o.id === item.base;
              const state = picked === null ? "idle" : right ? "right" : n === picked ? "wrong" : "other";
              return (
                <button key={o.id} type="button" disabled={picked !== null} onClick={() => { setPicked(n); if (item) recordSkill(`sound:${item.id}`, right); if (right) setScore((s) => s + 1); else if (item) setWrong((w) => [...w, item]); }} className={cn("min-h-12 rounded-xl border px-4 py-2.5 text-left text-[14.5px]", state === "right" ? "border-success bg-success-soft" : state === "wrong" ? "border-danger bg-danger-soft" : "border-line bg-surface hover:bg-surface-2", state === "other" && "opacity-60")}>
                  {o.label}
                </button>
              );
            })}
          </div>
          {picked !== null && (
            <section className="selectable animate-enter rounded-xl border border-line p-4">
              <div className={cn("text-[14px] font-semibold", options[picked]?.id === item.base ? "text-success" : "text-danger")}>{options[picked]?.id === item.base ? "Correct" : `It's ${item.label}`}</div>
              <p className="mt-1 text-[14px] leading-6">{item.key}</p>
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
