/**
 * "Understand this disease" — after a case ends, the condition explained the way a good teacher would:
 * what it is, why it happens, how it presents, how it's confirmed and treated, what can go wrong.
 * Written once per diagnosis and country by the model, then kept for everyone.
 */
import "server-only";

import { z } from "zod";

import { chatJSON, openAIConfig } from "@/engine/providers/openai";
import { GUIDELINES } from "@/engine/providers/openai-review";
import type { Country } from "@/engine/countries";

import { getCaseAI, putCaseAI } from "./case-ai";

const list = z.array(z.string().max(400)).max(10).catch([]);
export const DiseaseSchema = z.object({
  name: z.string().max(160),
  overview: z.string().max(900),
  cause: z.string().max(900),
  mechanism: z.string().max(1200),
  presentation: list,
  diagnosis: list,
  treatment: list,
  complications: list,
  prognosis: z.string().max(600).catch(""),
  remember: list,
});
export type DiseaseExplainer = z.infer<typeof DiseaseSchema>;

export async function explainDisease(topic: { diagnosis: string; qualifier?: string; age: number; sex: string; country: Country }): Promise<DiseaseExplainer | null> {
  const key = `disease:${topic.country}:${topic.diagnosis.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80)}`;
  const kept = await getCaseAI(key, "disease").catch(() => undefined);
  if (kept) return JSON.parse(kept.data) as DiseaseExplainer;
  if (!openAIConfig().key) return null;
  const raw = await chatJSON(
    [
      { role: "system", content: `You are a senior clinician and a gifted teacher. Every fact is accurate and current — ${GUIDELINES[topic.country]}. Output JSON only.` },
      {
        role: "user",
        content: `A doctor has just finished a simulated case: a ${topic.age}-year-old ${topic.sex.toLowerCase()} with ${topic.diagnosis}${topic.qualifier ? ` (${topic.qualifier})` : ""}.
Explain the disease so it is understood, not memorised — clear, specific, exam-relevant, in plain words a doctor reads in three minutes.
Return {"name","overview":"2–3 sentences","cause":"causes and risk factors","mechanism":"the pathophysiology as a chain of cause and effect","presentation":["symptoms and signs, most typical first"],"diagnosis":["how it's confirmed: key tests and what they show"],"treatment":["management in order, with first-line drugs and doses"],"complications":[],"prognosis":"","remember":["3–5 high-yield points"]}`,
      },
    ],
    3200,
    true,
    45_000,
  );
  const parsed = DiseaseSchema.safeParse(raw);
  if (!parsed.success) return null;
  await putCaseAI(key, "disease", "system", "application/json", JSON.stringify(parsed.data)).catch(() => undefined);
  return parsed.data;
}
