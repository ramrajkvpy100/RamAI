import { describe, expect, it } from "vitest";

import { CASE_LIBRARY, getCase, pickCase, TUTORIAL_CASE } from "@/engine/cases";
import { generateDebrief } from "@/engine/debrief";
import { simulateCase, submitDoctorAction } from "@/engine/engine";

import { demoLines } from "@/lib/demo-script";

import { messagesOf, play } from "./helpers";

process.env.RAMAI_SESSION_SECRET = "test-secret-test-secret-test-secret-123";

describe("guided demo case", () => {
  it("is never picked at random, but always replays", () => {
    expect(CASE_LIBRARY.some((c) => c.guided)).toBe(false);
    for (let i = 0; i < 50; i++) expect(pickCase({ random: () => i / 50 })?.guided).toBeFalsy();
    expect(getCase(TUTORIAL_CASE.id)).toBe(TUTORIAL_CASE);
  });

  it("starts as a guided session", async () => {
    const session = await simulateCase({ userId: "u1", caseNumber: 1, tutorial: true });
    expect(session.state.guided).toBe(true);
    expect(session.state.patient.age).toBe(62);
    const turn = await submitDoctorAction(session.token, "What happened?", "u1");
    expect(turn.state.guided).toBe(true);
  });

  it("walks from confusion to recovery the moment dextrose goes in", () => {
    const { state, turns } = play(TUTORIAL_CASE, ["What happened?", "Is he diabetic?", "What medicines does he take?", "When did he last eat?", "Check RBS", "Give 25% dextrose 100 mL IV", "Recheck RBS"]);
    expect(messagesOf(turns[3]!.effects).join(" ")).toMatch(/skipped breakfast/);
    expect(messagesOf(turns[4]!.effects).join(" ")).toMatch(/RBS 42/);
    expect(messagesOf(turns[5]!.effects).join(" ")).toMatch(/100 mL IV/);
    expect(state.patientStatus).toBe("improving");
    expect(state.vitals.rbs!.current.value).toBe("146");
    expect(messagesOf(turns[5]!.effects).some((m) => m.startsWith("patient:") && /better/.test(m))).toBe(true);
    const exam = play(TUTORIAL_CASE, ["Give 25% dextrose 100 mL IV", "Examine the patient"]);
    expect(messagesOf(exam.turns[1]!.effects).join(" ")).toMatch(/Awake, alert and oriented/);
  });

  it("without sugar, he has a seizure at half an hour — time enough for a first-timer", () => {
    expect(play(TUTORIAL_CASE, ["Wait 25 minutes"]).state.patientStatus).not.toBe("critical");
    const { state, turns } = play(TUTORIAL_CASE, ["Wait 35 minutes"]);
    expect(state.patientStatus).toBe("critical");
    expect(messagesOf(turns[0]!.effects).join(" ")).toMatch(/fitting/);
  });

  it("rewards the full plan in the debrief", () => {
    const { hidden, state } = play(TUTORIAL_CASE, [
      "What happened?", "Is he diabetic?", "What medicines does he take?", "When did he last eat?", "Any allergies?", "Check RBS",
      "Give 25% dextrose 100 mL IV", "Recheck RBS", "Check vitals", "Examine the patient", "Neurological examination",
      "Start 10% dextrose at 100 mL/h", "Stop glimepiride", "Admit to the ward", "Diagnosis: sulfonylurea induced hypoglycaemia", "End case",
    ]);
    const debrief = generateDebrief(TUTORIAL_CASE, hidden, state);
    expect(debrief.verdict).toBe("correct");
    expect(debrief.score.total).toBeGreaterThanOrEqual(80);
  });
});

describe("guided demo case abroad — the coach's words work", () => {
  const plan = (check: string, bolus: string, recheck: string, drip: string) => [
    "What happened?", "Is he diabetic?", "What medicines does he take?", "When did he last eat?", "Any allergies?", check,
    bolus, recheck, "Check vitals", "Examine the patient", "Neurological examination",
    drip, "Stop glimepiride", "Admit to the ward", "Diagnosis: sulfonylurea induced hypoglycemia", "End case",
  ];

  it.each([
    ["US", plan("Check glucose", "Give D50 50 mL IV", "Recheck glucose", "Start D10 at 100 mL/h")],
    ["UK", plan("Check CBG", "Give 20% glucose 100 mL IV", "Recheck CBG", "Start 10% glucose at 100 mL/h")],
  ] as const)("%s: same recovery, same score", async (country, inputs) => {
    const { localizeCase } = await import("@/engine/i18n/country");
    const def = localizeCase(TUTORIAL_CASE, country);
    const { hidden, state, turns } = play(def, [...inputs]);
    expect(state.vitals.rbs!.history.length).toBeGreaterThan(0);
    expect(messagesOf(turns[6]!.effects).some((m) => m.startsWith("patient:") && /better/.test(m))).toBe(true);
    const debrief = generateDebrief(def, hidden, state);
    expect(debrief.verdict).toBe("correct");
    expect(debrief.score.total).toBeGreaterThanOrEqual(80);
    expect(debrief.missed.map((m) => m.what).join(" ")).not.toMatch(/dextrose|infusion|glimepiride/i);
  });
});

describe("guided demo — tapping every tip wins", () => {
  for (const country of ["IN", "US", "UK"] as const) {
    it(`in ${country}: a clean, correct case with a winning score`, () => {
      const def = { ...TUTORIAL_CASE };
      const { hidden, state } = play(def, [...demoLines(country), "End case"]);
      const d = generateDebrief(def, hidden, state);
      expect(d.verdict).toBe("correct");
      expect(d.missed).toEqual([]);
      expect(d.score.total).toBeGreaterThanOrEqual(85);
      expect(["improving", "recovered", "stable"]).toContain(state.patientStatus);
      // Every tip did what it says: one line, several actions.
      expect(state.messages.some((m) => m.stethoscope)).toBe(true);
      expect(state.workingDiagnosis).toBeTruthy();
      // The history tip really asks all four things — allergies included, before any drug.
      expect(Object.keys(hidden.history)).toEqual(expect.arrayContaining(["diabetes", "meds", "meal", "allergy"]));
      expect(d.score.lines.find((l) => l.category === "drugSafety")?.earned).toBe(d.score.lines.find((l) => l.category === "drugSafety")?.max);
    });
  }

  it("the demo never runs out of time on a first-timer who reads every tip", () => {
    const { state } = play(TUTORIAL_CASE, ["What happened?", "Any fever?", "Did he fall?", "Previous episodes?", "Does he drink?", "Examine the patient", "Check RBS"]);
    expect(state.patientStatus).not.toBe("critical");
  });
});

describe("guided demo — every lost mark has a reason", () => {
  it("explains each mark below 100 in plain words", () => {
    const { hidden, state } = play(TUTORIAL_CASE, [...demoLines("IN"), "End case"]);
    const { score } = generateDebrief(TUTORIAL_CASE, hidden, state);
    for (const l of score.lines) if (l.earned < l.max - 0.05) expect(l.lost?.length, l.category).toBeGreaterThan(0);
    expect(score.lines.find((l) => l.category === "differential")?.lost?.join(" ")).toMatch(/differential/i);
  });
});
