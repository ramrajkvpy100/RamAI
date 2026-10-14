import { beforeEach, describe, expect, it } from "vitest";

import { noteUsage, withUsage, type UsageScope } from "@/engine/providers/usage";
import { costOf, usageReport } from "@/server/ai-usage";
import { db } from "@/server/db";

process.env.RAMAI_DB_PATH = ":memory:";

/** Stored after the response in production; here at once (outside a request). Give the write a moment. */
const settle = () => new Promise((r) => setTimeout(r, 30));

beforeEach(async () => {
  await db.run("DELETE FROM ai_usage");
  delete process.env.RAMAI_PRICE_INPUT_PER_M;
  delete process.env.RAMAI_PRICE_OUTPUT_PER_M;
  delete process.env.RAMAI_PRICE_CACHED_PER_M;
  delete process.env.RAMAI_PRICE_IMAGE;
});

describe("AI usage", () => {
  it("is counted against the work and the case it was for — even a case whose id comes later", async () => {
    const scope: UsageScope = { kind: "case-start" };
    await withUsage(scope, async () => noteUsage({ prompt_tokens: 1000, completion_tokens: 200, prompt_tokens_details: { cached_tokens: 400 } }));
    scope.sessionId = "s1";
    await withUsage({ kind: "picture", sessionId: "s1" }, async () => noteUsage({}, 1));
    noteUsage({ prompt_tokens: 10, completion_tokens: 5 });
    await settle();
    const rows = await db.all<{ kind: string; session_id: string | null; input_tokens: number; cached_tokens: number; output_tokens: number; images: number }>("SELECT * FROM ai_usage ORDER BY id");
    expect(rows).toMatchObject([
      { kind: "case-start", session_id: "s1", input_tokens: 1000, cached_tokens: 400, output_tokens: 200, images: 0 },
      { kind: "picture", session_id: "s1", images: 1 },
      { kind: "other", session_id: null, input_tokens: 10 },
    ]);
  });

  it("is priced from the owner's prices, cached input at its own rate", () => {
    const p = { input: 1, cached: 0.1, output: 4, image: 0.01 };
    expect(costOf({ inputTokens: 1_000_000, cachedTokens: 500_000, outputTokens: 250_000, images: 2 }, p)).toBeCloseTo(0.5 + 0.05 + 1 + 0.02);
    expect(costOf({ inputTokens: 1, cachedTokens: 0, outputTokens: 1, images: 0 }, null)).toBeNull();
  });

  it("adds up per kind and per case for the admin", async () => {
    process.env.RAMAI_PRICE_INPUT_PER_M = "2";
    process.env.RAMAI_PRICE_OUTPUT_PER_M = "8";
    await withUsage({ kind: "turn", sessionId: "a" }, async () => noteUsage({ prompt_tokens: 500_000, completion_tokens: 0 }));
    await withUsage({ kind: "turn", sessionId: "b" }, async () => noteUsage({ prompt_tokens: 0, completion_tokens: 500_000 }));
    await settle();
    const r = await usageReport(30);
    expect(r.kinds).toMatchObject([{ kind: "turn", calls: 2, inputTokens: 500_000, outputTokens: 500_000, usd: 5 }]);
    expect(r.caseCost).toMatchObject({ counted: 2, median: 4, p90: 4 });
  });
});
