/**
 * Checks the OpenAI connection: is the key accepted, is the model available,
 * and does a tiny request get an answer? Never returns, logs or echoes the key.
 *
 * Pure (no Next.js imports), so the terminal check (scripts/check-openai.mjs)
 * and the admin-only check on the live site share it.
 */

export interface OpenAIEnv {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  OPENAI_BASE_URL?: string;
}

export interface OpenAICheck {
  ok: boolean;
  /** What went wrong, in plain words. */
  problem?: string;
  /** The model the site is set to use. */
  model: string;
  modelAvailable?: boolean;
  /** Chat models this key can use (names only), to choose from. */
  models?: string[];
  /** The model's answer to the test question. */
  reply?: string;
  /** How long the test answer took, in milliseconds. */
  ms?: number;
}

/** The model RamAI uses unless OPENAI_MODEL says otherwise. Never switched automatically. */
export const DEFAULT_MODEL = "gpt-6-luna";

/** The lightest reasoning setting each model family accepts (none sent to models without one). */
export function lightReasoning(model: string): Record<string, string> {
  if (/^gpt-6/.test(model)) return { reasoning_effort: "none" };
  if (/^gpt-5/.test(model)) return { reasoning_effort: "low" };
  if (/^o\d/.test(model)) return { reasoning_effort: "low" };
  return {};
}

export async function checkOpenAI(env: OpenAIEnv, fetchImpl: typeof fetch = fetch): Promise<OpenAICheck> {
  const key = env.OPENAI_API_KEY?.trim();
  const model = env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
  const base = (env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
  if (!key) return { ok: false, model, problem: "No OPENAI_API_KEY is set." };
  if (!/^sk-[A-Za-z0-9_-]{20,}$/.test(key)) {
    return { ok: false, model, problem: "OPENAI_API_KEY doesn't look like an OpenAI key — it should start with “sk-”, on one line, with no spaces or quotation marks." };
  }
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

  // 1. The list of models: free, and proves the key is accepted.
  let res: Response;
  try {
    res = await fetchImpl(`${base}/models`, { headers, signal: AbortSignal.timeout(15_000) });
  } catch {
    return { ok: false, model, problem: "Couldn't reach OpenAI — check the internet connection and try again." };
  }
  if (res.status === 401) return { ok: false, model, problem: "OpenAI rejected the key: it's wrong, incomplete or was deleted. Copy it again from platform.openai.com/api-keys." };
  if (!res.ok) return { ok: false, model, problem: `OpenAI answered ${res.status} when asked for its models. Try again in a minute.` };
  const ids = (((await res.json().catch(() => ({}))) as { data?: { id?: string }[] }).data ?? []).map((m) => String(m.id ?? ""));
  const models = ids.filter((id) => /^(gpt-|o\d)/.test(id)).sort();
  if (!ids.includes(model)) return { ok: false, model, modelAvailable: false, models, problem: `The key works, but the model “${model}” isn't available to it.` };

  // 2. One tiny question: proves the account can actually answer (it has credit). Costs a small fraction of a cent.
  const started = Date.now();
  try {
    res = await fetchImpl(`${base}/chat/completions`, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Reply with exactly these words: RamAI connection OK" }],
        max_completion_tokens: 400,
        ...lightReasoning(model),
      }),
    });
  } catch {
    return { ok: false, model, modelAvailable: true, models, problem: "The key works, but the test question timed out. Try again in a minute." };
  }
  const json = (await res.json().catch(() => ({}))) as { error?: { type?: string; code?: string; message?: string }; choices?: { message?: { content?: string } }[] };
  if (!res.ok) {
    const code = json.error?.code;
    // "No credit" arrives as type insufficient_quota, with a code such as credit_balance_exhausted.
    const noCredit = json.error?.type === "insufficient_quota" || ["insufficient_quota", "credit_balance_exhausted", "billing_hard_limit_reached"].includes(code ?? "");
    const problem =
      noCredit
        ? "The key works, but the OpenAI account has no credit yet. Add some at platform.openai.com/settings/organization/billing."
        : res.status === 429
          ? "OpenAI is limiting requests right now. Try again in a minute."
          : `OpenAI couldn't answer the test question (${res.status}${code ? `, ${code}` : ""}).`;
    return { ok: false, model, modelAvailable: true, models, problem };
  }
  const reply = json.choices?.[0]?.message?.content?.trim() ?? "";
  return { ok: reply.length > 0, model, modelAvailable: true, models, reply, ms: Date.now() - started, ...(reply ? {} : { problem: "OpenAI answered, but with an empty message." }) };
}
