/**
 * Builds src/lib/knowledge-pack.json: official facts for every drug in the formulary, fetched ahead of time so a case
 * never waits on a public API. Free, no keys. Run weekly or after adding drugs:
 *   AUDIT=1 npx vitest run tests/audit/build-knowledge-pack.test.ts
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { it } from "vitest";

import { FORMULARY } from "@/engine/formulary";
import { clearMedicalCache, cypEnzymes, drugForms, drugMechanism, fdaLabel, reportedReactions } from "@/engine/providers/medical-apis";

const OUT = "src/lib/knowledge-pack.json";
const NAME = (generic: string) => generic.replace(/\s*\d.*$/, "").replace(/[–-]/g, " / ").toLowerCase().trim();
const short = (t: string | undefined, n = 260) => (t && t.length > n ? `${t.slice(0, n - 1)}…` : t);

it("builds the pack", { timeout: 590_000 }, async () => {
  const old: Record<string, Record<string, unknown>> = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")).drugs ?? {} : {};
  const drugs: Record<string, unknown> = { ...old };
  const queue = FORMULARY.filter((d) => !d.fluid && !old[d.id]);
  const worker = async () => {
    for (let d = queue.shift(); d; d = queue.shift()) {
      const name = NAME(d.generic);
      const [forms, label, reactions, cyp, mechanism] = await Promise.all([drugForms(name), fdaLabel(name), reportedReactions(name), cypEnzymes(name), drugMechanism(name)]);
      const facts = {
        ...(forms?.routes.length ? { routes: forms.routes, strengths: forms.strengths.slice(0, 6) } : {}),
        ...(label ? { boxedWarning: short(label.boxedWarning), contraindications: short(label.contraindications), interactions: short(label.interactions), pregnancy: short(label.pregnancy), overdose: short(label.overdose) } : {}),
        ...(reactions?.length ? { reported: reactions.slice(0, 5) } : {}),
        ...(cyp?.length ? { cyp } : {}),
        ...(mechanism?.length ? { mechanism: mechanism.slice(0, 2) } : {}),
      };
      if (Object.keys(facts).length) drugs[d.id] = facts;
    }
  };
  clearMedicalCache();
  await Promise.all([worker(), worker(), worker()]);
  writeFileSync(OUT, `${JSON.stringify({ builtAt: new Date().toISOString().slice(0, 10), sources: "RxTerms (NLM), openFDA labels and FAERS, PubChem, ChEMBL", drugs })}\n`);
  console.log(`pack: ${Object.keys(drugs).length} of ${FORMULARY.length} drugs`);
});
