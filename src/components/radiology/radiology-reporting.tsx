"use client";

import { recordSkill } from "@/lib/skill-progress";
import { CrowdBanner, OptionPct, useCrowd } from "@/components/practice/crowd";
import { Rich, RichLines } from "@/components/ui/rich-lines";
import { ExplainMore } from "@/components/practice/explain-more";
import { ReportProblem } from "@/components/case/report-problem";
import { Portal } from "@/components/ui/portal";
import { useCallback, useEffect, useState } from "react";

import { cn } from "@/lib/cn";
import type { DrillItem, Modality } from "@/lib/practice";
import type { RadiologyBrief } from "@/lib/radiology";
import STACKS from "@/lib/radiology-stacks.json";

import { StackViewer } from "./stack-viewer";

type Item = DrillItem & { brief: RadiologyBrief; stack?: { id: string; slices: number; credit: string; windows?: string[] } };
type Tab = Modality | "mammo" | "mri";
/** CT and MRI: scroll through the series (as at a workstation), or single images. */
type View = "scroll" | "static";

const TABS: [Tab, string][] = [["xray", "X-ray"], ["ct", "CT"], ["mri", "MRI"], ["usg", "Ultrasound"], ["mammo", "Mammography"]];

/** Body systems, and the chapters within them — each study sorted by its id and diagnosis. */
const SYSTEMS: [string, RegExp][] = [
  ["Brain & spine", /edh|sdh|sah|ich|infarct|hydroceph|abscess-brain|brain|ncc|tubercul?oma|gbm|glio|ms\b|mri-ms|pituitar|meningio|schwannoma|vs-mri|skull|disc|spine|potts|c-spine|cerebr|ivh/i],
  ["Chest & lungs", /cxr|pneumo(?!peritoneum)|tension|consolidation|effusion|oedema|edema|cardiomegaly|miliary|cavity|collapse|copd|emphysema|lung|bronch|ild|hilar|haemothorax|empyema|ground-glass|covid|pe\b|embol|mediastin|rib|b-lines|lung-sliding/i],
  ["Liver", /liver|hcc|hepat|cirrhosis|hydatid|fatty|tace/i],
  ["Gallbladder & pancreas", /gall|chole|gb-|cbd|pancrea|pseudocyst/i],
  ["Kidney & bladder", /\brenal|kidney|kub|stone|calcul|hydroneph|pyelo|pkd|ckd|bladder|bph|prostat/i],
  ["Bowel & abdomen", /normal-abdo|adrenal|abdo|appendic|sbo|lbo|bowel|volvulus|intussus|diverticul|perforat|pneumoperitoneum|mesenteric|ascites|splen|fluoro|achalasia|crohn|hiatus|applecore|free-fluid|pyloric/i],
  ["Bones & joints", /fracture|colles|nof|scaphoid|boxer|ankle|tibia|clavicle|shoulder|supracondylar|oa-|ra-|gout|ankylos|osteo|rickets|pelvic|acl|knee/i],
  ["Women & pregnancy", /ectopic|iup|ovar|fibroid|pcos|dermoid|endometrioma|molar|miscarriage|twin|placenta|breech|anenceph|mammo|breast|fibroadenoma/i],
  ["Vessels & heart", /dissection|aaa|aneurysm|dvt|pericardial|varicocele|testicular/i],
  ["Neck & thyroid", /thyroid|lymph|graves|adenoma|nm-|epiglott|croup|sinus|orbital/i],
];
const systemOf = (it: { item: string; options: string[]; answer: number }) => SYSTEMS.find(([, re]) => re.test(`${it.item} ${it.options[it.answer] ?? ""}`))?.[0] ?? "Other";

const shuffle = <T,>(xs: T[]): T[] => [...xs].sort(() => Math.random() - 0.5);

/** The scroll-through series (real TCIA studies), as reporting cases. */
function stackItems(only: "CT" | "MR"): Item[] {
  return shuffle(STACKS.filter((s) => s.modality === only)).map((s) => {
    const options = shuffle(s.options);
    return { item: s.id, image: null, ecg: null, options, answer: options.indexOf(s.diagnosis), key: s.key, credit: null, source: "commons" as const, brief: { history: s.history, question: s.question }, stack: { id: s.id, slices: s.slices, credit: s.credit, ...("windows" in s && Array.isArray(s.windows) ? { windows: s.windows as string[] } : {}) } };
  });
}

/**
 * Report a study as a radiologist does: read the request, look at the images, write your findings,
 * commit to a diagnosis — then compare with the model report. No treatment.
 */
export function RadiologyReporting({ embedded = false }: { /** Inside Skills Lab: no page heading of its own. */ embedded?: boolean } = {}) {
  const [modality, setModality] = useState<Tab>("xray");
  const [view, setView] = useState<View>("scroll");
  const [items, setItems] = useState<Item[] | null>(null);
  const [index, setIndex] = useState(0);
  const [findings, setFindings] = useState("");
  const [picked, setPicked] = useState<number | null>(null);
  const [zoom, setZoom] = useState(false);
  const [score, setScore] = useState(0);
  const [system, setSystem] = useState<string | null>(null);
  const [all, setAll] = useState<Item[] | null>(null);

  const load = useCallback(async (m: Tab, v: View) => {
    setItems(null);
    setIndex(0);
    setPicked(null);
    setFindings("");
    setScore(0);
    setSystem(null);
    if ((m === "ct" || m === "mri") && v === "scroll") {
      const st = stackItems(m === "ct" ? "CT" : "MR");
      setAll(st);
      setItems(st);
      return;
    }
    const res = await fetch("/api/radiology/round", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ modality: m }) }).catch(() => null);
    const json = res?.ok ? ((await res.json()) as { items: Item[] }) : { items: [] };
    const got = shuffle(json.items);
    setAll(got);
    setItems(got);
  }, []);
  useEffect(() => void load(modality, view), [modality, view, load]);
  const systems = all ? [...new Set(all.map(systemOf))] : [];
  const chooseSystem = (sys: string | null) => {
    setSystem(sys);
    setIndex(0);
    setPicked(null);
    setFindings("");
    setScore(0);
    setItems(all ? (sys ? all.filter((x) => systemOf(x) === sys) : all) : null);
  };

  const item = items?.[index];
  const crowd = useCrowd(item ? `radio:${item.item}` : "none", item?.options ?? [], item && picked !== null ? item.options[picked]! : null, item ? item.options[item.answer]! : "");
  const next = () => {
    setPicked(null);
    setFindings("");
    setIndex((i) => i + 1);
  };

  return (
    <div className="flex flex-col gap-5 py-6">
      {!embedded && <header>
        <p className="text-[12px] font-semibold tracking-[0.16em] text-accent-text uppercase">Radiology</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em]">Report the study</h1>
        <p className="mt-1 text-[14.5px] text-fg-2">Real images, a real request form — from the history to the diagnosis. Write your findings, then commit.</p>
      </header>}
      <div className="grid grid-cols-5 gap-1 rounded-xl bg-surface-3 p-1">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" aria-pressed={modality === id} onClick={() => setModality(id)} className={cn("h-10 min-w-0 truncate rounded-lg px-1 text-[11.5px] font-medium sm:text-[13.5px]", modality === id ? "bg-surface text-fg shadow-sm" : "text-fg-2")}>
            {/* (Long names are shortened on phones, so the five tabs fit.) */}
            {label === "Mammography" ? <><span className="sm:hidden">Mammo</span><span className="hidden sm:inline">{label}</span></> : label === "Ultrasound" ? <><span className="sm:hidden">USG</span><span className="hidden sm:inline">{label}</span></> : label}
          </button>
        ))}
      </div>

      {(modality === "ct" || modality === "mri") && (
        <div className="flex gap-1 self-start rounded-full bg-surface-3 p-1 text-[13px]">
          {(["scroll", "static"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={cn("rounded-full px-3.5 py-1.5 font-medium", view === v ? "bg-surface text-fg shadow-sm" : "text-fg-2")}>
              {v === "scroll" ? "↕ Scroll series" : "🖼 Single images"}
            </button>
          ))}
        </div>
      )}
      {systems.length > 1 && (
        <div role="radiogroup" aria-label="System" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {[null, ...systems].map((sys) => (
            <button key={sys ?? "all"} type="button" role="radio" aria-checked={system === sys} onClick={() => chooseSystem(sys)} className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium whitespace-nowrap", system === sys ? "border-accent-line bg-accent-soft text-accent-text" : "border-line text-fg-2 hover:text-fg")}>
              {sys ?? "All systems"} <span className="text-fg-3 tabular">{sys ? all!.filter((x) => systemOf(x) === sys).length : all!.length}</span>
            </button>
          ))}
        </div>
      )}
      {items === null && <div className="card h-80 animate-pulse" aria-busy="true" />}
      {items && items.length === 0 && <p className="card p-6 text-[14px] text-fg-2">Real studies for this section are being collected right now — try again in a minute, or open another tab.</p>}
      {items && items.length > 0 && !item && (
        <div className="card flex flex-col items-center gap-3 p-8 text-center">
          <div className="text-[44px] font-bold tabular">{score}/{items.length}</div>
          <p className="text-[14px] text-fg-2">diagnoses correct</p>
          <button type="button" onClick={() => void load(modality, view)} className="h-11 rounded-full bg-accent px-6 text-[14px] font-semibold text-on-accent">Another set</button>
        </div>
      )}

      {item && (
        <article className="card flex flex-col gap-4 p-5">
          <div className="text-[12px] text-fg-3 tabular">Study {index + 1} of {items!.length}</div>
          <section className="rounded-xl bg-surface-2 p-4">
            <div className="text-[11px] font-bold tracking-[0.1em] text-fg-3 uppercase">Request form</div>
            <p className="mt-1.5 text-[14.5px] leading-6">{item.brief.history}</p>
            <p className="mt-2 text-[14px] font-semibold">{item.brief.question}</p>
          </section>
          {item.stack ? (
            <>
              <StackViewer id={item.stack.id} slices={item.stack.slices} label="The study" windows={item.stack.windows} />
              {picked !== null && <p className="-mt-1 text-[11px] text-fg-3">Study: {item.stack.credit}</p>}
            </>
          ) : (
          <button type="button" onClick={() => setZoom(true)} className="overflow-hidden rounded-xl bg-black" aria-label="Open the image full size">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.image!} alt="The study to report" className="mx-auto max-h-[60dvh] w-auto object-contain" />
          </button>
          )}
          {item.credit && picked !== null && (
            <a href={item.credit.source} target="_blank" rel="noopener noreferrer" className="-mt-2 text-[11.5px] text-fg-3 underline">
              Real image · {item.credit.author} · {item.credit.license}
            </a>
          )}
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">Your findings</span>
            <textarea value={findings} onChange={(e) => setFindings(e.target.value.slice(0, 1000))} disabled={picked !== null} rows={3} placeholder="Describe what you see, as in a report…" className="rounded-xl border border-line bg-surface p-3 text-[14px] outline-none focus:border-accent-line" />
          </label>
          <div>
            <div className="mb-2 text-[13px] font-semibold">Impression (diagnosis)</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {item.options.map((o, i) => {
                const state = picked === null ? "idle" : i === item.answer ? "right" : i === picked ? "wrong" : "other";
                return (
                  <button
                    key={o}
                    type="button"
                    disabled={picked !== null}
                    onClick={() => {
                      setPicked(i);
                      recordSkill(`radio:${item.item}`, i === item.answer);
                      if (i === item.answer) setScore((s) => s + 1);
                    }}
                    className={cn("min-h-11 rounded-xl border px-3 py-2 text-left text-[14px]", state === "right" ? "border-success bg-success-soft" : state === "wrong" ? "border-danger bg-danger-soft" : "border-line bg-surface hover:bg-surface-2", state === "other" && "opacity-60")}
                  >
                    {o}
                    <OptionPct stats={crowd} option={o} />
                  </button>
                );
              })}
            </div>
          </div>
          {picked !== null && (
            <section className="selectable animate-enter rounded-xl border border-line p-4">
              <div className={cn("text-[14px] font-semibold", picked === item.answer ? "text-success" : "text-danger")}>{picked === item.answer ? "Correct" : `Impression: ${item.options[item.answer]}`}</div>
              <CrowdBanner stats={crowd} className="mt-2" />
              <div className="mt-2 text-[11px] font-bold tracking-[0.1em] text-fg-3 uppercase">Model report — key findings</div>
              <RichLines text={item.key} className="mt-1 text-[14px]" />
              {findings.trim() && (
                <>
                  <div className="mt-3 text-[11px] font-bold tracking-[0.1em] text-fg-3 uppercase">Your findings</div>
                  <p className="mt-1 text-[14px] leading-6 text-fg-2">{findings}</p>
                </>
              )}
              {picked !== item.answer && item.keys?.[picked] && (
                <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[13.5px] leading-6 text-amber-900 dark:bg-amber-400/10 dark:text-amber-100">
                  <b>Why not {item.options[picked]}?</b> It would show <Rich text={item.keys[picked]!.replace(/\.$/, "").replace(/^./, (c) => c.toLowerCase())} />.
                </div>
              )}
              <ExplainMore key={item.item} drill={`Radiology reporting (${modality})`} question={`${item.brief?.history ?? ""} ${item.brief?.question ?? ""}`.trim() || "Report the study."} options={item.options} answer={item.options[item.answer]!} explanation={item.key} />
              <div className="mt-4 flex items-center justify-between gap-2">
                <ReportProblem compact target={{ area: "skills", ref: `Radiology reporting · ${item.options[item.answer]}`, details: `Study: ${item.image ?? "scroll series"}\nOptions: ${item.options.map((o, i) => `${i === item.answer ? "✓ " : ""}${o}`).join(" | ")}\nKey: ${item.key}` }} />
                <button type="button" onClick={next} autoFocus className="h-10 rounded-full bg-accent px-5 text-[14px] font-semibold text-on-accent">
                  {index + 1 < items!.length ? "Next study" : "See your score"}
                </button>
              </div>
            </section>
          )}
        </article>
      )}
      {zoom && item?.image && (
        <Portal><button type="button" onClick={() => setZoom(false)} aria-label="Close" className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.image!} alt="The study, full size" className="max-h-full max-w-full object-contain" />
        </button></Portal>
      )}
    </div>
  );
}
