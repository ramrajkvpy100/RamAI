/**
 * Is the AI answering? A cached, quick answer for pages that need to say why
 * something couldn't be made — never the key, never a slow wait.
 */
import "server-only";

import { checkOpenAI } from "@/lib/server/openai-check";

let last: { at: number; ok: boolean } | null = null;

/** True unless OpenAI has just refused (no credit, wrong key, unknown model). Unknown counts as answering. Cached ten minutes. */
export async function aiAnswering(): Promise<boolean> {
  if (last && Date.now() - last.at < 10 * 60_000) return last.ok;
  const { OPENAI_API_KEY, OPENAI_MODEL, OPENAI_BASE_URL } = process.env;
  const check = checkOpenAI({ OPENAI_API_KEY, OPENAI_MODEL, OPENAI_BASE_URL })
    .then((c) => c.ok)
    .catch(() => true);
  const ok = await Promise.race([check, new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 8_000))]);
  last = { at: Date.now(), ok };
  if (!ok) console.error("[ramai] the AI isn't answering — see Admin · AI costs for why.");
  return ok;
}
