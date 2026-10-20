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

/** The structured patient response contract (spec §42). Lenient: one malformed intent is dropped, not the whole answer. */
export const PatientResponseSchema = z.object({
  type: z.literal("patient_response").optional().catch(undefined),
  message: z.string().catch("").default("").transform((t) => t.trim().slice(0, 800)),
  /** Who says `message`: the patient, a relative, or the nurse (an instruction or remark no listed id covers). */
  speaker: z.enum(["patient", "attendant", "nurse"]).optional().catch(undefined),
  new_information: z.array(z.object({ label: z.string().max(60), value: z.string().max(300) })).max(6).default([]).catch([]),
  intents: z.unknown().optional().transform((v) =>
    (Array.isArray(v) ? v : [])
      .map((x) => IntentSchema.safeParse(x))
      .filter((r) => r.success)
      .map((r) => r.data)
      .slice(0, 8),
  ),
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
/* An AI-made case, in four pieces: an outline, then three parts in parallel   */
/* Forgiving on purpose: small slips are fixed or dropped, not fatal.          */
/* -------------------------------------------------------------------------- */

/** Text (numbers accepted), trimmed and capped. A missing value is missing — never the word "undefined". */
/** Text up to `max` characters — cut at a word, with "…", never mid-word ("…continuous monitorin."). */
const clip = (t: string, max: number) => {
  const x = t.trim();
  if (x.length <= max) return x;
  const cut = x.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:–—-]+$/, "")}…`;
};
const str = (max: number) => z.preprocess((v) => (typeof v === "number" || typeof v === "boolean" ? String(v) : v), z.string()).transform((t) => clip(t, max));
/** Optional text: missing, null or malformed all mean "not given". */
const optStr = (max: number) => str(max).optional().catch(undefined);
/** A list from whatever arrived: an array, one value, or a semicolon-separated string. */
const strs = (maxItems: number, maxLen = 220) =>
  z.unknown().optional().transform((v) => (Array.isArray(v) ? v : typeof v === "string" ? v.split(/;\s*|\n/) : v == null ? [] : [v]).map((x) => String(x).trim().slice(0, maxLen)).filter(Boolean).slice(0, maxItems));
/** A list of objects: items that don't fit are dropped, the rest kept. */
const listOf = <T extends z.ZodType>(item: T, maxItems: number) =>
  z.unknown().optional().transform((v) =>
    (Array.isArray(v) ? v : v == null ? [] : [v])
      .map((x) => item.safeParse(x))
      .filter((r) => r.success)
      .map((r) => r.data as z.output<T>)
      .slice(0, maxItems),
  );
const num = (fallback: number) => z.coerce.number().catch(fallback);

/** An age in whole years, however it's written: 34, "34", "2 years", "18 months" (→ 1), "6 weeks" (→ 0). Unreadable → null (the case is rejected, never given a made-up age). */
const ageYears = z.union([z.number(), z.string()]).transform((v) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const m = v.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(year|yr|y\b|month|mo\b|week|wk|day|d\b)?/);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2] ?? "year";
  return unit.startsWith("mo") ? n / 12 : unit.startsWith("w") ? n / 52 : unit.startsWith("d") ? n / 365 : n;
}).catch(null);

const Flag = z.enum(["normal", "low", "high", "critical", "unknown"]).catch("normal");
const LabRow = z.object({ analyte: str(80), value: str(40), unit: optStr(30), reference: optStr(60), flag: Flag });
const VitalKey = z.enum(["bp", "hr", "rr", "temp", "spo2", "rbs", "weight", "height", "bmi", "gcs", "pain", "urine"]);
const FactGroup = z.enum(["demographics", "complaint", "hpi", "past", "medication", "allergy", "family", "social", "diet", "sexual", "obstetric", "systemic"]).catch("hpi");
const Importance = z.enum(["essential", "useful", "minor"]).catch("useful");
const Specialty = z.enum(["Medicine", "Dermatology", "Surgery", "Pediatrics", "OBGYN", "Emergency", "Cardiology", "Neurology", "Respiratory", "Gastroenterology", "Nephrology", "Endocrinology", "Psychiatry", "ENT", "Ophthalmology", "Orthopedics", "Urology", "Infectious Disease"]);
const Lead = z.enum(["I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6"]);
const PerLead = z.partialRecord(Lead, z.coerce.number().min(-12).max(12)).optional().catch(undefined);
const Role = z.enum(["patient", "attendant", "nurse", "system"]).catch("system");
const Kind = z.enum(["speech", "action", "finding", "status"]).catch("speech");

/** An ECG: the findings only — the site's ECG engine draws them, accurately. */
const EcgMedia = z.object({
  kind: z.literal("ecg"),
  rate: z.coerce.number().min(20).max(250),
  rhythm: z.enum(["sinus", "afib", "aflutter", "svt", "vt", "paced", "junctional"]).catch("sinus"),
  morphology: z
    .object({
      st: PerLead,
      t: PerLead,
      q: PerLead,
      qrsScale: PerLead,
      pr: z.coerce.number().min(60).max(400).optional().catch(undefined),
      qrs: z.coerce.number().min(60).max(240).optional().catch(undefined),
      qt: z.coerce.number().min(200).max(700).optional().catch(undefined),
      pWaves: z.boolean().optional().catch(undefined),
      peakedT: z.boolean().optional().catch(undefined),
    })
    .optional()
    .catch(undefined),
});
/** A picture: a precise description the image model draws from when the case reaches it. Never shown to the player. */
const PictureMedia = z.object({
  kind: z.literal("picture"),
  type: z.enum(["photo", "xray", "ct", "mri", "usg", "fundus", "endoscopy", "slide"]),
  view: str(80),
  describe: str(900).refine((t) => t.length >= 20),
});
/** Accepts the details nested in "spec" or written flat beside alt and caption (both happen). */
function normaliseMedia(v: unknown): unknown {
  if (!v || typeof v !== "object") return v;
  const m = v as Record<string, unknown>;
  if (m.spec && typeof m.spec === "object") return m;
  const { alt, caption, spec, ...rest } = m;
  const label = typeof spec === "string" ? spec.toLowerCase() : "";
  const kind = typeof rest.kind === "string" ? rest.kind.toLowerCase() : label.includes("ecg") ? "ecg" : label.includes("picture") ? "picture" : undefined;
  return { alt, caption, spec: { ...rest, kind } };
}
const GenMedia = z.preprocess(normaliseMedia, z.object({ spec: z.union([EcgMedia, PictureMedia]), alt: str(220), caption: optStr(120) }));
export type GeneratedMedia = z.infer<typeof GenMedia>;
const media = GenMedia.optional().catch(undefined);

const Miss = z.object({ what: str(300), why: str(300), better: str(300), severity: z.enum(["minor", "moderate", "major"]).catch("moderate") });

/** 1. The outline — who, what's wrong, and the key facts every part must agree on. */
export const ConceptSchema = z.object({
  specialty: Specialty.catch("Medicine"),
  difficulty: z.coerce.number().int().min(1).max(3).catch(2),
  patient: z.object({ name: optStr(60), age: ageYears.transform((n) => (n === null ? null : Math.max(0, Math.min(110, Math.floor(n))))), sex: z.enum(["Male", "Female"]).catch("Male"), city: str(80), occupation: optStr(80) }),
  briefing: str(260),
  diagnosis: str(140),
  qualifier: optStr(400),
  keyHistory: strs(12),
  keyExam: strs(10),
  keyResults: strs(10),
  pictures: strs(4),
  ecg: optStr(400),
  differentials: strs(6, 80),
  plan: strs(10),
});
export type Concept = z.infer<typeof ConceptSchema>;

/** 2a. What the patient and family say, and the vital signs. */
export const DialogueSchema = z.object({
  opening: listOf(z.object({ role: Role, kind: Kind, text: str(400) }), 4),
  baselineVitals: z.record(z.string(), z.coerce.string()).transform((v) => Object.fromEntries(Object.entries(v).filter(([k]) => VitalKey.safeParse(k).success).map(([k, x]) => [k, x.slice(0, 20)]))),
  triageVitals: listOf(VitalKey, 12),
  profile: z
    .object({ allergies: strs(6, 60), currentDrugs: strs(8, 60), pregnancyPossible: z.boolean().optional().catch(undefined), pregnant: z.boolean().optional().catch(undefined), asthma: z.boolean().optional().catch(undefined), ckd: z.boolean().optional().catch(undefined), heartFailure: z.boolean().optional().catch(undefined), thrombocytopenia: z.boolean().optional().catch(undefined), volume: z.enum(["depleted", "normal", "overloaded"]).optional().catch(undefined), fluidDeficitMlPerKg: z.number().min(0).max(150).optional().catch(undefined) })
    .catch({ allergies: [], currentDrugs: [] }),
  history: listOf(z.object({ id: str(40), group: FactGroup, label: str(60), match: strs(10, 60), reply: str(500), fact: optStr(200), abnormal: z.boolean().optional().catch(undefined), importance: Importance, speaker: z.enum(["patient", "attendant"]).optional().catch(undefined) }), 16),
});

/** 2b. What the doctor finds: examinations and test results, with their pictures and ECGs. */
export const FindingsSchema = z.object({
  exam: listOf(z.object({ id: str(40), group: z.enum(["general-exam", "systemic-exam", "local-exam"]).catch("systemic-exam"), label: str(60), match: strs(10, 60), finding: str(600), fact: optStr(200), abnormal: z.boolean().optional().catch(undefined), importance: Importance, media }), 10),
  investigations: listOf(
    z.object({
      id: str(40),
      name: optStr(80),
      short: optStr(30),
      category: z.enum(["lab", "bedside", "ecg", "imaging", "photo", "micro", "histopath", "function"]).optional().catch(undefined),
      match: strs(10, 60),
      cost: num(0).optional(),
      rows: listOf(LabRow, 24),
      report: optStr(900),
      media,
      priority: z.enum(["essential", "useful", "situational", "unnecessary"]).catch("useful"),
      teaching: z.object({ whenToOrder: str(300), whatItTellsYou: str(300) }).catch({ whenToOrder: "", whatItTellsYou: "" }),
    }),
    14,
  ),
});

/** 2c. Management and the marking key. */
export const ManagementSchema = z.object({
  therapeutics: listOf(
    z.object({
      id: str(40),
      kind: z.enum(["drug", "procedure", "counsel", "referral", "admit", "discharge", "supportive"]).catch("supportive"),
      drugIds: strs(6, 40),
      drugClasses: strs(6, 40),
      measureIds: strs(6, 40),
      concernsDrugs: strs(6, 40),
      match: strs(10, 60),
      label: str(80),
      appropriateness: z.enum(["ideal", "acceptable", "neutral", "unnecessary", "harmful", "dangerous"]).catch("acceptable"),
      note: optStr(300),
      critique: Miss.optional().catch(undefined),
      praise: optStr(200),
    }),
    12,
  ),
  reasoning: listOf(z.object({ stage: z.enum(["History", "Examination", "Investigation", "Diagnosis"]), text: str(500) }), 4),
  rubric: z.object({
    diagnosisAccept: strs(10, 100),
    diagnosisPartial: strs(10, 100),
    diagnosisWrong: strs(10, 60).catch([]),
    differentials: strs(8, 100),
    idealTreatment: z.unknown().optional().transform((v) => (Array.isArray(v) ? v : []).map((g) => (Array.isArray(g) ? g : [g]).map(String)).filter((g) => g.length > 0).slice(0, 8)),
    expertActionCount: z.coerce.number().int().min(4).max(60).catch(14),
    followUpDays: z.object({ min: z.coerce.number(), max: z.coerce.number() }).optional().catch(undefined),
    expectsReassessment: z.boolean().catch(false),
  }),
  followUp: listOf(z.object({ when: z.enum(["ideal", "acceptable", "harmful", "untreated", "any"]).catch("any"), status: z.enum(["stable", "guarded", "deteriorating", "critical", "improving", "recovered"]).catch("stable"), lines: listOf(z.object({ role: Role, kind: Kind, text: str(400) }), 4) }), 4),
});

/** 3. Written in the background while the case is played: the teaching and the misses, for the debrief. */
export const TeachingSchema = z.object({
  teaching: z.object({
    patientBand: optStr(40),
    severityBands: listOf(z.object({ id: str(40), label: str(80), recognition: strs(6), investigation: strs(6), treatment: strs(6), followUp: strs(6) }), 5),
    drugs: listOf(z.object({ generic: str(80), brand: optStr(80), dose: str(80), route: z.enum(["PO", "IV", "IM", "SC", "SL", "PR", "TOP", "INH", "NEB", "OD-eye", "IN"]).catch("PO"), frequency: str(60), duration: str(60), indication: str(160), mechanism: str(200), whyItWorks: str(200), avoidWhen: strs(5), adverseEffects: strs(6), monitoring: strs(5) }), 6),
    routines: listOf(z.object({ label: str(80), steps: listOf(z.object({ order: z.coerce.number(), step: str(200), note: optStr(200) }), 8), avoid: strs(5).optional(), improvementTimeline: optStr(200) }), 3),
    followUp: z.object({ interval: str(60), reassess: strs(6), redFlags: strs(6), whenToEscalate: strs(6) }).catch({ interval: "", reassess: [], redFlags: [], whenToEscalate: [] }),
    treatmentFailure: z.object({ steps: strs(6) }).catch({ steps: [] }),
    pearl: str(600),
    sources: strs(4).catch([]),
  }),
  misses: z.record(z.string(), Miss).catch({}),
  strengths: z.record(z.string(), str(200)).catch({}),
});
export type TeachingPack = z.infer<typeof TeachingSchema>;

/* -------------------------------------------------------------------------- */
/* A consultant's review of each part, before the case starts                 */
/* -------------------------------------------------------------------------- */

const Appropriateness = z.enum(["ideal", "acceptable", "neutral", "unnecessary", "harmful", "dangerous"]);

/** Corrections to the findings: whole replacements for the items that were wrong (an empty table means unchanged). */
export const FindingsReviewSchema = z.object({
  fixes: listOf(
    z.object({ id: str(40), finding: optStr(600), rows: listOf(LabRow, 24), report: optStr(900), ecg: EcgMedia.optional().catch(undefined), describe: optStr(900), why: optStr(240) }),
    20,
  ),
});

/** Corrections to the management and the marking key. */
export const ManagementReviewSchema = z.object({
  fixes: listOf(z.object({ id: str(40), label: optStr(80), appropriateness: Appropriateness.optional().catch(undefined), note: optStr(300), critique: Miss.optional().catch(undefined), why: optStr(240) }), 20),
  rubric: z
    .object({
      diagnosisAccept: strs(10, 100),
      diagnosisPartial: strs(10, 100),
      differentials: strs(8, 100),
      idealTreatment: z.unknown().optional().transform((v) => (Array.isArray(v) ? v : []).map((g) => (Array.isArray(g) ? g : [g]).map(String)).filter((g) => g.length > 0).slice(0, 8)),
      followUpDays: z.object({ min: z.coerce.number(), max: z.coerce.number() }).optional().catch(undefined),
    })
    .optional()
    .catch(undefined),
});

/** Corrections to the vital signs and what the patient says. */
export const DialogueReviewSchema = z.object({
  vitals: z.record(z.string(), z.coerce.string()).optional().catch(undefined),
  fixes: listOf(z.object({ id: str(40), reply: optStr(500), fact: optStr(200), why: optStr(240) }), 16),
});

/* -------------------------------------------------------------------------- */
/* After the case: pearls and exam-style questions, checked by an examiner    */
/* -------------------------------------------------------------------------- */

const McqSchema = z
  .object({
    stem: str(1400),
    options: strs(5, 300),
    answer: z.coerce.number().int(),
    explanation: str(1600),
    topic: str(80),
    difficulty: z.enum(["easy", "medium", "hard"]).catch("medium"),
    /** Previous-year-pattern sets: which paper's pattern it follows, e.g. "NEET PG 2023 pattern". */
    pattern: optStr(60),
  })
  .refine((q) => q.options.length >= 4 && q.answer >= 0 && q.answer < q.options.length && q.stem.length >= 15);

export const LearnSchema = z.object({ pearls: strs(6, 400), mcqs: listOf(McqSchema, 6) });

const ExaminerFix = z.object({ index: z.coerce.number().int(), answer: z.coerce.number().int().optional().catch(undefined), stem: optStr(1400), options: strs(5, 300), explanation: optStr(1600), drop: z.boolean().optional().catch(undefined), why: optStr(240) });

/** The examiner's corrections: a different answer key, rewritten parts — or "drop" when a question can't be saved. */
export const ExaminerReviewSchema = z.object({
  fixes: listOf(ExaminerFix, 8),
  pearls: strs(6, 400),
});

/** Exam practice: a set of up to 12 questions, and the examiner's corrections to any of them. */
export const ExamSetSchema = z.object({ mcqs: listOf(McqSchema, 12) });
export const ExamReviewSchema = z.object({ fixes: listOf(ExaminerFix, 12), pearls: strs(6, 400) });
