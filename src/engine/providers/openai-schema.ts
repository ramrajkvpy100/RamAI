/**
 * Zod schemas for everything the language model returns. Model output is
 * never trusted: it is validated here, then mapped onto engine structures.
 */
import { z } from "zod";

/* -------------------------------------------------------------------------- */
/* Turn interpretation                                                         */
/* -------------------------------------------------------------------------- */

export const IntentSchema = z.object({
  kind: z.enum(["greeting", "history", "vitals", "exam", "investigation", "drug", "action", "followup", "wait", "reassess", "diagnosis", "differential", "close", "results", "unknown"]),
  targetId: z.string().max(80).optional(),
  phrase: z.string().max(400).default(""),
  payload: z.record(z.string(), z.union([z.string().max(300), z.number(), z.boolean()])).optional(),
});

/** The structured patient response contract (spec §42). */
export const PatientResponseSchema = z.object({
  type: z.literal("patient_response"),
  message: z.string().max(800),
  new_information: z.array(z.object({ label: z.string().max(60), value: z.string().max(300) })).max(6).default([]),
  intents: z.array(IntentSchema).max(8).default([]),
  /** Engine-owned fields are accepted for contract compatibility but ignored. */
  vitals: z.record(z.string(), z.unknown()).optional(),
  state_changes: z.array(z.unknown()).optional(),
  investigation_results: z.array(z.unknown()).optional(),
  patient_status: z.string().optional(),
  case_status: z.string().optional(),
});
export type PatientResponse = z.infer<typeof PatientResponseSchema>;

/* -------------------------------------------------------------------------- */
/* Patient voice                                                               */
/* -------------------------------------------------------------------------- */

/** One reply per question asked, in order. */
export const VoiceSchema = z.object({ replies: z.array(z.string().max(700)).max(8) });

/* -------------------------------------------------------------------------- */
/* Debrief feedback                                                            */
/* -------------------------------------------------------------------------- */

export const FeedbackSchema = z.object({
  summary: z.string().min(1).max(800),
  reasoning: z.string().min(1).max(800),
  nextTime: z.array(z.string().min(1).max(260)).min(1).max(4),
});

/* -------------------------------------------------------------------------- */
/* An AI-made case: the whole patient file, checked before it is used          */
/* -------------------------------------------------------------------------- */

const Flag = z.enum(["normal", "low", "high", "critical", "unknown"]).default("normal");
const LabRow = z.object({ analyte: z.string().max(80), value: z.string().max(40), unit: z.string().max(30).optional(), reference: z.string().max(60).optional(), flag: Flag });
const VitalKey = z.enum(["bp", "hr", "rr", "temp", "spo2", "rbs", "weight", "height", "bmi", "gcs", "pain", "urine"]);
const FactGroup = z.enum(["demographics", "complaint", "hpi", "past", "medication", "allergy", "family", "social", "diet", "sexual", "obstetric", "systemic", "general-exam", "systemic-exam", "local-exam"]);
const Importance = z.enum(["essential", "useful", "minor"]);
const Specialty = z.enum(["Medicine", "Dermatology", "Surgery", "Pediatrics", "OBGYN", "Emergency", "Cardiology", "Neurology", "Respiratory", "Gastroenterology", "Nephrology", "Endocrinology", "Psychiatry", "ENT", "Ophthalmology", "Orthopedics", "Urology", "Infectious Disease"]);
const Lead = z.enum(["I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6"]);
const PerLead = z.partialRecord(Lead, z.number().min(-12).max(12)).optional();

/** An ECG: the findings only — the site's ECG engine draws them, accurately. */
const EcgMedia = z.object({
  kind: z.literal("ecg"),
  rate: z.number().min(20).max(250),
  rhythm: z.enum(["sinus", "afib", "aflutter", "svt", "vt", "paced", "junctional"]),
  morphology: z
    .object({
      st: PerLead,
      t: PerLead,
      q: PerLead,
      qrsScale: PerLead,
      pr: z.number().min(60).max(400).optional(),
      qrs: z.number().min(60).max(240).optional(),
      qt: z.number().min(200).max(700).optional(),
      pWaves: z.boolean().optional(),
      peakedT: z.boolean().optional(),
    })
    .optional(),
});
/** A picture: a precise description the image model draws from when the case reaches it. Never shown to the player. */
const PictureMedia = z.object({
  kind: z.literal("picture"),
  type: z.enum(["photo", "xray", "ct", "mri", "usg", "fundus", "endoscopy", "slide"]),
  view: z.string().max(80),
  describe: z.string().min(20).max(900),
});
const GenMedia = z.object({ spec: z.union([EcgMedia, PictureMedia]), alt: z.string().max(220), caption: z.string().max(120).optional() });
export type GeneratedMedia = z.infer<typeof GenMedia>;

const Miss = z.object({ what: z.string(), why: z.string(), better: z.string(), severity: z.enum(["minor", "moderate", "major"]).default("moderate") });

export const GeneratedCaseSchema = z.object({
  specialty: Specialty,
  setting: z.enum(["OPD", "IPD", "ER", "ICU", "Ward", "Teleconsult"]),
  difficulty: z.number().int().min(1).max(3).default(2),
  patient: z.object({ name: z.string().max(60).optional(), age: z.number().int().min(0).max(110), sex: z.enum(["Male", "Female", "Other"]), city: z.string().max(80), occupation: z.string().max(80).optional(), context: z.string().max(80).optional() }),
  arrivalMinuteOfDay: z.number().int().min(0).max(1439).default(600),
  briefing: z.string().max(260),
  opening: z.array(z.object({ role: z.enum(["patient", "attendant", "nurse", "system"]), kind: z.enum(["speech", "action", "finding", "status"]), text: z.string().max(400), media: GenMedia.optional() })).min(1).max(4),
  baselineVitals: z.partialRecord(VitalKey, z.string().max(20)),
  triageVitals: z.array(VitalKey).optional(),
  profile: z
    .object({
      allergies: z.array(z.string()).optional(),
      currentDrugs: z.array(z.string()).optional(),
      pregnancyPossible: z.boolean().optional(),
      pregnant: z.boolean().optional(),
      asthma: z.boolean().optional(),
      ckd: z.boolean().optional(),
      heartFailure: z.boolean().optional(),
      thrombocytopenia: z.boolean().optional(),
      fluidToleranceMl: z.number().optional(),
    })
    .default({}),
  history: z.array(z.object({ id: z.string().max(40), group: FactGroup, label: z.string().max(60), match: z.array(z.string().max(60)).min(1).max(20), reply: z.string().max(500), fact: z.string().max(200).optional(), abnormal: z.boolean().optional(), importance: Importance, speaker: z.enum(["patient", "attendant"]).optional() })).min(6).max(30),
  exam: z.array(z.object({ id: z.string().max(40), group: z.enum(["general-exam", "systemic-exam", "local-exam"]), label: z.string().max(60), match: z.array(z.string().max(60)).max(12).default([]), finding: z.string().max(600), fact: z.string().max(200).optional(), abnormal: z.boolean().optional(), importance: Importance, patientReaction: z.string().max(200).optional(), media: GenMedia.optional() })).min(2).max(24),
  investigations: z.array(z.object({ id: z.string().max(40), name: z.string().max(80).optional(), short: z.string().max(30).optional(), category: z.enum(["lab", "bedside", "ecg", "imaging", "photo", "micro", "histopath", "function"]).optional(), match: z.array(z.string().max(60)).max(12).optional(), turnaroundMin: z.number().min(1).max(10080).optional(), cost: z.number().min(0).max(100000).optional(), rows: z.array(LabRow).max(30).optional(), report: z.string().max(900).optional(), media: GenMedia.optional(), priority: z.enum(["essential", "useful", "situational", "unnecessary"]), teaching: z.object({ whenToOrder: z.string().max(300), whatItTellsYou: z.string().max(300) }) })).max(24),
  therapeutics: z.array(z.object({ id: z.string().max(40), kind: z.enum(["drug", "procedure", "counsel", "referral", "admit", "discharge", "supportive"]), drugIds: z.array(z.string()).optional(), drugClasses: z.array(z.string()).optional(), measureIds: z.array(z.string()).optional(), concernsDrugs: z.array(z.string()).optional(), match: z.array(z.string().max(60)).max(12).optional(), label: z.string().max(80), appropriateness: z.enum(["ideal", "acceptable", "neutral", "unnecessary", "harmful", "dangerous"]), note: z.string().max(300).optional(), critique: Miss.optional(), praise: z.string().max(200).optional() })).max(30),
  truth: z.object({ diagnosis: z.string().max(120), qualifier: z.string().max(400).optional(), reasoning: z.array(z.object({ stage: z.enum(["History", "Examination", "Investigation", "Diagnosis"]), text: z.string().max(500) })).length(4) }),
  rubric: z.object({
    diagnosisAccept: z.array(z.string()).min(1),
    diagnosisPartial: z.array(z.string()).default([]),
    differentials: z.array(z.string()).default([]),
    idealTreatment: z.array(z.array(z.string()).min(1)).default([]),
    expertActionCount: z.number().int().min(4).max(60).default(14),
    followUpDays: z.object({ min: z.number(), max: z.number() }).optional(),
    expectsReassessment: z.boolean().default(false),
    misses: z.record(z.string(), Miss).default({}),
    strengths: z.record(z.string(), z.string()).default({}),
  }),
  followUp: z.array(z.object({ when: z.enum(["ideal", "acceptable", "harmful", "untreated", "any"]), status: z.enum(["stable", "guarded", "deteriorating", "critical", "improving", "recovered"]), lines: z.array(z.object({ role: z.enum(["patient", "attendant", "nurse", "system"]), kind: z.enum(["speech", "action", "finding", "status"]), text: z.string().max(400) })).min(1).max(4) })).max(4).default([]),
  teaching: z.object({
    patientBand: z.string().optional(),
    severityBands: z.array(z.object({ id: z.string(), label: z.string(), recognition: z.array(z.string()), investigation: z.array(z.string()), treatment: z.array(z.string()), followUp: z.array(z.string()) })).max(5).default([]),
    drugs: z.array(z.object({ generic: z.string(), brand: z.string().optional(), dose: z.string(), route: z.enum(["PO", "IV", "IM", "SC", "SL", "PR", "TOP", "INH", "NEB", "OD-eye", "IN"]), frequency: z.string(), duration: z.string(), indication: z.string(), mechanism: z.string(), whyItWorks: z.string(), avoidWhen: z.array(z.string()), adverseEffects: z.array(z.string()), monitoring: z.array(z.string()) })).max(6).default([]),
    routines: z.array(z.object({ label: z.string(), steps: z.array(z.object({ order: z.number(), step: z.string(), product: z.string().optional(), howMuch: z.string().optional(), where: z.string().optional(), note: z.string().optional() })), avoid: z.array(z.string()).optional(), improvementTimeline: z.string().optional() })).max(3).default([]),
    followUp: z.object({ interval: z.string(), reassess: z.array(z.string()), redFlags: z.array(z.string()), whenToEscalate: z.array(z.string()) }),
    treatmentFailure: z.object({ steps: z.array(z.string()) }),
    pearl: z.string().max(600),
  }),
});
export type GeneratedCase = z.infer<typeof GeneratedCaseSchema>;
