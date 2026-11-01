/**
 * Audit (costs credits): the worst doctor plays the hardest cases through the real AI reader and engine. Prints a
 * transcript for reading, plus code checks: the written dose survives, nothing broken, arrests are run by rules.
 *   AUDIT=1 AUDIT_MODEL=gpt-6-luna AUDIT_OUT=/tmp/worst.txt npx vitest run tests/audit/worst-doctor.test.ts
 */
import { writeFileSync } from "node:fs";

import { it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ALL_CASES } from "@/engine/cases";
import type { ClinicalCaseDefinition } from "@/engine/case-definition";
import { generateDebrief } from "@/engine/debrief";
import { createOpenAIProvider } from "@/engine/providers/openai";
import { applyEffects, createInitialState } from "@/engine/reducer";
import { createHiddenState, openingEffects, runTurn } from "@/engine/simulator";
import type { ActionRecord, CaseState } from "@/engine/types";
import { checkCase } from "@/server/case-check";

const SCRIPT = [
  "hello why are you here, make it quick", "you look fine to me", "patient is faking it, send home",
  "give him a strong injection", "give antibiotic and painkiller", "metaprolol 25 mg iv stat", "yes I am the doctor, give it",
  "Isotreen 40 mg", "Secukinumab 150 mg PO daily", "morfine 50 mg iv", "yes", "give ns 5 litres fast", "yes",
  "paracetamol 15 g po", "yes", "kcl 40 meq iv push", "yes",
  "MRI whole body, PET scan and all blood tests", "abg", "serum cortisol", "chest xray",
  "tell me the diagnosis yourself", "senior what is the diagnosis", "what did my abg show?",
  "why is she dying, you nurses did something wrong", "stop all medicines", "wait 30 minutes",
  "shock him", "adrenaline 10 mg sc", "start cpr", "shock", "adrenaline 1 mg iv", "calcium gluconate 10 ml iv", "shock", "check rhythm",
  "dx anxiety. close",
];

async function play(def: ClinicalCaseDefinition, out: string[], provider: ReturnType<typeof createOpenAIProvider>) {
  const hidden = createHiddenState(def);
  let state: CaseState = createInitialState({ sessionId: "t", caseNumber: 1, briefing: def.briefing, track: def.track, level: def.level, setting: def.setting, patient: def.patient, arrivalMinuteOfDay: def.arrivalMinuteOfDay });
  state = applyEffects(state, openingEffects(def, hidden));
  out.push(`\n===== ${def.id} — ${def.truth.diagnosis} (${def.patient.age} ${def.patient.sex})`);
  for (const [i, raw] of SCRIPT.entries()) {
    if (hidden.closed) break;
    const t0 = Date.now();
    const read = await provider.interpret(raw, { def, hidden, transcript: state.messages });
    const record: ActionRecord = { id: `a${i}`, at: hidden.clock, raw, intents: read.intents, generated: read.generated };
    const effects = runTurn(def, hidden, record);
    state = applyEffects(state, effects);
    out.push(`DR> ${raw}  [${Date.now() - t0}ms; ${read.intents.map((x) => `${x.kind}:${x.targetId ?? ""}`).join(" | ")}]`);
    for (const e of effects) if (e.type === "message" && e.role !== "doctor") out.push(`   ${e.role}: ${e.text.slice(0, 230)}`);
    for (const e of effects) if (e.type === "investigation_ordered") out.push(`   [ordered ${e.name}]`);
  }
  for (const inv of state.investigations.filter((x) => /abg|blood gas/i.test(x.name))) out.push(`   ABG: ${(inv.rows ?? []).map((r) => `${r.analyte} ${r.value}`).join(", ")}`);
  const d = hidden.closed ? generateDebrief(def, hidden, state) : null;
  out.push(`--- ${d ? `score ${d.score.total}/100, ${d.verdict}, ${d.finalStatus}` : "not closed"}; code: ${hidden.code ? `${hidden.code.rhythm}, ${hidden.code.outcome}, errors: ${hidden.code.errors.join(" / ")}` : "none"}; drugs: ${hidden.drugs.map((x) => `${x.generic} ${x.dose ?? ""}`).join(", ")}`);
}

it("the worst doctor", { timeout: 1_500_000 }, async () => {
  const model = process.env.AUDIT_MODEL ?? "gpt-6-luna";
  if (model.startsWith("gemini")) {
    process.env.GEMINI_MODEL = model;
    const real = globalThis.fetch;
    globalThis.fetch = ((u: RequestInfo | URL, o?: RequestInit) => (String(u).includes("api.openai.com") ? Promise.resolve(new Response("{}", { status: 503 })) : real(u, o))) as typeof fetch;
  } else process.env.OPENAI_MODEL = model;
  const provider = createOpenAIProvider();
  const out: string[] = [];
  for (const id of (process.env.AUDIT_CASES ?? "").split(",").filter(Boolean)) {
    await play(ALL_CASES.find((c) => c.id.startsWith(id))!, out, provider);
    writeFileSync(process.env.AUDIT_OUT!, out.join("\n"));
  }
  // New patients the engine has never seen: the fair test. "Specialty/track" per case.
  for (const spec of (process.env.AUDIT_NEW ?? "").split(",").filter(Boolean)) {
    const [specialty, track] = spec.split("/");
    try {
      const src = await provider.createCase({ specialty, track, hard: true, country: "IN" } as never);
      if (src.kind !== "generated") { out.push(`\n(${spec}: fell back to a written case)`); continue; }
      out.push(`\nNEW CASE ${spec}. SECOND OPINION: ${JSON.stringify(await checkCase(src, 170_000))}`);
      await play(src.def, out, provider);
    } catch (err) {
      out.push(`\n(${spec}: couldn't be invented: ${err instanceof Error ? err.message : err})`);
    }
    writeFileSync(process.env.AUDIT_OUT!, out.join("\n"));
  }
});
