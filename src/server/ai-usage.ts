import "server-only";

import { after } from "next/server";

import { setUsageSink, type Usage } from "@/engine/providers/usage";

import { db } from "./db";

/**
 * Stores what each AI call used (see engine/providers/usage), and sums it up for the admin: the real
 * cost of a case, so Pro can be priced on it. Prices are the owner's, in US dollars per million tokens
 * and per picture, from the env (OpenAI's price page) — without them, only tokens are shown.
 */
function store(u: Usage) {
  const write = () =>
    db
      .run(
        "INSERT INTO ai_usage (session_id, kind, input_tokens, cached_tokens, output_tokens, images, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        u.sessionId ?? null,
        u.kind,
        u.inputTokens,
        u.cachedTokens,
        u.outputTokens,
        u.images,
        Date.now(),
      )
      .catch((err) =>
        console.error(
          "[ramai] usage not recorded:",
          err instanceof Error ? err.message : err,
        ),
      );
  try {
    // After the response, so counting never slows a reply.
    after(write);
  } catch {
    // Outside a request (a script, a test): shortly, once the case it belongs to has its id.
    setTimeout(write, 0);
  }
}

setUsageSink(store);

export interface UsagePrices {
  input: number;
  cached: number;
  output: number;
  image: number;
}

const price = (name: string) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** USD per 1M input / cached-input / output tokens and per picture, or null when not set. */
export function usagePrices(): UsagePrices | null {
  const input = price("RAMAI_PRICE_INPUT_PER_M");
  const output = price("RAMAI_PRICE_OUTPUT_PER_M");
  if (input === null || output === null) return null;
  return {
    input,
    cached: price("RAMAI_PRICE_CACHED_PER_M") ?? input,
    output,
    image: price("RAMAI_PRICE_IMAGE") ?? 0,
  };
}

export interface UsageRow {
  kind: string;
  calls: number;
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
  images: number;
  usd: number | null;
}

export interface UsageReport {
  days: number;
  kinds: UsageRow[];
  total: UsageRow;
  /** Cases started in the window, and the average cost of one (all AI spend ÷ cases). */
  cases: number;
  perCase: number | null;
  /** Of the cases whose calls were counted against them: the median and the dearest 10%. */
  caseCost: { counted: number; median: number | null; p90: number | null };
  prices: UsagePrices | null;
}

export const costOf = (
  r: {
    inputTokens: number;
    cachedTokens: number;
    outputTokens: number;
    images: number;
  },
  p: UsagePrices | null,
): number | null =>
  p
    ? ((r.inputTokens - r.cachedTokens) * p.input +
        r.cachedTokens * p.cached +
        r.outputTokens * p.output) /
        1e6 +
      r.images * p.image
    : null;

const pct = (sorted: number[], q: number) =>
  sorted.length
    ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!
    : null;

export async function usageReport(days = 30): Promise<UsageReport> {
  const since = Date.now() - days * 86_400_000;
  const prices = usagePrices();
  const rows = await db.all<{
    kind: string;
    calls: number;
    i: number;
    c: number;
    o: number;
    img: number;
  }>(
    "SELECT kind, COUNT(*) AS calls, SUM(input_tokens) AS i, SUM(cached_tokens) AS c, SUM(output_tokens) AS o, SUM(images) AS img FROM ai_usage WHERE created_at > ? GROUP BY kind ORDER BY kind",
    since,
  );
  const kinds = rows.map((r) => {
    const row = {
      kind: r.kind,
      calls: Number(r.calls),
      inputTokens: Number(r.i ?? 0),
      cachedTokens: Number(r.c ?? 0),
      outputTokens: Number(r.o ?? 0),
      images: Number(r.img ?? 0),
    };
    return { ...row, usd: costOf(row, prices) };
  });
  const sum = (
    k: "calls" | "inputTokens" | "cachedTokens" | "outputTokens" | "images",
  ) => kinds.reduce((n, r) => n + r[k], 0);
  const totalRow = {
    kind: "all",
    calls: sum("calls"),
    inputTokens: sum("inputTokens"),
    cachedTokens: sum("cachedTokens"),
    outputTokens: sum("outputTokens"),
    images: sum("images"),
  };
  const total = { ...totalRow, usd: costOf(totalRow, prices) };
  const cases = Number(
    (
      await db.get<{ n: number }>(
        "SELECT COUNT(*) AS n FROM case_starts WHERE created_at > ?",
        since,
      )
    )?.n ?? 0,
  );
  const perSession = await db.all<{
    i: number;
    c: number;
    o: number;
    img: number;
  }>(
    "SELECT SUM(input_tokens) AS i, SUM(cached_tokens) AS c, SUM(output_tokens) AS o, SUM(images) AS img FROM ai_usage WHERE created_at > ? AND session_id IS NOT NULL GROUP BY session_id",
    since,
  );
  const costs = prices
    ? perSession
        .map(
          (r) =>
            costOf(
              {
                inputTokens: Number(r.i ?? 0),
                cachedTokens: Number(r.c ?? 0),
                outputTokens: Number(r.o ?? 0),
                images: Number(r.img ?? 0),
              },
              prices,
            )!,
        )
        .sort((a, b) => a - b)
    : [];
  return {
    days,
    kinds,
    total,
    cases,
    perCase: total.usd !== null && cases > 0 ? total.usd / cases : null,
    caseCost: {
      counted: perSession.length,
      median: pct(costs, 0.5),
      p90: pct(costs, 0.9),
    },
    prices,
  };
}
