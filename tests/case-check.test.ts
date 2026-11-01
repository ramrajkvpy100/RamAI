import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { emAdhf } from "@/engine/cases/em-adhf";
import { checkCase } from "@/server/case-check";

const src = { kind: "generated" as const, def: emAdhf };
const says = (body: unknown) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(body) }] } }] }) }) as Response;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the second opinion on an invented case", () => {
  it("rejects what it calls seriously wrong, passes the rest", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "x");
    vi.stubGlobal("fetch", vi.fn(async () => says({ serious_errors: ["pH doesn't fit the bicarbonate."] })));
    expect(await checkCase(src)).toEqual({ status: "rejected", errors: ["pH doesn't fit the bicarbonate."] });
    vi.stubGlobal("fetch", vi.fn(async () => says({ serious_errors: [] })));
    expect((await checkCase(src)).status).toBe("passed");
  });

  it("an outage or no key leaves the case standing, marked unchecked", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "x");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) }) as Response));
    expect((await checkCase(src)).status).toBe("unchecked");
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
    expect((await checkCase(src)).status).toBe("unchecked");
  });
});
