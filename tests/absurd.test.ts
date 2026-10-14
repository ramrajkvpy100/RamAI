import { describe, expect, it } from "vitest";

import { dermAcne } from "@/engine/cases/derm-acne";
import { emAdhf } from "@/engine/cases/em-adhf";

import { play } from "./helpers";

describe("orders beyond reason are carried out — and the patient lives (or dies) with them", () => {
  it("more adrenaline into the VT it caused brings ventricular fibrillation, not 'no change'", () => {
    const once = play(emAdhf, ["Give adrenaline 1 mg IV stat", "Wait 4 minutes"]);
    expect(once.state.patientStatus).toBe("critical");
    const again = play(emAdhf, ["Give adrenaline 1 mg IV stat", "Wait 4 minutes", "Give adrenaline 2 mg IV stat"]);
    expect(again.state.patientStatus).toBe("deceased");
    expect(again.state.messages.some((m) => /ventricular fibrillation/i.test(m.text))).toBe(true);
    expect(again.state.messages.some((m) => /no change/i.test(m.text) && /adrenaline/i.test(m.text))).toBe(false);
  });

  it("50 g of salt is eaten as ordered: vomiting and thirst, then a rising sodium, fits — and death if left", () => {
    const early = play(dermAcne, ["Eat 50 g of salt", "Wait 20 minutes"]);
    expect(early.state.patientStatus).toBe("deteriorating");
    expect(early.state.messages.some((m) => /thirsty|vomit/i.test(m.text))).toBe(true);
    const later = play(dermAcne, ["Eat 50 g of salt", "Wait 20 minutes", "Wait 50 minutes", "Check serum electrolytes"]);
    expect(later.state.patientStatus).toBe("critical");
    const na = later.state.investigations.find((i) => i.defId === "electrolytes")?.rows?.find((r) => r.analyte === "Sodium");
    expect(Number(na?.value)).toBeGreaterThan(165);
    const left = play(dermAcne, ["Eat 50 g of salt", "Wait 20 minutes", "Wait 1 hour", "Wait 2 hours", "Wait 3 hours"]);
    expect(left.state.patientStatus).toBe("deceased");
  });

  it("free water in time rescues salt poisoning", () => {
    const { state } = play(dermAcne, ["Eat 50 g of salt", "Wait 30 minutes", "Start 5% dextrose 1000 mL IV", "Wait 6 hours"]);
    expect(state.patientStatus).not.toBe("deceased");
  });

  it("'low salt diet' is advice, not an order to eat salt", () => {
    const { state } = play(dermAcne, ["Advise a low salt diet", "Wait 2 hours"]);
    expect(state.patientStatus).not.toBe("deteriorating");
    expect(state.drugs.some((d) => /salt/i.test(d.generic))).toBe(false);
  });
});
