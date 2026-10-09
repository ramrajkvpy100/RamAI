/**
 * OpenAI provider.
 *
 *   UI → /api/cases/* → engine → OpenAI (JSON) → zod validation → engine state → UI
 *
 * The model supplies clinical CONTENT (new cases) and LANGUAGE (questions the
 * rule-based resolver cannot place, phrased patient replies). It never owns
 * vitals, results, physiology or scoring — those stay deterministic, which is
 * what makes sessions replayable, auditable and resistant to hallucination.
 *
 * Server-only. The API key is read from the environment on the server and is
 * never sent to, or readable by, the browser.
 */
import "server-only";

import type { ClinicalCaseDefinition } from "../case-definition";
import { EXAMS, INVESTIGATIONS, MEASURES } from "../catalog";
import { FORMULARY } from "../formulary";
import { LEVELS, TRACKS } from "../levels";
import { ALL_SPECIALTIES } from "../progression";
import { CARE_LEVELS, CASE_TRACKS, type ResolvedIntent } from "../types";
import { mockProvider } from "./mock";
import { GeneratedCaseSchema, PatientResponseSchema, type GeneratedCase } from "./openai-schema";
import type { ClinicalProvider, Interpretation, StartOptions } from "./types";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

class UpstreamError extends Error {}

function config() {
  return {
    key: process.env.OPENAI_API_KEY ?? "",
    model: process.env.OPENAI_MODEL || "gpt-5",
    baseUrl: (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
    timeoutMs: Number(process.env.RAMAI_ENGINE_TIMEOUT_MS || 45000),
  };
}

async function chatJSON(messages: ChatMessage[], maxTokens: number): Promise<unknown> {
  const { key, model, baseUrl, timeoutMs } = config();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages, response_format: { type: "json_object" }, max_completion_tokens: maxTokens }),
      signal: controller.signal,
    });
    if (!res.ok) throw new UpstreamError(`OpenAI responded ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new UpstreamError("Empty completion");
    return JSON.parse(content);
  } finally {
    clearTimeout(timer);
  }
}

/* -------------------------------------------------------------------------- */
/* Prompts                                                                     */
/* -------------------------------------------------------------------------- */

const SIMULATION_RULES = `You are the hidden clinical environment of RamAI, an educational clinical-decision game for doctors in India.
Absolute rules while a case is active:
- Never reveal or hint at the diagnosis, differential, severity, hidden findings, future complications, scoring or ideal treatment.
- Never coach. No "you may want to…", "this could suggest…", "consider…", "the next step is…".
- The patient speaks as a lay person from the stated background (Indian English, natural, brief). They answer only what was asked.
- Positive findings must come only from the case file. If the case file does not mention something, the honest answer is a plausible negative.
- Output JSON only.`;

function interpretPrompt(def: ClinicalCaseDefinition, clause: string): ChatMessage[] {
  const history = def.history.map((h) => `${h.id} | ${h.label} | patient says: ${h.reply}`).join("\n");
  const exams = [...def.exam.map((e) => `${e.id} | ${e.label}`), ...EXAMS.map((e) => `${e.id} | ${e.label}`)].join("\n");
  const invs = [...def.investigations.map((i) => i.id), ...INVESTIGATIONS.map((i) => i.id)].join(", ");
  const measures = MEASURES.map((m) => m.id).join(", ");
  const rules = def.therapeutics.map((r) => `${r.id} (${r.kind}: ${r.label})`).join(", ");
  return [
    { role: "system", content: SIMULATION_RULES },
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

The doctor said: """${clause}"""

Return JSON:
{"type":"patient_response","message":"<what the patient says, if the doctor addressed the patient; otherwise empty>","new_information":[],"intents":[{"kind":"history|vitals|exam|investigation|drug|action|followup|wait|reassess|diagnosis|differential|close|unknown","targetId":"<id from the lists above>","phrase":"<the doctor's words>","payload":{}}]}
Map to existing ids whenever the meaning matches. For history questions with no matching entry, use kind "history", targetId "generated", and put the patient's reply in "message".`,
    },
  ];
}

function generationPrompt(opts: StartOptions): ChatMessage[] {
  const specialty = opts.specialty;
  const setting = opts.level ? `${LEVELS[opts.level].label} (${LEVELS[opts.level].description})` : "any Indian care setting";
  const mode = opts.track ? TRACKS[opts.track].label : "any mode";
  return [
    { role: "system", content: `${SIMULATION_RULES}\nYou author realistic, guideline-accurate clinical cases for Indian outpatient and emergency practice. Patients are fictional, culturally realistic, never stereotyped. Use reputed Indian brands in teaching content.` },
    {
      role: "user",
      content: `Write one complete case${specialty ? ` in ${specialty}` : " (favour dermatology and common North-Indian OPD presentations)"} for ${setting}, mode: ${mode}. Difficulty must match the setting. Return JSON matching this TypeScript shape exactly (all teaching content is released only after closure):

${GENERATED_CASE_SHAPE}

Constraints:
- history: 10–20 entries. Every POSITIVE finding must be authored; match phrases are short lowercase phrases a doctor might type.
- Use only these catalogue examination ids when overriding standard exams: ${EXAMS.map((e) => e.id).join(", ")} (or new ids for special signs).
- investigations: override catalogue ids (${INVESTIGATIONS.map((i) => i.id).join(", ")}) with abnormal rows/reports; reports describe findings, never an impression.
- therapeutics.drugIds must come from: ${FORMULARY.map((d) => d.id).join(", ")}.
- measureIds must come from: ${MEASURES.map((m) => m.id).join(", ")}.
- rubric.idealTreatment is an AND-of-ORs over therapeutic ids.
- Dermatology: include a derm media spec in the opening.`,
    },
  ];
}

const GENERATED_CASE_SHAPE = `{ specialty, setting: "OPD"|"ER"|"IPD"|"ICU"|"Ward"|"Teleconsult", difficulty: 1|2|3,
  patient: { name?, age, sex: "Male"|"Female", city, occupation?, context? }, arrivalMinuteOfDay, briefing,
  opening: [{ role, kind, text, media? }], baselineVitals: { bp: "158/96", hr: "88", rr, temp (°F), spo2, rbs, weight, height },
  triageVitals?: VitalKey[], profile: { allergies?, currentDrugs?, pregnancyPossible?, asthma?, ckd?, heartFailure?, thrombocytopenia?, fluidToleranceMl? },
  history: [{ id, group, label, match: string[], reply, fact?, abnormal?, importance: "essential"|"useful"|"minor" }],
  exam: [{ id, group: "general-exam"|"systemic-exam"|"local-exam", label, match: string[], finding, fact?, abnormal?, importance, patientReaction?, media? }],
  investigations: [{ id, name?, short?, category?, match?, turnaroundMin?, cost?, rows?: [{ analyte, value, unit?, reference?, flag }], report?, media?, priority, teaching: { whenToOrder, whatItTellsYou } }],
  therapeutics: [{ id, kind, drugIds?, drugClasses?, measureIds?, concernsDrugs?, match?, label, appropriateness, note?, critique?: { what, why, better, severity }, praise? }],
  truth: { diagnosis, qualifier?, reasoning: [{stage:"History",text},{stage:"Examination",text},{stage:"Investigation",text},{stage:"Diagnosis",text}] },
  rubric: { diagnosisAccept, diagnosisPartial, differentials, idealTreatment: string[][], expertActionCount, followUpDays?, expectsReassessment, misses: Record<id, Miss>, strengths: Record<id, string> },
  followUp: [{ when: "ideal"|"acceptable"|"harmful"|"untreated"|"any", status, lines: [{ role, kind, text }] }],
  teaching: { patientBand?, severityBands: [{ id, label, recognition[], investigation[], treatment[], followUp[], media? }], drugs: [{ generic, brand, dose, route, frequency, duration, indication, mechanism, whyItWorks, avoidWhen[], adverseEffects[], monitoring[] }], routines: [...], followUp: { interval, reassess[], redFlags[], whenToEscalate[] }, treatmentFailure: { steps[] }, pearl } }`;

/* -------------------------------------------------------------------------- */
/* Mapping                                                                     */
/* -------------------------------------------------------------------------- */

function toDefinition(g: GeneratedCase, opts: StartOptions): ClinicalCaseDefinition {
  const id = `gen-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    specialty: g.specialty,
    track: opts.track ?? (g.setting === "ER" ? "emergency" : g.setting === "Teleconsult" ? "phone" : "opd"),
    level: opts.level ?? "district",
    setting: g.setting,
    weight: 1,
    difficulty: g.difficulty as 1 | 2 | 3,
    patient: g.patient,
    arrivalMinuteOfDay: g.arrivalMinuteOfDay,
    briefing: g.briefing,
    opening: g.opening as ClinicalCaseDefinition["opening"],
    baselineVitals: Object.fromEntries(Object.entries(g.baselineVitals).map(([k, v]) => [k, { key: k, value: v }])) as ClinicalCaseDefinition["baselineVitals"],
    triageVitals: g.triageVitals,
    profile: g.profile,
    history: g.history,
    exam: g.exam as ClinicalCaseDefinition["exam"],
    investigations: g.investigations as ClinicalCaseDefinition["investigations"],
    therapeutics: g.therapeutics as ClinicalCaseDefinition["therapeutics"],
    hazards: [],
    followUp: g.followUp,
    truth: g.truth,
    rubric: g.rubric,
    teaching: { ...g.teaching, treatmentByBand: {} } as ClinicalCaseDefinition["teaching"],
  };
}

/* -------------------------------------------------------------------------- */
/* Provider                                                                    */
/* -------------------------------------------------------------------------- */

export function createOpenAIProvider(): ClinicalProvider {
  return {
    id: "openai",

    async createCase(opts) {
      try {
        const raw = await chatJSON(generationPrompt(opts), 12000);
        const parsed = GeneratedCaseSchema.safeParse(raw);
        if (!parsed.success) throw new UpstreamError("Generated case failed validation");
        return { kind: "generated", def: toDefinition(parsed.data, opts) };
      } catch (err) {
        console.error("[ramai] case generation failed; using library", err instanceof Error ? err.message : err);
        return mockProvider.createCase(opts);
      }
    },

    resolveCase(src) {
      return mockProvider.resolveCase(src);
    },

    async interpret(text, ctx): Promise<Interpretation> {
      // Rules first: deterministic, instant, free. The model only sees what they cannot place.
      const ruled = (await mockProvider.interpret(text, ctx)).intents;
      const unresolved = ruled.some((i) => i.kind === "unknown" || (i.kind === "history" && i.targetId?.startsWith("fallback:")));
      if (!unresolved) return { intents: ruled };
      try {
        const raw = await chatJSON(interpretPrompt(ctx.def, text), 800);
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
        // Drop anything the model referenced that the engine doesn't know.
        return intents.length ? { intents, generated } : { intents: ruled };
      } catch (err) {
        console.error("[ramai] interpretation fell back to rules", err instanceof Error ? err.message : err);
        return { intents: ruled };
      }
    },

    /** Generated cases can be any specialty, mode or level. */
    async availability() {
      const all = <K extends string>(keys: readonly K[]) => Object.fromEntries(keys.map((k) => [k, 999])) as Partial<Record<K, number>>;
      return { specialties: all(ALL_SPECIALTIES), tracks: all(CASE_TRACKS), levels: all(CARE_LEVELS) };
    },
  };
}

