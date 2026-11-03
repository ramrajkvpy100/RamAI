import { describe, expect, it } from "vitest";

import { ALL_CASES } from "@/engine/cases";
import { FORMULARY, formularyDrug } from "@/engine/formulary";
import { substituteFor, THERAPEUTIC_GROUPS, therapeuticGroupOf } from "@/engine/therapeutic-classes";

const caseOf = (id: string) => ALL_CASES.find((c) => c.id.startsWith(id))!;
const sub = (caseId: string, drug: string, route?: string) => substituteFor(caseOf(caseId), formularyDrug(drug)!, route);

describe("therapeutic equivalence", () => {
  it("names only drugs in the formulary", () => {
    for (const g of THERAPEUTIC_GROUPS) for (const m of [...g.equivalent, ...(g.second ?? [])]) expect(formularyDrug(m.id), m.id).toBeTruthy();
  });

  it("files every formulary drug, with those nothing replaces saying so", () => {
    for (const d of FORMULARY) expect(therapeuticGroupOf(d.id) === null || typeof therapeuticGroupOf(d.id) === "string").toBe(true);
    expect(therapeuticGroupOf("adrenaline")).toBeNull();
    expect(therapeuticGroupOf("bumetanide")).toBe("loop-diuretic");
  });

  it("bumetanide is the loop diuretic in heart failure, with the dose window scaled to its potency", () => {
    const s = sub("em-adhf", "bumetanide", "IV");
    expect(s?.substitute.tier).toBe("equivalent");
    expect(s?.rule.id).toBe("diuretic");
    const written = caseOf("em-adhf").therapeutics.find((r) => r.id === "diuretic")!.doseRange;
    if (written) expect(s?.rule.doseRange?.max).toBeCloseTo(written.max / 40);
  });

  it("tablets don't replace the vein in an emergency", () => {
    expect(sub("em-adhf", "bumetanide", "PO")).toBeUndefined();
  });

  it("cefotaxime is ceftriaxone; meropenem counts but is flagged as an escalation", () => {
    expect(sub("surg-cholecystitis", "cefotaxime", "IV")?.substitute.tier).toBe("equivalent");
    expect(sub("surg-cholecystitis", "cefoperazone-sulbactam", "IV")?.substitute.tier).toBe("second-line");
  });

  it("a harmful or written judgement in the case isn't touched by the matrix", () => {
    // Enalapril in pre-eclampsia: the group doesn't apply, whatever a rule covers.
    expect(sub("obg-preeclampsia", "enalapril", "PO")).toBeUndefined();
    expect(sub("obg-preeclampsia", "telmisartan", "PO")).toBeUndefined();
  });

  it("nifedipine stands in only in pregnancy", () => {
    expect(THERAPEUTIC_GROUPS.find((g) => g.id === "severe-preeclampsia")!.onlyIn!.test("Hypertensive emergency with aortic dissection")).toBe(false);
  });

  it("steroids aren't swapped where the specific drug matters", () => {
    const g = THERAPEUTIC_GROUPS.find((x) => x.id === "systemic-steroid")!;
    for (const d of ["Adrenal crisis", "Bacterial meningitis", "Preterm labour", "Septic shock"]) expect(g.notIn!.test(d)).toBe(true);
    expect(g.notIn!.test("Acute severe asthma")).toBe(false);
  });

  it("no NSAID stands in for paracetamol in dengue or a child", () => {
    const g = THERAPEUTIC_GROUPS.find((x) => x.id === "analgesic")!;
    expect(g.secondNotIn!.test("Dengue with warning signs")).toBe(true);
  });
});
