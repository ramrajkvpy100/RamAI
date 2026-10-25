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
import { withUntreatedCourse } from "./untreated";
import "server-only";

import { DEFAULT_MODEL, lightReasoning } from "@/lib/server/openai-check";

import type { ClinicalCaseDefinition } from "../case-definition";
import { EXAMS, INVESTIGATIONS, MEASURES } from "../catalog";
import { COUNTRY, type Country } from "../countries";
import { FORMULARY } from "../formulary";
import { levelMeta, trackLabel } from "../levels";
import type { CareLevel, CaseTrack, MediaAsset, PatientLang, ResolvedIntent, Specialty } from "../types";
import { CARE_LEVELS, PLAYABLE_TRACKS } from "../types";
import { ALL_SPECIALTIES } from "../progression";
import { pickCondition } from "./conditions";
import { mockProvider, NoCaseError } from "./mock";
import type { z } from "zod";

import { ConceptSchema, DialogueSchema, FeedbackSchema, FindingsSchema, LearnSchema, ManagementSchema, PatientResponseSchema, TeachingSchema, VoiceSchema, type Concept, type GeneratedMedia } from "./openai-schema";
import { applyDialogueReview, applyExaminerReview, applyFindingsReview, applyManagementReview, checkLabFlags, dialogueReviewPrompt, findingsReviewPrompt, flagFromRange, GUIDELINES, managementReviewPrompt } from "./openai-review";
import { normalise } from "../text";
import { aboutThem, labGap, systemFinding, vitalsNow } from "../simulator";
import { noteUsage } from "./usage";
import type { CaseSource, ClinicalProvider, CoachFeedback, FeedbackInput, InterpretContext, Interpretation, StartOptions } from "./types";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** OpenAI answered with an error: its HTTP status and error code (e.g. 429 insufficient_quota), never the key. */
export class UpstreamError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

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
/** One call — tried again once, straight away, if the connection drops or OpenAI has a passing fault (5xx, 429). */
/** How hard the model thinks: false = the lightest setting, true = low, "medium" = medium (measured: no more accurate than low for reading the doctor, and seconds slower). */
type Effort = boolean | "medium";
export async function chatJSON(messages: ChatMessage[], maxTokens: number, careful: Effort = false, timeout?: number): Promise<unknown> {
  const limit = timeout ?? openAIConfig().timeoutMs;
  const started = Date.now();
  try {
    return await chatJSONOnce(messages, maxTokens, careful, limit);
  } catch (err) {
    const passing = (err instanceof TypeError && /fetch failed|network|socket|ECONNRESET/i.test(`${err.message} ${String((err as { cause?: unknown }).cause ?? "")}`))
      || (err instanceof UpstreamError && err.status !== undefined && (err.status >= 500 || err.status === 429));
    const left = limit - (Date.now() - started);
    const cause = (err as { cause?: { code?: string; message?: string } }).cause;
    if (!passing || left < 8_000) {
      if (passing) console.warn(`[ramai] AI call failed in passing with no time left to retry (${Date.now() - started} ms): ${cause?.code ?? cause?.message ?? ""}`);
      throw err;
    }
    console.warn(`[ramai] AI call failed in passing after ${Date.now() - started} ms (${cause?.code ?? cause?.message ?? (err instanceof Error ? err.message : String(err))}); trying once more`);
    await new Promise((r) => setTimeout(r, 800));
    return chatJSONOnce(messages, maxTokens, careful, left - 800);
  }
}

async function chatJSONOnce(messages: ChatMessage[], maxTokens: number, careful: Effort, timeout: number): Promise<unknown> {
  const { key, model, baseUrl } = openAIConfig();
  const timeoutMs = timeout ?? openAIConfig().timeoutMs;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  // RAMAI_TRACE=1: how long each call took (what it was for, from its first words) — for tuning timeouts.
  if (process.env.RAMAI_TRACE) controller.signal.addEventListener("abort", () => console.info(`[ramai] trace: aborted after ${Date.now() - started} ms (limit ${timeoutMs}) — ${String(messages[messages.length - 1]?.content ?? "").slice(0, 60)}`));
  try {
    const effort = careful ? (/^gpt-6/.test(model) ? { reasoning_effort: careful === "medium" ? "medium" : "low" } : lightReasoning(model)) : lightReasoning(model);
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages, response_format: { type: "json_object" }, max_completion_tokens: maxTokens, ...effort }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: { code?: string; type?: string } };
      const code = err.error?.code ?? err.error?.type;
      throw new UpstreamError(`OpenAI responded ${res.status}${code ? ` (${code})` : ""}`, res.status, code);
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: unknown };
    if (process.env.RAMAI_TRACE) console.info(`[ramai] trace: ${Date.now() - started} ms (limit ${timeoutMs}) — ${String(messages[messages.length - 1]?.content ?? "").slice(0, 60)}`);
    noteUsage(data.usage);
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

const IDIOM: Record<Country, string> = { IN: "Indian English", US: "American English", UK: "British English", WW: "plain international English" };
const WHERE: Record<Country, string> = { IN: "India", US: "the USA", UK: "the UK", WW: "a low- or middle-income country (choose a realistic one — in Africa, South or Southeast Asia, the Middle East or Latin America), following WHO guidance" };
const language = (country: Country = "IN", lang: PatientLang = "en") =>
  lang === "hinglish" ? "Hinglish — everyday Hindi written in Roman letters, mixed with common English words, as people speak in North India" : `natural ${IDIOM[country]} — even when the doctor writes in Hindi or Hinglish (the player chose English replies)`;

const simulationRules = (country: Country = "IN") => `You are the hidden clinical environment of RamAI, an educational clinical-decision game for doctors in ${WHERE[country]}.
Absolute rules while a case is active:
- Never reveal or hint at the diagnosis, differential, severity, hidden findings, future complications, scoring or ideal treatment.
- Never coach. No "you may want to…", "this could suggest…", "consider…", "the next step is…".
- The patient speaks as a lay person from the stated background (${IDIOM[country]}, natural, brief). They answer only what was asked.
- Positive findings must come only from the case file. If the case file does not mention something, the honest answer is a plausible negative.
- Output JSON only.`;

/**
 * What the doctor has actually found so far — asked, examined, resulted — with values and units, plus what's
 * still pending. The model reasons from this; anything not here is unknown (not negative) and must not be stated.
 */
export function knownSoFar(ctx: InterpretContext): string {
  const { def, hidden } = ctx;
  const asked = Object.keys(hidden.history).map((id) => def.history.find((h) => h.id === id)).filter((h): h is NonNullable<typeof h> => !!h).map((h) => `${h.label}: ${(h.fact ?? h.reply).slice(0, 160)}`);
  const examined = Object.keys(hidden.exams).map((id) => {
    const label = def.exam.find((e) => e.id === id)?.label ?? id;
    const finding = systemFinding(def, hidden, id).replace(/(Heart|Breath|Bowel) sounds[^.]*\./g, "").trim();
    return finding ? `${label}: ${finding.slice(0, 220)}` : "";
  }).filter(Boolean);
  const back = hidden.investigations.filter((i) => i.delivered).map((i) => {
    const rows = (i.result.rows ?? []).map((r) => `${r.analyte} ${r.value}${r.unit ? ` ${r.unit}` : ""}${r.flag && r.flag !== "normal" ? ` (${r.flag})` : ""}`).join(", ");
    return `${i.name}: ${[rows, i.result.report?.slice(0, 240)].filter(Boolean).join(" | ")}`;
  });
  const pending = hidden.investigations.filter((i) => !i.delivered).map((i) => `${i.name} (due in about ${Math.max(1, Math.round(i.resultAt - hidden.clock))} min)`);
  const meds = hidden.drugs.slice(-12).map((d) => `${d.generic}${d.dose ? ` ${d.dose}` : ""} ${d.route}${d.mode === "prescribed" ? ` — prescribed${d.frequency ? ` ${d.frequency}` : ""}${d.duration ? ` × ${d.duration}` : ""}` : ` — given at minute ${Math.round(d.at)}`}`);
  return [
    `WHAT THE DOCTOR HAS FOUND SO FAR (only this is known in the room — anything else is not yet asked, examined or tested: unknown, not negative):`,
    `History obtained: ${asked.length ? asked.join("; ") : "nothing yet"}.`,
    `Examination done: ${examined.length ? examined.join("; ") : "none yet"}.`,
    `Results back: ${back.length ? back.join("; ") : "none"}.`,
    `Pending: ${pending.length ? pending.join("; ") : "none"}.`,
    `Medicines given or prescribed: ${meds.length ? meds.join("; ") : "none"}.`,
  ].join("\n");
}

/** Where the encounter stands — so replies fit the moment, and follow-ups ("in 2 seconds", "same again") read in context. */
function stateNote(ctx: InterpretContext): string {
  const h = ctx.hidden;
  const v = vitalsNow(h);
  const given = h.drugs.filter((d) => d.mode === "given").slice(-8).map((d) => `${d.generic}${d.dose ? ` ${d.dose}` : ""} ${d.route} at minute ${Math.round(d.at)}`);
  // The whole conversation (up to 40 lines), so the model follows it the way a colleague would.
  const recent = ctx.transcript
    .slice(-40)
    .map((m) => `${m.role === "doctor" ? "Doctor" : m.role === "attendant" ? "Relative" : m.role === "nurse" ? "Nurse" : m.role === "patient" ? "Patient" : "Ward"}: ${m.text}`)
    .join("\n");
  return `Minute ${Math.round(h.clock)} of the encounter. The patient is ${h.status}${h.patientSays ? ` and says "${h.patientSays}"` : ""}. Vitals: HR ${v.hr.value}, BP ${v.bp.value}, RR ${v.rr.value}, SpO2 ${v.spo2.value}, temperature ${v.temp.value}.
Given so far: ${given.length ? given.join("; ") : "nothing"}.
${knownSoFar(ctx)}
${recent ? `Conversation so far:\n${recent}` : ""}`;
}

/** For a question the rules couldn't place: what did the doctor mean, and (if it was a question) what does the patient say? */
/** Every name a stocked drug goes by (four letters or more, so "pan" or "rl" don't catch ordinary words). */
const DRUG_NAMES = [...new Set(FORMULARY.flatMap((d) => [d.id, d.generic, ...(d.aliases ?? []), ...d.brands].map((x) => x.toLowerCase())))].filter((w) => w.length > 3);
const escapeRe = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const DRUG_NAME_RE = new RegExp(`\\b(?:${DRUG_NAMES.map(escapeRe).join("|")})\\b`);
const namesDrug = (phrase: string) => DRUG_NAME_RE.test(phrase.toLowerCase());

/** A "value" that is no result at all — the lab must report the test, never decline it. */
const NO_VALUE = /\b(not (?:obtained|measured|done|performed|available|tested|reported)|pending|awaited|n\/a)\b|^\s*(?:not performed|not done)\.?\s*$/i;

const BEDSIDE_TEST = /\b(visual acuity|snellen|\bva\b|fluorescein|pinhole|near vision|colou?r vision|confrontation|20 ?wbct|whole blood clotting|clotting time|bleeding time|dipstick|urine dip|glucometer|capillary glucose|peak flow|pefr|pulse oximetry|tuning fork|rinne|weber|otoscopy|schober|single breath count|bedside)\b/i;

/**
 * Does a reply written by the model name the diagnosis (or an accepted synonym) that nothing in the room has said yet?
 * Such a reply is never shown during the case — the scripted words stand instead.
 */
export function leaksDiagnosis(def: ClinicalCaseDefinition, reply: string, alreadySaid: string): boolean {
  const said = alreadySaid.toLowerCase();
  const text = reply.toLowerCase();
  const terms = [def.truth.diagnosis, ...def.rubric.diagnosisAccept].map((t) => t.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim()).filter((t) => t.length >= 4);
  return terms.some((t) => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text) && !said.includes(t));
}

/** Shorthand, typos and Hinglish spelled out ("kab se hai" → "since when"), as a hint beside the doctor's own words. */
function plainEnglish(clause: string): string {
  const plain = normalise(clause);
  const raw = clause.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  return plain && plain !== raw ? `\n(In plain words: "${plain}")` : "";
}

function interpretPrompt(def: ClinicalCaseDefinition, clause: string, ctx: InterpretContext, guess = ""): ChatMessage[] {
  const { country, lang } = ctx;
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
Patient: ${def.patient.age}-year-old ${def.patient.sex}, ${def.patient.city}${def.patient.occupation ? `, ${def.patient.occupation}` : ""}.${def.persona ? ` The patient is ${def.persona} — their replies show it.` : ""}
Diagnosis (never reveal): ${def.truth.diagnosis}.

NOW: ${stateNote(ctx)}

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
Read the doctor's words in the context of the conversation — a follow-up is about the order just given: "same again", "another", "double it" is a new order (kind "drug", same targetId, with the payload); "stop it" is kind "action", targetId "measure:stop-drug" (or "measure:stop-fluids" for a drip); a new rate or timing ("in 2 seconds", "faster") for something already given is kind "unknown", and the nurse answers in the room's words — for a bolus that has already gone in, that it has; for a drip still running, that it's been sped up.
Orders are carried out exactly as given, however unusual, excessive or unsafe — the simulation plays out the consequences. Never refuse, soften or correct an order: map it to the matching id with the dose, route and rate exactly as said, in "payload": {"mode":"given"|"prescribed","route":"IV|IM|PO|SC|SL|NEB|INH|PR|TOP|IN","amount":<number>,"unit":"mg|mcg|g|units|mL|L|mmol","volumeMl":<for fluids>,"overMin":<minutes it is given over, if said>,"frequency"?,"duration"?}. Put in the payload ONLY what the doctor said — never fill in a usual dose, route, rate, frequency or duration: the ward asks for whatever is missing. For imaging, put the part, view and contrast the doctor said in "payload": {"region"?: "chest|abdomen|pelvis|kub|head|neck|knee|…","view"?: "PA|AP|lateral|erect|supine","contrast"?: "plain|contrast"}; an X-ray, CT, ultrasound or MRI with no part named uses targetId "xray", "ct", "usg" or "mri".
If the nurse has just asked about an order's missing details and the doctor answers them, return that same order (same kind and targetId) with the details in its payload.
Map to existing ids whenever the meaning matches — the game answers those itself.
Understand the doctor the way a thoughtful, experienced colleague would in a real conversation: typos, abbreviations (c/o, h/o, o/e, BD, TDS, stat), shorthand, Hinglish or Hindi, half-sentences and several requests in one message — handle every request, in the order given, each as its own intent. Use the whole conversation to work out what "it", "that", "same", "again" and short replies refer to.
Accuracy matters more than anything: never map to an id that means something other than what the doctor said. Use kind "exam" only when the doctor asked to examine, look, feel, listen or test a sign — an instruction to the patient ("stand up", "sit", "walk", "take a deep breath") is kind "unknown" and the patient simply does it. Never swap one drug, test, side or body part for another (left is not right; a CT is not an MRI; amoxicillin is not amoxiclav). If a name could mean two different ids and the conversation doesn't settle it, use kind "unknown" with speaker "nurse" and ask in one short line which one the doctor means — the only time a question is asked.${def.unlimited ? `
This hospital has every resource: any test can be done. A test the doctor orders that no investigation id covers is kind "investigation", targetId "adhoc:<its standard name>" (e.g. "adhoc:Anti-CCP antibodies") — never say it isn't available.` : ""}
For history questions with no matching entry, use kind "history", targetId "generated", speaker "patient" — the patient answers for themself; "attendant" ONLY when the doctor clearly addressed the relative by name or role, or the patient is a young child or can't speak (unconscious, confused), and put the reply in "message", in ${language(country, lang)}. A relative speaking about a child (or about a patient who can't speak) speaks of them in the third person — "he hasn't had a fever", never "I haven't".
Whatever the doctor says is acted on. Read it in the context of the conversation and do what they most likely mean: a short reply ("ya", "yes", "ok", "haan", "do it", "go ahead") agrees to whatever was just asked or proposed and carries it out; a measurement ("measure his height", "weigh her") is kind "vitals"; a unit or a repeat ("in feet", "again") refers to the last thing done.
For anything else no id covers — a remark, reassurance, small talk, or a request the ward can't carry out — use kind "unknown" and always write "message": the brief, natural reply of whoever was spoken to. By default that is the patient (in ${language(country, lang)}); the relative only when spoken to directly, or when the patient is a young child or can't speak. The nurse answers only when the doctor gave the staff an order (speaker "nurse", plain English, one short sentence); the nurse never says that a test, drug, procedure or referral has been done or given, never states a finding or result, and never suggests what to do next. If something truly can't be done here, say so plainly in one line. Never ask the doctor what they want.

The doctor said: """${clause}"""${plainEnglish(clause)}${guess ? `\n(A quick keyword reading took it as: ${guess}. Keep it if it is what the doctor meant; correct it if not — a question is never an order, history is not examination, and asking for results is not a new test.)` : ""}`,
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
    .slice(-24)
    .map((m) => `${m.role === "doctor" ? "Doctor" : m.role === "attendant" ? "Relative" : "Patient"}: ${m.text}`)
    .join("\n");
  return [
    {
      role: "system",
      content: `You voice patients and their relatives in RamAI, an educational clinical simulation for doctors in ${WHERE[ctx.country ?? "IN"]}.
Rules:
- Speak as a lay person, briefly (one to three sentences per reply), warmly and naturally, in ${language(ctx.country, ctx.lang)}.
- Convey the facts given for each reply — no new symptoms, numbers, findings or history, and nothing left out that matters — but say them the way this person would: answer the question actually asked first, in their own words, remembering what was said earlier (don't repeat yourself word for word), with the feelings that fit (worry, pain, relief, impatience).
- Never name a diagnosis, never give medical advice, never hint at what the doctor should do.
- The patient speaks in the first person; a relative speaks about the patient ("he", "she"). Call the doctor "doctor" now and then.
- Match how unwell the patient is right now.
- Output JSON only: {"replies":["…"]} — exactly one reply per question, in order.`,
    },
    {
      role: "user",
      content: `Patient: ${p.age}-year-old ${p.sex}${p.occupation ? `, ${p.occupation}` : ""}, ${p.city}.
Scene: ${def.briefing}
How the patient is now: ${ctx.hidden.status}${ctx.hidden.patientSays ? ` — "${ctx.hidden.patientSays}"` : ""}.${def.persona ? `\nThe patient is ${def.persona} — let it show.` : ""}
Treatment so far: ${ctx.hidden.drugs.filter((d) => d.mode === "given").slice(-6).map((d) => `${d.generic} (minute ${Math.round(d.at)})`).join(", ") || "none yet"}.
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
- Be specific to what they actually did. Plain language, no headings.
- Short lines, never paragraphs: each point on its own line (separate lines with \n), under 15 words, with its key words wrapped in **double asterisks** for bold.
- When the patient was a difficult one (anxious, reluctant, low health literacy), say in the reasoning how well the doctor communicated: explaining simply, reassuring, checking understanding, showing empathy.
- Output JSON only: {"summary":"two or three short lines on how it went","reasoning":"two or three short lines on their clinical reasoning","nextTime":["two to four short, concrete tips"]}`,
    },
    {
      role: "user",
      content: `The case: ${def.patient.age}-year-old ${def.patient.sex}. ${def.briefing}
Diagnosis: ${def.truth.diagnosis}${def.truth.qualifier ? ` — ${def.truth.qualifier}` : ""}.
Teaching point: ${def.teaching.pearl}${def.persona ? `\nThe patient was ${def.persona}.` : ""}

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
const PART_TIMEOUT_MS = 60_000;
/** A consultant's review of a part gets what's left of the minute, up to this. */
const REVIEW_TIMEOUT_MS = 25_000;
// Writing, reviewing every part and the senior read of the whole case takes up to ~70 s with the current model.
const CASE_DEADLINE_MS = 110_000;

/**
 * A consultant's look at one part, its corrections applied. Accuracy comes first: a part that
 * couldn't be reviewed in time is never shown — the case is dropped (a written, checked case
 * stands in) rather than served unchecked.
 */
async function reviewPart<T>(name: string, part: T, prompt: ChatMessage[], maxTokens: number, apply: (part: T, raw: unknown) => { part: T; fixes: string[] }, timeLeft: number): Promise<T> {
  if (timeLeft < 6_000) throw new UpstreamError(`no time left to review the ${name}`);
  try {
    const { part: fixed, fixes } = apply(part, await chatJSON(prompt, maxTokens, true, Math.min(REVIEW_TIMEOUT_MS, timeLeft)));
    if (fixes.length) console.info(`[ramai] consultant review — ${name}: ${fixes.length} correction${fixes.length === 1 ? "" : "s"}: ${fixes.join(" | ").slice(0, 800)}`);
    return fixed;
  } catch (err) {
    throw new UpstreamError(`the ${name} couldn't be reviewed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** A number from a vital as written ("116/74", "98.6 °F", "94"). */
const firstNum = (v: string | undefined) => {
  const m = v?.match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : undefined;
};

/**
 * Plain impossibilities, caught in code before anyone sees the case: a diagnosis the patient's
 * sex can't have, adult numbers on a baby, vitals no living patient shows.
 */
export function sanityProblems(concept: { patient: { age: number; sex: string }; diagnosis: string }, vitals: Record<string, string>): string[] {
  const out: string[] = [];
  const dx = concept.diagnosis.toLowerCase();
  const { age, sex } = concept.patient;
  if (sex === "Male" && /pregnan|ectopic|eclampsia|post-?partum|\bpph\b|abortion|miscarriage|placenta|ovar|uter|endometri|cervi|menstru|vagin|mastitis|puerper/.test(dx)) out.push(`a male patient with "${concept.diagnosis}"`);
  if (sex === "Female" && /prostat|testic|scrot|hydrocele|varicocele|phimosis|epididym/.test(dx)) out.push(`a female patient with "${concept.diagnosis}"`);
  if ((age < 12 || age > 55) && /pregnan|ectopic|eclampsia|post-?partum|\bpph\b|abortion|placenta/.test(dx)) out.push(`pregnancy at age ${age}`);
  if (age < 15 && /\bbph\b|benign prostatic|copd|alzheimer|parkinson|osteoarthritis|myocardial infarction|\bstemi\b/.test(dx)) out.push(`"${concept.diagnosis}" at age ${age}`);
  const hr = firstNum(vitals.hr);
  const rr = firstNum(vitals.rr);
  const spo2 = firstNum(vitals.spo2);
  const sbp = firstNum(vitals.bp);
  const dbp = vitals.bp?.match(/\/\s*(\d+)/) ? Number(vitals.bp.match(/\/\s*(\d+)/)![1]) : undefined;
  const temp = firstNum(vitals.temp);
  if (hr !== undefined && (hr < 25 || hr > 240)) out.push(`pulse ${hr}`);
  if (rr !== undefined && (rr < 4 || rr > 90)) out.push(`respiratory rate ${rr}`);
  if (spo2 !== undefined && (spo2 > 100 || spo2 < 40)) out.push(`SpO2 ${spo2}`);
  if (sbp !== undefined && (sbp < 40 || sbp > 280)) out.push(`systolic BP ${sbp}`);
  if (sbp !== undefined && dbp !== undefined && dbp >= sbp) out.push(`BP ${vitals.bp} (diastolic not below systolic)`);
  if (temp !== undefined && !((temp >= 32 && temp <= 43.5) || (temp >= 89 && temp <= 110))) out.push(`temperature ${vitals.temp}`);
  // A baby's or a child's numbers, not an adult's.
  if (age < 1 && hr !== undefined && hr < 80) out.push(`pulse ${hr} in an infant`);
  if (age < 1 && rr !== undefined && rr < 20) out.push(`respiratory rate ${rr} in an infant`);
  if (age < 5 && sbp !== undefined && sbp > 150) out.push(`systolic BP ${sbp} in a ${age}-year-old`);
  if (age >= 14 && hr !== undefined && hr > 200) out.push(`pulse ${hr} in an adult`);
  return out;
}

/**
 * The last look before a case is used: one senior clinician reads the whole case at once —
 * story, examination, every result and the marking key — and says whether it hangs together.
 * Parts were each reviewed alone; this catches what only shows across them.
 */
/** The whole case as text for the senior's read — every clinical fact, none of the picture data (which made it too long and got it cut off). */
function compactCase(def: unknown): string {
  const DROP = new Set(["media", "spec", "svg", "alt", "caption", "pictures", "portrait", "seed", "visual", "sounds", "stethoscope"]);
  const text = JSON.stringify(def, (k, v) => (DROP.has(k) ? undefined : v));
  return text.length > 90_000 ? `${text.slice(0, 90_000)} …(the rest omitted for length — judge only what is shown)` : text;
}

function coherencePrompt(def: unknown): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "You are a senior consultant and medical educator checking a simulated clinical case before trainee doctors see it. Clinical accuracy is everything: a single wrong fact teaches a doctor something false. Read the whole case and check that (1) the history, vital signs, examination findings and every investigation result are consistent with each other and with the final diagnosis, for this patient's age and sex; (2) no finding or result contradicts the diagnosis or another finding, and nothing is mislabelled (wrong side, wrong organ, wrong units, wrong normal range, impossible value); (3) the expected management and drug doses follow current standard guidelines for this setting and patient (age, weight, pregnancy, kidney function), and every weight and per-kg dose uses the same weight the case states; (4) the marking key rewards what a good doctor would do and does not penalise correct alternatives. Minor stylistic points do not matter. Reply as JSON only.",
    },
    {
      role: "user",
      content: `The case:\n${compactCase(def)}\n\nReturn JSON {"verdict": "ok" | "reject", "problems": ["each clinically wrong or inconsistent point, briefly"]}. Use "reject" if there is ANY clinical error, contradiction, mislabel or unsafe dose that a trainee could learn from; "ok" only when the case is clinically sound.`,
    },
  ];
}

const pickOne = <T>(xs: readonly T[], random = Math.random): T => xs[Math.floor(random() * xs.length)]!;

/** General practice: the problems a GP sees every day, presented fairly — learnable and winnable. */
/** What makes a general-practice case fair and learnable, whatever the condition. */
const GP_FAIR = "Make it fair and learnable: a cooperative patient who volunteers the key history when asked, the key sign clearly present on examination, one or two simple tests that confirm it, and a standard first-line treatment from the national guidelines. The patient stays stable throughout.";
const GP_BRIEF = "This is general practice: choose one of the commonest primary-care problems (fever with a cold or cough, sore throat, acute gastroenteritis, urinary infection, new or uncontrolled hypertension or type 2 diabetes, tinea, scabies, acne, iron-deficiency anaemia, asthma, low back pain, tension headache, otitis media, conjunctivitis, worms, dyspepsia, or — in season — dengue, malaria or typhoid without warning signs). Make it fair and learnable: a cooperative patient who volunteers the key history when asked, the key sign clearly present on examination, one or two simple tests that confirm it, and a standard first-line treatment from the national guidelines. The patient stays stable throughout.";

/** What to ask for: the player's choices, and otherwise a varied mix — a new kind of patient each time. */
function caseBrief(opts: StartOptions) {
  // (Phone consults are no longer offered: a request for one is played in the clinic.)
  const track: CaseTrack = opts.track && opts.track !== "phone" ? opts.track : opts.easy ? "opd" : pickOne(["opd", "opd", "opd", "emergency", "emergency"] as const);
  const levels = (opts.allowedLevels ?? CARE_LEVELS).filter((l) => !opts.easy || l === "phc" || l === "chc");
  const level: CareLevel = opts.level ?? pickOne(levels.length ? levels : (opts.allowedLevels ?? CARE_LEVELS));
  // Every specialty can come up — General Practice, Medicine, Dermatology and Paediatrics most often.
  const common: Specialty[] = ["General Practice", "General Practice", "General Practice", "Medicine", "Medicine", "Medicine", "Dermatology", "Dermatology", "Dermatology", "Pediatrics", "Pediatrics", "Surgery", "OBGYN", "Cardiology", "Respiratory", "Gastroenterology", "Infectious Disease", "Endocrinology", "Neurology", "ENT", "Ophthalmology", "Orthopedics", "Nephrology", "Urology", "Psychiatry"];
  const specialty: Specialty = opts.specialty ?? (track === "emergency" ? pickOne(["Emergency", "Emergency", "Emergency", "Medicine", "Medicine", "Pediatrics", "Pediatrics", "Surgery", "Cardiology", "OBGYN", "Infectious Disease"] as Specialty[]) : pickOne(common));
  const sex = specialty === "OBGYN" ? "Female" : pickOne(["Male", "Female"] as const);
  const age = specialty === "Pediatrics" ? pickOne(["an infant", "a toddler", "a school-age child", "an adolescent"]) : pickOne(["a young adult", "an adult in their 30s or 40s", "a middle-aged adult", "an older adult"]);
  // About one patient in four is harder to talk to — never in a newcomer's easy case.
  const persona = opts.easy || opts.disease ? undefined : Math.random() < 0.25 ? pickOne(PERSONAS) : undefined;
  // A condition from the curated list for this specialty, level and mode (the model picks only where there's none).
  const condition = opts.disease ? undefined : pickCondition(specialty, level, track, opts.country ?? "IN");
  return { track, level, specialty, sex, age, persona, condition };
}
type Brief = ReturnType<typeof caseBrief>;

/**
 * The guideline bodies each specialty follows, by country — the case, its treatment and its teaching
 * follow these exclusively where they apply (WHO for anything they don't cover).
 */
const SPECIALTY_BODIES: Partial<Record<string, Record<"IN" | "INTL", string>>> = {
  Pediatrics: { IN: "Indian Academy of Pediatrics (IAP) guidelines and IAP Standard Treatment Guidelines, with Nelson Textbook of Pediatrics and OP Ghai", INTL: "AAP / NICE paediatric guidelines and WHO IMCI, with Nelson Textbook of Pediatrics" },
  OBGYN: { IN: "FOGSI guidelines and the MoHFW/NHM maternal health guidelines, with Williams Obstetrics and DC Dutta", INTL: "ACOG / RCOG guidelines and WHO maternal care guidance, with Williams Obstetrics" },
  Cardiology: { IN: "Cardiological Society of India (CSI) guidance with ESC and ACC/AHA guidelines", INTL: "ACC/AHA and ESC guidelines" },
  "General Practice": { IN: "ICMR and MoHFW Standard Treatment Guidelines for primary care, with Murtagh's General Practice", INTL: "NICE Clinical Knowledge Summaries and WHO guidance, with Murtagh's General Practice" },
  Medicine: { IN: "API (Association of Physicians of India) guidance and ICMR Standard Treatment Guidelines, with Harrison's Principles of Internal Medicine", INTL: "NICE / ACP guidance, with Harrison's Principles of Internal Medicine" },
  Surgery: { IN: "Association of Surgeons of India (ASI) guidance, with Bailey & Love's Short Practice of Surgery", INTL: "ACS / NICE surgical guidance, with Bailey & Love and Sabiston" },
  Dermatology: { IN: "IADVL guidelines, with Rook's Textbook of Dermatology", INTL: "AAD / BAD guidelines, with Rook's Textbook of Dermatology" },
  Psychiatry: { IN: "Indian Psychiatric Society (IPS) clinical practice guidelines, with Kaplan & Sadock", INTL: "APA / NICE mental health guidelines, with Kaplan & Sadock" },
  ENT: { IN: "Association of Otolaryngologists of India guidance, with Dhingra's ENT", INTL: "AAO-HNS / ENT UK guidance, with Scott-Brown's" },
  Ophthalmology: { IN: "AIOS guidance, with Kanski's Clinical Ophthalmology and Khurana", INTL: "AAO Preferred Practice Patterns, with Kanski's" },
  Orthopedics: { IN: "Indian Orthopaedic Association guidance, with Apley's System of Orthopaedics", INTL: "AAOS / BOA guidance, with Apley's" },
  "Infectious Disease": { IN: "ICMR antimicrobial guidelines and national programme guidelines (NVBDCP, NTEP, NACO), with Harrison's", INTL: "IDSA guidelines and WHO, with Harrison's" },
  Endocrinology: { IN: "RSSDI and Endocrine Society of India guidance, with Williams Textbook of Endocrinology", INTL: "ADA Standards of Care and Endocrine Society guidelines" },
  Respiratory: { IN: "ICS–NCCP guidelines, GINA and GOLD", INTL: "GINA, GOLD and BTS guidelines" },
  Gastroenterology: { IN: "Indian Society of Gastroenterology guidance, with Sleisenger and Fordtran", INTL: "ACG / BSG guidelines" },
  Nephrology: { IN: "Indian Society of Nephrology guidance and KDIGO", INTL: "KDIGO guidelines" },
  Neurology: { IN: "Indian Academy of Neurology guidance with AHA/ASA stroke guidelines", INTL: "AAN and AHA/ASA guidelines" },
  Urology: { IN: "Urological Society of India guidance with EAU guidelines", INTL: "AUA / EAU guidelines, with Campbell-Walsh Urology" },
  Emergency: { IN: "ACLS/PALS (AHA) and Society for Emergency Medicine India guidance, with Tintinalli's", INTL: "AHA ACLS/PALS, ATLS and RCEM guidance, with Tintinalli's" },
};
function specialtyGuidelines(specialty: string, country: Country): string {
  const b = SPECIALTY_BODIES[specialty];
  return b ? (country === "IN" ? b.IN : b.INTL) : country === "IN" ? "ICMR Standard Treatment Guidelines and national programme guidelines" : "WHO guidance";
}

/** Difficult patients, as doctors meet them every day. */
const PERSONAS = [
  "anxious — frightened it is something serious, asks again and again what is wrong and needs calm reassurance",
  "reluctant — doesn't want tests or admission, has stopped medicines before, and needs to be persuaded with reasons",
  "low health literacy — uses everyday words, misunderstands medical terms and needs things explained simply",
];

/** What's in season where the case is set: the conditions doctors are seeing this month. */
function seasonNote(country: Country, month = new Date().getMonth()): string {
  if (country === "IN" || country === "WW") {
    if (month >= 5 && month <= 9) return "It is the monsoon: dengue, malaria, leptospirosis, typhoid, scrub typhus, acute gastroenteritis and snakebite are common now.";
    if (month >= 10 || month <= 1) return "It is winter: respiratory infections, asthma and COPD exacerbations, and heart attacks are common now.";
    return "It is the hot season: heat stroke, dehydration, acute gastroenteritis, typhoid and hepatitis A/E are common now.";
  }
  if (month >= 10 || month <= 2) return "It is winter: influenza, RSV, pneumonia, COPD exacerbations and falls are common now.";
  if (month >= 5 && month <= 7) return "It is summer: heat illness, Lyme disease (USA), injuries and gastroenteritis are common now.";
  return "It is spring or autumn: allergies, asthma and viral infections are common now.";
}

const authoring = (country: Country) => {
  const c = COUNTRY[country];
  return `${simulationRules(country)}
You author realistic, guideline-accurate clinical cases for ${c.name}. Patients are fictional and culturally realistic, never stereotyped; places, food, drug brands and services are local (the ambulance number is ${c.emergency}). Lab values in conventional units (mg/dL, g/dL, °F); costs in Indian rupees (the app converts them). Management, drugs and doses follow the specialty's own guidelines exclusively, as named in each request, and standard textbooks.`;
};

function outlinePrompt(opts: StartOptions, brief: Brief): ChatMessage[] {
  const chosen = opts.disease ?? brief.condition;
  const country = COUNTRY[opts.country ?? "IN"];
  const level = levelMeta(brief.level, country.id);
  const difficulty = opts.easy
    ? "1 — VERY EASY: one of the commonest conditions, with a classic textbook presentation — the key symptom is volunteered, the findings are clear and typical, one or two simple tests confirm it, and the treatment is a standard first-line one. The patient stays stable while the doctor works, with no sudden deterioration, no misleading clues and no complications, so a careful beginner wins it"
    : opts.hard
      ? "3 — HARD: a less common condition or an atypical presentation, with a reasonable differential to work through, findings that need looking for, and a patient who may deteriorate if the doctor is slow or wrong — still fair and solvable from the history, examination and tests"
      : "2 — MEDIUM: a common condition with a typical presentation, a short differential, and a clear plan once the key test is back";
  return [
    { role: "system", content: authoring(country.id) },
    {
      role: "user",
      content: `Outline one case in ${brief.specialty} for ${level.label} — ${level.description} — in ${country.name}. Mode: ${trackLabel(brief.track, country.id)}. ${chosen ? `The condition is ${chosen} (${opts.disease ? "the doctor chose to practise it; " : ""}never name it in the briefing). The patient's age and sex are whatever is typical for it.` : `The patient is ${brief.age}, ${brief.sex.toLowerCase()} — change the age if the condition you choose needs it (a baby's illness is a baby's).`} Difficulty: ${difficulty}. ${chosen ? "" : `${seasonNote(country.id)} Sometimes (not usually) choose a condition common in this season and region${country.id === "IN" ? " — tropical and regional diseases such as dengue, typhoid, TB, snakebite, scrub typhus and organophosphate poisoning are common in India" : country.id === "WW" ? " — malaria, TB, HIV, typhoid, sickle cell disease, rheumatic heart disease, cholera and snakebite are common in low- and middle-income countries" : ""}. `}${chosen ? `Give it a ${opts.easy ? "classic, textbook" : "typical"} presentation for this setting.${brief.specialty === "General Practice" ? ` ${GP_FAIR}` : ""}` : brief.specialty === "General Practice" ? GP_BRIEF : opts.easy ? "Choose one of the most common conditions seen in this setting, with a classic presentation." : `Choose a realistic condition that fits; vary it — not always the most common one. ${["phc", "chc", "district"].includes(brief.level) ? "At this level, choose a condition commonly seen at such a facility — common or important presentations, no rare diseases (no rare syndromes, inborn errors, eosinophilic or genetic disorders)." : brief.level === "college" ? "Uncommon conditions are fine, rare ones occasionally." : "Rare and complex conditions are expected here."}`} The condition and its cause must occur where the patient lives (${country.name}) — never a disease, organism or venomous animal found only elsewhere in the world (Sin Nombre hantavirus, Lyme disease, coccidioidomycosis or rattlesnakes in India, say) unless recent travel is part of the story. patient.age must match the story exactly, as a plain number of whole years (0 for a baby under one year).
Return compact JSON — short phrases, not sentences: { "specialty", "difficulty": 1|2|3, "patient": { "name", "age", "sex": "Male"|"Female", "city", "occupation" }, "briefing": "one non-diagnostic line setting the scene", "diagnosis", "qualifier": "cause, severity, key context", "keyHistory": ["up to 8: what the patient will report — positives and important negatives"], "keyExam": ["up to 6 signs present"], "keyResults": ["up to 6 abnormal results, with values"], "pictures": ["each finding a doctor would look at as a picture, e.g. 'exam: rash on both shins (photo)', 'test: chest X-ray PA'"], "ecg": "ECG findings if an ECG is relevant", "differentials": ["3–5"], "plan": ["up to 6 management steps"] }`,
    },
  ];
}

const partHead = (concept: Concept, brief: Brief) =>
  `THE CASE (every part must agree with it):\n${JSON.stringify({ ...concept, setting: brief.track === "emergency" ? "ER" : "OPD" })}\n\n`;

function dialoguePrompt(opts: StartOptions, concept: Concept, brief: Brief): ChatMessage[] {
  return [
    { role: "system", content: authoring(opts.country ?? "IN") },
    {
      role: "user",
      content: `${partHead(concept, brief)}${brief.persona ? `The patient is ${brief.persona}: it shows naturally in how they speak — now and then, not repeated in every reply. ` : ""}Write what the patient and family say, and the vital signs. Return JSON:
{ "opening": [{ "role": "patient"|"attendant"|"nurse"|"system", "kind": "speech"|"action"|"status", "text" }] (1–3 lines: how the patient arrives and their first words — no diagnosis),
  "baselineVitals": { "bp": "128/82", "hr": "88", "rr", "temp" (°F), "spo2", "rbs", "weight", "height", "gcs"?, "pain"? },
  "triageVitals": ["vitals already on the board on arrival"],
  "profile": { "allergies": [], "currentDrugs": [], "pregnancyPossible"?, "asthma"?, "ckd"?, "heartFailure"?, "volume": "depleted"|"normal"|"overloaded" (the patient's fluid state now), "fluidDeficitMlPerKg"?: how much fluid they are short of, mL/kg — e.g. 30 for moderate dehydration or septic shock, 70–100 for DKA or severe cholera; 0 if not depleted },
  "history": [{ "id": "short_snake_case", "group": "complaint"|"hpi"|"past"|"medication"|"allergy"|"family"|"social"|"diet"|"sexual"|"obstetric"|"systemic", "label", "match": ["3–8 short lowercase phrases a doctor might type"], "reply": "what the patient says, lay words", "fact": "the fact in clinical shorthand", "abnormal"?, "importance": "essential"|"useful"|"minor", "speaker"?: "attendant" }] }
history: 8–12 entries — the presenting complaint, its course, relevant positives and negatives, past history, medicines and allergies. Every positive in the case must be here. The complaint's reply says how long it has been going on, and its match includes "how long", "since when" and "kab se"; when a relative answers for a child, they speak of the child as he or she.`,
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
      content: `${partHead(concept, brief)}Write the management and the marking key, following ${specialtyGuidelines(concept.specialty ?? brief.specialty, opts.country ?? "IN")} exclusively where they apply. Every label is complete (no trailing fragments) and under 80 characters; every critique speaks to the doctor about what they did or didn't do ("Didn't check the sugar"), never about the case text. Return JSON:
{ "therapeutics": [{ "id", "kind": "drug"|"procedure"|"counsel"|"referral"|"admit"|"discharge"|"supportive", "drugIds"?, "drugClasses"?, "measureIds"?, "concernsDrugs"?, "match"?: ["phrases a doctor might type"], "label", "appropriateness": "ideal"|"acceptable"|"neutral"|"unnecessary"|"harmful"|"dangerous", "note"?, "critique"?: { "what", "why" (one line — and the guideline it follows, e.g. WHO, ICMR, NICE or AHA, where one applies), "better", "severity": "minor"|"moderate"|"major" }, "praise"? }],
  "reasoning": [{ "stage": "History", "text" }, { "stage": "Examination", "text" }, { "stage": "Investigation", "text" }, { "stage": "Diagnosis", "text" }],
  "rubric": { "diagnosisAccept": ["names and synonyms that count as correct"], "diagnosisPartial": [], "diagnosisWrong": ["words that make an otherwise-close diagnosis wrong, e.g. the wrong type, side or organism"], "differentials": [], "idealTreatment": [["therapeutic ids, any one of which satisfies this step"], …], "expertActionCount", "followUpDays"?: { "min", "max" }, "expectsReassessment" },
  "followUp": [{ "when": "ideal"|"acceptable"|"harmful"|"untreated"|"any", "status": "recovered"|"improving"|"stable"|"guarded"|"deteriorating"|"critical", "lines": [{ "role", "kind", "text" }] }] } — follow-up lines are what the patient or family say and what is seen or measured; never name the diagnosis or a complication
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

/** Vital signs as the monitor shows them — numbers only ("89% on room air" → "89", "68 kg" → "68"); anything unreadable is dropped. */
export function cleanVitals(vitals: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(vitals)) {
    const text = String(raw);
    // Heights written as 5'7", 5 ft 7 in or 1.72 m become centimetres.
    if (key === "height") {
      const ft = text.match(/(\d)\s*(?:'|ft|feet|foot)\s*(\d{1,2})?/i);
      const m = text.match(/^\s*([12](?:\.\d+)?)\s*m\b/i) ?? text.match(/^\s*([12]\.\d+)\s*$/);
      if (ft) {
        out.height = String(Math.round(Number(ft[1]) * 30.48 + Number(ft[2] ?? 0) * 2.54));
        continue;
      }
      if (m) {
        out.height = String(Math.round(Number(m[1]) * 100));
        continue;
      }
    }
    const value = key === "bp" ? text.match(/(\d{2,3})\s*\/\s*(\d{2,3})/)?.slice(1, 3).join("/") : text.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/)?.[0];
    if (value) out[key] = value;
  }
  return out;
}

const DRUG_IDS = new Set(FORMULARY.map((d) => d.id));
const MEASURE_IDS = new Set(MEASURES.map((m) => m.id));
/** The debrief's teaching arrives later (written in the background); until then, an empty frame. */
const NO_TEACHING: ClinicalCaseDefinition["teaching"] = { severityBands: [], treatmentByBand: {}, drugs: [], routines: [], followUp: { interval: "", reassess: [], redFlags: [], whenToEscalate: [] }, treatmentFailure: { steps: [] }, pearl: "" } as unknown as ClinicalCaseDefinition["teaching"];

function toDefinition(concept: Concept, d: z.infer<typeof DialogueSchema>, f: z.infer<typeof FindingsSchema>, m: z.infer<typeof ManagementSchema>, brief: Brief, opts: StartOptions): ClinicalCaseDefinition {
  const pictures: NonNullable<ClinicalCaseDefinition["pictures"]> = {};
  const unique = <T extends { id: string }>(xs: T[]) => xs.filter((x, i) => x.id && xs.findIndex((y) => y.id === x.id) === i);
  // A treatment's trigger words never include a test's name ("urine", "urine r/m", "ecg"): ordering the test isn't the treatment.
  const testWords = new Set(INVESTIGATIONS.flatMap((i) => i.match.map((x) => x.toLowerCase())).concat(["urine", "blood", "bloods", "test", "tests", "report", "reports"]));
  // A step that isn't a drug never fires on a drug's name ("ciprofloxacin" can't run "empiric antibiotics — done"): that's an order.
  // A step that isn't a drug never fires on a drug's name ("ciprofloxacin" can't run "empiric antibiotics — done"): that's an order.
  const keep = (t: { kind: string }, phrase: string) => !testWords.has(phrase.toLowerCase().trim()) && (t.kind === "drug" || !namesDrug(phrase));
  // A step that names drugs ("an oral NSAID") is a drug step — so ordering ibuprofen gives ibuprofen, not "… — done".
  // (Advice keeps its kind: "avoid NSAIDs" is counselling about a drug.)
  const therapeutics = unique(m.therapeutics).map((t) => ({ ...t, ...(t.kind !== "drug" && t.kind !== "counsel" && (t.drugIds.some((x) => DRUG_IDS.has(x)) || t.drugClasses.length > 0) ? { kind: "drug" as const } : {}), drugIds: t.drugIds.filter((x) => DRUG_IDS.has(x)), measureIds: t.measureIds.filter((x) => MEASURE_IDS.has(x)), match: (t.match ?? []).filter((x) => keep(t, x)) }));
  const known = new Set(therapeutics.map((t) => t.id));
  const named = [concept.diagnosis, ...m.rubric.diagnosisAccept].map((x) => x.toLowerCase().trim()).filter((x) => x.length > 3);
  const giveaway = (text: string) => named.some((x) => text.toLowerCase().includes(x));
  return {
    id: `gen-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    pictures,
    // The specialty the doctor chose (the outline sometimes names a neighbour: "Medicine" for an eye case).
    specialty: brief.specialty,
    track: brief.track,
    level: brief.level,
    setting: brief.track === "emergency" ? "ER" : "OPD",
    weight: 1,
    difficulty: (opts.easy ? 1 : opts.hard ? 3 : concept.difficulty) as 1 | 2 | 3,
    ...(opts.country ? { countries: [opts.country] } : {}),
    ...(brief.persona ? { persona: brief.persona } : {}),
    patient: { name: concept.patient.name, age: concept.patient.age, sex: concept.patient.sex, city: concept.patient.city, occupation: concept.patient.occupation, context: brief.track === "emergency" ? "Emergency" : "OPD" } as ClinicalCaseDefinition["patient"],
    arrivalMinuteOfDay: 8 * 60 + Math.floor(Math.random() * 10 * 60),
    briefing: concept.briefing,
    // (An empty line — a toddler "says" nothing — is left out, never shown as an empty bubble.)
    opening: (() => {
      const lines = d.opening.filter((o) => typeof o.text === "string" && o.text.trim().length > 0);
      return lines.length ? lines : [{ role: "patient", kind: "speech", text: "Namaste, doctor." }];
    })() as ClinicalCaseDefinition["opening"],
    baselineVitals: Object.fromEntries(Object.entries({ bp: "122/78", hr: "84", rr: "16", temp: "98.4", spo2: "98", weight: "62", ...cleanVitals(d.baselineVitals) }).map(([k, v]) => [k, { key: k, value: v }])) as ClinicalCaseDefinition["baselineVitals"],
    triageVitals: d.triageVitals as ClinicalCaseDefinition["triageVitals"],
    profile: d.profile,
    history: unique(d.history).filter((h) => h.match.length > 0) as ClinicalCaseDefinition["history"],
    exam: unique(f.exam).map((e) => ({ ...e, media: mediaOf(e.media, pictures) })) as ClinicalCaseDefinition["exam"],
    // A bedside test (visual acuity, fluorescein, 20WBCT, dipstick) needs no lab: it can be done at any level.
    investigations: unique(f.investigations).map((i) => ({ ...i, rows: i.rows.length ? i.rows : undefined, media: mediaOf(i.media, pictures), ...(i.category === "bedside" || BEDSIDE_TEST.test(`${i.id} ${i.name ?? ""}`) ? { minLevel: "phc" as const } : {}) })) as ClinicalCaseDefinition["investigations"],
    // Only drugs and measures the engine knows: anything else could never be matched.
    therapeutics: therapeutics as ClinicalCaseDefinition["therapeutics"],
    hazards: [],
    // A follow-up shows what's seen and said — a line naming the diagnosis ("the acute kidney injury remains") would give it away.
    followUp: m.followUp.map((f) => ({ ...f, lines: f.lines.filter((l) => !(l.role === "system" && giveaway(l.text))).map((l) => (l.role === "system" && l.kind === "speech" ? { ...l, kind: "finding" } : l)) })) as ClinicalCaseDefinition["followUp"],
    truth: {
      diagnosis: concept.diagnosis,
      qualifier: concept.qualifier,
      reasoning: (["History", "Examination", "Investigation", "Diagnosis"] as const).map((stage) => ({ stage, text: m.reasoning.find((r) => r.stage === stage)?.text ?? "" })),
    },
    rubric: {
      diagnosisAccept: m.rubric.diagnosisAccept.length ? m.rubric.diagnosisAccept : [concept.diagnosis],
      diagnosisPartial: m.rubric.diagnosisPartial,
      ...(m.rubric.diagnosisWrong?.length ? { diagnosisWrong: m.rubric.diagnosisWrong } : {}),
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
    { role: "system", content: `You write concise, guideline-accurate teaching for a clinical simulation's debrief (shown only after the case). Follow ${specialtyGuidelines(def.specialty, def.countries?.[0] ?? "IN")} exclusively where they apply. Output JSON only.` },
    {
      role: "user",
      content: `Case: ${def.patient.age}-year-old ${def.patient.sex}. ${def.briefing}
Diagnosis: ${def.truth.diagnosis}${def.truth.qualifier ? ` — ${def.truth.qualifier}` : ""}.
Items in the case (id, what, importance): ${items.join("; ")}

Return JSON:
{ "teaching": { "patientBand": "the id of this patient's severity band", "severityBands": [{ "id", "label", "recognition": [], "investigation": [], "treatment": [], "followUp": [] }] (2–4 bands), "drugs": [{ "generic", "brand", "dose", "route": "PO"|"IV"|"IM"|"SC"|"SL"|"PR"|"TOP"|"INH"|"NEB"|"IN", "frequency", "duration", "indication", "mechanism", "whyItWorks", "avoidWhen": [], "adverseEffects": [], "monitoring": [] }] (1–4), "routines": [], "followUp": { "interval", "reassess": [], "redFlags": [], "whenToEscalate": [] }, "treatmentFailure": { "steps": [] }, "pearl": "one memorable teaching point", "sources": ["1–3 real, widely recognised sources this treatment follows, in this order: the current guideline for this exact condition where one exists (e.g. 'National Snakebite Management Protocol (MoHFW, 2017)', 'GINA 2024', 'Surviving Sepsis Campaign 2021'), else the specialty body's guideline (e.g. 'IAP Standard Treatment Guidelines'), and the standard textbook (e.g. 'Nelson Textbook of Pediatrics'); every drug and dose in this teaching must agree with them; no page numbers, never invent a title or a year"] },
  "misses": { "<id of an essential or useful item>": { "what": "what the doctor didn't do, said to them (\"Didn't check renal function\") — never about the case notes or the record", "why": "why it matters here, in one line — naming the guideline (WHO, ICMR, NICE, AHA…) where one applies", "better": "the better approach", "severity": "minor"|"moderate"|"major" } },
  "strengths": { "<id>": "what doing it well shows" } }
misses and strengths: one for each essential item and the most useful ones; keys must be ids from the list.`,
    },
  ];
}

/* -------------------------------------------------------------------------- */
/* After the case: pearls and exam-style questions                             */
/* -------------------------------------------------------------------------- */

/** The exam each country's doctors sit, and how its questions are written. */
const EXAM: Record<Country, { name: string; board: string; options: number; style: string }> = {
  IN: {
    name: "NEET PG & INI-CET",
    board: "the National Board of Examinations and AIIMS",
    options: 4,
    style: "NEET PG / INI-CET single best answer: a one-to-three-line stem — a short clinical vignette or a direct question — and FOUR options. High-yield, as Indian postgraduate entrance exams test: drug of choice, investigation of choice, most common cause, characteristic sign, next best step, per standard Indian textbooks and national guidelines",
  },
  WW: {
    name: "International licensing exams (FMGE, PLAB, USMLE, AMC)",
    board: "international medical licensing boards",
    options: 4,
    style: "Single best answer: a short clinical vignette and FOUR options, high-yield and guideline-based (WHO where it applies): diagnosis, next best step, drug of choice, investigation of choice",
  },
  US: {
    name: "USMLE Step 2 CK",
    board: "the NBME",
    options: 5,
    style: "USMLE Step 2 CK single best answer: a clinical vignette (age, sex, setting, presentation, vital signs, key examination and laboratory findings) ending in one lead-in — e.g. 'Which of the following is the most appropriate next step in management?' — with FIVE homogeneous options, per current US guidelines",
  },
  UK: {
    name: "UKMLA & PLAB 1",
    board: "the GMC",
    options: 5,
    style: "UKMLA AKT / PLAB 1 single best answer: a short clinical vignette with one lead-in and FIVE options, per NICE, CKS and the BNF",
  },
};

function caseSummary(def: ClinicalCaseDefinition) {
  const abnormalExam = def.exam.filter((e) => e.abnormal).map((e) => `${e.label}: ${e.finding}`);
  const results = def.investigations.flatMap((i) => [...(i.rows ?? []).filter((r) => r.flag !== "normal").map((r) => `${r.analyte} ${r.value}${r.unit ? ` ${r.unit}` : ""}`), ...(i.report ? [`${i.name ?? i.id}: ${i.report}`] : [])]);
  const ideal = def.therapeutics.filter((t) => t.appropriateness === "ideal").map((t) => t.label);
  return JSON.stringify({
    diagnosis: def.truth.diagnosis,
    qualifier: def.truth.qualifier,
    patient: `${def.patient.age}-year-old ${def.patient.sex}`,
    setting: `${def.setting}, ${levelMeta(def.level).label}`,
    examination: abnormalExam.slice(0, 6),
    results: results.slice(0, 10),
    idealManagement: ideal.slice(0, 8),
    pearl: def.teaching.pearl || undefined,
  });
}

function learnPrompt(def: ClinicalCaseDefinition, country: Country): ChatMessage[] {
  const exam = EXAM[country];
  return [
    { role: "system", content: `You are a senior clinician and an experienced item writer for ${exam.name} (${exam.board}). Every fact you write is accurate and current — ${GUIDELINES[country]}. Output JSON only.` },
    {
      role: "user",
      content: `THE CASE (finished — the diagnosis can be named): ${caseSummary(def)}

Write, for a doctor preparing for ${exam.name}:
- "pearls": 3–5 high-yield clinical pearls this case teaches — specific, practical and memorable, one sentence each.
- "mcqs": 5 questions in ${exam.style}. Test what this case needs: the diagnosis, the right investigation, management, a complication, and one closely related high-yield fact. Exactly one best answer each; plausible, homogeneous distractors; no "all of the above" or "none of the above". In explanations, refer to options by their content, never by letter or position.
Each question: {"stem","options":[${exam.options} options],"answer": the 0-based index of the best answer,"explanation":"short lines (one point per line, separated by \\n, key words in **bold**): why it's right, then one line for each other option saying why it isn't","topic":"a short tag, e.g. 'STEMI — reperfusion'","difficulty":"easy"|"medium"|"hard"}
Return {"pearls":[…],"mcqs":[…]}`,
    },
  ];
}

function examinerPrompt(def: ClinicalCaseDefinition, country: Country, draft: z.infer<typeof LearnSchema>): ChatMessage[] {
  const exam = EXAM[country];
  return [
    { role: "system", content: `You are a senior examiner for ${exam.name} (${exam.board}). You check every question before a candidate sees it, against ${GUIDELINES[country]}. Output JSON only.` },
    {
      role: "user",
      content: `THE CASE: ${caseSummary(def)}

PEARLS: ${JSON.stringify(draft.pearls)}
QUESTIONS: ${JSON.stringify(draft.mcqs.map((q, index) => ({ index, ...q })))}

For each question: is there exactly one best answer, and is the key right per current guidelines? Is the explanation correct? Is the stem unambiguous, with homogeneous, plausible options, in ${exam.name} style? Are the pearls accurate?
Return {"fixes":[{"index","answer"?: corrected 0-based key,"stem"?,"options"?: the whole corrected list,"explanation"?,"drop"?: true if it can't be saved,"why":"one line"}],"pearls"?: [the corrected pearls, only if any was wrong]} — {"fixes":[]} if all is right.`,
    },
  ];
}

/** The best answer in a random place — models favour the second option. Explanations name options by content, so moving them is safe. */
function shuffleOptions<T extends { options: string[]; answer: number }>(q: T, random = Math.random): T {
  const order = q.options.map((_, i) => i).sort(() => random() - 0.5);
  return { ...q, options: order.map((i) => q.options[i]!), answer: order.indexOf(q.answer) };
}

/* -------------------------------------------------------------------------- */
/* Provider                                                                    */
/* -------------------------------------------------------------------------- */

/** The rules couldn't place it: ask the model what the doctor meant. */
async function understand(text: string, ctx: InterpretContext, ruled: ResolvedIntent[]): Promise<Interpretation> {
  try {
    // The rules' reading, as a colleague's first guess — the model keeps it when it's right and corrects it when it isn't.
    const guess = ruled.filter((i) => i.kind !== "unknown").map((i) => `${i.kind}${i.targetId ? `:${i.targetId}` : ""}${i.payload && Object.keys(i.payload).length ? ` ${JSON.stringify(i.payload)}` : ""}`).join("; ");
    const raw = await chatJSON(interpretPrompt(ctx.def, text, ctx, guess), 2400, true, 25_000);
    const parsed = PatientResponseSchema.safeParse(raw);
    if (!parsed.success) return { intents: ruled };
    const { speaker } = parsed.data;
    // A parent answering for a small child in the child's voice ("I haven't had a fever"): put back in the third person.
    const firstPerson = /^(?:no,?\s+|yes,?\s+)?(?:doctor,?\s+)?I(?:'ve| have|'m| am| feel| haven't| don't| sleep| slept| had| was)\b/i;
    const roomSoFar = `${ctx.def.history.map((h) => h.reply).join(" ")} ${ctx.transcript.map((m) => m.text).join(" ")}`;
    if (parsed.data.message && leaksDiagnosis(ctx.def, parsed.data.message, roomSoFar)) {
      console.warn("[ramai] a model reply named the diagnosis; the rules' reading stands");
      return { intents: ruled };
    }
    const message = parsed.data.message && speaker === "attendant" && ctx.def.patient.age < 12 && firstPerson.test(parsed.data.message) && !/\b(he|she|him|her|his|my (?:son|daughter|child|baby))\b/i.test(parsed.data.message)
      ? aboutThem(parsed.data.message, ctx.def.patient.sex)
      : parsed.data.message;
    const intents: ResolvedIntent[] = [];
    const generated: Record<string, string> = {};
    // The one reply goes to the first intent that needs words: a question the case file doesn't cover, or anything no id covers.
    const say = (index: number) => {
      if (!message || Object.keys(generated).length > 0) return false;
      generated[String(index)] = message;
      return true;
    };
    // A question to the patient ("urine ok?") is never an order: a test the model read into it is dropped.
    const askedOnly = /\?\s*$/.test(text.trim()) && !/\b(order|send|do|get|check|test|repeat|report|result)\b/i.test(text);
    for (const i of parsed.data.intents) {
      if (askedOnly && (i.kind === "investigation" || i.kind === "drug")) continue;
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

/**
 * Results the case file doesn't have — an analyte it never gave, a scan it
 * never reported — written by the lab for this patient, consistent with the
 * diagnosis, the stage of the illness and every value already known. One call
 * for everything ordered in the turn; kept with the action, so it never changes.
 */
async function completeLabs(ctx: InterpretContext, intents: ResolvedIntent[]): Promise<Record<string, string>> {
  const gaps = intents
    .filter((i) => i.kind === "investigation" && i.targetId && !i.payload?.reshow)
    .map((i) => labGap(ctx.def, ctx.hidden, i.targetId!, i.phrase))
    .filter((g): g is NonNullable<typeof g> => g !== null);
  const unique = gaps.filter((g, i) => gaps.findIndex((x) => x.id === g.id) === i).slice(0, 6);
  if (unique.length === 0) return {};
  const def = ctx.def;
  const known = [
    ...ctx.hidden.investigations.flatMap((i) => (i.result.rows ?? []).map((r) => `${r.analyte} ${r.value}${r.unit ? ` ${r.unit}` : ""}`)),
    ...def.investigations.flatMap((i) => [...(i.rows ?? []).map((r) => `${r.analyte} ${r.value}${r.unit ? ` ${r.unit}` : ""}`), ...(i.report ? [`${i.name ?? i.id}: ${i.report}`] : [])]),
  ];
  const asked = unique.map((g) =>
    g.adhoc ? `- ${g.id} (${g.name}): a test this hospital does — report it fully for this patient: every analyte with its unit and reference range, or, for a scan, biopsy or scope, a report of the actual findings and an impression. Never say it's unavailable or that there are no findings` : g.report ? `- ${g.id} (${g.name}): the report` : `- ${g.id} (${g.name}): ${g.analytes.map((a) => `${a.analyte}${a.unit ? ` [${a.unit}]` : ""}${a.reference ? ` (ref ${a.reference})` : ""}`).join("; ")}`,
  );
  try {
    const raw = (await chatJSON(
      [
        {
          role: "system",
          content: `You are the laboratory and radiology department of a hospital in RamAI, an educational clinical simulation for doctors in ${WHERE[ctx.country ?? "IN"]}. You report results for one patient — exactly what a real patient with this condition, at this point in the illness and after the treatment so far, would show — consistent with every value already known. A value the condition wouldn't change is normal. Radiology reports state findings and an impression in one to three sentences, with no advice. Every test asked for was done and every value is a real result (never "not obtained", "not measured" or "pending"): never say it wasn't performed, isn't available or has no findings — a test this condition wouldn't change is reported normal. Output JSON only. Each test reports its own specimen only: a urine test gives urine values (urine glucose and ketones as Nil/Trace/+ to ++++, urine pH 4.5–8), never a blood glucose, blood pH or blood-gas value; CSF and body fluids likewise.`,
        },
        {
          role: "user",
          content: `PATIENT: ${def.patient.age}-year-old ${def.patient.sex}. Diagnosis: ${def.truth.diagnosis}${def.truth.qualifier ? ` (${def.truth.qualifier})` : ""}.
Key findings: ${def.exam.filter((e) => e.abnormal).map((e) => `${e.label}: ${e.finding}`).slice(0, 6).join("; ") || "none recorded"}.
Values already known: ${known.slice(0, 40).join("; ") || "none"}.
NOW: ${stateNote(ctx)}

Report these (use the units and reference ranges given):
${asked.join("\n")}

Return {"results":[{"test":"<id>","rows":[{"analyte","value","unit","reference","flag":"normal|high|low|critical"}],"report":"<only for a report>"}]}`,
        },
      ],
      1200,
      false,
      12_000,
    )) as { results?: { test?: string; rows?: { analyte?: string; value?: unknown; unit?: string; reference?: string; flag?: string }[]; report?: string }[] };
    const out: Record<string, string> = {};
    for (const g of unique) {
      const r = raw?.results?.find((x) => x.test === g.id);
      if (!r) continue;
      if (g.adhoc) {
        const free = (r.rows ?? [])
          .filter((x) => typeof x.analyte === "string" && (typeof x.value === "string" || typeof x.value === "number") && !NO_VALUE.test(String(x.value)))
          .slice(0, 12)
          .map((x) => flagFromRange({ analyte: String(x.analyte).slice(0, 60), value: String(x.value).slice(0, 24), unit: x.unit?.slice(0, 20), reference: x.reference?.slice(0, 40), flag: ["normal", "high", "low", "critical"].includes(String(x.flag)) ? (x.flag as "normal") : "normal" }));
        const said = typeof r.report === "string" && !NO_VALUE.test(r.report) ? r.report.trim().slice(0, 600) : undefined;
        if (free.length || said) out[`lab:${g.id}`] = JSON.stringify({ ...(free.length ? { rows: free } : {}), ...(said ? { report: said } : {}) });
        continue;
      }
      const rows = g.analytes
        .map((a) => {
          const got = r.rows?.find((x) => typeof x.analyte === "string" && x.analyte.toLowerCase().replace(/[^a-z0-9]/g, "") === a.analyte.toLowerCase().replace(/[^a-z0-9]/g, ""));
          if (!got || (typeof got.value !== "string" && typeof got.value !== "number") || NO_VALUE.test(String(got.value))) return null;
          const flag = ["normal", "high", "low", "critical"].includes(String(got.flag)) ? (got.flag as "normal") : "normal";
          return flagFromRange({ analyte: a.analyte, value: String(got.value).slice(0, 24), unit: a.unit, reference: a.reference, flag });
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
      const report = g.report && typeof r.report === "string" && !NO_VALUE.test(r.report) ? r.report.trim().slice(0, 600) : undefined;
      if (rows.length || report) out[`lab:${g.id}`] = JSON.stringify({ ...(rows.length ? { rows } : {}), ...(report ? { report } : {}) });
    }
    return out;
  } catch (err) {
    console.error("[ramai] lab results fell back to normal values", err instanceof Error ? err.message : err);
    return {};
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
      // (No reasoning: measured, a little thinking made each turn about a second slower for wording no better.)
      700 + 250 * items.length,
      false,
      20_000,
    );
    const parsed = VoiceSchema.safeParse(raw);
    if (!parsed.success || parsed.data.replies.length !== items.length) return { intents: ruled };
    const generated: Record<string, string> = {};
    const roomSoFar = `${items.map((x) => x.entry.reply).join(" ")} ${ctx.transcript.map((m) => m.text).join(" ")}`;
    items.forEach((x, k) => {
      const reply = parsed.data.replies[k]?.trim();
      // (A reply naming the diagnosis is dropped: the scripted words are said instead.)
      if (reply && !leaksDiagnosis(ctx.def, reply, roomSoFar)) generated[String(x.index)] = reply;
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
      let brief = caseBrief(opts);
      // General practice is made to learn from: always the easy, classic kind of case.
      if (brief.specialty === "General Practice" && !opts.easy) {
        opts = { ...opts, specialty: "General Practice", easy: true };
        brief = caseBrief(opts);
      }
      const country = opts.country ?? "IN";
      const started = Date.now();
      const left = () => CASE_DEADLINE_MS - (Date.now() - started);
      // A second attempt gets what's left of the deadline: the parts must still be reviewed in time.
      const partTimeout = () => Math.max(20_000, Math.min(PART_TIMEOUT_MS, left() - 35_000));
      const invent = async (): Promise<CaseSource> => {
        // The outline is quick; if it times out (a slow moment upstream) it's asked for once more.
        const outlineRaw = await chatJSON(outlinePrompt(opts, brief), 900, false, OUTLINE_TIMEOUT_MS).catch((err) => {
          if (left() < 85_000) throw err;
          console.warn("[ramai] the outline didn't come back in time; asking once more:", err instanceof Error ? err.message : err);
          return chatJSON(outlinePrompt(opts, brief), 900, false, OUTLINE_TIMEOUT_MS);
        });
        const outline = ConceptSchema.safeParse(outlineRaw);
        if (!outline.success || !outline.data.diagnosis) throw new UpstreamError("the outline failed its checks");
        if (outline.data.patient.age === null) throw new UpstreamError("the outline gave no readable age");
        // A child's specialty must have a child.
        if (brief.specialty === "Pediatrics" && outline.data.patient.age > 17) throw new UpstreamError(`a paediatric case came back with an adult (age ${outline.data.patient.age})`);
        const concept = { ...outline.data, patient: { ...outline.data.patient, age: outline.data.patient.age } };
        const level = levelMeta(brief.level, country).label;
        // Each part is written, then checked by a consultant the moment it's ready — the three in parallel.
        let [d, f, m] = await Promise.all([
          chatJSON(dialoguePrompt(opts, concept, brief), 3400, false, partTimeout())
            .then((x) => DialogueSchema.parse(x))
            .then((part) => reviewPart("history and vitals", part, dialogueReviewPrompt(concept, part, country), 5000, applyDialogueReview, left())),
          chatJSON(findingsPrompt(opts, concept, brief), 5800, false, partTimeout())
            .then((x) => FindingsSchema.parse(x))
            .then((part) => reviewPart("findings and results", part, findingsReviewPrompt(concept, part, country), 8000, applyFindingsReview, left()))
            .then((part) => {
              const checked = checkLabFlags(part);
              if (checked.fixes.length) console.info(`[ramai] lab flags corrected: ${checked.fixes.join(" | ")}`);
              return checked.part;
            }),
          chatJSON(managementPrompt(opts, concept, brief), 3400, false, partTimeout())
            .then((x) => ManagementSchema.parse(x))
            .then((part) => reviewPart("management and marking key", part, managementReviewPrompt(concept, part, country, level), 6000, applyManagementReview, left())),
        ]);
        if (d.history.length < 4 || f.exam.length < 1 || m.therapeutics.length < 2) {
          throw new UpstreamError(`a part came back too thin (history ${d.history.length}, exam ${f.exam.length}, treatments ${m.therapeutics.length})`);
        }
        const impossible = sanityProblems(concept, d.baselineVitals);
        if (impossible.length) throw new UpstreamError(`the case failed its sanity checks: ${impossible.join("; ")}`);
        let def = withUntreatedCourse(toDefinition(concept, d, f, m, brief, opts), brief.track === "emergency" && brief.specialty !== "General Practice");
        // The whole case, read at once by a senior. What they find is sent back to the part reviewers to correct — the
        // case is repaired, not thrown away — and only then used. (The model thinks before answering: give it room, or the
        // reply comes back empty.) If the senior can't answer at all, the case stands on its parts' reviews.
        const verdict = (await chatJSON(coherencePrompt(def), 6000, true, Math.max(20_000, Math.min(40_000, left() + 15_000))).catch((err) => {
          console.warn("[ramai] the senior review didn't answer; the case stands on its parts' reviews:", err instanceof Error ? err.message : err);
          return { verdict: "ok", problems: [] };
        })) as { verdict?: string; problems?: unknown };
        if (verdict?.verdict !== "ok") {
          const problems = Array.isArray(verdict?.problems) ? verdict.problems.map(String).filter(Boolean) : [];
          if (!problems.length || left() < 20_000) throw new UpstreamError(`the senior review rejected the case and there was no time to repair it: ${problems.join(" | ").slice(0, 800)}`);
          console.info(`[ramai] senior review: ${problems.length} problem${problems.length === 1 ? "" : "s"} sent back for correction: ${problems.join(" | ").slice(0, 900)}`);
          const withProblems = (prompt: ChatMessage[]): ChatMessage[] => [
            ...prompt,
            { role: "user", content: `A senior consultant read the whole case and found these problems. Correct every one that concerns this part (and anything else wrong in it), using the same JSON format:\n- ${problems.join("\n- ")}` },
          ];
          [d, f, m] = await Promise.all([
            reviewPart("history and vitals (repair)", d, withProblems(dialogueReviewPrompt(concept, d, country)), 5000, applyDialogueReview, left()),
            reviewPart("findings and results (repair)", f, withProblems(findingsReviewPrompt(concept, f, country)), 8000, applyFindingsReview, left()).then((part) => checkLabFlags(part).part),
            reviewPart("management and marking key (repair)", m, withProblems(managementReviewPrompt(concept, m, country, level)), 6000, applyManagementReview, left()),
          ]);
          const still = sanityProblems(concept, d.baselineVitals);
          if (still.length) throw new UpstreamError(`the repaired case failed its sanity checks: ${still.join("; ")}`);
          def = withUntreatedCourse(toDefinition(concept, d, f, m, brief, opts), brief.track === "emergency" && brief.specialty !== "General Practice");
        }
        return { kind: "generated", def };
      };
      try {
        try {
          return await invent();
        } catch (first) {
          // Failed early (a dropped connection, a case that didn't pass its checks): there is time to invent another.
          if (left() < 70_000) throw first;
          console.warn("[ramai] the first patient couldn't be invented; trying a fresh one:", first instanceof Error ? first.message : first);
          return await invent();
        }
      } catch (err) {
        console.error("[ramai] couldn't invent a patient; using a written case", err instanceof Error ? err.message : err);
        // A written case for this choice — or one in the same specialty. Never another specialty's patient: an eye
        // doctor handed a skin case would be misled, so then the doctor is asked to try again.
        return mockProvider.createCase(opts)
          // Same specialty and mode (a phone call stays a phone call) at any level.
          .catch(() => mockProvider.createCase({ ...opts, level: undefined, allowedLevels: undefined }))
          .catch(() => {
            throw new NoCaseError(`We couldn't prepare a new ${opts.specialty ?? ""} case just now — please press Start again.`.replace("  ", " "));
          });
      }
    },

    async teach(def) {
      try {
        // Written in the background, so it can take the time to reason carefully.
        // (The model thinks before it writes: too little room and the reply comes back cut off or empty.)
        const parsed = TeachingSchema.safeParse(await chatJSON(teachingPrompt(def), 9000, true, 60_000));
        if (parsed.success && parsed.data.teaching.drugs.length > 0) return parsed.data;
        console.warn("[ramai] teaching came back incomplete; asking once more", parsed.success ? "no drugs" : parsed.error.issues.slice(0, 3).map((i) => i.path.join(".")).join(", "));
        // (If the second try fails too, the first answer's other teaching is kept rather than lost.)
        const again = TeachingSchema.safeParse(await chatJSON(teachingPrompt(def), 9000, false, 45_000).catch(() => null));
        return again.success && again.data.teaching.drugs.length > 0 ? again.data : parsed.success ? parsed.data : again.success ? again.data : undefined;
      } catch (err) {
        console.error("[ramai] teaching unavailable", err instanceof Error ? err.message : err);
        return undefined;
      }
    },
    /** Pearls and exam questions: written carefully, then checked by an examiner before anyone answers them. */
    async learn(def, country) {
      try {
        const draft = LearnSchema.safeParse(await chatJSON(learnPrompt(def, country), 4400, true, 50_000));
        if (!draft.success || draft.data.mcqs.length < 3) return undefined;
        const reviewed = await chatJSON(examinerPrompt(def, country, draft.data), 2800, true, 40_000)
          .then((raw) => applyExaminerReview(draft.data, raw))
          .catch(() => ({ part: draft.data, fixes: [] as string[] }));
        if (reviewed.fixes.length) console.info(`[ramai] examiner review: ${reviewed.fixes.join(" | ").slice(0, 600)}`);
        if (reviewed.part.mcqs.length < 3) return undefined;
        return { exam: EXAM[country].name, pearls: reviewed.part.pearls, mcqs: reviewed.part.mcqs.map((q) => shuffleOptions(q)), model: openAIConfig().model };
      } catch (err) {
        console.error("[ramai] pearls and questions unavailable", err instanceof Error ? err.message : err);
        return undefined;
      }
    },
    resolveCase: (src) => mockProvider.resolveCase(src),
    /** Any specialty, mode or level can be invented. */
    async availability() {
      const all = <K extends string>(keys: readonly K[]) => Object.fromEntries(keys.map((k) => [k, 999])) as Partial<Record<K, number>>;
      return { specialties: all(ALL_SPECIALTIES), tracks: all(PLAYABLE_TRACKS), levels: all(CARE_LEVELS) };
    },

    async interpret(text, ctx): Promise<Interpretation> {
      // Rules first: instant and free. What they can't place, the model answers — in the guided demo too.
      const rules = await mockProvider.interpret(text, ctx);
      // The senior's button and "Full history" are carried out exactly by the simulator — nothing to read.
      if (text.trim() === ctx.hidden.seniorStep?.text || /^(?:take\s+)?(?:a\s+|the\s+)?(?:full|complete|whole|important)\s+history\.?$/i.test(text.trim())) return rules;
      // An order's question asked again: the rules have the words already.
      if (rules.generated && rules.intents.some((i) => i.payload?.keepPending === true || i.payload?.settled === true)) return rules;
      const ruled = rules.intents;
      // The doctor answered an order's question: that's settled; the rest isn't worth a model call to reread.
      // Several requests in one message, or a long one the rules only partly placed: the model reads all of it, as ChatGPT would.
      const clauses = text.split(/[.?!;\n]+|\band\b|\balso\b|\bthen\b|,/i).filter((c) => c.trim().split(/\s+/).length >= 2).length;
      const partly = text.trim().split(/\s+/).length > 6 && clauses > ruled.filter((i) => i.kind !== "unknown").length;
      // A question the rules turned into an order ("can we give aspirin?", "cbc normal?") is checked by the model too.
      const questionAsOrder = /\?\s*$/.test(text.trim()) && ruled.some((i) => ["drug", "investigation", "action"].includes(i.kind) && i.payload?.reshow !== true);
      const unresolved = !ruled.some((i) => i.payload?.completes === true) && (partly || questionAsOrder || ruled.some((i) => (i.kind === "unknown" && !i.payload?.empty) || (i.kind === "history" && i.targetId?.startsWith("fallback:"))));
      // Speed: a button (the senior's step, "Full history", a ready-made reply) or a plain order needs no rewording — the
      // rules' words go straight back. Otherwise the patient's voice gets 2.5 s; past that, the rules' answer is shown.
      const button = text.trim() === ctx.hidden.seniorStep?.text || /^(?:take\s+)?(?:a\s+|the\s+)?(?:full|complete|whole|important)\s+history\.?$/i.test(text.trim());
      const talk = ruled.some((i) => i.kind === "history" || i.kind === "greeting");
      const quick = (p: Promise<Interpretation>): Promise<Interpretation> => Promise.race([p, new Promise<Interpretation>((resolve) => setTimeout(() => resolve({ intents: ruled }), 2500))]);
      const reading: Promise<Interpretation> = unresolved ? understand(text, ctx, ruled) : button || !talk || ctx.def.guided || openAIConfig().voice !== "all" ? Promise.resolve({ intents: ruled }) : quick(voice(text, ctx, ruled));
      // The demo's results stay as written; elsewhere, what the case file left out is reported for this patient.
      if (ctx.def.guided) return reading;
      // When the rules placed the order, its results are written while the patient's words are (the voice keeps the rules' intents).
      const [read, early] = await Promise.all([reading, unresolved ? null : completeLabs(ctx, ruled)]);
      const labs = early ?? (await completeLabs(ctx, read.intents));
      return Object.keys(labs).length ? { ...read, generated: { ...read.generated, ...labs } } : read;
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

