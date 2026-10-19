"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { renderAuscultation, toWav } from "@/engine/stethoscope-audio";
import type { Auscultation } from "@/engine/types";
import { cn } from "@/lib/cn";

interface SoundItem {
  id: string;
  label: string;
  sound: Auscultation;
  key: string;
}

/** Heart and breath sounds, made by RamAI's stethoscope engine in the browser (no AI, nothing downloaded). */
const HEART: SoundItem[] = [
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

const LUNGS: SoundItem[] = [
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

/** Listen (headphones help), name the sound, see why — ten at a time. */
/** Harder to tell apart — residents and specialists only. */
const ADVANCED = new Set(["ar", "ms", "s4", "rub", "pleural-rub", "coarse"]);

export function SoundsDrill({ level = "full" }: { level?: "basic" | "full" }) {
  const keep = (xs: SoundItem[]) => (level === "basic" ? xs.filter((x) => !ADVANCED.has(x.id)) : xs);
  const [kind, setKind] = useState<"heart" | "lungs">("heart");
  const [order, setOrder] = useState<SoundItem[] | null>(null);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setOrder(shuffle(keep(kind === "heart" ? HEART : LUNGS)));
    setI(0);
    setPicked(null);
    setScore(0);
  }, [kind]);

  const item = order?.[i];
  const pool = keep(kind === "heart" ? HEART : LUNGS);
  const options = useMemo(() => (item ? shuffle([item, ...shuffle(pool.filter((p) => p.id !== item.id)).slice(0, 3)]) : []), [item, pool]);
  // The sound itself, made on this device the first time it's played.
  const url = useMemo(() => {
    if (!item) return null;
    const wav = toWav(renderAuscultation([item.sound], Math.floor(Math.random() * 1e6)));
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
          <button type="button" onClick={() => { setOrder(shuffle(pool)); setI(0); setScore(0); setPicked(null); }} className="h-11 rounded-full bg-accent px-6 text-[14px] font-semibold text-on-accent">Again</button>
        </div>
      ) : (
        <article className="card flex flex-col gap-4 p-5">
          <div className="text-[12px] text-fg-3 tabular">Sound {i + 1} of {order.length} · headphones help</div>
          {url && <audio ref={audio} src={url} controls loop className="w-full" />}
          <div className="grid gap-2">
            {options.map((o, n) => {
              const right = o.id === item.id;
              const state = picked === null ? "idle" : right ? "right" : n === picked ? "wrong" : "other";
              return (
                <button key={o.id} type="button" disabled={picked !== null} onClick={() => { setPicked(n); if (right) setScore((s) => s + 1); }} className={cn("min-h-12 rounded-xl border px-4 py-2.5 text-left text-[14.5px]", state === "right" ? "border-success bg-success-soft" : state === "wrong" ? "border-danger bg-danger-soft" : "border-line bg-surface hover:bg-surface-2", state === "other" && "opacity-60")}>
                  {o.label}
                </button>
              );
            })}
          </div>
          {picked !== null && (
            <section className="animate-enter rounded-xl border border-line p-4">
              <div className={cn("text-[14px] font-semibold", options[picked]?.id === item.id ? "text-success" : "text-danger")}>{options[picked]?.id === item.id ? "Correct" : `It's ${item.label}`}</div>
              <p className="mt-1 text-[14px] leading-6">{item.key}</p>
              {options[picked]?.id !== item.id && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[13.5px] leading-6 text-amber-900 dark:bg-amber-400/10 dark:text-amber-100"><b>Why not {options[picked]?.label}?</b> {options[picked]?.key}</p>}
              <p className="mt-2 text-[11.5px] text-fg-3">A teaching simulation of the sound, made by RamAI&apos;s stethoscope engine — real recordings vary. Source for the findings: Macleod&apos;s Clinical Examination.</p>
              <div className="mt-3 flex justify-end">
                <button type="button" onClick={() => { audio.current?.pause(); setPicked(null); setI(i + 1); }} autoFocus className="h-10 rounded-full bg-accent px-5 text-[14px] font-semibold text-on-accent">{i + 1 < order.length ? "Next" : "See your score"}</button>
              </div>
            </section>
          )}
        </article>
      )}
    </div>
  );
}
