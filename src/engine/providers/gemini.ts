/**
 * Google Gemini, the backup for when OpenAI can't answer. Off until GOOGLE_GENERATIVE_AI_API_KEY is set.
 * The key stays on the server and is sent in a header, never in a URL.
 */
import { noteTiming, noteUsage } from "./usage";

export const DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview";
/** Its free allowance is separate. For a live turn only, when the main one's has run out; never for writing or checking a case. */
export const GEMINI_LITE_MODEL = "gemini-3.1-flash-lite";

export const geminiConfig = () => ({
  key: process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ?? "",
  model: process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
});

export const geminiConfigured = () => geminiConfig().key.length > 0;

/** One JSON reply, from the same messages OpenAI would have had. */
export async function geminiJSON(messages: { role: string; content: unknown }[], maxTokens: number, timeoutMs: number, modelOverride?: string, liveTurn = false): Promise<unknown> {
  const { key, model: configured } = geminiConfig();
  const model = modelOverride ?? configured;
  const text = (m: { content: unknown }) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content));
  const system = messages.filter((m) => m.role === "system").map(text).join("\n\n");
  const contents = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: text(m) }] }));
  const began = Date.now();
  const stopAt = began + timeoutMs;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents,
      // Room for its thinking as well as the answer, which share this limit.
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: maxTokens + 2000 },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  noteTiming("llm_fallback", Date.now() - began);
  // Out of its free allowance, with a doctor waiting: once more on the lite model, in the time left.
  if (res.status === 429 && liveTurn && model !== GEMINI_LITE_MODEL && stopAt - Date.now() > 500) return geminiJSON(messages, maxTokens, stopAt - Date.now(), GEMINI_LITE_MODEL);
  if (!res.ok) throw new Error(`Gemini responded ${res.status}`);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  };
  const usage = data.usageMetadata;
  if (usage) noteUsage({ prompt_tokens: usage.promptTokenCount ?? 0, completion_tokens: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0) });
  const reply = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
  if (!reply) throw new Error("Gemini sent an empty reply");
  return JSON.parse(reply.replace(/^```(?:json)?\s*|\s*```$/g, ""));
}
