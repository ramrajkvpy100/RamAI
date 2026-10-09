/**
 * Zod schemas for everything the language model returns. Model output is
 * never trusted: it is validated here, then mapped onto engine structures.
 */
import { z } from "zod";

/* -------------------------------------------------------------------------- */
/* Turn interpretation                                                         */
/* -------------------------------------------------------------------------- */

export const IntentSchema = z.object({
  kind: z.enum(["greeting", "history", "vitals", "exam", "investigation", "drug", "action", "followup", "wait", "reassess", "diagnosis", "differential", "close", "unknown"]),
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
/* Generated case                                                              */
/* -------------------------------------------------------------------------- */

const Flag = z.enum(["normal", "low", "high", "critical", "unknown"]).default("normal");
const LabRow = z.object({ analyte: z.string(), value: z.string(), unit: z.string().optional(), reference: z.string().optional(), flag: Flag });
const VitalKey = z.enum(["bp", "hr", "rr", "temp", "spo2", "rbs", "weight", "height", "bmi", "gcs", "pain", "urine"]);
const FactGroup = z.enum(["demographics", "complaint", "hpi", "past", "medication", "allergy", "family", "social", "diet", "sexual", "obstetric", "systemic", "general-exam", "systemic-exam", "local-exam"]);
const Importance = z.enum(["essential", "useful", "minor"]);
const Specialty = z.enum(["Medicine", "Dermatology", "Surgery", "Pediatrics", "OBGYN", "Emergency", "Cardiology", "Neurology", "Respiratory", "Gastroenterology", "Nephrology", "Endocrinology", "Psychiatry", "ENT", "Ophthalmology", "Orthopedics", "Urology", "Infectious Disease"]);

const DermLayer = z.object({
  morphology: z.enum(["comedone-open", "comedone-closed", "papule", "pustule", "nodule", "cyst", "macule", "patch", "plaque", "scale", "vesicle", "wheal", "scar-atrophic", "scar-hypertrophic", "erythema", "hyperpigment", "ulcer", "target", "annular"]),
  count: z.number().int().min(0).max(120),
  size: z.number().min(0.5).max(40).optional(),
  colour: z.string().optional(),
  confluence: z.number().min(0).max(1).optional(),
  region: z.enum(["malar", "central", "perioral", "diffuse", "extensor", "flexor", "margins"]).optional(),
});
const Media = z.object({
  spec: z.union([
    z.object({ kind: z.literal("derm"), site: z.enum(["face", "cheek", "forehead", "back", "forearm", "shin", "trunk", "scalp", "hand", "foot"]), phototype: z.number().int().min(1).max(6), lesions: z.array(DermLayer).max(10), seed: z.number().int() }),
    z.object({ kind: z.literal("ecg"), rate: z.number().min(20).max(250), rhythm: z.enum(["sinus", "afib", "aflutter", "svt", "vt", "paced", "junctional"]), morphology: z.record(z.string(), z.unknown()).optional() }),
    z.object({ kind: z.enum(["xray", "ct", "mri", "usg", "fundus"]), view: z.string(), features: z.array(z.object({ id: z.string(), side: z.enum(["left", "right", "bilateral"]).optional(), severity: z.number().int().min(1).max(3).optional() })).max(6), seed: z.number().int() }),
  ]).optional(),
  alt: z.string(),
  caption: z.string().optional(),
});

const Miss = z.object({ what: z.string(), why: z.string(), better: z.string(), severity: z.enum(["minor", "moderate", "major"]).default("moderate") });

export const GeneratedCaseSchema = z.object({
  specialty: Specialty,
  setting: z.enum(["OPD", "IPD", "ER", "ICU", "Ward", "Teleconsult"]),
  difficulty: z.number().int().min(1).max(3).default(2),
  patient: z.object({ name: z.string().optional(), age: z.number().int().min(0).max(110), sex: z.enum(["Male", "Female", "Other"]), city: z.string(), occupation: z.string().optional(), context: z.string().optional() }),
  arrivalMinuteOfDay: z.number().int().min(0).max(1439).default(600),
  briefing: z.string().max(240),
  opening: z.array(z.object({ role: z.enum(["patient", "attendant", "nurse", "system"]), kind: z.enum(["speech", "action", "finding", "status"]), text: z.string(), media: Media.optional() })).min(1).max(4),
  baselineVitals: z.record(VitalKey, z.string()),
  triageVitals: z.array(VitalKey).optional(),
  profile: z.object({
    allergies: z.array(z.string()).optional(), currentDrugs: z.array(z.string()).optional(), pregnancyPossible: z.boolean().optional(),
    pregnant: z.boolean().optional(), asthma: z.boolean().optional(), ckd: z.boolean().optional(), heartFailure: z.boolean().optional(),
    thrombocytopenia: z.boolean().optional(), fluidToleranceMl: z.number().optional(),
  }).default({}),
  history: z.array(z.object({ id: z.string(), group: FactGroup, label: z.string(), match: z.array(z.string()).min(1), reply: z.string(), fact: z.string().optional(), abnormal: z.boolean().optional(), importance: Importance })).min(6).max(40),
  exam: z.array(z.object({ id: z.string(), group: z.enum(["general-exam", "systemic-exam", "local-exam"]), label: z.string(), match: z.array(z.string()).default([]), finding: z.string(), fact: z.string().optional(), abnormal: z.boolean().optional(), importance: Importance, patientReaction: z.string().optional(), media: Media.optional() })).min(2).max(30),
  investigations: z.array(z.object({ id: z.string(), name: z.string().optional(), short: z.string().optional(), category: z.enum(["lab", "bedside", "ecg", "imaging", "photo", "micro", "histopath", "function"]).optional(), match: z.array(z.string()).optional(), turnaroundMin: z.number().optional(), cost: z.number().optional(), rows: z.array(LabRow).optional(), report: z.string().optional(), media: Media.optional(), priority: z.enum(["essential", "useful", "situational", "unnecessary"]), teaching: z.object({ whenToOrder: z.string(), whatItTellsYou: z.string() }) })).max(30),
  therapeutics: z.array(z.object({ id: z.string(), kind: z.enum(["drug", "procedure", "counsel", "referral", "admit", "discharge", "supportive"]), drugIds: z.array(z.string()).optional(), drugClasses: z.array(z.string()).optional(), measureIds: z.array(z.string()).optional(), concernsDrugs: z.array(z.string()).optional(), match: z.array(z.string()).optional(), label: z.string(), appropriateness: z.enum(["ideal", "acceptable", "neutral", "unnecessary", "harmful", "dangerous"]), note: z.string().optional(), critique: Miss.optional(), praise: z.string().optional() })).max(40),
  truth: z.object({ diagnosis: z.string(), qualifier: z.string().optional(), reasoning: z.array(z.object({ stage: z.enum(["History", "Examination", "Investigation", "Diagnosis"]), text: z.string() })).length(4) }),
  rubric: z.object({
    diagnosisAccept: z.array(z.string()).min(1), diagnosisPartial: z.array(z.string()).default([]), differentials: z.array(z.string()).default([]),
    idealTreatment: z.array(z.array(z.string()).min(1)).default([]), expertActionCount: z.number().int().min(4).max(60).default(16),
    followUpDays: z.object({ min: z.number(), max: z.number() }).optional(), expectsReassessment: z.boolean().default(false),
    misses: z.record(z.string(), Miss).default({}), strengths: z.record(z.string(), z.string()).default({}),
  }),
  followUp: z.array(z.object({ when: z.enum(["ideal", "acceptable", "harmful", "untreated", "any"]), status: z.enum(["stable", "guarded", "deteriorating", "critical", "improving", "recovered"]), lines: z.array(z.object({ role: z.enum(["patient", "attendant", "nurse", "system"]), kind: z.enum(["speech", "action", "finding", "status"]), text: z.string() })).min(1) })).default([]),
  teaching: z.object({
    patientBand: z.string().optional(),
    severityBands: z.array(z.object({ id: z.string(), label: z.string(), recognition: z.array(z.string()), investigation: z.array(z.string()), treatment: z.array(z.string()), followUp: z.array(z.string()), media: Media.optional() })).default([]),
    drugs: z.array(z.object({ generic: z.string(), brand: z.string().optional(), dose: z.string(), route: z.enum(["PO", "IV", "IM", "SC", "SL", "PR", "TOP", "INH", "NEB", "OD-eye", "IN"]), frequency: z.string(), duration: z.string(), indication: z.string(), mechanism: z.string(), whyItWorks: z.string(), avoidWhen: z.array(z.string()), adverseEffects: z.array(z.string()), monitoring: z.array(z.string()) })).default([]),
    routines: z.array(z.object({ label: z.string(), steps: z.array(z.object({ order: z.number(), step: z.string(), product: z.string().optional(), howMuch: z.string().optional(), where: z.string().optional(), note: z.string().optional() })), avoid: z.array(z.string()).optional(), expectedIrritation: z.string().optional(), ifIrritated: z.string().optional(), improvementTimeline: z.string().optional() })).default([]),
    followUp: z.object({ interval: z.string(), reassess: z.array(z.string()), redFlags: z.array(z.string()), whenToEscalate: z.array(z.string()) }),
    treatmentFailure: z.object({ steps: z.array(z.string()) }),
    pearl: z.string(),
  }),
});
export type GeneratedCase = z.infer<typeof GeneratedCaseSchema>;
