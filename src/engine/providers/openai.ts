/**
 * The OpenAI provider. The model supplies LANGUAGE; backend code supplies
 * everything else.
 *
 *   The model:  the patient's (or relative's) spoken replies, worded from the
 *               facts the engine releases · understanding what the doctor meant
 *               when the rules can't place it · feedback in words for the debrief.
 *   Backend:    the patients themselves (the case library), investigation
 *               results, physiology, scoring and access control.
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
import type { Country } from "../countries";
import { FORMULARY } from "../formulary";
import type { PatientLang, ResolvedIntent } from "../types";
import { mockProvider } from "./mock";
import { FeedbackSchema, PatientResponseSchema, VoiceSchema } from "./openai-schema";
import type { ClinicalProvider, CoachFeedback, FeedbackInput, InterpretContext, Interpretation } from "./types";

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
async function chatJSON(messages: ChatMessage[], maxTokens: number, careful = false): Promise<unknown> {
  const { key, model, baseUrl, timeoutMs } = openAIConfig();
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
{"type":"patient_response","message":"<what the patient says, if the doctor addressed the patient; otherwise empty>","new_information":[],"intents":[{"kind":"history|vitals|exam|investigation|drug|action|followup|wait|reassess|diagnosis|differential|close|unknown","targetId":"<id from the lists above>","phrase":"<the doctor's words>","payload":{}}]}
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

    // Patients come from the case library — backend records, never invented by the model.
    createCase: (opts) => mockProvider.createCase(opts),
    resolveCase: (src) => mockProvider.resolveCase(src),
    availability: (country) => mockProvider.availability(country),

    async interpret(text, ctx): Promise<Interpretation> {
      // Rules first: instant and free. The guided demo stays fully scripted.
      const ruled = (await mockProvider.interpret(text, ctx)).intents;
      if (ctx.def.guided) return { intents: ruled };
      const unresolved = ruled.some((i) => i.kind === "unknown" || (i.kind === "history" && i.targetId?.startsWith("fallback:")));
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

