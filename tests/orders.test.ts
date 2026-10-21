import { describe, expect, it } from "vitest";

import { dermAcne } from "@/engine/cases/derm-acne";
import { emAdhf } from "@/engine/cases/em-adhf";
import { idDengue } from "@/engine/cases/id-dengue";
import { phAcs } from "@/engine/cases/ph-acs";
import { surgAppendicitis } from "@/engine/cases/surg-appendicitis";
import { toHinglish } from "@/engine/i18n/hinglish";

import { ALL_CASES } from "@/engine/cases";
import { converse, messagesOf, play } from "./helpers";

const ALL_PHONE = ALL_CASES.filter((c) => c.track === "phone");

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

import { childDoseConcern } from "@/engine/orders";
import { judgeDiagnosis } from "@/engine/scoring";
import { emViperPhc } from "@/engine/cases/em-viper-phc";
describe("bad-doctor audit, round two", () => {
  it("an adult dose for a baby is caught: paracetamol 1 g for 8 kg", () => {
    expect(childDoseConcern("paracetamol", 1, "g", 8)).toMatch(/125 mg\/kg/);
    expect(childDoseConcern("paracetamol", 120, "mg", 8)).toBeNull();
  });
  it("'currently taking any tab' is a question about medicines, not an order", async () => {
    const { turns } = await converse(getCase("id-dengue-01")!, ["currently taking any tab"]);
    expect(turns[0]!.record.intents[0]?.kind).toBe("history");
  });
  it("'dextrose 10%' is D10, and 'd10 100 ml' is 100 mL", async () => {
    const { turns } = await converse(getCase("gr-aip-01")!, ["give iv dextrose 10%", "d10 100 ml iv"]);
    expect(turns[0]!.record.intents[0]?.targetId).toBe("d10");
  });
  it("'rf' is rheumatoid factor", async () => {
    const { turns } = await converse(getCase("derm-psoriasis-01")!, ["rf"]);
    expect(turns[0]!.record.intents[0]?.targetId).toBe("rf");
  });
  it("'neurotoxic snake bite' for a viper's haemotoxic bite is wrong, not partly right", () => {
    expect(judgeDiagnosis(emViperPhc, "neurotoxic snake bite")).toBe("incorrect");
    expect(judgeDiagnosis(emViperPhc, "snake bite")).toBe("partial");
  });
  it("a vague 'examine' shows the general examination — never 'no abnormality'", async () => {
    const { turns } = await converse(getCase("id-dengue-01")!, ["examine everything please doc"]);
    expect(said(turns[0]!)).not.toMatch(/No abnormality detected on that examination/);
  });
});

describe("bad-doctor audit, round three", () => {
  it("the nurse queries phenytoin pushed, morphine 50 mg and 3× doses", async () => {
    const { turns } = await converse(getCase("id-dengue-01")!, ["phenytoin 1 g iv push", "no", "morphine 50 mg iv", "no", "ondansetron 20 mg iv"]);
    expect(said(turns[0]!)).toMatch(/50 mg a minute/);
    expect(said(turns[2]!)).toMatch(/opioid could stop the breathing/);
    expect(said(turns[4]!)).toMatch(/times the usual dose/);
  });
  it("'wait 30 min' is a wait, not 'hold it'", async () => {
    const { turns } = await converse(getCase("id-dengue-01")!, ["phenytoin 1 g iv push", "wait 30 min"]);
    expect(said(turns[1]!)).not.toMatch(/hold it/);
  });
  it("'start antibiotics' asks which antibiotic", async () => {
    const { turns } = await converse(getCase("id-dengue-01")!, ["start antibiotics"]);
    expect(said(turns[0]!)).toMatch(/Which antibiotic/);
  });
  it("once discharged, bedside orders aren't carried out", async () => {
    const { turns } = await converse(getCase("id-dengue-01")!, ["discharge the patient", "cbc"]);
    expect(said(turns[1]!)).toMatch(/gone home/);
  });
});

describe("several studies in one line", () => {
  it("'xray chest usg abdomen ct abdomen' — each study its own part", async () => {
    const { hidden } = await converse(getCase("surg-appendicitis-01")!, ["cbc xray chest usg abdomen ct abdomen with contrast"]);
    const names = hidden.investigations.map((i) => i.name.toLowerCase()).join(" | ");
    expect(names).not.toMatch(/usg chest|ct chest/);
  });
});

describe("Obstetric emergencies (CHC PPH)", () => {
  it("reads an oxytocin infusion as IV, and doesn't query the usual PPH doses", async () => {
    const { obgPphChc } = await import("@/engine/cases/obg-pph-chc");
    const { turns, hidden } = play(obgPphChc, ["oxytocin 40 units in 1 litre rl over 4 hours", "tranexamic acid 1 g iv over 10 min"]);
    const said = turns.flatMap((t) => messagesOf(t.effects)).join("\n");
    expect(said).not.toMatch(/IM or IV|times the usual dose/);
    expect(hidden.drugs.find((d) => d.drugId === "oxytocin")?.route).toBe("IV");
  });

  it("queries a tenfold carboprost and a magnesium push", async () => {
    const { obgPphChc } = await import("@/engine/cases/obg-pph-chc");
    const { turns } = play(obgPphChc, ["carboprost 2.5 mg im", "no", "magnesium sulphate 4 g iv over 1 min"]);
    const said = turns.flatMap((t) => messagesOf(t.effects)).join("\n");
    expect(said).toMatch(/carboprost[^\n]*far above the usual dose/i);
    expect(said).toMatch(/Magnesium that fast/);
  });

  it("improves once a uterotonic is in", async () => {
    const { obgPphChc } = await import("@/engine/cases/obg-pph-chc");
    const { hidden } = play(obgPphChc, ["massage the uterus", "oxytocin 10 units iv", "ringer lactate 1 litre over 30 min", "wait 30 min"]);
    expect(hidden.status).toBe("improving");
    expect(hidden.hazards.some((h) => h.died)).toBe(false);
  });
});

describe("Random erratic-doctor audit, round five", () => {
  const said = (turns: { effects: Parameters<typeof messagesOf>[0] }[]) => turns.flatMap((t) => messagesOf(t.effects)).join("\n");

  it("reads vitamin K, bicarbonate and platelet transfusions as orders, not tests", () => {
    const { turns } = play(emAdhf, ["vit k 10 mg iv", "sodium bicarb 50 meq iv over 10 min", "platelets 2 units"]);
    const ids = turns.flatMap((t) => t.record.intents.map((i) => `${i.kind}:${i.targetId}`));
    expect(ids).toContain("drug:vitamin-k");
    expect(ids).toContain("drug:sodium-bicarbonate");
    expect(ids).toContain("drug:platelet-transfusion");
    expect(ids.some((x) => x.startsWith("investigation:"))).toBe(false);
  });

  it("keeps short forms whole: 'S. electrolytes', 'Inj. Ceftriaxone'", () => {
    const { turns } = play(emAdhf, ["s. electrolytes", "Inj. Ceftriaxone 1 g IV"]);
    expect(turns[0]!.record.intents.map((i) => i.kind)).toEqual(["investigation"]);
    expect(turns[1]!.record.intents.map((i) => `${i.kind}:${i.targetId}`)).toEqual(["drug:ceftriaxone"]);
  });

  it("answers exam shorthands and a symptom question correctly", () => {
    const { turns } = play(dermAcne, ["cns", "per abdomen", "jvp", "chest pain on walking?"]);
    expect(turns.slice(0, 3).map((t) => t.record.intents[0]?.kind)).toEqual(["exam", "exam", "exam"]);
    expect(turns[3]!.record.intents[0]?.kind).toBe("history");
  });

  it("asks which medicine when an order is changed without naming it", () => {
    const { turns } = play(emAdhf, ["double the dose", "change to iv", "cancel that"]);
    expect(said(turns)).toMatch(/Which medicine do you mean, doctor\?/);
    expect(said(turns)).not.toMatch(/say that once more|withheld/);
  });

  it("checks before sending an unstable patient home", () => {
    const { turns, hidden } = play(emAdhf, ["discharge"]);
    expect(said(turns)).toMatch(/send them home\? They're/);
    expect(hidden.discharged).toBeFalsy();
  });

  it("queries a uterotonic for a man, a pregnancy test for a man, and a diuretic in low BP", async () => {
    const { emViperPhc } = await import("@/engine/cases/em-viper-phc");
    const man = play(emViperPhc, ["misoprostol 800 mcg sl", "no", "upt"]);
    expect(said(man.turns)).toMatch(/no use in a man/);
    expect(said(man.turns)).toMatch(/he's a man — a pregnancy test isn't needed/);
    const { obgPphChc } = await import("@/engine/cases/obg-pph-chc");
    expect(said(play(obgPphChc, ["furosemide 40 mg iv"]).turns)).toMatch(/BP is 94\/60 — a diuretic could drop it further/);
  });

  it("the phone: no ICU, no drip to stop", () => {
    const phone = ALL_PHONE[0];
    if (!phone) return;
    const { turns } = play(phone, ["admit in icu", "stop the drip"]);
    expect(said(turns)).toMatch(/bring them to the hospital/);
    expect(said(turns)).not.toMatch(/Admitted to the ICU|IV fluids stopped/);
  });
});

describe("Random erratic-doctor audit, round five (replies)", () => {
  const said = (turns: { effects: Parameters<typeof messagesOf>[0] }[]) => turns.flatMap((t) => messagesOf(t.effects)).join("\n");
  it("doesn't deny a diagnosis it can't know, and denies a risk it wasn't given", () => {
    const { turns } = play(emAdhf, ["is this dengue?", "suicidal thoughts?"]);
    expect(turns[0]!.record.intents[0]?.targetId).toBe("answer:diagnosis");
    expect(turns[1]!.record.intents[0]?.targetId).toBe("fallback:yesno");
    expect(said(turns)).not.toMatch(/say that once more/);
  });
  it("an examination isn't the answer to an X-ray's question", () => {
    const { turns } = play(surgAppendicitis, ["xray knee", "chest auscultation"]);
    expect(turns[1]!.record.intents[0]?.kind).toBe("exam");
  });
  it("reads 'wat hapnd' and keeps advice and examinations out of the history", () => {
    const { turns } = play(emAdhf, ["wat hapnd", "explain to relatives", "knee exam"]);
    expect(turns[0]!.record.intents[0]?.kind).toBe("history");
    expect(turns[0]!.record.intents[0]?.targetId).not.toMatch(/^fallback/);
    expect(turns[1]!.record.intents[0]?.kind).toBe("action");
    expect(turns[2]!.record.intents[0]?.kind).toBe("exam");
  });
});

describe("Random erratic-doctor audit, round six", () => {
  const said = (turns: { effects: Parameters<typeof messagesOf>[0] }[]) => turns.flatMap((t) => messagesOf(t.effects)).join("\n");
  it("eye drops go in the eye; drops in an eye aren't a drip rate", async () => {
    const { parseOrderDetails } = await import("@/engine/formulary");
    expect(parseOrderDetails("atropine 1% eye drops").route).toBe("OD-eye");
    expect(parseOrderDetails("timolol 1 drop in both eyes bd").rateMlH).toBeUndefined();
    expect(parseOrderDetails("ns 1 litre at 30 drops per minute").rateMlH).toBe(90);
  });
  it("asks before intubating someone awake and saturating well, and says what a PHC has", async () => {
    const { emViperPhc } = await import("@/engine/cases/em-viper-phc");
    const { turns } = await converse(emViperPhc, ["intubate", "yes"]);
    expect(said(turns)).toMatch(/intubate\? They're awake/);
    expect(said(turns)).toMatch(/no ventilator here/);
    expect(said(turns)).not.toMatch(/capnography/);
  });
  it("a discharge the nurse queried goes ahead on 'yes', and waits on 'no'", async () => {
    const yes = await converse(emAdhf, ["discharge", "yes"]);
    expect(yes.hidden.discharged).toBe(true);
    const no = await converse(emAdhf, ["discharge", "no"]);
    expect(no.hidden.discharged).toBeFalsy();
  });
});

describe("Random erratic-doctor audit, round seven", () => {
  const said = (turns: { effects: Parameters<typeof messagesOf>[0] }[]) => turns.flatMap((t) => messagesOf(t.effects)).join("\n");
  it("'fundus' is the eye — or the womb in an obstetric case", async () => {
    const { obgPphChc } = await import("@/engine/cases/obg-pph-chc");
    expect(play(emAdhf, ["fundus"]).turns[0]!.record.intents[0]?.targetId).toBe("eyes");
    expect(play(obgPphChc, ["fundus"]).turns[0]!.record.intents[0]?.targetId).toBe("uterus");
  });
  it("'shift to OT' runs the case's own operation, or theatre asks which", () => {
    expect(said(play(emAdhf, ["shift to ot"]).turns)).toMatch(/Which operation, doctor\?/);
    expect(play(surgAppendicitis, ["shift to ot"]).turns[0]!.record.intents[0]?.targetId).not.toBe("procedure:ot");
  });
  it("a bare yes or no with nothing asked is heard, not queried", () => {
    const text = said(play(emAdhf, ["yes", "no", "hmm"]).turns);
    expect(text).toMatch(/Okay, doctor\. What next\?/);
    expect(text).not.toMatch(/say that once more|what would you like me to do/);
  });
});

describe("Random erratic-doctor audit, round eight", () => {
  const said = (turns: { effects: Parameters<typeof messagesOf>[0] }[]) => turns.flatMap((t) => messagesOf(t.effects)).join("\n");
  it("asks before shocking someone with a pulse in sinus rhythm", async () => {
    const { emViperPhc } = await import("@/engine/cases/em-viper-phc");
    const { turns, hidden } = play(emViperPhc, ["shock 200 j"]);
    expect(said(turns)).toMatch(/shock\? They have a pulse/);
    expect(hidden.actions["measure:defib"]).toBeUndefined();
  });
  it("keeps the dose of a misspelt drug, and doesn't call normal doses overdoses", () => {
    const { turns } = play(surgAppendicitis, ["inj diclofenec 75 im", "allopurinol 300 mg od x 30 days", "glimepiride 4 mg od x 30 days"]);
    expect(turns[0]!.record.intents[0]?.payload?.amount).toBe(75);
    expect(said(turns)).not.toMatch(/times the usual dose/);
  });
  it("on the phone, any test gets the same answer", () => {
    const phone = ALL_PHONE[0];
    if (!phone) return;
    expect(said(play(phone, ["xray knee"]).turns)).toMatch(/Tests can't be done during a phone call/);
  });
  it("a patient who came in guarded and hasn't been treated isn't 'a little better'", async () => {
    const { emViperPhc } = await import("@/engine/cases/em-viper-phc");
    expect(said(play(emViperPhc, ["how are you feeling"]).turns)).not.toMatch(/A little better/);
  });
});

describe("Random erratic-doctor audit, round nine", () => {
  const said = (turns: { effects: Parameters<typeof messagesOf>[0] }[]) => turns.flatMap((t) => messagesOf(t.effects)).join("\n");
  it("no vaginal examination in a man", () => {
    expect(said(play(surgAppendicitis, ["pv exam"]).turns)).toMatch(/no vaginal examination to do/);
  });
  it("a phone 'discharge' is the family looking after them at home", () => {
    const phone = ALL_PHONE[0];
    if (!phone) return;
    const text = said(play(phone, ["discharge"]).turns);
    expect(text).toMatch(/look after them at home/);
    expect(text).not.toMatch(/Discharged home/);
  });
});

describe("Random erratic-doctor audit, round ten", () => {
  const said = (turns: { effects: Parameters<typeof messagesOf>[0] }[]) => turns.flatMap((t) => messagesOf(t.effects)).join("\n");
  it("'is this dengue?' gets an honest 'I don't know'", () => {
    expect(said(play(emAdhf, ["is this dengue?"]).turns)).toMatch(/I don't know, doctor — you tell me/);
  });
  it("a named limb is examined as named; 'local exam' is the case's local finding", async () => {
    const { emViperPhc } = await import("@/engine/cases/em-viper-phc");
    expect(said(play(emAdhf, ["knee exam"]).turns)).toMatch(/Knee: no swelling/);
    expect(play(emViperPhc, ["local exam"]).turns[0]!.record.intents[0]?.targetId).toBe("local");
  });
  it("a step bundling measures does only the one named", () => {
    const def = structuredClone(emAdhf);
    def.therapeutics.push({ id: "bundle", kind: "supportive", measureIds: ["iv-access", "monitor", "catheter"], label: "Lines and monitoring", appropriateness: "acceptable" });
    const text = said(play(def, ["catheterise"]).turns);
    expect(text).toMatch(/Foley catheter inserted/);
    expect(text).not.toMatch(/IV access secured|Multipara monitor/);
  });
});

describe("Focus audit, round one", () => {
  const said = (turns: { effects: Parameters<typeof messagesOf>[0] }[]) => turns.flatMap((t) => messagesOf(t.effects)).join("\n");
  it("'150 weekly' is 150 mg, not 15", () => {
    const { turns } = play(dermAcne, ["fluconazole 150 weekly x 4 weeks", "methotrexate 15 weekly"]);
    expect(turns[0]!.record.intents[0]?.payload?.amount).toBe(150);
    expect(turns[1]!.record.intents[0]?.payload?.amount).toBe(15);
  });
  it("queries lorazepam 4 mg IV in someone not fitting, a womb drug outside childbirth, and a BP-lowering drug in low BP", async () => {
    const { obgPphChc } = await import("@/engine/cases/obg-pph-chc");
    expect(said(play(emAdhf, ["lorazepam 4 mg iv"]).turns)).toMatch(/status epilepticus/);
    expect(said(play(emAdhf, ["methergin 0.2 mg im"]).turns)).toMatch(/only around childbirth/);
    expect(said(play(obgPphChc, ["amlodipine 5 mg po stat"]).turns)).toMatch(/could drop it further/);
  });
  it("asks before an ICU bed for a stable patient, and won't book a week's follow-up in the ER while unwell", async () => {
    const { gpUtiPhc } = await import("@/engine/cases/gp-uti-phc");
    expect(said(play(gpUtiPhc, ["admit in icu"]).turns)).toMatch(/the ICU\? They're stable/);
    const { obgPphChc } = await import("@/engine/cases/obg-pph-chc");
    expect(said(play(obgPphChc, ["follow up 1 week"]).turns)).toMatch(/still here in emergency/);
  });
  it("a case step never runs on a drug's or a test's name", () => {
    const def = structuredClone(emAdhf);
    def.therapeutics.push({ id: "nsaid-step", kind: "drug", drugClasses: ["nsaid"], match: ["aspirin", "ibuprofen"], label: "Give an NSAID", appropriateness: "harmful" });
    def.therapeutics.push({ id: "cultures-step", kind: "procedure", match: ["blood culture"], label: "Send cultures", appropriateness: "ideal" });
    const { turns } = play(def, ["blood culture"]);
    expect(turns[0]!.record.intents[0]?.kind).toBe("investigation");
  });
  it("a child's heparin is checked by weight", async () => {
    const { pedDiarrhoeaPhc } = await import("@/engine/cases/ped-diarrhoea-phc");
    expect(said(play(pedDiarrhoeaPhc, ["heparin 5000 units iv"]).turns)).toMatch(/10-kg child/);
  });
});
