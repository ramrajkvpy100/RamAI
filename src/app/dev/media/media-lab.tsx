"use client";

import { useState } from "react";

import { DermPhoto } from "@/components/media/derm";
import { EcgTrace } from "@/components/media/ecg";
import { RadiographImage } from "@/components/media/radiograph";
import { acneLesions, type AcneBand } from "@/engine/cases/media";
import type { DermSpec, EcgSpec, RadiographSpec } from "@/engine/types";

const BANDS: AcneBand[] = ["mild", "moderate", "moderately-severe", "severe", "scarring"];

const DERM_EXTRA: { label: string; spec: DermSpec }[] = [
  { label: "Melasma (malar patches)", spec: { kind: "derm", site: "cheek", phototype: 4, seed: 5, lesions: [{ morphology: "patch", count: 2, size: 40, confluence: 0.7, region: "central" }, { morphology: "hyperpigment", count: 5, size: 7, region: "central" }] } },
  { label: "Tinea corporis (annular)", spec: { kind: "derm", site: "trunk", phototype: 4, seed: 9, lesions: [{ morphology: "annular", count: 2, size: 24, region: "central" }, { morphology: "hyperpigment", count: 4, size: 5 }] } },
  { label: "Chronic plaque psoriasis", spec: { kind: "derm", site: "shin", phototype: 4, seed: 3, lesions: [{ morphology: "plaque", count: 3, size: 28 }] } },
];

const ECGS: { label: string; spec: EcgSpec }[] = [
  { label: "Sinus 78", spec: { kind: "ecg", rate: 78, rhythm: "sinus" } },
  { label: "LVH voltage", spec: { kind: "ecg", rate: 88, rhythm: "sinus", morphology: { qrsScale: { V1: 1.5, V2: 1.4, V5: 1.6, V6: 1.4, aVL: 1.3, I: 1.2 } } } },
  { label: "Inferior STE", spec: { kind: "ecg", rate: 96, rhythm: "sinus", morphology: { st: { II: 2.5, III: 3, aVF: 2.5, I: -1, aVL: -1.5 } } } },
  { label: "AF 118", spec: { kind: "ecg", rate: 118, rhythm: "afib" } },
];

const RADS: { label: string; spec: RadiographSpec }[] = [
  { label: "CXR normal", spec: { kind: "xray", view: "PA", features: [{ id: "normal" }], seed: 4 } },
  { label: "CXR oedema", spec: { kind: "xray", view: "AP", features: [{ id: "bat-wing-oedema", severity: 3 }, { id: "cardiomegaly", severity: 1 }, { id: "pleural-effusion", side: "bilateral", severity: 1 }], seed: 7 } },
  { label: "CXR consolidation", spec: { kind: "xray", view: "PA", features: [{ id: "consolidation", side: "right" }], seed: 2 } },
  { label: "USG appendix", spec: { kind: "usg", view: "Right iliac fossa, linear probe", features: [{ id: "appendix-thickened" }], seed: 23 } },
  { label: "USG collection", spec: { kind: "usg", view: "Curvilinear", features: [{ id: "appendix-thickened", severity: 3 }], seed: 29 } },
  { label: "Fundus — diabetic", spec: { kind: "fundus", view: "Posterior pole", features: [{ id: "microaneurysms" }, { id: "hard-exudates" }], seed: 11 } },
];

export function MediaLab() {
  const [only, setOnly] = useState<string | null>(null);
  const show = (k: string) => !only || only === k;
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-[20px] font-medium">Media lab</h1>
      <p className="mt-1 text-ui text-fg-2">Development only. Procedural clinical media used by cases.</p>
      <div className="mt-4 flex gap-2 text-ui">
        {[null, "acne", "derm", "ecg", "rad"].map((k) => (
          <button key={String(k)} onClick={() => setOnly(k)} className="rounded-md border border-line px-2.5 py-1">
            {k ?? "all"}
          </button>
        ))}
      </div>
      {show("acne") && (
        <section className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-3" data-lab="acne">
          {BANDS.map((b) => (
            <figure key={b} className="overflow-hidden rounded-lg border border-line">
              <DermPhoto spec={{ kind: "derm", site: "cheek", phototype: 4, seed: 12, lesions: acneLesions(b) }} className="block aspect-[4/3] w-full" />
              <figcaption className="px-3 py-2 text-ui">{b}</figcaption>
            </figure>
          ))}
        </section>
      )}
      {show("derm") && (
        <section className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-3" data-lab="derm">
          {DERM_EXTRA.map((d) => (
            <figure key={d.label} className="overflow-hidden rounded-lg border border-line">
              <DermPhoto spec={d.spec} className="block aspect-[4/3] w-full" />
              <figcaption className="px-3 py-2 text-ui">{d.label}</figcaption>
            </figure>
          ))}
        </section>
      )}
      {show("ecg") && (
        <section className="mt-8 flex flex-col gap-4" data-lab="ecg">
          {ECGS.map((e) => (
            <figure key={e.label} className="overflow-hidden rounded-lg border border-line">
              <EcgTrace spec={e.spec} className="block w-full" />
              <figcaption className="px-3 py-2 text-ui">{e.label}</figcaption>
            </figure>
          ))}
        </section>
      )}
      {show("rad") && (
        <section className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-3" data-lab="rad">
          {RADS.map((r) => (
            <figure key={r.label} className="overflow-hidden rounded-lg border border-line bg-black">
              <RadiographImage spec={r.spec} className="block aspect-square w-full" />
              <figcaption className="bg-surface px-3 py-2 text-ui">{r.label}</figcaption>
            </figure>
          ))}
        </section>
      )}
    </main>
  );
}
