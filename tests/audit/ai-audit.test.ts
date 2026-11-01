/**
 * Audit (temporary, uses AI credits): AI-invented cases played with a messy doctor through the real
 * provider — interpretation, patient voices, results — exactly as the site runs them.
 */
import { readFileSync, writeFileSync } from "node:fs";

import { it } from "vitest";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^"|"$/g, "");
}
process.env.RAMAI_DB_PATH = ":memory:";
process.env.RAMAI_ENGINE = "openai";

const OUT = process.env.AUDIT_OUT ?? "/tmp/ai-audit.txt";

const SCRIPT = (process.env.AUDIT_SCRIPT === "bad" ? [
  "start ivf and antibiotics",
  "inj ceftriaxon 2 g iv",
  "wat happend",
  "h/o fevr?",
  "any allergy",
  "pcm 1 g stat",
  "inj diclofenec 75 im",
  "cbc lft rft electrolytes urine r/m xray chest usg abdomen ct abdomen",
  "examine",
  "check vitals",
  "metronidazol 5 g iv",
  "ns 3 litre over 15 min",
  "inj pantop 80 iv",
  "ondansetron 40 mg iv",
  "yes give it",
  "wait 2 hrs",
  "how is the patient",
  "what are the reports",
  "stop all medicines",
  "discharge home with paracetamol",
  "dx viral fever. close",
] : [
  "hi doc here", "wat brings u here", "since how many days", "any fvr cough vomiting loose motions", "past h/o?", "allergy to any medicin",
  "currently taking any tab", "check vitals", "examine", "cbc lft rft urine r/m", "xray chest", "inj ceftriaxon 1gm iv", "pcm 1 g tds x 3 days",
  "inj pantop 40 iv od", "wait 1 hr", "how r u feeling now", "what are the reports", "dx viral fever. case close",
]);

const CASES = (process.env.AUDIT_FEW ? [
  { specialty: "Medicine", track: "emergency" },
  { specialty: "Surgery", track: "emergency" },
  { specialty: "Pediatrics", track: "emergency" },
] : [
  { specialty: "Pediatrics", track: "emergency" },
  { specialty: "Medicine", track: "emergency" },
  { specialty: "OBGYN", track: "emergency" },
  { specialty: "Surgery", track: "emergency" },
  { specialty: "Cardiology", track: "emergency" },
  { specialty: "Pediatrics", track: "opd" },
]) as readonly { specialty: "Pediatrics" | "Medicine" | "OBGYN" | "Surgery" | "Cardiology"; track: "emergency" | "opd" }[];

it("plays AI-invented cases with a messy doctor", { timeout: 1_500_000 }, async () => {
  const { simulateCase, submitDoctorAction } = await import("@/engine/engine");
  const out: string[] = [];
  for (const [n, c] of CASES.entries()) {
    const t0 = Date.now();
    const { sessionInfo } = await import("@/engine/engine");
    let start = await simulateCase({ userId: "audit", caseNumber: n + 10, specialty: c.specialty, track: c.track, country: "IN" });
    for (let tries = 1; tries < 3 && !sessionInfo(start.token).generated; tries++) {
      out.push(`(attempt ${tries} rejected — trying again)`);
      start = await simulateCase({ userId: "audit", caseNumber: n + 10, specialty: c.specialty, track: c.track, country: "IN" });
    }
    out.push(`(AI-invented: ${sessionInfo(start.token).generated})`);
    out.push(`\n================ AI case ${n + 1}: ${c.specialty} ${c.track} — patient ${start.state.patient.age} ${start.state.patient.sex} (made in ${Math.round((Date.now() - t0) / 1000)} s)`);
    out.push(`BRIEFING: ${start.state.briefing}`);
    for (const m of start.state.messages) out.push(`   ${m.role}/${m.kind}: ${m.text}`);
    let token = start.token;
    let seen = start.state.messages.length;
    for (const input of SCRIPT) {
      const t = Date.now();
      try {
        const res = await submitDoctorAction(token, input, "audit");
        token = res.token;
        out.push(`\nDR> ${input}   (${((Date.now() - t) / 1000).toFixed(1)} s)`);
        for (const m of res.state.messages.slice(seen)) if (m.role !== "doctor") out.push(`   ${m.role}/${m.kind}: ${m.text}`);
        for (const i of res.state.investigations.filter((x) => x.status === "resulted" && Date.now() - t < 120_000)) void i;
        seen = res.state.messages.length;
        if (res.debrief) {
          const d = res.debrief;
          out.push(`\n--- DEBRIEF true dx: ${d.diagnosis}${d.qualifier ? ` (${d.qualifier})` : ""} | verdict ${d.verdict} | score ${d.score.total} | status ${d.finalStatus}`);
          for (const p of d.score.penalties) out.push(`   PENALTY ${p.label} ${p.points}: ${p.reason}`);
          for (const m of d.missed) out.push(`   MISSED[${m.severity}] ${m.what} — ${m.better}`);
          out.push(`   didWell: ${d.didWell.join(" / ")}`);
          out.push(`   sources: ${(d.sources ?? []).join(" | ")}`);
          out.push(`   drugs taught: ${d.drugs.map((x) => `${x.generic} ${x.dose} ${x.route} ${x.frequency ?? ""}`).join(" ; ")}`);
          const inv = res.state.investigations.map((x) => `${x.name}: ${(x.rows ?? []).map((r) => `${r.analyte} ${r.value}${r.unit ? " " + r.unit : ""}${r.flag ? `(${r.flag})` : ""}`).join(", ")}${x.report ? ` | ${x.report}` : ""}`);
          out.push(`   RESULTS:\n     ${inv.join("\n     ")}`);
        }
      } catch (err) {
        out.push(`\nDR> ${input}\n   !! ERROR ${err instanceof Error ? err.message : String(err)}`);
      }
      writeFileSync(OUT, out.join("\n"));
    }
  }
  writeFileSync(OUT, out.join("\n"));
});
