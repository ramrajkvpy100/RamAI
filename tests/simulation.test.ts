import { describe, expect, it } from "vitest";

import { dermAcne } from "@/engine/cases/derm-acne";
import { emAdhf } from "@/engine/cases/em-adhf";
import { medPad } from "@/engine/cases/med-pad";
import { surgAppendicitis } from "@/engine/cases/surg-appendicitis";
import { generateDebrief } from "@/engine/debrief";

import { messagesOf, play } from "./helpers";

describe("information is revealed only when obtained", () => {
  it("OPD vitals start empty and appear only when measured", () => {
    const { state } = play(medPad, ["Check BP and RBS"]);
    expect(Object.keys(state.vitals).sort()).toEqual(["bp", "rbs"]);
    expect(state.vitals.bp?.current.value).toBe("158/96");
    expect(state.vitals.rbs?.current.value).toBe("236");
    expect(state.vitals.hr).toBeUndefined();
  });

  it("ER triage vitals are visible from arrival", () => {
    const { state } = play(surgAppendicitis, []);
    expect(state.vitals.temp?.current.value).toBe("100.6");
    expect(state.vitals.rr).toBeUndefined();
  });

  it("lab results arrive only after their turnaround", () => {
    const { state } = play(surgAppendicitis, ["Order CBC"]);
    expect(state.investigations[0]?.status).toBe("pending");
    const later = play(surgAppendicitis, ["Order CBC", "Wait for results"]);
    const cbc = later.state.investigations[0];
    expect(cbc?.status).toBe("resulted");
    expect(cbc?.rows?.find((r) => r.analyte === "Total leucocyte count")?.flag).toBe("high");
  });

  it("no message ever contains the hidden diagnosis during play", () => {
    const { state } = play(surgAppendicitis, [
      "What brings you here?", "Where is the pain?", "Any vomiting?", "Examine abdomen", "Examine McBurney's point",
      "Order CBC, CRP and USG abdomen", "Wait for results", "Any allergies?",
    ]);
    const text = state.messages.map((m) => m.text.toLowerCase()).join(" ");
    expect(text).not.toContain("appendicitis");
  });
});

describe("orders are executed — and have consequences", () => {
  it("a penicillin in a penicillin-allergic patient causes anaphylaxis that adrenaline rescues", () => {
    // A wait is interrupted as soon as the patient's status changes — the nurse calls you.
    const first = play(surgAppendicitis, ["Give piperacillin tazobactam 4.5 g IV", "Wait 10 minutes"]);
    expect(first.state.patientStatus).toBe("deteriorating");
    expect(first.state.clock).toBeLessThan(10);
    expect(first.hidden.hazards[0]?.id).toBe("anaphylaxis");

    const harm = play(surgAppendicitis, ["Give piperacillin tazobactam 4.5 g IV", "Wait 10 minutes", "Wait 10 minutes"]);
    expect(harm.state.patientStatus).toBe("critical");

    const rescued = play(surgAppendicitis, ["Give piperacillin tazobactam 4.5 g IV", "Wait 10 minutes", "Give adrenaline 0.5 mg IM", "Wait 45 minutes"]);
    expect(rescued.hidden.hazards[0]?.rescue).toBe("full");
    expect(["improving", "guarded"]).toContain(rescued.state.patientStatus);
  });

  it("untreated, the patient dies — and the case asks to be closed", () => {
    const { state, hidden } = play(surgAppendicitis, ["Give piperacillin tazobactam 4.5 g IV", "Wait 60 minutes", "Wait 60 minutes", "Wait 60 minutes", "Wait 60 minutes"]);
    expect(hidden.status).toBe("deceased");
    expect(state.messages.some((m) => m.text.includes("has died"))).toBe(true);
  });

  it("delaying surgery past the window lets the appendix perforate", () => {
    const { hidden, state } = play(surgAppendicitis, ["Admit", "Give IV ceftriaxone 1 g", "Observe for 9 hours"]);
    expect(hidden.hazards.some((h) => h.id === "perforation" && h.manifestedAt !== undefined)).toBe(true);
    expect(state.patientStatus).toBe("deteriorating");
  });

  it("surgery in time prevents perforation", () => {
    const { hidden } = play(surgAppendicitis, ["Keep NPO", "Do laparoscopic appendicectomy", "Wait 12 hours"]);
    expect(hidden.hazards).toHaveLength(0);
  });

  it("sildenafil with a nitrate collapses the patient later — the follow-up is interrupted", () => {
    const { hidden, state, turns } = play(medPad, ["Prescribe sildenafil 50 mg SOS", "Follow up after 2 weeks"]);
    expect(hidden.hazards[0]?.id).toBe("pde5-nitrate");
    expect(state.setting).toBe("ER");
    expect(state.patientStatus).toBe("critical");
    expect(messagesOf(turns[1]!.effects).join(" ")).toContain("collapsed");
  });
});

describe("a strong encounter scores well; a weak one doesn't", () => {
  const strong = [
    "Hello, what brings you here?", "Where did the pain start and has it moved?", "Any vomiting?", "Any urinary symptoms?",
    "Any allergies?", "Check vitals", "Examine abdomen", "Examine McBurney's point", "Check rebound tenderness",
    "Examine the scrotum", "Order CBC, CRP, urine routine and USG abdomen", "Keep NPO", "Start RL 1 litre IV",
    "Give paracetamol 1 g IV", "Wait for results", "Give ceftriaxone 1 g IV and metronidazole 500 mg IV",
    "Diagnosis: acute appendicitis", "Do laparoscopic appendicectomy", "Reassess the patient", "Follow up after 10 days",
    "Case close",
  ];

  it("strong appendicitis management", () => {
    const { hidden, state } = play(surgAppendicitis, strong);
    expect(hidden.closed).toBe(true);
    const debrief = generateDebrief(surgAppendicitis, hidden, state);
    expect(debrief.verdict).toBe("correct");
    expect(debrief.score.total).toBeGreaterThanOrEqual(80);
    expect(debrief.rescue.occurred).toBe(false);
  });

  it("weak management", () => {
    const { hidden, state } = play(surgAppendicitis, ["Order CT abdomen", "Give pantoprazole 40 mg IV", "Diagnosis: gastritis", "Case close"]);
    const debrief = generateDebrief(surgAppendicitis, hidden, state);
    expect(debrief.verdict).toBe("incorrect");
    expect(debrief.score.total).toBeLessThan(35);
    expect(debrief.missed.length).toBeGreaterThan(3);
  });

  it("ending the case never asks for a diagnosis", () => {
    const { state, hidden } = play(dermAcne, ["End case"]);
    expect(hidden.closed).toBe(true);
    expect(state.status).toBe("complete");
    expect(generateDebrief(dermAcne, hidden, state).verdict).toBe("not-recorded");
  });

  it("without a stated diagnosis, management that treats the disease shows it was recognised", () => {
    const treated = play(emAdhf, ["Sit her up, start oxygen, attach monitor", "Give furosemide 40 mg IV", "End case"]);
    const debrief = generateDebrief(emAdhf, treated.hidden, treated.state);
    expect(debrief.verdict).toBe("implied");
    expect(debrief.userDiagnosis).toBeUndefined();
    expect(debrief.didWell[0]).toMatch(/recognised the diagnosis/);

    const stated = play(emAdhf, ["Sit her up, start oxygen, attach monitor", "Give furosemide 40 mg IV", "Diagnosis: acute decompensated heart failure", "End case"]);
    const statedDebrief = generateDebrief(emAdhf, stated.hidden, stated.state);
    expect(statedDebrief.verdict).toBe("correct");
    const ddx = (d: typeof debrief) => d.score.lines.find((l) => l.category === "differential")!.earned;
    expect(ddx(statedDebrief)).toBeGreaterThan(ddx(debrief));

    const untreated = play(emAdhf, ["Give paracetamol 650 mg PO", "End case"]);
    expect(generateDebrief(emAdhf, untreated.hidden, untreated.state).verdict).toBe("not-recorded");
  });

  it("OPD cases without a single definitive treatment count most of the ideal plan", () => {
    const { hidden, state } = play(dermAcne, [
      "Stop the steroid cream", "Adapalene with benzoyl peroxide gel at night", "Tab doxycycline 100 mg OD for 8 weeks", "End case",
    ]);
    expect(generateDebrief(dermAcne, hidden, state).verdict).toBe("implied");
  });

  it("acne: steroid cream uncovered and stopped, correct regimen", () => {
    const { hidden, state } = play(dermAcne, [
      "What brings you here?", "Since when?", "What have you been applying?", "Are your periods regular?",
      "Any excess facial hair?", "Any allergies?", "Examine the face", "Examine the back",
      "Diagnosis: moderate acne vulgaris", "Stop the steroid cream", "Adapalene with benzoyl peroxide gel at night",
      "Tab doxycycline 100 mg OD for 8 weeks", "Sunscreen every morning and a moisturiser",
      "Follow up after 6 weeks", "Case close",
    ]);
    const debrief = generateDebrief(dermAcne, hidden, state);
    expect(debrief.verdict).toBe("correct");
    expect(state.patientStatus).toBe("improving");
    expect(debrief.score.total).toBeGreaterThanOrEqual(75);
  });
});

describe("determinism", () => {
  it("replaying the same inputs yields identical state", () => {
    const inputs = ["Any allergies?", "Check vitals", "Order CBC", "Give paracetamol 1 g IV", "Wait 40 minutes"];
    const a = play(surgAppendicitis, inputs).state;
    const b = play(surgAppendicitis, inputs).state;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
