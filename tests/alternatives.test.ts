import { describe, expect, it } from "vitest";

import { ALL_CASES } from "@/engine/cases";
import { generateDebrief } from "@/engine/debrief";
import { formularyDrug } from "@/engine/formulary";

import { play } from "./helpers";

const C = (id: string) => ALL_CASES.find((c) => c.id.startsWith(id))!;
const treatment = (id: string, inputs: string[]) => {
  const { hidden, state } = play(C(id), inputs);
  const d = generateDebrief(C(id), hidden, state);
  const line = d.score.lines.find((l) => l.category === "treatment")!;
  return { hidden, status: hidden.status, share: line.earned / line.max, lost: line.lost ?? [], drugs: hidden.drugs };
};

describe("a valid alternative treats the patient", () => {
  const adhf = (drug: string) => ["Sit her up, oxygen 15 L via NRBM, attach monitor", `Give ${drug} IV`, "Start BiPAP", "Admit to CCU", "Wait 60 minutes", "Diagnosis: acute decompensated heart failure"];

  it("bumetanide for furosemide in heart failure: the same recovery and marks", () => {
    const first = treatment("em-adhf", adhf("furosemide 80 mg"));
    const swap = treatment("em-adhf", adhf("bumetanide 2 mg"));
    expect(swap.drugs.find((d) => d.drugId === "bumetanide")?.substitute?.tier).toBe("equivalent");
    expect(swap.status).toBe(first.status);
    expect(["improving", "recovered"]).toContain(swap.status);
    expect(swap.share).toBeGreaterThanOrEqual(first.share - 0.05);
  });

  it("torsemide for furosemide: the case already names it, and it counts in full", () => {
    const swap = treatment("em-adhf", adhf("torsemide 40 mg"));
    expect(["improving", "recovered"]).toContain(swap.status);
    expect(swap.share).toBeGreaterThanOrEqual(0.85);
  });

  it("telmisartan in place of amlodipine in hypertension scores high", () => {
    const orders = (d: string) => ["Prescribe " + d + " once daily for 30 days", "Advise low salt diet, regular exercise, weight loss and DASH diet", "Counsel adherence: take the tablet every day even if you feel well", "Review in 2 weeks"];
    const a = treatment("gp-hypertension", orders("amlodipine 5 mg"));
    const t = treatment("gp-hypertension", orders("telmisartan 40 mg"));
    expect(t.share).toBeGreaterThanOrEqual(a.share - 0.05);
    expect(t.share).toBeGreaterThanOrEqual(0.8);
  });

  it("cefotaxime for ceftriaxone in cholecystitis: full recovery and credit", () => {
    const orders = (d: string) => ["NPO, IV access, normal saline 1 litre IV over 8 hours", "Paracetamol 1 g IV", `${d} IV`, "Refer to surgeon for early laparoscopic cholecystectomy", "Admit", "Wait 240 minutes"];
    const a = treatment("surg-cholecystitis", orders("ceftriaxone 2 g"));
    const c = treatment("surg-cholecystitis", orders("cefotaxime 2 g"));
    expect(c.drugs.find((d) => d.drugId === "cefotaxime")?.substitute?.tier).toBe("equivalent");
    expect(c.status).toBe(a.status);
    expect(c.share).toBeGreaterThanOrEqual(a.share - 0.01);
  });

  it("a broader escalation still works, with less credit and a note saying why", () => {
    const orders = (d: string) => ["NPO, IV access, normal saline 1 litre IV over 8 hours", "Paracetamol 1 g IV", `${d} IV`, "Refer to surgeon for early laparoscopic cholecystectomy", "Admit", "Wait 240 minutes"];
    const a = treatment("surg-cholecystitis", orders("ceftriaxone 2 g"));
    const m = treatment("surg-cholecystitis", orders("cefoperazone sulbactam 1.5 g"));
    expect(m.drugs.find((d) => d.drugId === "cefoperazone-sulbactam")?.substitute?.tier).toBe("second-line");
    expect(["improving", "recovered"]).toContain(m.status);
    expect(m.share).toBeLessThan(a.share);
    expect(m.share).toBeGreaterThanOrEqual(a.share - 0.2);
    expect(m.lost.join(" ")).toMatch(/preferred first-line because/);
  });

  it("an unrelated drug isn't treatment", () => {
    expect(formularyDrug("adrenaline")).toBeTruthy();
    const t = treatment("surg-cholecystitis", ["Pantoprazole 40 mg IV", "Wait 240 minutes"]);
    expect(t.hidden.actions["antibiotic"]).toBeUndefined();
  });
});
