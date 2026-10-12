/**
 * The OpenAI provider. The model supplies LANGUAGE; backend code supplies
 * everything else.
 *
 *   The model:  each patient, invented when the case starts — history, findings,
 *               results, ECG findings and what each picture shows · the patient's
 *               spoken replies · understanding what the doctor meant when the
 *               rules can't place it · feedback in words for the debrief.
 *   Backend:    the rules the case is played by — time, physiology, how results
 *               arrive, scoring and access control. The written case library is
 *               only a backup for when the model can't be reached, and the
 *               guided demo and the daily case stay written.
 *
 * One model only: OPENAI_MODEL (gpt-6-luna by default). When a request fails,
 * the turn falls back to the scripted reply — it never tries another model.
 *
 * Credits are spent carefully: the guided demo stays scripted; the lightest
 * reasoning setting and short replies; prompts start with what doesn't change
 * (so OpenAI's prompt caching discounts it); and every reply is saved with the
 * case, so replaying or reopening a case never asks the model again.
 * RAMAI_AI_VOICE=unscripted keeps scripted answers free and asks the model only
 * for questions the script doesn't cover.
 */
import "server-only";

import { DEFAULT_MODEL, lightReasoning } from "@/lib/server/openai-check";

import type { ClinicalCaseDefinition } from "../case-definition";
import { EXAMS, INVESTIGATIONS, MEASURES } from "../catalog";
import { COUNTRY, type Country } from "../countries";
import { FORMULARY } from "../formulary";
import { levelMeta, trackLabel } from "../levels";
import type { CareLevel, CaseTrack, MediaAsset, PatientLang, ResolvedIntent, Specialty } from "../types";
import { CARE_LEVELS, CASE_TRACKS } from "../types";
import { ALL_SPECIALTIES } from "../progression";
import { mockProvider } from "./mock";
import type { z } from "zod";

import { ConceptSchema, DialogueSchema, FeedbackSchema, FindingsSchema, ManagementSchema, PatientResponseSchema, TeachingSchema, VoiceSchema, type Concept, type GeneratedMedia } from "./openai-schema";
import type { ClinicalProvider, CoachFeedback, FeedbackInput, InterpretContext, Interpretation, StartOptions } from "./types";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

class UpstreamError extends Error {}

export function openAIConfig() {
  return {
    key: process.env.OPENAI_API_KEY ?? "",
    model: process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL,
    baseUrl: (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
    timeoutMs: Number(process.env.RAMAI_ENGINE_TIMEOUT_MS || 30000),
    /** "all": the model words every patient reply. "unscripted": only questions the script doesn't cover. */
    voice: process.env.RAMAI_AI_VOICE === "unscripted" ? ("unscripted" as const) : ("all" as const),
  };
}

/** One request to the configured model. `careful` allows a little reasoning; otherwise the lightest setting. */
async function chatJSON(messages: ChatMessage[], maxTokens: number, careful = false, timeout?: number): Promise<unknown> {
  const { key, model, baseUrl } = openAIConfig();
  const timeoutMs = timeout ?? openAIConfig().timeoutMs;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const effort = careful ? (/^gpt-6/.test(model) ? { reasoning_effort: "low" } : lightReasoning(model)) : lightReasoning(model);
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages, response_format: { type: "json_object" }, max_completion_tokens: maxTokens, ...effort }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: { code?: string } };
      throw new UpstreamError(`OpenAI responded ${res.status}${err.error?.code ? ` (${err.error.code})` : ""}`);
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new UpstreamError("Empty completion");
    return JSON.parse(content);
  } finally {
    clearTimeout(timer);
  }
}

/* -------------------------------------------------------------------------- */
/* Prompts — what never changes first, so OpenAI's prompt caching can reuse it */
/* -------------------------------------------------------------------------- */

const IDIOM: Record<Country, string> = { IN: "Indian English", US: "American English", UK: "British English" };
const WHERE: Record<Country, string> = { IN: "India", US: "the USA", UK: "the UK" };
const language = (country: Country = "IN", lang: PatientLang = "en") =>
  lang === "hinglish" ? "Hinglish — everyday Hindi written in Roman letters, mixed with common English words, as people speak in North India" : `natural ${IDIOM[country]}`;

const simulationRules = (country: Country = "IN") => `You are the hidden clinical environment of RamAI, an educational clinical-decision game for doctors in ${WHERE[country]}.
Absolute rules while a case is active:
- Never reveal or hint at the diagnosis, differential, severity, hidden findings, future complications, scoring or ideal treatment.
- Never coach. No "you may want to…", "this could suggest…", "consider…", "the next step is…".
- The patient speaks as a lay person from the stated background (${IDIOM[country]}, natural, brief). They answer only what was asked.
- Positive findings must come only from the case file. If the case file does not mention something, the honest answer is a plausible negative.
- Output JSON only.`;

/** For a question the rules couldn't place: what did the doctor mean, and (if it was a question) what does the patient say? */
function interpretPrompt(def: ClinicalCaseDefinition, clause: string, country?: Country, lang?: PatientLang): ChatMessage[] {
  const history = def.history.map((h) => `${h.id} | ${h.label} | patient says: ${h.reply}`).join("\n");
  const exams = [...def.exam.map((e) => `${e.id} | ${e.label}`), ...EXAMS.map((e) => `${e.id} | ${e.label}`)].join("\n");
  const invs = [...def.investigations.map((i) => i.id), ...INVESTIGATIONS.map((i) => i.id)].join(", ");
  const measures = MEASURES.map((m) => m.id).join(", ");
  const rules = def.therapeutics.map((r) => `${r.id} (${r.kind}: ${r.label})`).join(", ");
  return [
    { role: "system", content: simulationRules(country) },
    {
      role: "user",
      content: `CASE FILE (hidden)
Patient: ${def.patient.age}-year-old ${def.patient.sex}, ${def.patient.city}${def.patient.occupation ? `, ${def.patient.occupation}` : ""}.
Diagnosis (never reveal): ${def.truth.diagnosis}.

History entries (id | topic | what the patient says):
${history}

Examinations (id | label):
${exams}

Investigation ids: ${invs}
Supportive measure ids (use as "measure:<id>"): ${measures}
Case therapeutic rule ids: ${rules}
Formulary drug ids: ${FORMULARY.map((d) => d.id).join(", ")}

Return JSON:
{"type":"patient_response","speaker":"patient|attendant|nurse","message":"<the reply spoken in the room — see below>","new_information":[],"intents":[{"kind":"history|vitals|exam|investigation|drug|action|followup|wait|reassess|diagnosis|differential|close|results|unknown","targetId":"<id from the lists above>","phrase":"<the doctor's words>","payload":{}}]}
Use kind "results" when the doctor asks about the results of tests already sent.
Map to existing ids whenever the meaning matches — the game answers those itself.
For history questions with no matching entry, use kind "history", targetId "generated", speaker "patient" (or "attendant" if the doctor spoke to the relative), and put the reply in "message", in ${language(country, lang)}.
For anything else no id covers — a remark, reassurance, small talk, a request the ward can't carry out, or words that are unclear — use kind "unknown" and always write "message": the brief, natural reply of whoever would answer. The patient or relative answers if the doctor spoke to them (in ${language(country, lang)}); otherwise the nurse answers (speaker "nurse", plain English, one or two short sentences). The nurse never says that a test, drug, procedure or referral has been done or given, never states a finding or result, and never suggests what to do next. If it can't be done here, the nurse says so plainly; if the words are unclear, the nurse asks briefly what exactly the doctor wants.

The doctor said: """${clause}"""`,
    },
  ];
}

interface VoiceItem {
  speaker: "patient" | "attendant";
  facts: string;
}

/** Word the replies the engine has decided on: the facts are fixed; only the voice is the model's. */
function voicePrompt(def: ClinicalCaseDefinition, items: VoiceItem[], said: string, ctx: InterpretContext): ChatMessage[] {
  const p = def.patient;
  const recent = ctx.transcript
    .filter((m) => m.role === "doctor" || m.role === "patient" || m.role === "attendant")
    .slice(-6)
    .map((m) => `${m.role === "doctor" ? "Doctor" : m.role === "attendant" ? "Relative" : "Patient"}: ${m.text}`)
    .join("\n");
  return [
    {
      role: "system",
      content: `You voice patients and their relatives in RamAI, an educational clinical simulation for doctors in ${WHERE[ctx.country ?? "IN"]}.
Rules:
- Speak as a lay person, briefly (one to three sentences per reply), warmly and naturally, in ${language(ctx.country, ctx.lang)}.
- Convey exactly the facts given for each reply: no new symptoms, numbers, findings or history, and nothing left out that matters.
- Never name a diagnosis, never give medical advice, never hint at what the doctor should do.
- The patient speaks in the first person; a relative speaks about the patient ("he", "she"). Call the doctor "doctor" now and then.
- Match how unwell the patient is right now.
- Output JSON only: {"replies":["…"]} — exactly one reply per question, in order.`,
    },
    {
      role: "user",
      content: `Patient: ${p.age}-year-old ${p.sex}${p.occupation ? `, ${p.occupation}` : ""}, ${p.city}.
Scene: ${def.briefing}
How the patient is now: ${ctx.hidden.status}.
${recent ? `Recent conversation:\n${recent}\n` : ""}
The doctor said: """${said}"""

${items.map((it, i) => `Reply ${i + 1} — spoken by ${it.speaker === "attendant" ? "the relative with the patient" : "the patient"}. Facts: ${it.facts}`).join("\n")}`,
    },
  ];
}

function feedbackPrompt({ def, transcript, debrief }: FeedbackInput): ChatMessage[] {
  const clock = (at: number) => `${Math.floor(at)} min`;
  const actions = transcript
    .filter((m) => m.role === "doctor")
    .slice(0, 60)
    .map((m) => `${clock(m.at)}: ${m.text}`)
    .join("\n");
  const lines = debrief.score.lines.map((l) => `${l.label}: ${l.earned}/${l.max}${l.lost?.length ? ` — ${l.lost.join(" ")}` : ""}`).join("\n");
  const missed = debrief.missed.map((m) => `- ${m.what} (${m.severity}) ${m.why}`).join("\n");
  return [
    {
      role: "system",
      content: `You are a senior clinician giving brief, specific, encouraging feedback to a doctor who has just finished a simulated case in RamAI, an educational game.
Rules:
- The score has already been decided by fixed marking rules. Never change it, re-score it, or contradict it.
- Comment on their clinical reasoning: what they prioritised, the order of their steps, what they missed and why it matters for this patient.
- Be specific to what they actually did. Plain language, no markdown, no headings.
- Output JSON only: {"summary":"two or three sentences on how it went","reasoning":"two or three sentences on their clinical reasoning","nextTime":["two to four short, concrete tips"]}`,
    },
    {
      role: "user",
      content: `The case: ${def.patient.age}-year-old ${def.patient.sex}. ${def.briefing}
Diagnosis: ${def.truth.diagnosis}${def.truth.qualifier ? ` — ${def.truth.qualifier}` : ""}.
Teaching point: ${def.teaching.pearl}

What the doctor did:
${actions || "(nothing recorded)"}

Their diagnosis: ${debrief.userDiagnosis ?? "not stated"} (${debrief.verdict}). Outcome: ${debrief.finalStatus}.
Score ${debrief.score.total}/${debrief.score.max}, from the marking rules:
${lines}
${missed ? `Missed:\n${missed}` : "Nothing significant missed."}
${debrief.didWell.length ? `Done well: ${debrief.didWell.join("; ")}` : ""}`,
    },
  ];
}

/* -------------------------------------------------------------------------- */
/* Inventing a patient: a quick outline, then three parts written in parallel  */
/* -------------------------------------------------------------------------- */

/** The whole invention must finish inside the request's minute; past this, the written backup is used. */
const OUTLINE_TIMEOUT_MS = 16_000;
const PART_TIMEOUT_MS = 32_000;

const pickOne = <T>(xs: readonly T[], random = Math.random): T => xs[Math.floor(random() * xs.length)]!;

/** What to ask for: the player's choices, and otherwise a varied mix — a new kind of patient each time. */
function caseBrief(opts: StartOptions) {
  const track: CaseTrack = opts.track ?? (opts.easy ? "opd" : pickOne(["opd", "opd", "opd", "emergency", "emergency", "phone"] as const));
  const levels = (opts.allowedLevels ?? CARE_LEVELS).filter((l) => !opts.easy || l === "phc" || l === "chc");
  const level: CareLevel = opts.level ?? pickOne(levels.length ? levels : (opts.allowedLevels ?? CARE_LEVELS));
  const common: Specialty[] = ["Medicine", "Medicine", "Dermatology", "Dermatology", "Surgery", "Pediatrics", "OBGYN", "Cardiology", "Respiratory", "Gastroenterology", "Infectious Disease", "Infectious Disease", "Endocrinology", "Neurology", "ENT", "Ophthalmology", "Orthopedics", "Nephrology", "Urology", "Psychiatry"];
  const specialty: Specialty = opts.specialty ?? (track === "emergency" ? pickOne(["Emergency", "Medicine", "Surgery", "Cardiology", "Pediatrics", "Infectious Disease"] as Specialty[]) : pickOne(common));
  const sex = specialty === "OBGYN" ? "Female" : pickOne(["Male", "Female"] as const);
  const age = specialty === "Pediatrics" ? pickOne(["an infant", "a toddler", "a school-age child", "an adolescent"]) : pickOne(["a young adult", "an adult in their 30s or 40s", "a middle-aged adult", "an older adult"]);
  return { track, level, specialty, sex, age };
}
type Brief = ReturnType<typeof caseBrief>;

const authoring = (country: Country) => {
  const c = COUNTRY[country];
  return `${simulationRules(country)}
You author realistic, guideline-accurate clinical cases for ${c.name}. Patients are fictional and culturally realistic, never stereotyped; places, food, drug brands and services are local (the ambulance number is ${c.emergency}). Lab values in conventional units (mg/dL, g/dL, °F); costs in Indian rupees (the app converts them).`;
};

function outlinePrompt(opts: StartOptions, brief: Brief): ChatMessage[] {
  const country = COUNTRY[opts.country ?? "IN"];
  const level = levelMeta(brief.level, country.id);
  const difficulty = opts.easy ? "1 — EASY: a common, classic presentation with clear findings and a straightforward plan, for a doctor's first cases" : "matched to the setting (1 easy, 2 moderate, 3 hard)";
  return [
    { role: "system", content: authoring(country.id) },
    {
      role: "user",
      content: `Outline one case in ${brief.specialty} for ${level.label} — ${level.description} — in ${country.name}. Mode: ${trackLabel(brief.track, country.id)}. The patient is ${brief.age}, ${brief.sex.toLowerCase()}. Difficulty: ${difficulty}. ${opts.easy ? "Choose one of the most common conditions seen in this setting, with a classic presentation." : "Choose a realistic condition that fits; vary it — not always the most common one."}
Return compact JSON — short phrases, not sentences: { "specialty", "difficulty": 1|2|3, "patient": { "name", "age", "sex": "Male"|"Female", "city", "occupation" }, "briefing": "one non-diagnostic line setting the scene", "diagnosis", "qualifier": "cause, severity, key context", "keyHistory": ["up to 8: what the patient will report — positives and important negatives"], "keyExam": ["up to 6 signs present"], "keyResults": ["up to 6 abnormal results, with values"], "pictures": ["each finding a doctor would look at as a picture, e.g. 'exam: rash on both shins (photo)', 'test: chest X-ray PA'"], "ecg": "ECG findings if an ECG is relevant", "differentials": ["3–5"], "plan": ["up to 6 management steps"] }`,
    },
  ];
}

const partHead = (concept: Concept, brief: Brief) =>
  `THE CASE (every part must agree with it):\n${JSON.stringify({ ...concept, setting: brief.track === "phone" ? "Teleconsult" : brief.track === "emergency" ? "ER" : "OPD" })}\n\n`;

function dialoguePrompt(opts: StartOptions, concept: Concept, brief: Brief): ChatMessage[] {
  return [
    { role: "system", content: authoring(opts.country ?? "IN") },
    {
      role: "user",
      content: `${partHead(concept, brief)}Write what the patient and family say, and the vital signs. Return JSON:
{ "opening": [{ "role": "patient"|"attendant"|"nurse"|"system", "kind": "speech"|"action"|"status", "text" }] (1–3 lines: how the patient arrives and their first words — no diagnosis),
  "baselineVitals": { "bp": "128/82", "hr": "88", "rr", "temp" (°F), "spo2", "rbs", "weight", "height", "gcs"?, "pain"? },
  "triageVitals": ["vitals already on the board on arrival"],
  "profile": { "allergies": [], "currentDrugs": [], "pregnancyPossible"?, "asthma"?, "ckd"?, "heartFailure"? },
  "history": [{ "id": "short_snake_case", "group": "complaint"|"hpi"|"past"|"medication"|"allergy"|"family"|"social"|"diet"|"sexual"|"obstetric"|"systemic", "label", "match": ["3–8 short lowercase phrases a doctor might type"], "reply": "what the patient says, lay words", "fact": "the fact in clinical shorthand", "abnormal"?, "importance": "essential"|"useful"|"minor", "speaker"?: "attendant" }] }
history: 8–12 entries — the presenting complaint, its course, relevant positives and negatives, past history, medicines and allergies. Every positive in the case must be here.`,
    },
  ];
}

function findingsPrompt(opts: StartOptions, concept: Concept, brief: Brief): ChatMessage[] {
  return [
    { role: "system", content: authoring(opts.country ?? "IN") },
    {
      role: "user",
      content: `${partHead(concept, brief)}Write what the doctor finds. Return JSON:
{ "exam": [{ "id", "group": "general-exam"|"systemic-exam"|"local-exam", "label", "match": [], "finding": "what is seen, felt and heard, objectively", "fact", "abnormal"?, "importance", "media"? }],
  "investigations": [{ "id", "name", "short", "category": "lab"|"bedside"|"ecg"|"imaging"|"photo"|"micro"|"histopath"|"function", "match": ["phrases a doctor might type"], "cost" (INR), "rows"?: [{ "analyte", "value", "unit", "reference", "flag": "normal"|"low"|"high"|"critical" }], "report"?: "findings only — never an impression or diagnosis", "media"?, "priority": "essential"|"useful"|"situational"|"unnecessary", "teaching": { "whenToOrder", "whatItTellsYou" } }] }
media = { "spec": { …ECG or PICTURE fields… }, "alt": "what it is a picture of, without interpreting it", "caption": "acquisition details only, e.g. 'PA erect', 'Left cheek · close-up'" }
  e.g. "media": { "spec": { "kind": "picture", "type": "xray", "view": "PA erect", "describe": "…" }, "alt": "Chest radiograph, PA view", "caption": "PA erect" }
  ECG = { "kind": "ecg", "rate", "rhythm": "sinus"|"afib"|"aflutter"|"svt"|"vt"|"paced"|"junctional", "morphology"?: { "st"?: {"lead": mm, + = elevation}, "t"?: {"lead": multiplier, negative inverts}, "q"?: {"lead": mm}, "qrsScale"?: {"lead": multiplier}, "pr"?, "qrs"?, "qt"? (ms), "pWaves"?, "peakedT"? } } — leads I II III aVR aVL aVF V1–V6; the site draws it accurately from these numbers.
  PICTURE = { "kind": "picture", "type": "photo"|"xray"|"ct"|"mri"|"usg"|"fundus"|"endoscopy"|"slide", "view", "describe": "a precise, medically accurate visual description for an image generator — the view or projection, the anatomical site, the patient's skin tone (Fitzpatrick type) for photos, and every visible abnormality with its size, number, colour, shape, distribution, side and extent" }
exam: 3–7 entries; use these ids where they fit: ${EXAMS.map((e) => e.id).join(", ")}. A visible skin, wound, eye or mouth finding gets a photo (never photograph the genitals or breasts — describe those in words).
investigations: 6–9, with real results — abnormal where the disease makes them so, plus a few relevant normal ones; use these ids where they fit: ${INVESTIGATIONS.map((i) => i.id).join(", ")}. X-ray, CT, MRI, ultrasound and fundus results get their picture; an ECG gets ECG media.
Be concise: lab rows only for the analytes that matter (at most 10 per test); reports in one to three sentences; teaching in one sentence each.`,
    },
  ];
}

function managementPrompt(opts: StartOptions, concept: Concept, brief: Brief): ChatMessage[] {
  return [
    { role: "system", content: authoring(opts.country ?? "IN") },
    {
      role: "user",
      content: `${partHead(concept, brief)}Write the management and the marking key. Return JSON:
{ "therapeutics": [{ "id", "kind": "drug"|"procedure"|"counsel"|"referral"|"admit"|"discharge"|"supportive", "drugIds"?, "drugClasses"?, "measureIds"?, "concernsDrugs"?, "match"?: ["phrases a doctor might type"], "label", "appropriateness": "ideal"|"acceptable"|"neutral"|"unnecessary"|"harmful"|"dangerous", "note"?, "critique"?: { "what", "why", "better", "severity": "minor"|"moderate"|"major" }, "praise"? }],
  "reasoning": [{ "stage": "History", "text" }, { "stage": "Examination", "text" }, { "stage": "Investigation", "text" }, { "stage": "Diagnosis", "text" }],
  "rubric": { "diagnosisAccept": ["names and synonyms that count as correct"], "diagnosisPartial": [], "differentials": [], "idealTreatment": [["therapeutic ids, any one of which satisfies this step"], …], "expertActionCount", "followUpDays"?: { "min", "max" }, "expectsReassessment" },
  "followUp": [{ "when": "ideal"|"acceptable"|"harmful"|"untreated"|"any", "status": "recovered"|"improving"|"stable"|"guarded"|"deteriorating"|"critical", "lines": [{ "role", "kind", "text" }] }] }
therapeutics: 5–10 — the right treatments and common wrong or harmful ones. drugIds only from: ${FORMULARY.map((d) => d.id).join(", ")}. measureIds only from: ${MEASURES.map((m) => m.id).join(", ")}.`,
    },
  ];
}

/** Turns a picture into a reference the browser can ask for; what it shows stays with the case on the server. */
function mediaOf(m: GeneratedMedia | undefined, pictures: NonNullable<ClinicalCaseDefinition["pictures"]>): MediaAsset | undefined {
  if (!m) return undefined;
  const spec = m.spec;
  if (spec.kind === "ecg") {
    return { spec: { kind: "ecg", rate: spec.rate, rhythm: spec.rhythm, ...(spec.morphology ? { morphology: spec.morphology } : {}) }, alt: m.alt, caption: m.caption ?? "12-lead · 25 mm/s · 10 mm/mV" };
  }
  const ref = `p${Object.keys(pictures).length + 1}`;
  pictures[ref] = { type: spec.type, view: spec.view, describe: spec.describe };
  return { ai: { ref, type: spec.type, view: spec.view }, alt: m.alt, ...(m.caption ? { caption: m.caption } : {}) };
}

const DRUG_IDS = new Set(FORMULARY.map((d) => d.id));
const MEASURE_IDS = new Set(MEASURES.map((m) => m.id));
/** The debrief's teaching arrives later (written in the background); until then, an empty frame. */
const NO_TEACHING: ClinicalCaseDefinition["teaching"] = { severityBands: [], treatmentByBand: {}, drugs: [], routines: [], followUp: { interval: "", reassess: [], redFlags: [], whenToEscalate: [] }, treatmentFailure: { steps: [] }, pearl: "" } as unknown as ClinicalCaseDefinition["teaching"];

function toDefinition(concept: Concept, d: z.infer<typeof DialogueSchema>, f: z.infer<typeof FindingsSchema>, m: z.infer<typeof ManagementSchema>, brief: Brief, opts: StartOptions): ClinicalCaseDefinition {
  const pictures: NonNullable<ClinicalCaseDefinition["pictures"]> = {};
  const unique = <T extends { id: string }>(xs: T[]) => xs.filter((x, i) => x.id && xs.findIndex((y) => y.id === x.id) === i);
  const therapeutics = unique(m.therapeutics).map((t) => ({ ...t, drugIds: t.drugIds.filter((x) => DRUG_IDS.has(x)), measureIds: t.measureIds.filter((x) => MEASURE_IDS.has(x)) }));
  const known = new Set(therapeutics.map((t) => t.id));
  return {
    id: `gen-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    pictures,
    specialty: concept.specialty,
    track: brief.track,
    level: brief.level,
    setting: brief.track === "phone" ? "Teleconsult" : brief.track === "emergency" ? "ER" : "OPD",
    weight: 1,
    difficulty: (opts.easy ? 1 : concept.difficulty) as 1 | 2 | 3,
    ...(opts.country ? { countries: [opts.country] } : {}),
    patient: { name: concept.patient.name, age: concept.patient.age, sex: concept.patient.sex, city: concept.patient.city, occupation: concept.patient.occupation, context: brief.track === "emergency" ? "Emergency" : brief.track === "phone" ? "Phone" : "OPD" } as ClinicalCaseDefinition["patient"],
    arrivalMinuteOfDay: 8 * 60 + Math.floor(Math.random() * 10 * 60),
    briefing: concept.briefing,
    opening: (d.opening.length ? d.opening : [{ role: "patient", kind: "speech", text: "Namaste, doctor." }]) as ClinicalCaseDefinition["opening"],
    baselineVitals: Object.fromEntries(Object.entries({ bp: "122/78", hr: "84", rr: "16", temp: "98.4", spo2: "98", weight: "62", ...d.baselineVitals }).map(([k, v]) => [k, { key: k, value: v }])) as ClinicalCaseDefinition["baselineVitals"],
    triageVitals: d.triageVitals as ClinicalCaseDefinition["triageVitals"],
    profile: d.profile,
    history: unique(d.history).filter((h) => h.match.length > 0) as ClinicalCaseDefinition["history"],
    exam: unique(f.exam).map((e) => ({ ...e, media: mediaOf(e.media, pictures) })) as ClinicalCaseDefinition["exam"],
    investigations: unique(f.investigations).map((i) => ({ ...i, rows: i.rows.length ? i.rows : undefined, media: mediaOf(i.media, pictures) })) as ClinicalCaseDefinition["investigations"],
    // Only drugs and measures the engine knows: anything else could never be matched.
    therapeutics: therapeutics as ClinicalCaseDefinition["therapeutics"],
    hazards: [],
    followUp: m.followUp as ClinicalCaseDefinition["followUp"],
    truth: {
      diagnosis: concept.diagnosis,
      qualifier: concept.qualifier,
      reasoning: (["History", "Examination", "Investigation", "Diagnosis"] as const).map((stage) => ({ stage, text: m.reasoning.find((r) => r.stage === stage)?.text ?? "" })),
    },
    rubric: {
      diagnosisAccept: m.rubric.diagnosisAccept.length ? m.rubric.diagnosisAccept : [concept.diagnosis],
      diagnosisPartial: m.rubric.diagnosisPartial,
      differentials: m.rubric.differentials.length ? m.rubric.differentials : concept.differentials,
      idealTreatment: m.rubric.idealTreatment.map((g) => g.filter((id) => known.has(id))).filter((g) => g.length > 0),
      expertActionCount: m.rubric.expertActionCount,
      followUpDays: m.rubric.followUpDays,
      expectsReassessment: m.rubric.expectsReassessment,
      misses: {},
      strengths: {},
    } as ClinicalCaseDefinition["rubric"],
    teaching: NO_TEACHING,
  };
}

/** The debrief's teaching and misses, for an invented case — written while it's being played. */
function teachingPrompt(def: ClinicalCaseDefinition): ChatMessage[] {
  const items = [
    ...def.history.map((h) => `${h.id} (history: ${h.label}, ${h.importance})`),
    ...def.exam.map((e) => `${e.id} (exam: ${e.label}, ${e.importance})`),
    ...def.investigations.map((i) => `${i.id} (test: ${i.name ?? i.id}, ${i.priority})`),
    ...def.therapeutics.map((t) => `${t.id} (treatment: ${t.label}, ${t.appropriateness})`),
  ];
  return [
    { role: "system", content: "You write concise, guideline-accurate teaching for a clinical simulation's debrief (shown only after the case). Output JSON only." },
    {
      role: "user",
      content: `Case: ${def.patient.age}-year-old ${def.patient.sex}. ${def.briefing}
Diagnosis: ${def.truth.diagnosis}${def.truth.qualifier ? ` — ${def.truth.qualifier}` : ""}.
Items in the case (id, what, importance): ${items.join("; ")}

Return JSON:
{ "teaching": { "patientBand": "the id of this patient's severity band", "severityBands": [{ "id", "label", "recognition": [], "investigation": [], "treatment": [], "followUp": [] }] (2–4 bands), "drugs": [{ "generic", "brand", "dose", "route": "PO"|"IV"|"IM"|"SC"|"SL"|"PR"|"TOP"|"INH"|"NEB"|"IN", "frequency", "duration", "indication", "mechanism", "whyItWorks", "avoidWhen": [], "adverseEffects": [], "monitoring": [] }] (1–4), "routines": [], "followUp": { "interval", "reassess": [], "redFlags": [], "whenToEscalate": [] }, "treatmentFailure": { "steps": [] }, "pearl": "one memorable teaching point" },
  "misses": { "<id of an essential or useful item>": { "what": "what the doctor didn't do", "why": "why it matters here", "better": "the better approach", "severity": "minor"|"moderate"|"major" } },
  "strengths": { "<id>": "what doing it well shows" } }
misses and strengths: one for each essential item and the most useful ones; keys must be ids from the list.`,
    },
  ];
}

/* -------------------------------------------------------------------------- */
/* Provider                                                                    */
/* -------------------------------------------------------------------------- */

/** The rules couldn't place it: ask the model what the doctor meant. */
async function understand(text: string, ctx: InterpretContext, ruled: ResolvedIntent[]): Promise<Interpretation> {
  try {
    const raw = await chatJSON(interpretPrompt(ctx.def, text, ctx.country, ctx.lang), 800, true);
    const parsed = PatientResponseSchema.safeParse(raw);
    if (!parsed.success) return { intents: ruled };
    const { message, speaker } = parsed.data;
    const intents: ResolvedIntent[] = [];
    const generated: Record<string, string> = {};
    // The one reply goes to the first intent that needs words: a question the case file doesn't cover, or anything no id covers.
    const say = (index: number) => {
      if (!message || Object.keys(generated).length > 0) return false;
      generated[String(index)] = message;
      return true;
    };
    for (const i of parsed.data.intents) {
      const intent: ResolvedIntent = { kind: i.kind, targetId: i.targetId, phrase: i.phrase || text, matched: i.kind !== "unknown", payload: i.payload };
      if (i.kind === "history" && (!i.targetId || i.targetId === "generated" || !ctx.def.history.some((h) => h.id === i.targetId))) {
        intent.targetId = "generated";
        if (say(intents.length) && speaker === "attendant") intent.payload = { ...i.payload, speaker };
      }
      if (i.kind === "unknown" && say(intents.length)) intent.payload = { ...i.payload, speaker: speaker ?? "nurse" };
      intents.push(intent);
    }
    if (intents.length === 0 && message) {
      intents.push(
        speaker === "nurse"
          ? { kind: "unknown", phrase: text, matched: false, payload: { speaker } }
          : { kind: "history", targetId: "generated", phrase: text, matched: true, ...(speaker === "attendant" ? { payload: { speaker } } : {}) },
      );
      generated["0"] = message;
    }
    return intents.length ? { intents, generated } : { intents: ruled };
  } catch (err) {
    console.error("[ramai] interpretation fell back to rules", err instanceof Error ? err.message : err);
    return { intents: ruled };
  }
}

/** The rules placed it: have the model word the replies the case file gives. */
async function voice(text: string, ctx: InterpretContext, ruled: ResolvedIntent[]): Promise<Interpretation> {
  const items = ruled
    .map((intent, index) => ({ index, entry: intent.kind === "history" ? ctx.def.history.find((h) => h.id === intent.targetId) : undefined }))
    .filter((x): x is { index: number; entry: NonNullable<typeof x.entry> } => !!x.entry);
  if (items.length === 0) return { intents: ruled };
  try {
    const raw = await chatJSON(
      voicePrompt(ctx.def, items.map((x) => ({ speaker: x.entry.speaker === "attendant" ? "attendant" : "patient", facts: x.entry.reply })), text, ctx),
      120 + 120 * items.length,
    );
    const parsed = VoiceSchema.safeParse(raw);
    if (!parsed.success || parsed.data.replies.length !== items.length) return { intents: ruled };
    const generated: Record<string, string> = {};
    items.forEach((x, k) => {
      const reply = parsed.data.replies[k]?.trim();
      if (reply) generated[String(x.index)] = reply;
    });
    return { intents: ruled, generated };
  } catch (err) {
    console.error("[ramai] patient voice fell back to the script", err instanceof Error ? err.message : err);
    return { intents: ruled };
  }
}

export function createOpenAIProvider(): ClinicalProvider {
  return {
    id: "openai",

    /** A new patient, invented now. If the model can't (offline, slow, no credit, a file that fails its checks), a written case is the backup. */
    async createCase(opts) {
      // Every real case is invented now (RAMAI_AI_CASES=0 turns it off: written cases only).
      if (process.env.RAMAI_AI_CASES === "0") return mockProvider.createCase(opts);
      const brief = caseBrief(opts);
      try {
        const outline = ConceptSchema.safeParse(await chatJSON(outlinePrompt(opts, brief), 900, false, OUTLINE_TIMEOUT_MS));
        if (!outline.success || !outline.data.diagnosis) throw new UpstreamError("the outline failed its checks");
        const concept = outline.data;
        const [d, f, m] = await Promise.all([
          chatJSON(dialoguePrompt(opts, concept, brief), 2600, false, PART_TIMEOUT_MS).then((x) => DialogueSchema.parse(x)),
          chatJSON(findingsPrompt(opts, concept, brief), 4600, false, PART_TIMEOUT_MS).then((x) => FindingsSchema.parse(x)),
          chatJSON(managementPrompt(opts, concept, brief), 2400, false, PART_TIMEOUT_MS).then((x) => ManagementSchema.parse(x)),
        ]);
        if (d.history.length < 4 || f.exam.length < 1 || m.therapeutics.length < 2) {
          throw new UpstreamError(`a part came back too thin (history ${d.history.length}, exam ${f.exam.length}, treatments ${m.therapeutics.length})`);
        }
        return { kind: "generated", def: toDefinition(concept, d, f, m, brief, opts) };
      } catch (err) {
        console.error("[ramai] couldn't invent a patient; using a written case", err instanceof Error ? err.message : err);
        return mockProvider.createCase(opts);
      }
    },

    async teach(def) {
      try {
        const parsed = TeachingSchema.safeParse(await chatJSON(teachingPrompt(def), 3000, false, 45_000));
        return parsed.success ? parsed.data : undefined;
      } catch (err) {
        console.error("[ramai] teaching unavailable", err instanceof Error ? err.message : err);
        return undefined;
      }
    },
    resolveCase: (src) => mockProvider.resolveCase(src),
    /** Any specialty, mode or level can be invented. */
    async availability() {
      const all = <K extends string>(keys: readonly K[]) => Object.fromEntries(keys.map((k) => [k, 999])) as Partial<Record<K, number>>;
      return { specialties: all(ALL_SPECIALTIES), tracks: all(CASE_TRACKS), levels: all(CARE_LEVELS) };
    },

    async interpret(text, ctx): Promise<Interpretation> {
      // Rules first: instant and free. What they can't place, the model answers — in the guided demo too.
      const ruled = (await mockProvider.interpret(text, ctx)).intents;
      const unresolved = ruled.some((i) => (i.kind === "unknown" && !i.payload?.empty) || (i.kind === "history" && i.targetId?.startsWith("fallback:")));
      if (unresolved) return understand(text, ctx, ruled);
      // The demo's scripted replies stay as written.
      if (ctx.def.guided) return { intents: ruled };
      if (openAIConfig().voice === "all") return voice(text, ctx, ruled);
      return { intents: ruled };
    },

    async feedback(input): Promise<CoachFeedback | undefined> {
      if (input.def.guided) return undefined;
      try {
        const raw = await chatJSON(feedbackPrompt(input), 900, true);
        const parsed = FeedbackSchema.safeParse(raw);
        if (!parsed.success) return undefined;
        return { ...parsed.data, model: openAIConfig().model };
      } catch (err) {
        console.error("[ramai] debrief feedback unavailable", err instanceof Error ? err.message : err);
        return undefined;
      }
    },
  };
}

