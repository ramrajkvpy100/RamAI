/**
 * An invented case's natural course: how sick the patient is on arrival (from their vital signs, by age), and what
 * happens if nothing that treats the illness is done — they get worse, and the right treatment turns it round.
 * Written cases describe this themselves; invented ones had nothing, so an untreated shocked patient stayed "stable".
 */
import type { ClinicalCaseDefinition, HazardDefinition } from "../case-definition";
import type { PatientStatus } from "../types";

const n = (v: string | undefined) => {
  const m = v?.match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : undefined;
};

/** Danger signs in the vital signs, for the patient's age (adult limits, or the child's). */
export function dangerSigns(age: number, vitals: Record<string, { value: string } | undefined>): number {
  const hr = n(vitals.hr?.value);
  const rr = n(vitals.rr?.value);
  const spo2 = n(vitals.spo2?.value);
  const sbp = n(vitals.bp?.value);
  const gcs = n(vitals.gcs?.value);
  const rbs = n(vitals.rbs?.value);
  let t = n(vitals.temp?.value);
  if (t !== undefined && t > 50) t = ((t - 32) * 5) / 9;
  const limits = age < 1 ? { hr: 180, rr: 60, sbp: 65 } : age < 5 ? { hr: 160, rr: 45, sbp: 70 } : age < 12 ? { hr: 140, rr: 35, sbp: 80 } : { hr: 130, rr: 28, sbp: 90 };
  let signs = 0;
  if (hr !== undefined && (hr >= limits.hr || hr < (age < 12 ? 70 : 40))) signs++;
  if (rr !== undefined && (rr >= limits.rr || rr < 8)) signs++;
  if (spo2 !== undefined && spo2 < 92) signs += spo2 < 88 ? 2 : 1;
  if (sbp !== undefined && sbp < limits.sbp) signs += 2;
  if (gcs !== undefined && gcs < 13) signs += gcs < 9 ? 2 : 1;
  if (rbs !== undefined && rbs < 60) signs++;
  if (t !== undefined && (t >= 40 || t < 35)) signs++;
  return signs;
}

const WORSE: Record<PatientStatus, PatientStatus> = { recovered: "stable", improving: "stable", stable: "guarded", guarded: "deteriorating", deteriorating: "critical", critical: "critical", deceased: "deceased" };

/** The invented case with its arrival status and, if the patient is unwell, the course of the untreated illness. */
export function withUntreatedCourse(def: ClinicalCaseDefinition, emergency: boolean): ClinicalCaseDefinition {
  const signs = dangerSigns(def.patient.age, def.baselineVitals as Record<string, { value: string }>);
  const status: PatientStatus = signs >= 4 ? "critical" : signs >= 2 ? "deteriorating" : signs >= 1 || emergency ? "guarded" : "stable";
  if (status === "stable") return def;
  const treats = [...new Set(def.rubric.idealTreatment.flat())];
  if (!treats.length) return { ...def, initialStatus: status };
  const them = def.patient.sex === "Female" ? "she" : def.patient.sex === "Male" ? "he" : "they";
  const byMinute = status === "critical" ? 20 : status === "deteriorating" ? 45 : 90;
  const next = WORSE[status];
  const hazard: HazardDefinition = {
    id: "untreated-illness",
    label: `${def.truth.diagnosis} — untreated`,
    omission: { byMinute, preventedBy: treats },
    stages: [
      { afterMin: 0, status: next, vitals: [], shift: { hr: 12, sbp: -12, dbp: -8, rr: 4, spo2: -3 }, observation: { role: "nurse", text: `Doctor, ${them}'s getting worse.` }, patientSays: "I feel worse, doctor.", interrupts: true },
      { afterMin: 60, status: "critical", vitals: [], shift: { hr: 15, sbp: -15, dbp: -10, rr: 6, spo2: -4, gcs: -2 }, observation: { role: "nurse", text: `Doctor, ${them}'s much worse — please come now.` }, interrupts: true },
    ],
    rescue: [treats.map((id) => (id.includes(":") ? id : id))],
    fullRecoveryWindowMin: 60,
    lastRescueMin: 300,
    recovery: [{ afterMin: 30, status: status === "critical" ? "deteriorating" : "guarded", vitals: [], shift: { hr: -10, sbp: 10, rr: -3, spo2: 2 }, patientSays: "A little better, doctor." }],
    review: {
      cause: `${def.truth.diagnosis} left untreated`,
      whyItCausedHarm: "Without its treatment the illness progressed.",
      earliestRescueWindow: `Within ${byMinute} minutes of arrival`,
      correctRescueSequence: def.rubric.idealTreatment.map((g) => g.join(" or ")).slice(0, 4),
      lastRealisticRescueWindow: "A few hours",
    },
  };
  return { ...def, initialStatus: status, hazards: [...def.hazards, hazard] };
}
