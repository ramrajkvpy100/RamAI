import { describe, expect, it } from "vitest";

import { surgAppendicitis } from "@/engine/cases/surg-appendicitis";
import { formularyDrug } from "@/engine/formulary";
import { doseMultiple, timeCourse } from "@/engine/pharmacology";

import { play } from "./helpers";

const vital = (state: ReturnType<typeof play>["state"], k: "hr" | "rr" | "spo2" | "bp" | "temp" | "rbs" | "pain") => state.vitals[k]?.current.value;
const said = (state: ReturnType<typeof play>["state"]) => state.messages.map((m) => `${m.role}: ${m.text}`).join("\n");

describe("every drug acts, and takes time to act", () => {
  it("dose multiples: the usual dose is one; ten litres is twenty bags", () => {
    expect(doseMultiple(formularyDrug("paracetamol")!, { amount: 650, unit: "mg" })).toBe(1);
    expect(doseMultiple(formularyDrug("paracetamol")!, { amount: 1, unit: "g" })).toBeCloseTo(1.54, 1);
    expect(doseMultiple(formularyDrug("ns")!, { volumeMl: 10_000 })).toBe(20);
    expect(doseMultiple(formularyDrug("insulin-regular")!, { amount: 60, unit: "units" })).toBe(10);
  });

  it("an effect builds from onset to peak and wears off", () => {
    const k = { onset: 10, peak: 30, duration: 240 };
    expect(timeCourse(k, 0)).toBe(0);
    expect(timeCourse(k, 5)).toBe(0);
    expect(timeCourse(k, 30)).toBe(1);
    expect(timeCourse(k, 120)).toBeGreaterThan(0);
    expect(timeCourse(k, 120)).toBeLessThan(1);
    expect(timeCourse(k, 300)).toBe(0);
  });

  it("IV paracetamol brings a fever down — not at once, but over the next half hour", () => {
    const before = parseFloat(vital(play(surgAppendicitis, ["Give paracetamol 1 g IV", "Check temperature"]).state, "temp")!);
    const after = parseFloat(vital(play(surgAppendicitis, ["Give paracetamol 1 g IV", "Wait 40 minutes", "Check temperature"]).state, "temp")!);
    expect(before).toBeGreaterThan(100);
    expect(after).toBeLessThan(before - 0.5);
  });

  it("morphine eases the pain once it acts — and the patient says so", () => {
    const { state } = play(surgAppendicitis, ["Give morphine 3 mg IV", "Wait 15 minutes", "How are you feeling now?"]);
    expect(said(state)).toMatch(/pain has eased/i);
  });
});

describe("orders are carried out as given — and the patient lives with them", () => {
  it("ten thousand litres of saline in a minute floods the lungs, and the patient dies within minutes", () => {
    const now = play(surgAppendicitis, ["Give 10000 L of NS IV in 1 min"]);
    expect(now.state.patientStatus).toBe("critical");
    expect(said(now.state)).toMatch(/gasping|frothing/i);
    const later = play(surgAppendicitis, ["Give 10000 L of NS IV in 1 min", "Wait 10 minutes"]);
    expect(later.state.patientStatus).toBe("deceased");
  });

  it("a potassium push stops the heart", () => {
    const { state } = play(surgAppendicitis, ["Attach monitor", "Give KCl 20 mEq IV push", "Wait 5 minutes"]);
    expect(state.patientStatus).toBe("deceased");
    expect(said(state)).toMatch(/wide, bizarre complexes/i);
  });

  it("IV adrenaline to a patient with a pulse: a hypertensive crisis, then VT", () => {
    const { state } = play(surgAppendicitis, ["Attach monitor", "Give adrenaline 1 mg IV"]);
    expect(state.patientStatus).toBe("critical");
    expect(said(state)).toMatch(/BP is over 230/);
  });

  it("an insulin overdose drops the sugar; IV dextrose rescues it", () => {
    const hypo = play(surgAppendicitis, ["Give insulin 100 units IV", "Wait 30 minutes", "Check RBS"]);
    expect(parseFloat(vital(hypo.state, "rbs")!)).toBeLessThan(55);
    const rescued = play(surgAppendicitis, ["Give insulin 100 units IV", "Wait 15 minutes", "Give 25% dextrose 100 mL IV", "Wait 10 minutes", "Check RBS"]);
    expect(parseFloat(vital(rescued.state, "rbs")!)).toBeGreaterThan(100);
  });

  it("a usual dose harms no one", () => {
    const { state } = play(surgAppendicitis, ["Give ondansetron 4 mg IV", "Give paracetamol 1 g IV", "Wait 30 minutes"]);
    expect(["stable", "guarded", "improving", "deteriorating"]).toContain(state.patientStatus);
    expect(said(state)).not.toMatch(/arrest|no pulse/i);
  });
});
