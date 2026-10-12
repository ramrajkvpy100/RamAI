import "server-only";

/**
 * Before a community post or reply appears, the model reads it: abuse, spam,
 * real patients' identifying details, dangerous advice stated as fact and
 * leaked exam papers are kept out. If the check can't be had, it goes up —
 * reports and the admin catch the rest.
 */
export async function moderate(text: string): Promise<{ allowed: true } | { allowed: false; message: string }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { allowed: true };
  try {
    const res = await fetch(`${(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL?.trim() || "gpt-6-luna",
        response_format: { type: "json_object" },
        reasoning_effort: "low",
        max_completion_tokens: 300,
        messages: [
          {
            role: "system",
            content: `You moderate a community of doctors and medical students discussing clinical cases and exam preparation (NEET PG, INI-CET, USMLE, UKMLA, PLAB).
Block: abuse, harassment, hate, sexual content, spam or advertising, real patients' identifying details (names with conditions, phone numbers, addresses, hospital record numbers, identifiable photos), dangerous medical misinformation stated as fact, and leaked or copyrighted exam papers.
Allow: clinical discussion, fictional or properly anonymised cases, exam questions and strategies, respectful disagreement, and requests for help.
Return JSON: {"allowed": true|false, "message": "if blocked: one short, polite sentence telling the author what to change"}`,
          },
          { role: "user", content: text.slice(0, 6000) },
        ],
      }),
      signal: AbortSignal.timeout(8000),
    });
    const json = (await res.json().catch(() => ({}))) as { choices?: { message?: { content?: string } }[] };
    const verdict = JSON.parse(json.choices?.[0]?.message?.content ?? "{}") as { allowed?: boolean; message?: string };
    if (verdict.allowed === false) return { allowed: false, message: String(verdict.message || "This can't be posted as it is.").slice(0, 300) };
    return { allowed: true };
  } catch (err) {
    console.error("[ramai] moderation unavailable — posted unchecked:", err instanceof Error ? err.message : err);
    return { allowed: true };
  }
}
