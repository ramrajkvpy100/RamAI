import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { chatJSON } from "@/engine/providers/openai";

const openAIFails = (status: number) => ({ ok: false, status, json: async () => ({ error: { code: "x" } }) }) as Response;
const geminiSays = (body: unknown) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(body) }] } }] }) }) as Response;
const openAISays = (body: unknown) => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(body) } }] }) }) as Response;
const isGemini = (u: unknown) => String(u).includes("generativelanguage");
const MESSAGES = [{ role: "system", content: "Rules" }, { role: "user", content: "Hello" }] as Parameters<typeof chatJSON>[0];

beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test");
  vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "g-test");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Gemini as OpenAI's backup", () => {
  it("is not called while OpenAI answers", async () => {
    const fetcher = vi.fn(async (_u: unknown) => openAISays({ from: "openai" }));
    vi.stubGlobal("fetch", fetcher);
    expect(await chatJSON(MESSAGES, 100, false, 30_000)).toEqual({ from: "openai" });
    expect(fetcher.mock.calls.some(([u]) => isGemini(u))).toBe(false);
  });

  it("answers when OpenAI is out of quota, with the key in a header and not the URL", async () => {
    const fetcher = vi.fn(async (u: unknown, _o?: RequestInit) => (isGemini(u) ? geminiSays({ from: "gemini" }) : openAIFails(429)));
    vi.stubGlobal("fetch", fetcher);
    expect(await chatJSON(MESSAGES, 100, false, 30_000)).toEqual({ from: "gemini" });
    const call = fetcher.mock.calls.find(([u]) => isGemini(u))!;
    expect(String(call[0])).not.toContain("g-test");
    expect((call[1]!.headers as Record<string, string>)["x-goog-api-key"]).toBe("g-test");
    const body = JSON.parse(String(call[1]!.body));
    expect(body.systemInstruction.parts[0].text).toBe("Rules");
    expect(body.contents).toEqual([{ role: "user", parts: [{ text: "Hello" }] }]);
  });

  it("stays out of it for a bad request, and without a key", async () => {
    const bad = vi.fn(async () => openAIFails(400));
    vi.stubGlobal("fetch", bad);
    await expect(chatJSON(MESSAGES, 100, false, 30_000)).rejects.toThrow(/400/);
    expect(bad).toHaveBeenCalledTimes(1);

    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
    const down = vi.fn(async (_u: unknown) => openAIFails(503));
    vi.stubGlobal("fetch", down);
    await expect(chatJSON(MESSAGES, 100, false, 30_000)).rejects.toThrow(/503/);
    expect(down.mock.calls.some(([u]) => isGemini(u))).toBe(false);
  });

  it("if Gemini fails too, the original fault is reported", async () => {
    vi.stubGlobal("fetch", vi.fn(async (u: unknown) => (isGemini(u) ? openAIFails(500) : openAIFails(503))));
    await expect(chatJSON(MESSAGES, 100, false, 30_000)).rejects.toThrow(/OpenAI responded 503/);
  });
});
