import { createHash } from "node:crypto";

import { z } from "zod";

import { chatJSON } from "@/engine/providers/openai";
import { withUsage } from "@/engine/providers/usage";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { apiError, crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";
export const maxDuration = 60;

const Ask = z.object({
  /** Which drill, e.g. "Radiology reporting" or "Clinical calculations". */
  drill: z.string().trim().min(1).max(80),
  question: z.string().trim().min(1).max(1500),
  options: z.array(z.string().trim().max(200)).max(8).default([]),
  answer: z.string().trim().min(1).max(300),
  /** The drill's own short explanation — the ground truth the detail must agree with. */
  key: z.string().trim().max(3000).default(""),
});

const Teaching = z.object({
  findings: z.string().min(1).max(1200),
  why: z.string().min(1).max(1200),
  others: z.array(z.object({ option: z.string().max(200), why: z.string().max(400) })).max(7).default([]),
  next: z.string().max(800).default(""),
  pearl: z.string().max(400).default(""),
});
export type TeachingPoint = z.infer<typeof Teaching>;

/**
 * POST /api/practice/explain — a Skills Lab answer explained in detail: what to look for, why this is the answer,
 * why each other option isn't, what to do next, and one pearl. The drill's answer is fixed: the explanation must
 * agree with it. Written once per question and answer, then kept for everyone.
 */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 20);
  if (blocked) return blocked;
  const body = await parseBody(req, Ask);
  if (body instanceof Response) return body;
  try {
    await requireUser();
    const key = createHash("sha256").update(JSON.stringify([body.drill, body.question, body.answer, body.key])).digest("hex");
    const kept = await db.get<{ data: string }>("SELECT data FROM teaching_cache WHERE key = ?", key).catch(() => undefined);
    if (kept) return ok({ teaching: JSON.parse(kept.data) as TeachingPoint });
    const others = body.options.filter((o) => o !== body.answer);
    const raw = await withUsage({ kind: "teaching" }, () =>
      chatJSON(
        [
          {
            role: "system",
            content: `You are a senior clinician teaching doctors and medical students in India, the USA and the UK. Explain a practice question's answer in detail, plainly, accurately and briefly, following standard references (Harrison's, Grainger & Allison, BNF, NICE, WHO, ICMR, AHA). The stated answer is correct and final — never contradict it, never hedge it. Don't invent patient details or image findings that the question and key don't support; describe what is typically seen. Write every field as short lines (one point per line, under 15 words), never paragraphs, and wrap the key words of each line in **double asterisks** so they show in bold. Output JSON only.`,
          },
          {
            role: "user",
            content: `Drill: ${body.drill}
Question: ${body.question}
${others.length ? `Options: ${body.options.join(" | ")}\n` : ""}Correct answer: ${body.answer}
${body.key ? `The drill's own explanation (agree with it): ${body.key}\n` : ""}
Return JSON: {"findings": "what to look for / the key features, as short lines starting with '• '", "why": "why this is the answer — the reasoning step by step", "others": [${others.length ? `{"option": "<each other option>", "why": "why it isn't that"}` : ""}], "next": "what a doctor does next (tests, treatment, referral)", "pearl": "one exam or clinical pearl"}`,
          },
        ],
        1800,
        true,
        40_000,
      ),
    );
    const parsed = Teaching.safeParse(raw);
    if (!parsed.success) return apiError(502, "UNAVAILABLE", "The detailed explanation isn't available just now — please try again.");
    await db.run("INSERT OR IGNORE INTO teaching_cache (key, data, created_at) VALUES (?, ?, ?)", key, JSON.stringify(parsed.data), Date.now()).catch(() => undefined);
    return ok({ teaching: parsed.data });
  } catch (err) {
    return handleError(err);
  }
}
