import { readFileSync } from "node:fs";
import { it } from "vitest";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^"|"$/g, "");
}
process.env.RAMAI_DB_PATH = ":memory:";
it("why cases are rejected", { timeout: 900_000 }, async () => {
  const { createOpenAIProvider } = await import("@/engine/providers/openai");
  const p = createOpenAIProvider();
  const runs = [{ specialty: "Medicine", track: "opd" }, { specialty: "Pediatrics", track: "emergency" }, { specialty: "Surgery", track: "emergency" }] as const;
  await Promise.all(runs.map(async (r, i) => {
    const src = await p.createCase({ userId: "a", caseNumber: i + 1, specialty: r.specialty, track: r.track, country: "IN" } as never);
    console.log(`RESULT ${r.specialty}: ${src.kind}${src.kind === "generated" ? ` — ${src.def.truth.diagnosis}, age ${src.def.patient.age}` : ""}`);
  }));
});
