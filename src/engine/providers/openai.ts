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
 *               only a backup for when the model can't be reached.
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
import { FeedbackSchema, GeneratedCaseSchema, PatientResponseSchema, VoiceSchema, type GeneratedCase, type GeneratedMedia } from "./openai-schema";
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
{"type":"patient_response","message":"<what the patient says, if the doctor addressed the patient; otherwise empty>","new_information":[],"intents":[{"kind":"history|vitals|exam|investigation|drug|action|followup|wait|reassess|diagnosis|differential|close|results|unknown","targetId":"<id from the lists above>","phrase":"<the doctor's words>","payload":{}}]}
Use kind "results" when the doctor asks about the results of tests already sent.
Map to existing ids whenever the meaning matches. For history questions with no matching entry, use kind "history", targetId "generated", and put the patient's reply in "message", in ${language(country, lang)}.

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
/* Inventing a patient                                                         */
/* -------------------------------------------------------------------------- */

/** How long a new patient may take to invent before the written backup is used (the request itself may run 60 s). */
const GENERATION_TIMEOUT_MS = 48_000;

const GENERATED_CASE_SHAPE = `{ specialty, setting: "OPD"|"ER"|"IPD"|"ICU"|"Ward"|"Teleconsult", difficulty: 1|2|3,
  patient: { name?, age, sex: "Male"|"Female", city, occupation?, context? }, arrivalMinuteOfDay, briefing,
  opening: [{ role, kind, text, media? }], baselineVitals: { bp: "158/96", hr: "88", rr, temp (°F), spo2, rbs, weight, height, gcs?, pain? },
  triageVitals?: VitalKey[], profile: { allergies?, currentDrugs?, pregnancyPossible?, asthma?, ckd?, heartFailure?, thrombocytopenia? },
  history: [{ id, group, label, match: string[], reply, fact?, abnormal?, importance: "essential"|"useful"|"minor", speaker?: "patient"|"attendant" }],
  exam: [{ id, group: "general-exam"|"systemic-exam"|"local-exam", label, match: string[], finding, fact?, abnormal?, importance, patientReaction?, media? }],
  investigations: [{ id, name?, short?, category?, match?, turnaroundMin?, cost?, rows?: [{ analyte, value, unit?, reference?, flag: "normal"|"low"|"high"|"critical" }], report?, media?, priority: "essential"|"useful"|"situational"|"unnecessary", teaching: { whenToOrder, whatItTellsYou } }],
  therapeutics: [{ id, kind: "drug"|"procedure"|"counsel"|"referral"|"admit"|"discharge"|"supportive", drugIds?, drugClasses?, measureIds?, concernsDrugs?, match?, label, appropriateness: "ideal"|"acceptable"|"neutral"|"unnecessary"|"harmful"|"dangerous", note?, critique?: { what, why, better, severity }, praise? }],
  truth: { diagnosis, qualifier?, reasoning: [{stage:"History",text},{stage:"Examination",text},{stage:"Investigation",text},{stage:"Diagnosis",text}] },
  rubric: { diagnosisAccept: string[], diagnosisPartial: string[], differentials: string[], idealTreatment: string[][], expertActionCount, followUpDays?: { min, max }, expectsReassessment, misses: Record<id, { what, why, better, severity }>, strengths: Record<id, string> },
  followUp: [{ when: "ideal"|"acceptable"|"harmful"|"untreated"|"any", status, lines: [{ role, kind, text }] }],
  teaching: { patientBand?, severityBands: [{ id, label, recognition[], investigation[], treatment[], followUp[] }], drugs: [{ generic, brand, dose, route, frequency, duration, indication, mechanism, whyItWorks, avoidWhen[], adverseEffects[], monitoring[] }], routines: [], followUp: { interval, reassess[], redFlags[], whenToEscalate[] }, treatmentFailure: { steps[] }, pearl } }
media = { spec: ECG | PICTURE, alt, caption? }
  ECG = { kind: "ecg", rate, rhythm: "sinus"|"afib"|"aflutter"|"svt"|"vt"|"paced"|"junctional", morphology?: { st?: {lead: mm}, t?: {lead: multiplier}, q?: {lead: mm}, qrsScale?: {lead: multiplier}, pr?, qrs?, qt? (ms), pWaves?, peakedT? } }  leads: I II III aVR aVL aVF V1–V6
  PICTURE = { kind: "picture", type: "photo"|"xray"|"ct"|"mri"|"usg"|"fundus"|"endoscopy"|"slide", view, describe }`;

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

function generationPrompt(opts: StartOptions, brief: ReturnType<typeof caseBrief>): ChatMessage[] {
  const country = COUNTRY[opts.country ?? "IN"];
  const level = levelMeta(brief.level, country.id);
  const difficulty = opts.easy
    ? "1 — EASY: a common, classic presentation with clear findings and a straightforward plan; ideal for a doctor's first cases"
    : "matched to the setting (1 easy, 2 moderate, 3 hard)";
  return [
    {
      role: "system",
      content: `${simulationRules(country.id)}
You author realistic, guideline-accurate clinical cases for ${country.name}. Patients are fictional and culturally realistic, never stereotyped; places, food, drug brands and services are local (the ambulance number is ${country.emergency}). Write lab values in conventional units (mg/dL, g/dL, °F) and costs in Indian rupees: the app converts units and money for the player.

Return JSON matching this shape exactly (all teaching content is shown only after the case closes):
${GENERATED_CASE_SHAPE}

Rules for the case file:
- history: 8–14 entries. Every POSITIVE finding must be authored; "match" holds 3–8 short lowercase phrases a doctor might type. Include the presenting complaint, its history, past history, medicines and allergies.
- exam: 3–8 entries. Use these standard examination ids where they fit: ${EXAMS.map((e) => e.id).join(", ")}; new ids for special signs.
- investigations: 6–12, with their real results — abnormal where the disease makes them so, plus a few relevant normal ones. Use these ids where they fit: ${INVESTIGATIONS.map((i) => i.id).join(", ")}. Labs as rows; imaging and bedside tests as a report that describes findings only, never an impression or a diagnosis.
- Pictures: attach media wherever a doctor would look at one — a skin, wound, eye or mouth finding as a "photo" on that exam entry; an X-ray, CT, MRI, ultrasound or fundus image as its type on that investigation. "describe" is a precise, medically accurate visual description for an image generator: the view or projection, the anatomical site, the patient's skin tone (Fitzpatrick type) for photos, and every visible abnormality with its size, number, colour, shape, distribution, side and extent. No text, labels, arrows or measurements in the picture.
- ECGs: use the ECG media (rate, rhythm, per-lead ST in mm with + for elevation, T multiplier with negative to invert, Q depth in mm, QRS scale, PR/QRS/QT in ms). The site draws it accurately from these numbers.
- alt says what the picture is of without interpreting it; caption gives acquisition details only (e.g. "PA erect", "Left cheek · close-up").
- therapeutics: 6–12. drugIds only from: ${FORMULARY.map((d) => d.id).join(", ")}. measureIds only from: ${MEASURES.map((m) => m.id).join(", ")}.
- rubric.idealTreatment is an AND-of-ORs over therapeutic ids; misses and strengths are keyed by history, exam, investigation or therapeutic ids.
- Keep the teaching section concise.`,
    },
    {
      role: "user",
      content: `Write one complete case in ${brief.specialty} for ${level.label} — ${level.description} — in ${country.name}. Mode: ${trackLabel(brief.track, country.id)}. The patient is ${brief.age}, ${brief.sex.toLowerCase()}. Difficulty: ${difficulty}. Choose a realistic condition that fits; vary it — not always the most common one.`,
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

function toDefinition(g: GeneratedCase, brief: ReturnType<typeof caseBrief>, opts: StartOptions): ClinicalCaseDefinition {
  const pictures: NonNullable<ClinicalCaseDefinition["pictures"]> = {};
  const id = `gen-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    pictures,
    specialty: g.specialty,
    track: brief.track,
    level: brief.level,
    setting: brief.track === "phone" ? "Teleconsult" : brief.track === "emergency" ? "ER" : g.setting,
    weight: 1,
    difficulty: (opts.easy ? 1 : g.difficulty) as 1 | 2 | 3,
    ...(opts.country ? { countries: [opts.country] } : {}),
    patient: g.patient as ClinicalCaseDefinition["patient"],
    arrivalMinuteOfDay: g.arrivalMinuteOfDay,
    briefing: g.briefing,
    opening: g.opening.map((o) => ({ ...o, media: mediaOf(o.media, pictures) })) as ClinicalCaseDefinition["opening"],
    baselineVitals: Object.fromEntries(Object.entries(g.baselineVitals).map(([k, v]) => [k, { key: k, value: v }])) as ClinicalCaseDefinition["baselineVitals"],
    triageVitals: g.triageVitals as ClinicalCaseDefinition["triageVitals"],
    profile: g.profile,
    history: g.history as ClinicalCaseDefinition["history"],
    exam: g.exam.map((e) => ({ ...e, media: mediaOf(e.media, pictures) })) as ClinicalCaseDefinition["exam"],
    investigations: g.investigations.map((i) => ({ ...i, media: mediaOf(i.media, pictures) })) as ClinicalCaseDefinition["investigations"],
    // Only drugs and measures the engine knows: anything else could never be matched.
    therapeutics: g.therapeutics.map((t) => ({ ...t, drugIds: t.drugIds?.filter((d) => DRUG_IDS.has(d)), measureIds: t.measureIds?.filter((m) => MEASURE_IDS.has(m)) })) as ClinicalCaseDefinition["therapeutics"],
    hazards: [],
    followUp: g.followUp as ClinicalCaseDefinition["followUp"],
    truth: g.truth,
    rubric: g.rubric as ClinicalCaseDefinition["rubric"],
    teaching: { ...g.teaching, treatmentByBand: {} } as ClinicalCaseDefinition["teaching"],
  };
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
    const intents: ResolvedIntent[] = [];
    const generated: Record<string, string> = {};
    for (const i of parsed.data.intents) {
      const intent: ResolvedIntent = { kind: i.kind, targetId: i.targetId, phrase: i.phrase || text, matched: i.kind !== "unknown", payload: i.payload };
      if (i.kind === "history" && (!i.targetId || i.targetId === "generated" || !ctx.def.history.some((h) => h.id === i.targetId))) {
        intent.targetId = "generated";
        if (parsed.data.message) generated[String(intents.length)] = parsed.data.message;
      }
      intents.push(intent);
    }
    if (intents.length === 0 && parsed.data.message) {
      intents.push({ kind: "history", targetId: "generated", phrase: text, matched: true });
      generated["0"] = parsed.data.message;
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
      // Inventing patients switches on with RAMAI_AI_CASES=1 while the picture side is finished.
      if (process.env.RAMAI_AI_CASES !== "1") return mockProvider.createCase(opts);
      const brief = caseBrief(opts);
      try {
        const raw = await chatJSON(generationPrompt(opts, brief), 9000, false, GENERATION_TIMEOUT_MS);
        const parsed = GeneratedCaseSchema.safeParse(raw);
        if (!parsed.success) throw new UpstreamError(`case failed its checks: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
        return { kind: "generated", def: toDefinition(parsed.data, brief, opts) };
      } catch (err) {
        console.error("[ramai] couldn't invent a patient; using a written case", err instanceof Error ? err.message : err);
        return mockProvider.createCase(opts);
      }
    },
    resolveCase: (src) => mockProvider.resolveCase(src),
    /** Any specialty, mode or level can be invented. */
    async availability() {
      const all = <K extends string>(keys: readonly K[]) => Object.fromEntries(keys.map((k) => [k, 999])) as Partial<Record<K, number>>;
      return { specialties: all(ALL_SPECIALTIES), tracks: all(CASE_TRACKS), levels: all(CARE_LEVELS) };
    },

    async interpret(text, ctx): Promise<Interpretation> {
      // Rules first: instant and free. The guided demo stays fully scripted.
      const ruled = (await mockProvider.interpret(text, ctx)).intents;
      if (ctx.def.guided) return { intents: ruled };
      const unresolved = ruled.some((i) => (i.kind === "unknown" && !i.payload?.empty) || (i.kind === "history" && i.targetId?.startsWith("fallback:")));
      if (unresolved) return understand(text, ctx, ruled);
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

