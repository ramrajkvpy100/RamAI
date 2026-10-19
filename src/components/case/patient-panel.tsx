"use client";

import { useEffect, useState } from "react";

import { DuelCard } from "@/components/duel/duel-card";
import { PatientFigure } from "@/components/game/caricature";
import { fetchPicture } from "@/components/media/ai-picture";
import { MediaFigure } from "@/components/media/media-figure";
import { useCase } from "@/lib/case-store";
import { isLowData } from "@/lib/low-data";
import { Label } from "@/components/ui/primitives";
import type { CaseState, FactGroup, VitalKey } from "@/engine/types";
import { cn } from "@/lib/cn";
import { clockAt } from "@/lib/format";

import { LangToggle } from "./lang-toggle";

import { BedsideMonitor } from "./scene/bedside-monitor";
import { CallScreen } from "./scene/call-screen";
import { ConditionTrend } from "./scene/condition";
import { useScene } from "./scene/context";
import { figureCues, figureSeed } from "./scene/figures";
import { OpdChart } from "./scene/opd-chart";
import { sceneFor } from "./scene/scene";

const EXTRA: { key: VitalKey; label: string; unit: string }[] = [
  { key: "weight", label: "Weight", unit: "kg" },
  { key: "bmi", label: "BMI", unit: "kg/m²" },
  { key: "gcs", label: "GCS", unit: "/15" },
  { key: "pain", label: "Pain", unit: "/10" },
  { key: "urine", label: "Urine", unit: "mL/h" },
];

const VALUE_TONE = { normal: "text-fg", unknown: "text-fg", low: "text-warning", high: "text-warning", critical: "text-danger" } as const;

const HISTORY_GROUPS: FactGroup[] = ["complaint", "hpi", "past", "medication", "allergy", "family", "social", "diet", "sexual", "obstetric", "systemic"];
const EXAM_GROUPS: FactGroup[] = ["general-exam", "systemic-exam", "local-exam"];

export function PatientPanel({ state, flashKeys, className }: { state: CaseState; flashKeys: Set<string>; className?: string }) {
  const { patient } = state;
  const { alarm, speaking } = useScene();
  const scene = sceneFor(state);
  const historyFacts = state.facts.filter((f) => HISTORY_GROUPS.includes(f.group));
  const examFacts = state.facts.filter((f) => EXAM_GROUPS.includes(f.group));
  const extras = EXTRA.filter((v) => state.vitals[v.key] && !(scene === "opd" && v.key === "weight"));

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <section aria-labelledby="pp-patient" className="flex items-center gap-3.5">
        <PatientPortrait state={state}>
          <PatientFigure patient={patient} status={state.patientStatus} seed={figureSeed(state)} size={64} {...figureCues(state)} />
        </PatientPortrait>
        <div className="min-w-0 flex-1">
          <h2 id="pp-patient" className="flex items-baseline gap-2">
            <span className="text-[26px] leading-none font-semibold tracking-[-0.03em] tabular">{patient.age}</span>
            <span className="text-[14px] text-fg-2">{patient.sex}</span>
          </h2>
          <p className="mt-1 truncate text-[12.5px] text-fg-2">
            {[patient.occupation, patient.city.split(",").pop()?.trim()].filter(Boolean).join(" · ")}
          </p>
          <LangToggle value={state.lang} country={state.country} className="mt-2" />
        </div>
      </section>

      {state.duel && <DuelCard id={state.duel} />}

      <ConditionTrend state={state} />

      {scene === "monitor" ? <BedsideMonitor state={state} alarm={alarm} /> : scene === "opd" ? <OpdChart state={state} /> : <CallScreen state={state} speaking={speaking} />}

      {extras.length > 0 && (
        <dl className="-mt-2 grid grid-cols-2 gap-x-3 gap-y-1 px-1 text-ui">
          {extras.map((v) => (
            <div key={v.key} className={cn("flex items-baseline justify-between gap-2 rounded", flashKeys.has(`vital:${v.key}`) && "animate-flash")}>
              <dt className="text-fg-2">{v.label}</dt>
              <dd className={cn("tabular", VALUE_TONE[state.vitals[v.key]!.current.flag])}>
                {state.vitals[v.key]!.current.value} <span className="text-[11px] text-fg-3">{v.unit}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}

      {(state.workingDiagnosis || state.differentials.length > 0) && (
        <section aria-labelledby="pp-dx">
          <Label as="h2" className="mb-2">
            <span id="pp-dx">Your working diagnosis</span>
          </Label>
          {state.workingDiagnosis && <p className="text-[14px] font-medium">{state.workingDiagnosis}</p>}
          {state.differentials.length > 0 && <p className="mt-1 text-ui text-fg-2">DDx: {state.differentials.join(" · ")}</p>}
        </section>
      )}

      <FactList title="History" id="pp-history" facts={historyFacts} empty="Nothing obtained yet." flashKeys={flashKeys} />
      {scene !== "phone" && <FactList title="Examination" id="pp-exam" facts={examFacts} empty="Not examined yet." flashKeys={flashKeys} />}

      <CaseImages state={state} />
      {(state.drugs.length > 0 || state.procedures.length > 0) && (
        <section aria-labelledby="pp-tx">
          <Label as="h2" className="mb-2">
            <span id="pp-tx">Orders</span>
          </Label>
          <ul className="flex flex-col gap-1.5">
            {state.drugs.map((d) => (
              <li key={d.id} className="flex items-start justify-between gap-3 text-ui">
                <span className="min-w-0">
                  <span className="text-fg">{d.generic}</span>{" "}
                  <span className="text-fg-2">
                    {[d.dose, d.route, d.mode === "prescribed" ? d.frequency : undefined].filter(Boolean).join(" ")}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] text-fg-3 tabular">{d.mode === "given" ? clockAt(state.arrivalMinuteOfDay, d.at) : "Rx"}</span>
              </li>
            ))}
            {state.procedures.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-3 text-ui">
                <span className="text-fg">{p.name}</span>
                <span className="shrink-0 text-[11px] text-fg-3 tabular">{clockAt(state.arrivalMinuteOfDay, p.at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** One request per case, shared by every picture of the patient on the page (header, intro, each message). */
const portraits = new Map<string, { url: string | null; wait: Promise<string | null> | null; subs: Set<(u: string | null) => void> }>();

function loadPortrait(sessionId: string, token: string) {
  let entry = portraits.get(sessionId);
  if (!entry) {
    entry = { url: null, wait: null, subs: new Set() };
    portraits.set(sessionId, entry);
  }
  const e = entry;
  if (e.url || e.wait) return e;
  let tries = 0;
  const get = (): Promise<string | null> =>
    fetchPicture(`${sessionId}:portrait`, token, "portrait")
      .then((p) => p.url)
      .catch(() => (tries++ < 2 ? new Promise<string | null>((r) => window.setTimeout(() => r(get()), 4000)) : null));
  e.wait = get().then((url) => {
    e.url = url;
    e.wait = url ? e.wait : null;
    for (const s of e.subs) s(url);
    return url;
  });
  return e;
}

/** The patient's portrait, once drawn — fetched once per case and shared by everything that shows it. */
export function usePortrait(state: CaseState): string | null {
  const [url, setUrl] = useState<string | null>(() => portraits.get(state.sessionId)?.url ?? null);
  // The case's token may arrive after the first paint (a reopened case is resumed): wait for it.
  const token = useCase().session?.token ?? null;
  useEffect(() => {
    if (!token || isLowData()) return;
    const e = loadPortrait(state.sessionId, token);
    if (e.url) setUrl(e.url);
    e.subs.add(setUrl);
    return () => void e.subs.delete(setUrl);
  }, [state.sessionId, token]);
  return url;
}

export function PatientPortrait({ state, children }: { state: CaseState; children: React.ReactNode }) {
  const url = usePortrait(state);
  const [big, setBig] = useState(false);
  if (!url) return <>{children}</>;
  return (
    <>
      <button type="button" onClick={() => setBig(true)} aria-label="See the patient" className="h-16 w-16 shrink-0 overflow-hidden rounded-full ring-2 ring-line">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="The patient" className="h-full w-full object-cover" />
      </button>
      {big && (
        <button type="button" onClick={() => setBig(false)} aria-label="Close" className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="The patient" className="max-h-[80dvh] max-w-full rounded-2xl shadow-2xl" />
        </button>
      )}
    </>
  );
}

/** Every picture so far — examination photos and scans — kept in view. */
function CaseImages({ state }: { state: CaseState }) {
  const items = [
    ...state.messages.filter((m) => m.media).map((m) => ({ key: m.id, media: m.media!, title: m.text.split(" — ")[0]?.slice(0, 60) || "Image" })),
    ...state.investigations.filter((i) => i.status === "resulted" && i.media).map((i) => ({ key: i.id, media: i.media!, title: i.name })),
  ];
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="pp-img">
      <Label as="h2" className="mb-2">
        <span id="pp-img">Images</span>
      </Label>
      <ul className="grid grid-cols-2 gap-2">
        {items.map((it) => (
          <li key={it.key} className="min-w-0">
            <MediaFigure media={it.media} viewerKey={it.key} title={it.title} compact />
            <p className="mt-1 truncate text-[11px] text-fg-3">{it.title}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FactList({ title, id, facts, empty, flashKeys }: { title: string; id: string; facts: CaseState["facts"]; empty: string; flashKeys: Set<string> }) {
  return (
    <section aria-labelledby={id}>
      <Label as="h2" className="mb-2">
        <span id={id}>{title}</span>
      </Label>
      {facts.length === 0 ? (
        <p className="text-ui text-fg-3">{empty}</p>
      ) : (
        <dl className="flex flex-col gap-2.5">
          {facts.map((f) => (
            <div key={f.id} className={cn("rounded-md", flashKeys.has(`fact:${f.label}`) && "animate-flash")}>
              <dt className="text-[11.5px] text-fg-3">{f.label}</dt>
              <dd className={cn("text-ui leading-5", f.abnormal ? "text-fg" : "text-fg-2")}>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
