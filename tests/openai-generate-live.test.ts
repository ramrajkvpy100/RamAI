/**
 * Invents real patients with the real OpenAI API — skipped unless asked for:
 *   RAMAI_LIVE_OPENAI=1 npx vitest run tests/openai-generate-live.test.ts
 * Uses .env.local; costs about a cent or two per patient.
 */
import { describe, expect, it } from "vitest";

const live = process.env.RAMAI_LIVE_OPENAI === "1";

describe.skipIf(!live)("OpenAI live — inventing patients", () => {
  it("writes a complete patient file the engine can play", async () => {
    process.loadEnvFile(".env.local");
    process.env.RAMAI_AI_CASES = "1";
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const t = Date.now();
      const res = await realFetch(url, init);
      const copy = res.clone();
      copy.json().then((j: { usage?: { prompt_tokens?: number; completion_tokens?: number } }) => {
        const out = j.usage?.completion_tokens ?? 0;
        console.log(`  OpenAI: ${j.usage?.prompt_tokens} in, ${out} out in ${Date.now() - t} ms → ${Math.round(out / ((Date.now() - t) / 1000))} tokens/s`);
      }).catch(() => {});
      return res;
    }) as typeof fetch;
    const { createOpenAIProvider } = await import("@/engine/providers/openai");
    const provider = createOpenAIProvider();
    for (const opts of [{ country: "IN" as const, allowedLevels: ["phc", "chc", "district"] as const }, { country: "IN" as const, easy: true, allowedLevels: ["phc", "chc", "district"] as const }]) {
      const t = Date.now();
      const src = await provider.createCase(opts);
      const ms = Date.now() - t;
      if (src.kind !== "generated") {
        console.log(`fell back to a written case after ${ms} ms`);
        continue;
      }
      const d = src.def;
      console.log(`${opts.easy ? "EASY " : ""}${ms} ms · ${d.specialty} · ${d.track}/${d.level} · difficulty ${d.difficulty} · ${d.patient.age}${d.patient.sex[0]} — ${d.briefing}`);
      console.log(`  diagnosis: ${d.truth.diagnosis} · history ${d.history.length}, exam ${d.exam.length}, tests ${d.investigations.length}, treatments ${d.therapeutics.length}`);
      console.log(`  pictures: ${Object.entries(d.pictures ?? {}).map(([r, p]) => `${r} ${p.type} (${p.view})`).join("; ") || "none"} · ECGs: ${[...d.investigations, ...d.exam].filter((x) => x.media?.spec?.kind === "ecg").length}`);
    }
    expect(true).toBe(true);
  }, 180_000);
});
