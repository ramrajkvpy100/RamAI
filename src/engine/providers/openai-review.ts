/**
 * Clinical accuracy: before an invented case starts, a senior consultant (the
 * same model, reasoning carefully) checks each part against current practice
 * in the doctor's country, and its corrections are applied. Code then checks
 * what can be checked exactly — every lab flag against its value and range.
 */
import type { z } from "zod";

import type { Country } from "../countries";
import type { Concept } from "./openai-schema";
import { DialogueReviewSchema, FindingsReviewSchema, ManagementReviewSchema, type DialogueSchema, type FindingsSchema, type ManagementSchema } from "./openai-schema";

type ChatMessage = { role: "system" | "user"; content: string };
type Dialogue = z.infer<typeof DialogueSchema>;
type Findings = z.infer<typeof FindingsSchema>;
type Management = z.infer<typeof ManagementSchema>;

/** The guidelines a consultant in each country checks against. */
const GUIDELINES: Record<Country, string> = {
  IN: "current Indian practice — the Standard Treatment Guidelines (ICMR/MoHFW), national programme guidelines (NTEP, NVBDCP, NACO, NHM), API, IAP, FOGSI and CSI guidance, and the National List of Essential Medicines",
  US: "current US practice — AHA/ACC, IDSA, ATS, ACOG, AAP, ADA Standards of Care, GOLD, GINA, Surviving Sepsis Campaign and USPSTF guidance",
  UK: "current UK practice — NICE guidelines and CKS, the BNF and BNFC for doses, SIGN, BTS, RCOG and Resuscitation Council UK guidance",
};

const consultant = (concept: Concept, country: Country): ChatMessage => ({
  role: "system",
  content: `You are a senior consultant in ${concept.specialty} and a medical educator. Before doctors see it, you check a teaching case for clinical accuracy against ${GUIDELINES[country]}. Be exacting: every value, sign, report, drug, dose and mark must be what a careful specialist would sign off. Correct only what is wrong — keep each item's id, keep the patient fictional, and never name the diagnosis in findings, reports or the patient's words. Output JSON only.`,
});

const outline = (concept: Concept) => `THE CASE: ${JSON.stringify({ diagnosis: concept.diagnosis, qualifier: concept.qualifier, patient: concept.patient, keyHistory: concept.keyHistory, keyExam: concept.keyExam, keyResults: concept.keyResults, ecg: concept.ecg, plan: concept.plan })}`;

export function findingsReviewPrompt(concept: Concept, f: Findings, country: Country): ChatMessage[] {
  const part = {
    exam: f.exam.map((e) => ({ id: e.id, label: e.label, finding: e.finding })),
    investigations: f.investigations.map((i) => ({
      id: i.id,
      name: i.name,
      rows: i.rows.length ? i.rows : undefined,
      report: i.report,
      ecg: i.media?.spec.kind === "ecg" ? i.media.spec : undefined,
      picture: i.media?.spec.kind === "picture" ? i.media.spec.describe : undefined,
    })),
    examPictures: f.exam.filter((e) => e.media?.spec.kind === "picture").map((e) => ({ id: e.id, picture: e.media!.spec.kind === "picture" ? e.media!.spec.describe : undefined })),
  };
  return [
    consultant(concept, country),
    {
      role: "user",
      content: `${outline(concept)}

CHECK — the examination and test results:
${JSON.stringify(part)}

For every item: are lab values realistic for this patient, this diagnosis and its stated severity — conventional units (mg/dL, g/dL, mmol/L for electrolytes), reference ranges right for age and sex, every flag matching its value and range? Are imaging, picture and ECG findings exactly what this condition at this severity shows, described objectively? Do the examination findings fit the diagnosis, the vital signs and each other? Anything implausible, inconsistent, outdated or impossible?
Return {"fixes":[{"id":"<item id>","finding"?:"corrected examination finding","rows"?:[{"analyte","value","unit","reference","flag":"normal"|"low"|"high"|"critical"}] (the whole corrected table),"report"?:"corrected report — findings only","ecg"?:{"kind":"ecg","rate","rhythm","morphology"?},"describe"?:"corrected picture description","why":"one line"}]} — only items that need a change; {"fixes":[]} if all is accurate.`,
    },
  ];
}

export function managementReviewPrompt(concept: Concept, m: Management, country: Country, level: string): ChatMessage[] {
  const part = {
    therapeutics: m.therapeutics.map((t) => ({ id: t.id, kind: t.kind, label: t.label, appropriateness: t.appropriateness, note: t.note, critique: t.critique })),
    rubric: { diagnosisAccept: m.rubric.diagnosisAccept, diagnosisPartial: m.rubric.diagnosisPartial, differentials: m.rubric.differentials, idealTreatment: m.rubric.idealTreatment, followUpDays: m.rubric.followUpDays },
  };
  return [
    consultant(concept, country),
    {
      role: "user",
      content: `${outline(concept)}
Setting: ${level}.

CHECK — the management and the marking key:
${JSON.stringify(part)}

For every treatment: is its appropriateness right for THIS patient (age, sex, pregnancy, allergies, comorbidities, severity) and this setting? Are drug names, doses, routes, frequencies and durations in the labels correct and current? Is the ideal treatment the first-line choice current guidelines recommend, with nothing essential missing from idealTreatment? Are harmful and dangerous options marked as such (contraindications, interactions, wrong drug for the condition)? Does the marking key accept the right diagnosis names and synonyms, and is the follow-up interval right?
Return {"fixes":[{"id":"<therapeutic id>","label"?,"appropriateness"?:"ideal"|"acceptable"|"neutral"|"unnecessary"|"harmful"|"dangerous","note"?,"critique"?:{"what","why","better","severity":"minor"|"moderate"|"major"},"why":"one line"}],"rubric"?:{"diagnosisAccept"?,"diagnosisPartial"?,"differentials"?,"idealTreatment"?:[["therapeutic ids"]],"followUpDays"?:{"min","max"}}} — only what needs a change; {"fixes":[]} if all is accurate.`,
    },
  ];
}

export function dialogueReviewPrompt(concept: Concept, d: Dialogue, country: Country): ChatMessage[] {
  const part = { vitals: d.baselineVitals, history: d.history.map((h) => ({ id: h.id, label: h.label, reply: h.reply, fact: h.fact })) };
  return [
    consultant(concept, country),
    {
      role: "user",
      content: `${outline(concept)}

CHECK — the vital signs at presentation (temperature in °F) and what the patient says:
${JSON.stringify(part)}

Are the vital signs right for this condition at this severity, and physiologically consistent with each other? Does the history fit the condition — onset, course, character, associated features and the important negatives — in a lay person's words?
Return {"vitals"?:{"<key>":"<corrected value>"},"fixes":[{"id":"<history id>","reply"?:"corrected reply, lay words","fact"?:"corrected fact","why":"one line"}]} — only what needs a change; {"fixes":[]} if all is accurate.`,
    },
  ];
}

/* -------------------------------------------------------------------------- */
/* Applying the corrections                                                    */
/* -------------------------------------------------------------------------- */

export function applyFindingsReview(f: Findings, raw: unknown): { part: Findings; fixes: string[] } {
  const review = FindingsReviewSchema.safeParse(raw);
  if (!review.success) return { part: f, fixes: [] };
  const fixes: string[] = [];
  const exam = f.exam.map((e) => {
    const fix = review.data.fixes.find((x) => x.id === e.id);
    if (!fix) return e;
    fixes.push(`exam ${e.id}: ${fix.why ?? "corrected"}`);
    const media = fix.describe && e.media?.spec.kind === "picture" ? { ...e.media, spec: { ...e.media.spec, describe: fix.describe } } : e.media;
    return { ...e, ...(fix.finding ? { finding: fix.finding } : {}), media };
  });
  const investigations = f.investigations.map((i) => {
    const fix = review.data.fixes.find((x) => x.id === i.id);
    if (!fix) return i;
    fixes.push(`${i.id}: ${fix.why ?? "corrected"}`);
    let media = i.media;
    if (fix.ecg && media?.spec.kind === "ecg") media = { ...media, spec: fix.ecg };
    if (fix.describe && media?.spec.kind === "picture") media = { ...media, spec: { ...media.spec, describe: fix.describe } };
    return { ...i, ...(fix.rows.length ? { rows: fix.rows } : {}), ...(fix.report ? { report: fix.report } : {}), media };
  });
  return { part: { ...f, exam, investigations }, fixes };
}

export function applyManagementReview(m: Management, raw: unknown): { part: Management; fixes: string[] } {
  const review = ManagementReviewSchema.safeParse(raw);
  if (!review.success) return { part: m, fixes: [] };
  const fixes: string[] = [];
  const therapeutics = m.therapeutics.map((t) => {
    const fix = review.data.fixes.find((x) => x.id === t.id);
    if (!fix) return t;
    fixes.push(`${t.id}: ${fix.why ?? "corrected"}`);
    return { ...t, ...(fix.label ? { label: fix.label } : {}), ...(fix.appropriateness ? { appropriateness: fix.appropriateness } : {}), ...(fix.note ? { note: fix.note } : {}), ...(fix.critique ? { critique: fix.critique } : {}) };
  });
  const r = review.data.rubric;
  const ids = new Set(therapeutics.map((t) => t.id));
  const ideal = r?.idealTreatment.map((g) => g.filter((id) => ids.has(id))).filter((g) => g.length > 0) ?? [];
  if (r?.diagnosisAccept.length || ideal.length || r?.followUpDays) fixes.push("marking key: corrected");
  const rubric = {
    ...m.rubric,
    ...(r?.diagnosisAccept.length ? { diagnosisAccept: [...new Set([...r.diagnosisAccept, ...m.rubric.diagnosisAccept])] } : {}),
    ...(r?.diagnosisPartial.length ? { diagnosisPartial: r.diagnosisPartial } : {}),
    ...(r?.differentials.length ? { differentials: r.differentials } : {}),
    ...(ideal.length ? { idealTreatment: ideal } : {}),
    ...(r?.followUpDays ? { followUpDays: r.followUpDays } : {}),
  };
  return { part: { ...m, therapeutics, rubric }, fixes };
}

const VITAL_KEYS = new Set(["bp", "hr", "rr", "temp", "spo2", "rbs", "weight", "height", "bmi", "gcs", "pain", "urine"]);

export function applyDialogueReview(d: Dialogue, raw: unknown): { part: Dialogue; fixes: string[] } {
  const review = DialogueReviewSchema.safeParse(raw);
  if (!review.success) return { part: d, fixes: [] };
  const fixes: string[] = [];
  const vitals = Object.fromEntries(Object.entries(review.data.vitals ?? {}).filter(([k, v]) => VITAL_KEYS.has(k) && v.trim()).map(([k, v]) => [k, v.trim().slice(0, 20)]));
  if (Object.keys(vitals).length) fixes.push(`vitals: ${Object.keys(vitals).join(", ")}`);
  const history = d.history.map((h) => {
    const fix = review.data.fixes.find((x) => x.id === h.id);
    if (!fix) return h;
    fixes.push(`${h.id}: ${fix.why ?? "corrected"}`);
    return { ...h, ...(fix.reply ? { reply: fix.reply } : {}), ...(fix.fact ? { fact: fix.fact } : {}) };
  });
  return { part: { ...d, baselineVitals: { ...d.baselineVitals, ...vitals }, history }, fixes };
}

/* -------------------------------------------------------------------------- */
/* What code can check exactly                                                 */
/* -------------------------------------------------------------------------- */

const number = (s: string) => {
  const m = s.replace(/,/g, "").match(/^\s*[<>≤≥]?\s*(-?\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
};

/** A reference range as numbers: "4.0–11.0", "135-145 mmol/L", "<5", "≥ 60". */
export function parseRange(reference: string | undefined): { low?: number; high?: number } | null {
  if (!reference) return null;
  const r = reference.replace(/,/g, "");
  const between = r.match(/(-?\d+(?:\.\d+)?)\s*(?:–|-|to)\s*(-?\d+(?:\.\d+)?)/);
  if (between) return { low: Number(between[1]), high: Number(between[2]) };
  const below = r.match(/^\s*(?:<|≤|<=|up to)\s*(-?\d+(?:\.\d+)?)/i);
  if (below) return { high: Number(below[1]) };
  const above = r.match(/^\s*(?:>|≥|>=)\s*(-?\d+(?:\.\d+)?)/);
  if (above) return { low: Number(above[1]) };
  return null;
}

/** Every flag agrees with its value and range — a "normal" flag on an out-of-range value (or the reverse) is corrected. "critical" is the author's call. */
export function checkLabFlags(f: Findings): { part: Findings; fixes: string[] } {
  const fixes: string[] = [];
  const investigations = f.investigations.map((i) => ({
    ...i,
    rows: i.rows.map((row) => {
      const value = number(row.value);
      const range = parseRange(row.reference);
      if (value === null || !range || row.flag === "critical" || row.flag === "unknown") return row;
      const flag: typeof row.flag = range.low !== undefined && value < range.low ? "low" : range.high !== undefined && value > range.high ? "high" : "normal";
      if (flag === row.flag) return row;
      fixes.push(`${i.id} ${row.analyte}: ${row.flag} → ${flag}`);
      return { ...row, flag };
    }),
  }));
  return { part: { ...f, investigations }, fixes };
}
