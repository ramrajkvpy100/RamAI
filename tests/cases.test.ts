/**
 * Case lint — every case in the library must be internally consistent.
 * Catches authoring errors (dangling ids, unknown drugs) before players do.
 */
import { describe, expect, it } from "vitest";

import { catalogInvestigation, EXAMS, MEASURES } from "@/engine/catalog";
import { CASE_LIBRARY } from "@/engine/cases";
import { FORMULARY, formularyDrug } from "@/engine/formulary";
import { hazardLibrary } from "@/engine/physiology";

const DRUG_CLASSES = new Set(FORMULARY.flatMap((d) => d.classes as string[]));
const measure = (id: string) => MEASURES.some((m) => m.id === id);

describe.each(CASE_LIBRARY.map((c) => [c.id, c] as const))("%s", (_id, c) => {
  const historyIds = c.history.map((h) => h.id);
  const examIds = c.exam.map((e) => e.id);
  const invIds = c.investigations.map((i) => i.id);
  const ruleIds = c.therapeutics.map((r) => r.id);
  const lib = hazardLibrary(c);

  it("has unique ids, and no id shared between history and examination", () => {
    for (const ids of [historyIds, examIds, invIds, ruleIds]) expect(new Set(ids).size).toBe(ids.length);
    expect(historyIds.filter((id) => examIds.includes(id))).toEqual([]);
  });

  it("has a complaint entry and an allergy entry", () => {
    expect(c.history.some((h) => h.group === "complaint")).toBe(true);
    expect(c.history.some((h) => h.group === "allergy")).toBe(true);
  });

  it("references only real drugs, classes and measures", () => {
    for (const r of c.therapeutics) {
      for (const d of r.drugIds ?? []) expect(formularyDrug(d), `${r.id} → ${d}`).toBeDefined();
      for (const cl of r.drugClasses ?? []) expect(DRUG_CLASSES.has(cl), `${r.id} → class ${cl}`).toBe(true);
      for (const m of r.measureIds ?? []) expect(measure(m), `${r.id} → measure ${m}`).toBe(true);
      for (const x of r.concernsDrugs ?? []) expect(!!formularyDrug(x) || DRUG_CLASSES.has(x), `${r.id} → concern ${x}`).toBe(true);
      if (r.arms) expect(lib.has(r.arms), `${r.id} arms ${r.arms}`).toBe(true);
      if (r.kind === "drug") expect((r.drugIds?.length ?? 0) + (r.drugClasses?.length ?? 0)).toBeGreaterThan(0);
      else expect((r.match?.length ?? 0) + (r.measureIds?.length ?? 0) + (r.concernsDrugs?.length ?? 0)).toBeGreaterThan(0);
    }
    for (const d of c.profile.currentDrugs ?? []) expect(formularyDrug(d), `currentDrugs → ${d}`).toBeDefined();
    for (const a of c.profile.allergies ?? []) expect(!!formularyDrug(a) || DRUG_CLASSES.has(a), `allergy → ${a}`).toBe(true);
  });

  it("defines or overrides investigations correctly", () => {
    for (const inv of c.investigations) {
      const known = catalogInvestigation(inv.id);
      if (!known) {
        expect(inv.name, `${inv.id} needs a name`).toBeTruthy();
        expect(inv.category, `${inv.id} needs a category`).toBeTruthy();
        expect(inv.match?.length, `${inv.id} needs match phrases`).toBeGreaterThan(0);
      }
    }
  });

  it("gives exam overrides of catalogue ids, or their own match phrases", () => {
    for (const e of c.exam) {
      if (e.match.length === 0) expect(EXAMS.some((x) => x.id === e.id), `${e.id} has no phrases and no catalogue entry`).toBe(true);
    }
  });

  it("points every rubric key at something that exists", () => {
    const all = new Set([...historyIds, ...examIds, ...invIds, ...ruleIds]);
    for (const key of Object.keys(c.rubric.misses)) expect(all.has(key), `miss → ${key}`).toBe(true);
    for (const key of Object.keys(c.rubric.strengths)) expect(all.has(key), `strength → ${key}`).toBe(true);
    for (const group of c.rubric.idealTreatment) for (const id of group) expect(ruleIds.includes(id), `ideal → ${id}`).toBe(true);
    if (c.rubric.definitiveTreatment) for (const id of c.rubric.definitiveTreatment.ids) expect(ruleIds.includes(id)).toBe(true);
    expect(c.rubric.diagnosisAccept.length).toBeGreaterThan(0);
  });

  it("has hazards whose rescue tokens are executable", () => {
    for (const h of lib.values()) {
      for (const group of h.rescue) {
        for (const tok of group) {
          if (tok.startsWith("drug:")) expect(formularyDrug(tok.slice(5)), `${h.id} → ${tok}`).toBeDefined();
          else if (tok.startsWith("measure:")) expect(measure(tok.slice(8)), `${h.id} → ${tok}`).toBe(true);
          else expect(ruleIds.includes(tok), `${h.id} → ${tok}`).toBe(true);
        }
      }
      if (h.omission) for (const tok of h.omission.preventedBy) expect(ruleIds.includes(tok), `${h.id} omission → ${tok}`).toBe(true);
    }
  });

  it("has complete teaching content", () => {
    expect(c.truth.reasoning).toHaveLength(4);
    expect(c.teaching.severityBands.length).toBeGreaterThan(1);
    expect(c.teaching.drugs.length).toBeGreaterThan(0);
    for (const d of c.teaching.drugs) expect(d.brand, `${d.generic} needs an Indian brand`).toBeTruthy();
    if (c.teaching.patientBand) expect(c.teaching.severityBands.some((b) => b.id === c.teaching.patientBand)).toBe(true);
    expect(c.followUp.length).toBeGreaterThan(0);
  });
});
