import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pictureFor, resumeCase, sessionInfo, simulateCase, submitDoctorAction, teachingFor } from "@/engine/engine";

process.env.RAMAI_SESSION_SECRET ??= "test-secret-test-secret-test-secret-123";

const OUTLINE = {
  specialty: "Infectious Disease", difficulty: 1,
  patient: { name: "Suresh", age: 34, sex: "Male", city: "Nagpur", occupation: "Driver" },
  briefing: "A young man with fever and cough walks into the CHC OPD.",
  diagnosis: "Community-acquired pneumonia", qualifier: "Right lower lobe, mild (CURB-65 0)",
  keyHistory: ["fever 3 days", "productive cough"], keyExam: ["crackles right base"], keyResults: ["TLC 14,200"],
  pictures: ["test: chest X-ray PA"], differentials: ["bronchitis", "TB"], plan: ["oral amoxicillin", "review in 48 h"],
};
const DIALOGUE = {
  opening: [{ role: "patient", kind: "speech", text: "Doctor, fever and cough for three days." }],
  baselineVitals: { bp: "118/76", hr: 102, rr: "22", temp: "101.2", spo2: "95" },
  triageVitals: ["bp", "hr", "temp"],
  profile: { allergies: "none", currentDrugs: null },
  history: [
    { id: "cc", group: "complaint", label: "Presenting complaint", match: ["what happened", "what brings you"], reply: "Fever and cough for three days, doctor.", importance: "essential", abnormal: true, note: null },
    { id: "cough", group: "hpi", label: "Cough", match: ["cough", "sputum"], reply: "Yellow phlegm since yesterday.", importance: "essential" },
    { id: "breath", group: "hpi", label: "Breathlessness", match: "breathless; short of breath", reply: "A little breathless when I climb stairs.", importance: "useful" },
    { id: "allergy", group: "allergy", label: "Allergies", match: ["allergy", "allergic"], reply: "No allergies.", importance: "useful" },
    { id: "meds", group: "medication", label: "Medicines", match: ["medicines", "tablets"], reply: "Only paracetamol.", importance: "useful" },
  ],
};
const FINDINGS = {
  exam: [{ id: "rs", group: "systemic-exam", label: "Respiratory", match: ["chest", "lungs"], finding: "Crackles at the right base; bronchial breathing.", importance: "essential", abnormal: true }],
  investigations: [
    { id: "cbc", name: "Complete blood count", priority: "essential", rows: [{ analyte: "TLC", value: "14200", unit: "/µL", flag: "high" }], teaching: { whenToOrder: "Fever with chest signs.", whatItTellsYou: "Leucocytosis." } },
    // Written flat, the way the model sometimes does — must still be understood.
    { id: "cxr", name: "Chest X-ray PA", priority: "essential", report: "Homogeneous opacity in the right lower zone with air bronchograms.", media: { spec: "PICTURE", kind: "picture", type: "xray", view: "PA erect", describe: "PA erect chest radiograph: right lower zone consolidation with air bronchograms; costophrenic angles clear.", alt: "Chest radiograph, PA view", caption: "PA erect" }, teaching: { whenToOrder: "Suspected pneumonia.", whatItTellsYou: "Consolidation." } },
    { id: "ecg", name: "ECG", priority: "situational", media: { spec: { kind: "ecg", rate: 102, rhythm: "sinus" }, alt: "12-lead ECG" }, teaching: { whenToOrder: "Tachycardia.", whatItTellsYou: "Sinus tachycardia." } },
  ],
};
const MANAGEMENT = {
  therapeutics: [
    { id: "amox", kind: "drug", drugIds: ["amoxicillin", "not-a-real-drug"], label: "Oral amoxicillin", appropriateness: "ideal", note: null },
    { id: "review", kind: "counsel", match: ["review in two days"], label: "Review in 48 hours", appropriateness: "ideal" },
  ],
  reasoning: [{ stage: "History", text: "Fever and productive cough." }, { stage: "Diagnosis", text: "CAP, low severity." }],
  rubric: { diagnosisAccept: ["pneumonia", "community acquired pneumonia"], idealTreatment: [["amox"]], expertActionCount: 10, expectsReassessment: false },
  followUp: [],
};
const TEACHING = {
  teaching: { severityBands: [{ id: "mild", label: "Mild (CURB-65 0–1)", recognition: ["Walking, talking"], investigation: ["CXR"], treatment: ["Oral amoxicillin"], followUp: ["48 h review"] }], drugs: [], routines: [], followUp: { interval: "48 hours", reassess: ["Fever"], redFlags: ["Breathlessness"], whenToEscalate: ["Hypoxia"] }, treatmentFailure: { steps: ["Re-image"] }, pearl: "Pneumonia is a clinical diagnosis confirmed on the film." },
  misses: { rs: { what: "No chest examination.", why: "The crackles locate it.", better: "Examine the chest.", severity: "major" } },
  strengths: { cc: "Opened well." },
};

function fakeOpenAI(opts: { brokenOutline?: boolean; rejectCase?: boolean } = {}) {
  const prompts: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { messages: { content: string }[] };
    const text = body.messages.map((m) => m.content).join("\n");
    prompts.push(text);
    const answer = text.includes("checking a simulated clinical case")
      ? (opts.rejectCase ? { verdict: "reject", problems: ["Chest X-ray says left lower lobe but crackles are on the right"] } : { verdict: "ok", problems: [] })
      : text.includes("Outline one case")
      ? (opts.brokenOutline ? { nonsense: true } : OUTLINE)
      : text.includes("Write what the patient and family say")
        ? DIALOGUE
        : text.includes("Write what the doctor finds")
          ? FINDINGS
          : text.includes("Write the management and the marking key")
            ? MANAGEMENT
            : text.includes('"teaching": {')
              ? TEACHING
              : text.includes("You voice patients")
                ? { replies: text.match(/Reply \d+/g)!.map(() => "Yes, doctor.") }
                : text.includes("senior clinician")
                  ? { summary: "Good.", reasoning: "Sound.", nextTime: ["Examine the chest early."] }
                  : { type: "patient_response", message: "No, doctor.", intents: [] };
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(answer) } }] }), { status: 200 });
  }));
  return prompts;
}

describe("AI-invented patients", () => {
  beforeEach(() => {
    process.env.RAMAI_ENGINE = "openai";
    process.env.OPENAI_API_KEY = "sk-test-" + "x".repeat(40);
    process.env.RAMAI_AI_CASES = "1";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    for (const k of ["RAMAI_ENGINE", "OPENAI_API_KEY", "RAMAI_AI_CASES"]) delete process.env[k];
  });

  it("invents the patient in an outline and three parts, and plays it with the backend's rules", async () => {
    const prompts = fakeOpenAI();
    const start = await simulateCase({ userId: "gen-1", caseNumber: 1, easy: true, level: "chc", allowedLevels: ["phc", "chc"] }); // A CHC has an X-ray machine; a PHC does not.
    expect(sessionInfo(start.token).generated).toBe(true);
    expect(start.state.patient).toMatchObject({ age: 34, sex: "Male" });
    expect(prompts.filter((p) => p.includes("Outline one case"))).toHaveLength(1);
    expect(prompts.some((p) => p.includes("most common conditions"))).toBe(true);

    // The X-ray's picture: a reference only — what it shows never reaches the browser.
    expect(await pictureFor(start.token, "gen-1", "p1")).toBeNull();
    const turn = await submitDoctorAction(start.token, "Order chest X-ray", "gen-1");
    const cxr = turn.state.investigations.find((i) => i.media?.ai);
    expect(cxr?.status).toBe("resulted");
    expect(cxr?.media?.ai).toEqual({ ref: "p1", type: "xray", view: "PA erect" });
    expect(JSON.stringify(turn)).not.toContain("air bronchograms; costophrenic");
    expect(await pictureFor(turn.token, "gen-1", "p1")).toMatchObject({ type: "xray", describe: expect.stringContaining("consolidation") });
    await expect(pictureFor(turn.token, "someone-else", "p1")).rejects.toThrow();
  });

  it("writes the teaching, and the debrief uses it — the same after reopening", async () => {
    fakeOpenAI();
    const start = await simulateCase({ userId: "gen-2", caseNumber: 1 });
    const pack = await teachingFor(start.token, "gen-2");
    expect(pack?.teaching.pearl).toMatch(/clinical diagnosis/);
    const closed = await submitDoctorAction(start.token, "Diagnosis: pneumonia. End case", "gen-2", "en", pack);
    expect(closed.debrief?.pearl).toMatch(/clinical diagnosis/);
    expect(closed.debrief?.missed.some((m) => m.what === "No chest examination.")).toBe(true);
    expect(closed.debrief?.verdict).toBe("correct");
    const again = await resumeCase(closed.token, "gen-2");
    expect(again.debrief?.pearl).toBe(closed.debrief?.pearl);
  });

  it("when the model can't invent a patient, a written case is the backup", async () => {
    fakeOpenAI({ brokenOutline: true });
    const start = await simulateCase({ userId: "gen-3", caseNumber: 1 });
    expect(sessionInfo(start.token).generated).toBe(false);
    expect(start.state.patient.age).toBeGreaterThan(0);
  });

  it("what the senior review finds is sent back to be corrected — the case is repaired, then used", async () => {
    const prompts = fakeOpenAI({ rejectCase: true });
    const start = await simulateCase({ userId: "gen-4", caseNumber: 5 });
    expect(prompts.some((p) => p.includes("A senior consultant read the whole case and found these problems") && p.includes("left lower lobe"))).toBe(true);
    expect(sessionInfo(start.token).generated).toBe(true);
  });
});

import { sanityProblems } from "@/engine/providers/openai";
describe("sanity checks on invented cases", () => {
  it("catches impossible patients and vitals", () => {
    expect(sanityProblems({ patient: { age: 30, sex: "Male" }, diagnosis: "Ectopic pregnancy" }, {})).not.toHaveLength(0);
    expect(sanityProblems({ patient: { age: 0, sex: "Female" }, diagnosis: "Bronchiolitis" }, { hr: "62" })).not.toHaveLength(0);
    expect(sanityProblems({ patient: { age: 40, sex: "Female" }, diagnosis: "Dengue fever" }, { bp: "70/90" })).not.toHaveLength(0);
    expect(sanityProblems({ patient: { age: 42, sex: "Female" }, diagnosis: "Dengue fever" }, { hr: "94", bp: "116/74", temp: "101.3 °F", spo2: "98" })).toEqual([]);
  });
});
