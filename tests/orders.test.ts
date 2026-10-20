import { describe, expect, it } from "vitest";

import { dermAcne } from "@/engine/cases/derm-acne";
import { emAdhf } from "@/engine/cases/em-adhf";
import { idDengue } from "@/engine/cases/id-dengue";
import { phAcs } from "@/engine/cases/ph-acs";
import { surgAppendicitis } from "@/engine/cases/surg-appendicitis";
import { toHinglish } from "@/engine/i18n/hinglish";

import { converse, messagesOf, play } from "./helpers";

const said = (turn: { effects: Parameters<typeof messagesOf>[0] }) => messagesOf(turn.effects).join(" | ");

describe("IV fluid does what this patient needs — not what the bag says", () => {
  it("a patient who isn't short of fluid gets nothing for the pulse from a litre", () => {
    const { turns } = play(dermAcne, ["Attach monitor", "Give NS 1 L IV over 1 hour", "Wait 60 minutes"]);
    const all = turns.map(said).join(" ");
    expect(all).not.toMatch(/pulse 76 → \d/);
    expect(all).toMatch(/no change from it/);
  });

  it("five litres in half an hour floods a healthy woman's lungs — no 'improvement' from it", () => {
    const { state, turns } = play(dermAcne, ["Attach monitor", "Give NS 5 L IV over 30 minutes — I'm sure", "Wait 15 minutes", "Wait 15 minutes", "Wait 15 minutes"]);
    expect(["deteriorating", "critical"]).toContain(state.patientStatus);
    expect(Number(state.vitals.spo2!.current.value)).toBeLessThan(95);
    const all = turns.map(said).join(" ");
    expect(all).toMatch(/breathless|crepitation|frothy|can't lie/i);
    expect(all).not.toMatch(/looks better/);
  });

  it("the same five litres into failing heart and lungs is catastrophic", () => {
    const { state } = play(emAdhf, ["Attach monitor", "Give NS 5 L IV over 30 minutes — I'm sure", ...Array(8).fill("Wait 5 minutes")]);
    expect(state.patientStatus).toBe("deceased");
  });

  it("in a patient who is short of fluid, a bolus brings the pulse down — and says so", () => {
    const { turns } = play(idDengue, ["Attach monitor", "Give NS 500 mL IV over 30 minutes"]);
    expect(turns.map(said).join(" ")).toMatch(/after the 0\.9% sodium chloride 500 mL IV over 30 min:\s+• Pulse 108 → \d+/);
  });

  it("5% dextrose mostly goes into the cells: a litre over two hours doesn't flood anyone", () => {
    const { hidden } = play(dermAcne, ["Start 5% dextrose 1000 mL IV over 2 hours", "Wait 2 hours"]);
    expect(hidden.hazards.filter((h) => h.id.startsWith("fluid-"))).toEqual([]);
  });

  it("a drip stopped part-way gives only what ran in", () => {
    const { hidden, turns } = play(dermAcne, ["Give NS 5 L IV over 2 hours — I'm sure", "Wait 10 minutes", "Stop IV fluids", "Wait 2 hours"]);
    expect(said(turns[2]!)).toMatch(/IV fluids stopped — \d+ mL of the 0\.9% sodium chloride had gone in/);
    expect(hidden.hazards.some((h) => h.id.startsWith("fluid-") && !h.superseded && h.manifestedAt !== undefined)).toBe(false);
  });
});

describe("a drug is credited only with what it did", () => {
  it("a gram of salt after a salt load isn't blamed for the poisoning's course", () => {
    const { turns, hidden } = play(dermAcne, ["Eat 50 g of salt — I'm sure", "Wait 20 minutes", "Eat 1 g of salt", "Wait 15 minutes", "Wait 15 minutes", "Wait 15 minutes"]);
    const reports = turns.flatMap((t) => messagesOf(t.effects)).filter((m) => /after the table salt \(sodium chloride\) 1 g/.test(m));
    expect(reports.length).toBeGreaterThan(0);
    for (const r of reports) expect(r).toMatch(/no change from it/);
    // A pinch more doesn't hurry the poisoning on.
    expect(hidden.hazards.find((h) => h.id === "salt-poisoning")?.trigger).not.toMatch(/then/);
  });

  it("a little salt is just thirst — not poisoning", () => {
    const { hidden, state } = play(dermAcne, ["Eat 15 g of salt", "Wait 40 minutes"]);
    expect(hidden.hazards.map((h) => h.id)).toEqual(["salt-load"]);
    expect(state.patientStatus).not.toBe("critical");
  });
});

describe("an order missing what's needed is asked about, and the answer completes it", () => {
  it("a drug with no dose or route", async () => {
    const { hidden, turns } = await converse(surgAppendicitis, ["Give paracetamol", "1 g IV"]);
    expect(said(turns[0]!)).toMatch(/nurse: Paracetamol — what dose, and oral, IV or rectal, doctor\?/);
    expect(hidden.drugs).toHaveLength(1);
    expect(hidden.drugs[0]).toMatchObject({ drugId: "paracetamol", route: "IV", dose: "1 g" });
  });

  it("'the usual dose' is the formulary's", async () => {
    const { hidden } = await converse(surgAppendicitis, ["Give ondansetron", "the usual dose"]);
    expect(hidden.drugs[0]).toMatchObject({ drugId: "ondansetron", route: "IV", dose: "4 mg" });
  });

  it("'ok' isn't an answer — the question is asked again, and the order waits", async () => {
    const { hidden, turns } = await converse(surgAppendicitis, ["Give paracetamol", "ok", "1 g IV"]);
    expect(said(turns[1]!)).toMatch(/nurse: Paracetamol — what dose/);
    expect(hidden.drugs[0]).toMatchObject({ drugId: "paracetamol", dose: "1 g" });
  });

  it("something else instead: the order isn't given", async () => {
    const { hidden } = await converse(surgAppendicitis, ["Give paracetamol", "Check BP"]);
    expect(hidden.drugs).toHaveLength(0);
  });

  it("a drip with no volume or rate", async () => {
    const { hidden, turns } = await converse(surgAppendicitis, ["Start NS", "1 L over 8 hours"]);
    expect(said(turns[0]!)).toMatch(/how much, and over how long/);
    expect(hidden.drugs[0]).toMatchObject({ drugId: "ns", volumeMl: 1000, overMin: 480 });
  });

  it("a prescription with no frequency or duration", async () => {
    const { hidden, turns } = await converse(dermAcne, ["Prescribe doxycycline 100 mg", "BD for 6 weeks"]);
    expect(said(turns[0]!)).toMatch(/system: Doxycycline 100 mg — how often, and for how long\?/);
    expect(hidden.drugs[0]).toMatchObject({ drugId: "doxycycline", mode: "prescribed", frequency: "BD", duration: "6 weeks" });
  });

  it("a slow-infusion drug with no rate", async () => {
    const { hidden, turns } = await converse(surgAppendicitis, ["Give KCl 20 mEq IV", "over 2 hours"]);
    expect(said(turns[0]!)).toMatch(/over how long/);
    expect(hidden.drugs[0]).toMatchObject({ drugId: "potassium-chloride", overMin: 120 });
  });

  it("an X-ray: which part, and which views", async () => {
    const { state, turns } = await converse(surgAppendicitis, ["Order an X-ray", "right knee, AP and lateral"]);
    expect(said(turns[0]!)).toMatch(/X-ray of which part, doctor — and which view\?/);
    const xray = state.investigations.at(-1)!;
    expect(xray.name).toBe("X-ray right knee AP & lateral");
    expect(xray.report).toMatch(/No fracture/);
  });

  it("a chest X-ray: PA, or AP portable", async () => {
    const { state, turns } = await converse(emAdhf, ["Get a chest X-ray", "AP portable"]);
    expect(said(turns[0]!)).toMatch(/Chest X-ray — PA, or AP portable, doctor\?/);
    expect(state.investigations.at(-1)!.name).toBe("Chest X-ray AP (portable)");
  });

  it("a CT: plain, or with contrast", async () => {
    const { state, turns } = await converse(surgAppendicitis, ["CT abdomen", "with contrast"]);
    expect(said(turns[0]!)).toMatch(/plain or with contrast/);
    expect(state.investigations.at(-1)!.name).toBe("CECT abdomen & pelvis");
  });

  it("oxygen: which device, and how many litres — and the saturation answers to it", async () => {
    const { turns } = await converse(emAdhf, ["Attach monitor", "Start oxygen", "nasal prongs 4 L"]);
    expect(said(turns[1]!)).toMatch(/Oxygen — by nasal prongs, face mask or non-rebreather, and how many litres, doctor\?/);
    expect(said(turns[2]!)).toMatch(/Oxygen started — nasal prongs at 4 L\/min/);
  });

  it("a complete order goes straight through", async () => {
    const { hidden, turns } = await converse(surgAppendicitis, ["Give paracetamol 1 g IV over 15 minutes"]);
    expect(hidden.drugs).toHaveLength(1);
    expect(said(turns[0]!)).not.toMatch(/what dose/);
  });

  it("on the phone, the family asks in their words — in Hinglish too", async () => {
    const { turns } = await converse(phAcs, ["Give him aspirin"]);
    expect(said(turns[0]!)).toMatch(/attendant: Doctor, how much aspirin should we give\?/);
    expect(toHinglish("Doctor, how much aspirin should we give?", phAcs.id, "attendant", phAcs.patient)).toBe("Doctor, aspirin kitna dena hai?");
    expect(toHinglish("Doctor, should we give the isosorbide dinitrate under the tongue or by mouth?", phAcs.id, "attendant", phAcs.patient)).toBe("Doctor, isosorbide dinitrate jeebh ke neeche rakhein ya khila dein?");
  });
});

describe("an order that could kill is queried once — then carried out if the doctor says so", () => {
  it("the nurse asks before a potassium push, and nothing has gone in yet", async () => {
    const { hidden, turns } = await converse(surgAppendicitis, ["Give KCl 40 mEq IV push"]);
    expect(said(turns[0]!)).toMatch(/nurse: Doctor — potassium chloride .* IV.*\? Potassium that fast into a vein can stop the heart\. Do you still want it given\?/);
    expect(hidden.drugs).toHaveLength(0);
    expect(hidden.clock).toBe(0);
  });

  it("'yes, give it' — it's given, with what it does", async () => {
    const { state } = await converse(surgAppendicitis, ["Attach monitor", "Give KCl 40 mEq IV push", "yes give it", "Wait 5 minutes"]);
    expect(state.patientStatus).toBe("deceased");
  });

  it("the same order said again is the answer too", () => {
    const { hidden } = play(dermAcne, ["Give NS 5 L IV over 30 minutes", "Give NS 5 L IV over 30 minutes"]);
    expect(hidden.drugs).toHaveLength(1);
  });

  it("'no' — it's held", async () => {
    const { hidden, turns } = await converse(surgAppendicitis, ["Give KCl 40 mEq IV push", "no"]);
    expect(said(turns[1]!)).toMatch(/nurse: Okay, doctor — I'll hold it\./);
    expect(hidden.drugs).toHaveLength(0);
  });

  it("a safer order instead is simply given", async () => {
    const { hidden } = await converse(surgAppendicitis, ["Give KCl 40 mEq IV push", "Give KCl 20 mEq IV over 2 hours"]);
    expect(hidden.drugs).toHaveLength(1);
    expect(hidden.drugs[0]).toMatchObject({ overMin: 120 });
  });

  it("ordinary orders aren't queried", async () => {
    const { turns } = await converse(surgAppendicitis, ["Give paracetamol 1 g IV over 15 minutes", "Give NS 1 L IV over 8 hours"]);
    expect(turns.map(said).join(" ")).not.toMatch(/Do you still want it given/);
  });
});

import { childDose } from "@/engine/orders";
describe("children's doses go by weight", () => {
  it("15 mg/kg of paracetamol for a 12 kg child; never above the adult dose", () => {
    expect(childDose("paracetamol", 12)?.amount).toBe(180);
    expect(childDose("paracetamol", 90)?.amount).toBe(1000);
    expect(childDose("adrenaline", 15)?.amount).toBe(0.15);
  });
});

describe("a drug name slightly misspelt is still understood", () => {
  it("'Syrup Oseltimivir' is oseltamivir, by mouth", async () => {
    const { resolveIntents } = await import("@/engine/intent");
    const { surgAppendicitis } = await import("@/engine/cases/surg-appendicitis");
    const [i] = resolveIntents("Syrup Oseltimivir", { def: surgAppendicitis, setting: "OPD", weightKg: 10 });
    expect(i?.kind).toBe("drug");
    expect(i?.targetId).toBe("oseltamivir");
  });
});

describe("drug interactions", () => {
  it("warfarin with ibuprofen, and sildenafil with a nitrate, are found; paracetamol alone is not", async () => {
    const { findInteractions } = await import("@/engine/interactions");
    const n = (id: string) => id;
    expect(findInteractions(["warfarin", "ibuprofen"], n)).toHaveLength(1);
    expect(findInteractions(["sildenafil", "isosorbide-mononitrate"], n)[0]?.effect).toMatch(/hypotension/);
    expect(findInteractions(["paracetamol", "ondansetron"], n)).toHaveLength(0);
  });
});

import { getCase } from "@/engine/cases";
describe("a doctor's real shorthand — found by the messy-doctor audit", () => {
  const sle = () => getCase("med-sle-apex-01")!;
  it("a new medicine named while another waits for its dose is never swapped into it", async () => {
    const { hidden } = await converse(sle(), ["hcq bd", "mycophenolate 1 g bd"]);
    expect(hidden.drugs.every((d) => d.drugId !== "hydroxychloroquine" || d.amount !== 1)).toBe(true);
  });
  it("'1 mg/kg' is worked out for the patient's weight, not read as 1 mg", async () => {
    const { turns } = await converse(sle(), ["prednisolone 1mg/kg od"]);
    expect(turns[0]!.record.intents[0]?.payload?.amount).toBeGreaterThan(20);
  });
  it("a bare number after the drug is its usual unit: 'hcq 200 bd' is 200 mg", async () => {
    const { turns } = await converse(sle(), ["hcq 200 bd"]);
    expect(turns[0]!.record.intents[0]?.payload).toMatchObject({ amount: 200, unit: "mg" });
  });
  it("'24 hr urine protein' and 'over 1 hr' are hours, never the pulse", async () => {
    const { turns } = await converse(sle(), ["24 hr urine protein"]);
    expect(turns[0]!.record.intents.some((i) => i.kind === "vitals")).toBe(false);
  });
  it("'dx … close' and a bare 'close' end the case", async () => {
    expect((await converse(sle(), ["dx sle. close"])).hidden.closed).toBe(true);
    expect((await converse(sle(), ["close"])).hidden.closed).toBe(true);
  });
  it("'any drug allergy' is answered about allergies, not the medicines", async () => {
    const { turns } = await converse(getCase("derm-melasma-01")!, ["any drug allergy"]);
    expect(turns[0]!.record.intents[0]?.targetId).toBe("allergy");
  });
  it("the nurse questions a cephalosporin once the penicillin allergy is on the chart", async () => {
    const { turns } = await converse(surgAppendicitis, ["any drug allergy", "inj ceftriaxone 1 g iv"]);
    expect(said(turns[1]!)).toMatch(/allergic to penicillin/);
  });
});
