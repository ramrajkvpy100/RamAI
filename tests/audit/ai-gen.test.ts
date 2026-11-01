/** Audit (temporary, uses AI credits): only invents cases, keeping the engine's reasons for any rejection. */
import { readFileSync, writeFileSync } from "node:fs";
import { it } from "vitest";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^"|"$/g, "");
}
process.env.RAMAI_DB_PATH = ":memory:";
process.env.RAMAI_ENGINE = "openai";
process.env.RAMAI_TRACE = "1";
const OUT = process.env.AUDIT_OUT ?? "/tmp/ai-gen.txt";
const LOGS: string[] = [];
for (const k of ["error", "warn", "info", "log"] as const) {
  const orig = console[k].bind(console);
  console[k] = (...a: unknown[]) => { LOGS.push(`[${k}] ${a.map((x) => (x instanceof Error ? x.message : typeof x === "string" ? x : JSON.stringify(x))).join(" ")}`.slice(0, 2000)); writeFileSync(OUT, LOGS.join("\n")); orig(...a); };
}
const CHOICES = JSON.parse(process.env.AUDIT_CHOICES ?? "[]") as { specialty: string; level: string; track: string }[];
it("invents cases", { timeout: 1_500_000 }, async () => {
  const { getProvider } = await import("@/engine/providers");
  const provider = await getProvider();
  for (const c of CHOICES) {
    const t0 = Date.now();
    LOGS.push(`\n===== ${c.specialty} ${c.level} ${c.track}`);
    try {
      const src = await provider.createCase({ specialty: c.specialty as never, level: c.level as never, track: c.track as never, country: "IN" });
      LOGS.push(`RESULT ${src.kind} ${src.kind === "generated" ? src.def.truth.diagnosis : src.id} (${Math.round((Date.now() - t0) / 1000)} s)`);
    } catch (err) {
      LOGS.push(`RESULT ERROR ${err instanceof Error ? err.message : String(err)} (${Math.round((Date.now() - t0) / 1000)} s)`);
    }
    writeFileSync(OUT, LOGS.join("\n"));
  }
});
