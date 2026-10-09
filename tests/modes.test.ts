import { describe, expect, it } from "vitest";

import { emAdhf } from "@/engine/cases/em-adhf";
import { emViperPhc } from "@/engine/cases/em-viper-phc";
import { grAip } from "@/engine/cases/gr-aip";
import { medSleApex } from "@/engine/cases/med-sle-apex";
import { phAcs } from "@/engine/cases/ph-acs";
import { surgAppendicitis } from "@/engine/cases/surg-appendicitis";
import { generateDebrief } from "@/engine/debrief";

import { messagesOf, play } from "./helpers";

const allMessages = (turns: ReturnType<typeof play>["turns"]) => turns.flatMap((t) => messagesOf(t.effects));

describe("phone consults", () => {
  it("cannot examine or order tests — and says so once per message", () => {
    const { turns, state } = play(phAcs, ["Examine his chest", "Order an ECG and troponin"]);
    const text = allMessages(turns).join("\n");
    expect(text).toContain("can't examine over the phone");
    expect(text).toContain("Tests can't be done during a phone call");
    expect(text.match(/Tests can't be done/g)).toHaveLength(1);
    expect(state.investigations).toHaveLength(0);
  });

  it("home devices only: the caller reads the BP machine, and has no oximeter", () => {
    const bp = play(phAcs, ["Check his BP"]);
    expect(bp.state.vitals.bp?.current.value).toBe("150/94");
    expect(allMessages(bp.turns).some((m) => m.startsWith("attendant: The machine shows BP 150/94"))).toBe(true);

    const spo2 = play(phAcs, ["Check his SpO2"]);
    expect(spo2.state.vitals.spo2).toBeUndefined();
    expect(allMessages(spo2.turns).join("\n")).toContain("We only have a BP machine and a sugar machine at home");
  });

  it("no injections at home", () => {
    const { turns, hidden } = play(phAcs, ["Give morphine 3 mg IV"]);
    expect(allMessages(turns).join("\n")).toContain("can't give injections");
    expect(hidden.drugs).toHaveLength(0);
  });

  it("the ideal call: ambulance and chewed aspirin, no hazard", () => {
    const { hidden } = play(phAcs, ["What happened?", "Call 108 now and take him to the district hospital", "Ask him to chew aspirin 325 mg now"]);
    expect(hidden.hazards).toHaveLength(0);
    const aspirin = hidden.drugs.find((d) => d.drugId === "aspirin");
    expect(aspirin?.mode).toBe("given");
    expect(aspirin?.doseError).toBe(false);
  });

  it("a nitrate after sildenafil collapses him — lying flat with legs up rescues", () => {
    const harm = play(phAcs, ["What medicines has he taken today?", "Put a Sorbitrate under his tongue", "Wait 5 minutes"]);
    expect(harm.hidden.hazards.some((h) => h.id === "nitrate-pde5")).toBe(true);
    expect(harm.state.patientStatus).toBe("critical");

    const rescued = play(phAcs, ["Put a Sorbitrate under his tongue", "Wait 5 minutes", "Lie him flat and raise his legs", "Call 108", "Wait 10 minutes"]);
    expect(rescued.hidden.hazards.find((h) => h.id === "nitrate-pde5")?.rescue).toBe("full");
  });

  it("saying 'no Sorbitrate' executes the safety counselling rule", () => {
    const { hidden } = play(phAcs, ["Don't give him Sorbitrate"]);
    expect(hidden.actions["avoid-nitrate"]?.length).toBe(1);
  });

  it("delay at home leads to arrest", () => {
    const { hidden, state } = play(phAcs, ["Wait 20 minutes", "Wait 15 minutes"]);
    expect(hidden.hazards.some((h) => h.id === "stemi-delay")).toBe(true);
    expect(["critical", "deceased"]).toContain(state.patientStatus);
  });

  it("scores phone calls without examination or investigation categories", () => {
    const { hidden, state } = play(phAcs, ["What happened?", "Call 108", "Chew aspirin 325 mg now", "Final diagnosis: acute coronary syndrome. Case close."]);
    const debrief = generateDebrief(phAcs, hidden, state);
    const categories = debrief.score.lines.map((l) => l.category);
    expect(categories).not.toContain("examination");
    expect(categories).not.toContain("investigationSelection");
    expect(debrief.score.lines.reduce((s, l) => s + l.max, 0)).toBe(100);
    expect(debrief.verdict).toBe("correct");
  });
});

describe("facility levels", () => {
  it("a PHC can do a 20WBCT but not renal function or coagulation", () => {
    const { turns, state, hidden } = play(emViperPhc, ["Order RFT and PT INR", "Do a 20 minute whole blood clotting test"]);
    const text = allMessages(turns).join("\n");
    expect(text).toContain("isn't available at this primary health centre");
    expect(hidden.unavailable).toEqual(expect.arrayContaining(["rft", "coag"]));
    expect(state.investigations.map((i) => i.defId)).toEqual(["20wbct"]);
  });

  it("the 20WBCT result arrives after 20 minutes: not clotted", () => {
    const { state } = play(emViperPhc, ["Do a 20WBCT", "Wait for results"]);
    expect(state.investigations[0]?.status).toBe("resulted");
    expect(state.investigations[0]?.report).toContain("NOT clotted");
  });

  it("ASV doses are checked in vials", () => {
    const ok = play(emViperPhc, ["Give ASV 10 vials IV over 1 hour"]);
    expect(ok.hidden.drugs[0]?.doseError).toBe(false);
    const low = play(emViperPhc, ["Give ASV 2 vials IV"]);
    expect(low.hidden.drugs[0]?.doseError).toBe(true);
  });

  it("without antivenom the coagulopathy progresses; ASV rescues it", () => {
    const harm = play(emViperPhc, ["Wait 60 minutes"]);
    expect(harm.hidden.hazards.some((h) => h.id === "vicc-bleed")).toBe(true);
    expect(harm.state.patientStatus).toBe("deteriorating");

    const saved = play(emViperPhc, ["Wait 60 minutes", "Give ASV 10 vials IV over 1 hour", "Wait 2 hours"]);
    expect(saved.hidden.hazards.find((h) => h.id === "vicc-bleed")?.rescue).toBe("full");
  });

  it("an apex institute can order anything", () => {
    const { state } = play(medSleApex, ["Order anti-dsDNA, C3 C4 and renal biopsy"]);
    expect(state.investigations.map((i) => i.defId).sort()).toEqual(["anti-dsdna", "complement", "renal-biopsy"]);
  });
});

describe("images on request", () => {
  it("asking to see a test again re-shows the result without re-ordering", () => {
    const { turns, state } = play(emAdhf, ["Order ECG", "Wait for results", "Show me the ECG again"]);
    expect(state.investigations).toHaveLength(1);
    const last = turns[turns.length - 1]!;
    const msg = last.effects.find((e) => e.type === "message" && e.text.includes("showing the result again"));
    expect(msg).toBeDefined();
  });
});

describe("Grand Rounds and Apex cases", () => {
  it("a porphyrinogenic anticonvulsant deepens the attack", () => {
    const { hidden, state } = play(grAip, ["Give phenytoin 1 g IV", "Wait 40 minutes"]);
    expect(hidden.hazards.some((h) => h.id === "porphyrinogenic-drug")).toBe(true);
    expect(state.patientStatus).toBe("deteriorating");
  });

  it("stopping the pill runs the counselling rule; haem is dosed in mg", () => {
    const { hidden } = play(grAip, ["Stop the OCP", "Give haem arginate 150 mg IV"]);
    expect(hidden.actions["stop-ocp"]?.length).toBe(1);
    expect(hidden.drugs.find((d) => d.drugId === "haem-arginate")?.doseError).toBe(false);
  });

  it("an NSAID in active lupus nephritis worsens the kidneys", () => {
    const { hidden } = play(medSleApex, ["Give ibuprofen 400 mg", "Wait 13 hours"]);
    expect(hidden.hazards.some((h) => h.id === "nsaid-aki" && h.manifestedAt !== undefined)).toBe(true);
  });

  it("induction immunosuppression prevents the untreated-nephritis hazard", () => {
    const { hidden } = play(medSleApex, ["Give methylprednisolone 500 mg IV", "Start mycophenolate 1 g BD", "Wait 24 hours", "Wait 24 hours", "Wait 6 hours"]);
    expect(hidden.hazards.some((h) => h.id === "untreated-nephritis")).toBe(false);
  });
});

describe("bedside monitor", () => {
  it("shows no rhythm until the monitor is attached, then the case's own rhythm", () => {
    const before = play(emAdhf, ["What happened?"]);
    expect(before.state.monitored).toBe(false);
    expect(before.state.monitorRhythm).toBeUndefined();

    const af = play(emAdhf, ["Attach cardiac monitor"]);
    expect(af.state.monitored).toBe(true);
    expect(af.state.monitorRhythm).toBe("afib");

    const sinus = play(surgAppendicitis, ["Attach cardiac monitor"]);
    expect(sinus.state.monitorRhythm).toBe("sinus");
  });
});

describe("response to treatment", () => {
  it("a sick patient improves after the definitive treatment", () => {
    const { state } = play(emAdhf, ["Sit her up, start oxygen, attach monitor", "Give furosemide 40 mg IV", "Wait 40 minutes"]);
    expect(state.patientStatus).toBe("improving");
    expect(state.timeline.some((e) => e.label === "Responding to treatment")).toBe(true);
  });

  it("an attached monitor shows the response as it happens", () => {
    const { state } = play(emAdhf, ["Sit her up, start oxygen, attach monitor", "Give furosemide 40 mg IV", "Wait 40 minutes"]);
    const now = (k: "hr" | "rr" | "spo2") => state.vitals[k]!.current.numeric!;
    expect(now("hr")).toBeLessThan(132);
    expect(now("rr")).toBeLessThan(30);
    expect(now("spo2")).toBeGreaterThan(88);
    expect(state.vitals.rr!.history.length).toBeGreaterThan(0);
  });

  it("an unmonitored patient's change is only seen when measured", () => {
    const before = play(emAdhf, ["Give furosemide 40 mg IV", "Wait 40 minutes"]);
    expect(before.state.vitals.rr!.current.value).toBe("30");
    const after = play(emAdhf, ["Give furosemide 40 mg IV", "Wait 40 minutes", "Check vitals"]);
    expect(after.state.vitals.rr!.current.numeric!).toBeLessThan(30);
  });

  it("calling an ambulance is not a treatment — the patient at home doesn't 'improve'", () => {
    const { state } = play(phAcs, ["Call 108", "Chew aspirin 325 mg now", "Wait 30 minutes"]);
    expect(state.patientStatus).not.toBe("improving");
  });

  it("no improvement while a harm is unfolding", () => {
    const { state } = play(grAip, ["Give phenytoin 1 g IV", "Give haem arginate 150 mg IV", "Wait 60 minutes", "Wait 60 minutes"]);
    expect(state.patientStatus).not.toBe("improving");
  });
});

describe("live monitor", () => {
  const series = (state: ReturnType<typeof play>["state"], k: "hr" | "rr" | "spo2" | "bp") => [...state.vitals[k]!.history, state.vitals[k]!.current];

  it("treatment works at once: the monitor shows it in the same turn", () => {
    const { state, turns } = play(emAdhf, ["Attach monitor", "Give furosemide 40 mg IV"]);
    expect(state.patientStatus).toBe("improving");
    expect(state.vitals.rr!.current.numeric!).toBeLessThanOrEqual(24);
    expect(state.vitals.hr!.current.numeric!).toBeLessThan(132);
    expect(turns[1]!.effects.some((e) => e.type === "vitals")).toBe(true);
  });

  it("oxygen lifts the saturation at once", () => {
    const { state } = play(emAdhf, ["Attach monitor", "Start oxygen"]);
    expect(state.vitals.spo2!.current.numeric!).toBeGreaterThan(88);
  });

  it("the cuff re-measures blood pressure every 15 minutes", () => {
    const { state } = play(emAdhf, ["Sit her up, start oxygen, attach monitor", "Give furosemide 40 mg IV", "Wait 60 minutes"]);
    const at = series(state, "bp").map((r) => r.at);
    const cycles = at.slice(2).map((t, i) => t - at[i + 1]!);
    expect(cycles.length).toBeGreaterThanOrEqual(3);
    for (const gap of cycles) expect(gap).toBeGreaterThanOrEqual(15);
    for (const gap of cycles) expect(gap).toBeLessThanOrEqual(20);
  });

  it("a deterioration shows on the monitor at once", () => {
    const { state } = play(emAdhf, ["Attach monitor", "Wait 60 minutes"]);
    expect(state.vitals.spo2!.current.value).toBe("82");
  });

  it("without a monitor, nothing updates until someone measures", () => {
    const { state } = play(emAdhf, ["Give furosemide 40 mg IV", "Wait 40 minutes"]);
    expect(state.vitals.rr!.history).toHaveLength(0);
  });
});

