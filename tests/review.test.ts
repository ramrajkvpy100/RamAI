import { describe, expect, it } from "vitest";

import { applyDialogueReview, applyFindingsReview, applyManagementReview, checkLabFlags, parseRange } from "@/engine/providers/openai-review";
import { DialogueSchema, FindingsSchema, ManagementSchema } from "@/engine/providers/openai-schema";

const findings = FindingsSchema.parse({
  exam: [{ id: "rs", group: "systemic-exam", label: "Respiratory", match: ["chest"], finding: "Clear chest.", importance: "essential" }],
  investigations: [
    { id: "cbc", name: "CBC", priority: "essential", rows: [{ analyte: "TLC", value: "14,200", unit: "/µL", reference: "4,000–11,000", flag: "normal" }, { analyte: "Hb", value: "13.1", unit: "g/dL", reference: "12–15", flag: "low" }, { analyte: "Platelets", value: "18,000", unit: "/µL", reference: "1.5–4.5 lakh", flag: "critical" }] },
    { id: "ecg", name: "ECG", priority: "useful", media: { spec: { kind: "ecg", rate: 80, rhythm: "sinus" }, alt: "12-lead ECG" } },
    { id: "cxr", name: "Chest X-ray", priority: "essential", report: "Normal.", media: { spec: { kind: "picture", type: "xray", view: "PA", describe: "A normal chest radiograph of an adult." }, alt: "CXR" } },
  ],
});

describe("a consultant checks every invented case before it starts", () => {
  it("findings: a wrong examination, report, ECG and picture are replaced; nothing else changes", () => {
    const { part, fixes } = applyFindingsReview(findings, {
      fixes: [
        { id: "rs", finding: "Bronchial breathing and coarse crackles at the right base.", why: "pneumonia has signs" },
        { id: "ecg", ecg: { kind: "ecg", rate: 112, rhythm: "sinus" }, why: "febrile tachycardia" },
        { id: "cxr", report: "Right lower zone consolidation with air bronchograms.", describe: "PA chest radiograph: right lower zone consolidation with air bronchograms.", why: "matches the diagnosis" },
        { id: "not-there", report: "ignored" },
      ],
    });
    expect(part.exam[0]!.finding).toMatch(/^Bronchial breathing/);
    expect(part.investigations[1]!.media?.spec).toMatchObject({ kind: "ecg", rate: 112 });
    expect(part.investigations[2]).toMatchObject({ report: "Right lower zone consolidation with air bronchograms." });
    expect(part.investigations[2]!.media?.spec).toMatchObject({ kind: "picture", describe: expect.stringMatching(/consolidation/) });
    expect(part.investigations[0]!.rows).toEqual(findings.investigations[0]!.rows);
    expect(fixes).toHaveLength(3);
  });

  it("management: appropriateness and doses corrected, the marking key widened — only to treatments that exist", () => {
    const management = ManagementSchema.parse({
      therapeutics: [{ id: "amox", kind: "drug", label: "Amoxicillin 250 mg OD", appropriateness: "acceptable" }, { id: "cipro", kind: "drug", label: "Ciprofloxacin", appropriateness: "ideal" }],
      reasoning: [],
      rubric: { diagnosisAccept: ["pneumonia"], idealTreatment: [["cipro"]] },
      followUp: [],
    });
    const { part } = applyManagementReview(management, {
      fixes: [{ id: "amox", label: "Amoxicillin 1 g TDS for 5 days", appropriateness: "ideal" }, { id: "cipro", appropriateness: "unnecessary", why: "not first line for CAP" }],
      rubric: { diagnosisAccept: ["community-acquired pneumonia", "CAP"], idealTreatment: [["amox"], ["made-up"]] },
    });
    expect(part.therapeutics.map((t) => [t.id, t.label, t.appropriateness])).toEqual([["amox", "Amoxicillin 1 g TDS for 5 days", "ideal"], ["cipro", "Ciprofloxacin", "unnecessary"]]);
    expect(part.rubric.idealTreatment).toEqual([["amox"]]);
    expect(part.rubric.diagnosisAccept).toEqual(["community-acquired pneumonia", "CAP", "pneumonia"]);
  });

  it("history and vitals: only known vital signs and existing entries change", () => {
    const dialogue = DialogueSchema.parse({ opening: [], baselineVitals: { hr: "78", temp: "98.6" }, triageVitals: [], profile: {}, history: [{ id: "cc", group: "complaint", label: "Complaint", match: ["what happened"], reply: "Cough.", importance: "essential" }] });
    const { part } = applyDialogueReview(dialogue, { vitals: { hr: "112", temp: "102.2", mood: "fine" }, fixes: [{ id: "cc", reply: "Cough and fever for three days, doctor." }] });
    expect(part.baselineVitals).toEqual({ hr: "112", temp: "102.2" });
    expect(part.history[0]!.reply).toBe("Cough and fever for three days, doctor.");
  });

  it("a review that can't be read changes nothing", () => {
    expect(applyFindingsReview(findings, "nonsense").part).toBe(findings);
  });

  it("every lab flag matches its value and range; 'critical' stays the author's call", () => {
    const { part, fixes } = checkLabFlags(findings);
    expect(part.investigations[0]!.rows.map((r) => r.flag)).toEqual(["high", "normal", "critical"]);
    expect(fixes).toEqual(["cbc TLC: normal → high", "cbc Hb: low → normal"]);
    expect([parseRange("135-145 mmol/L"), parseRange("< 5"), parseRange("≥ 60"), parseRange("negative")]).toEqual([{ low: 135, high: 145 }, { high: 5 }, { low: 60 }, null]);
  });
});

describe("invented vital signs read like a monitor's", () => {
  it("numbers only, blood pressure as systolic/diastolic", async () => {
    const { cleanVitals } = await import("@/engine/providers/openai");
    expect(cleanVitals({ bp: "118 / 74 mmHg", hr: "112 bpm", spo2: "89% on room air", weight: "68 kg", pain: "6/10", temp: "unknown" })).toEqual({ bp: "118/74", hr: "112", spo2: "89", weight: "68", pain: "6" });
  });
});
