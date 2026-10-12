import { describe, expect, it } from "vitest";

import { checkOpenAI } from "@/lib/server/openai-check";

const KEY = "sk-test-" + "a".repeat(40);
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
/** A stand-in for OpenAI: the model list, then the answer to the test question. */
const fake = (models: Response, answer?: Response) => (async (url: string | URL | Request) => (String(url).endsWith("/models") ? models : answer!)) as typeof fetch;

describe("the OpenAI connection check", () => {
  it("says so plainly when there's no key, or it isn't one", async () => {
    expect((await checkOpenAI({})).problem).toMatch(/No OPENAI_API_KEY/);
    expect((await checkOpenAI({ OPENAI_API_KEY: '"sk-abc def"' })).problem).toMatch(/doesn't look like an OpenAI key/);
  });

  it("works end to end, and never repeats the key", async () => {
    const result = await checkOpenAI({ OPENAI_API_KEY: KEY }, fake(json(200, { data: [{ id: "gpt-6-luna" }, { id: "whisper-1" }] }), json(200, { choices: [{ message: { content: "RamAI connection OK" } }] })));
    expect(result).toMatchObject({ ok: true, model: "gpt-6-luna", reply: "RamAI connection OK", models: ["gpt-6-luna"] });
    expect(JSON.stringify(result)).not.toContain(KEY);
  });

  it("explains a rejected key, a missing model and an empty account", async () => {
    expect((await checkOpenAI({ OPENAI_API_KEY: KEY }, fake(json(401, {})))).problem).toMatch(/rejected the key/);
    const missing = await checkOpenAI({ OPENAI_API_KEY: KEY, OPENAI_MODEL: "gpt-9" }, fake(json(200, { data: [{ id: "gpt-5-mini" }] })));
    expect(missing).toMatchObject({ ok: false, modelAvailable: false, models: ["gpt-5-mini"] });
    const broke = await checkOpenAI({ OPENAI_API_KEY: KEY }, fake(json(200, { data: [{ id: "gpt-6-luna" }] }), json(429, { error: { code: "insufficient_quota" } })));
    expect(broke.problem).toMatch(/no credit/);
    // How OpenAI says it today: type insufficient_quota, code credit_balance_exhausted.
    const empty = await checkOpenAI({ OPENAI_API_KEY: KEY }, fake(json(200, { data: [{ id: "gpt-6-luna" }] }), json(429, { error: { type: "insufficient_quota", code: "credit_balance_exhausted" } })));
    expect(empty.problem).toMatch(/no credit/);
  });
});
