import { z } from "zod";

import { requireUser } from "@/server/auth";
import { apiError, crossSite, handleError, parseBody, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const VoiceSchema = z.object({
  text: z.string().trim().min(1).max(600),
  sex: z.enum(["Male", "Female"]),
  age: z.number().int().min(0).max(110),
  country: z.enum(["IN", "US", "UK", "WW"]).default("IN"),
  mood: z.enum(["calm", "pain", "scared", "ill", "better"]).default("calm"),
  hinglish: z.boolean().optional(),
});

const ACCENT = { IN: "an Indian English accent, as spoken in a north Indian town", US: "a general American accent", UK: "a British accent", WW: "a neutral international English accent" } as const;
const MOOD = {
  calm: "a little worried but calm, natural and conversational",
  pain: "in real pain: strained, short of breath between phrases, wincing, slower",
  scared: "frightened and anxious: quicker, higher, pleading",
  ill: "very unwell: weak, slow, tired, quiet",
  better: "relieved and warmer, like someone who feels better",
} as const;

/**
 * POST /api/cases/voice — a patient's line read aloud by OpenAI's text-to-speech (gpt-4o-mini-tts), in a voice
 * that fits their age, sex, accent and how they feel. Only the words already written by the case are spoken.
 */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 60);
  if (blocked) return blocked;
  const body = await parseBody(req, VoiceSchema);
  if (body instanceof Response) return body;
  if (!process.env.OPENAI_API_KEY) return apiError(503, "VOICE_OFF", "The natural voice isn't switched on here.");
  try {
    await requireUser();
    // Nothing that isn't speech: emojis, stage directions, symbols.
    const words = body.text.replace(/\p{Extended_Pictographic}|️|‍/gu, "").replace(/\([^)]*\)|\*[^*]*\*/g, " ").replace(/\s+/g, " ").trim();
    if (!words) return apiError(400, "EMPTY", "Nothing to say.");
    const child = body.age < 13;
    const voice = body.sex === "Female" ? (child ? "shimmer" : body.age >= 60 ? "sage" : "coral") : child ? "fable" : body.age >= 60 ? "onyx" : "ash";
    const res = await fetch(`${(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "")}/audio/speech`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
        voice,
        input: words,
        response_format: "mp3",
        instructions: `You are a ${body.age}-year-old ${body.sex === "Female" ? "woman" : "man"}${child ? " (a child)" : ""}, a patient talking to their doctor in a clinic. Speak with ${body.hinglish ? "a natural Hindi-English (Hinglish) mix and Indian accent" : ACCENT[body.country]}. You are ${MOOD[body.mood]}. Sound like a real person, not an announcer: natural pauses, everyday rhythm. Never read out symbols.`,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok || !res.body) {
      console.error("[ramai] voice failed:", res.status);
      return apiError(502, "VOICE_FAILED", "The voice couldn't be made.");
    }
    return new Response(res.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600" } });
  } catch (err) {
    return handleError(err);
  }
}
