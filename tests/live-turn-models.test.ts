/** Who answers a live turn: priority for what the doctor waits on, and a lite retry when Gemini's free allowance has run out. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { GEMINI_LITE_MODEL, geminiJSON } from "@/engine/providers/gemini";
import { chatJSON } from "@/engine/providers/openai";

const answer = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const geminiReply = { candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] };
const openaiReply = { choices: [{ message: { content: '{"ok":true}' } }] };
const messages = [{ role: "user", content: "x" }];

describe("live turns", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "test");
    vi.stubEnv("OPENAI_API_KEY", "test");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("a 429 on a live turn is retried once on the lite model", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      urls.push(url);
      return urls.length === 1 ? answer({}, 429) : answer(geminiReply);
    }));
    expect(await geminiJSON(messages, 100, 5000, undefined, true)).toEqual({ ok: true });
    expect(urls).toHaveLength(2);
    expect(urls[1]).toContain(GEMINI_LITE_MODEL);
  });

  it("the lite model has one try, and writing or checking a case never gets it", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      calls += 1;
      return answer({}, 429);
    }));
    await expect(geminiJSON(messages, 100, 5000, undefined, true)).rejects.toThrow(/429/);
    expect(calls).toBe(2);
    calls = 0;
    await expect(geminiJSON(messages, 100, 5000)).rejects.toThrow(/429/);
    expect(calls).toBe(1);
  });

  it("priority goes only with the calls that ask for it, not with every fast one", async () => {
    const bodies: { service_tier?: string }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: { body: string }) => {
      bodies.push(JSON.parse(init.body));
      return answer(openaiReply);
    }));
    await chatJSON(messages as never, 100, false, 5000, true, true);
    await chatJSON(messages as never, 100, false, 5000, true);
    await chatJSON(messages as never, 100, false, 5000);
    expect(bodies.map((b) => b.service_tier)).toEqual(["priority", undefined, undefined]);
  });
});
