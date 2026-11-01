import { readFileSync } from "node:fs";
import { it } from "vitest";
for (const line of readFileSync(".env.local", "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^"|"$/g, ""); }
process.env.RAMAI_DB_PATH = ":memory:"; process.env.RAMAI_ENGINE = "openai";
it("guide", { timeout: 120000 }, async () => {
  const { getCase } = await import("@/engine/cases");
  const { createOpenAIProvider } = await import("@/engine/providers/openai");
  const { nextSeniorStep } = await import("@/engine/simulator");
  const { converse } = await import("../helpers");
  const def = getCase("id-dengue-01")!;
  const played = await converse(def, []);
  const step = nextSeniorStep(def, played.hidden);
  require("node:fs").appendFileSync("/tmp/claude-guide.txt", "STEP " + JSON.stringify({ stage: step.stage, ask: step.ask }));
  const t = Date.now();
  const g = await createOpenAIProvider().guide!(step, { def, hidden: played.hidden, transcript: played.state.messages, country: "IN", lang: "en" });
  require("node:fs").appendFileSync("/tmp/claude-guide.txt", "\nGUIDE " + (Date.now() - t) + "ms " + JSON.stringify(g)?.slice(0, 1200) + "\n");
});
