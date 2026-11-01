/**
 * Audit (costs credits): a really bad doctor plays five hard cases through the real AI reader and the medical APIs,
 * once per model. MODEL=gemini makes OpenAI fail, so the Gemini backup answers.
 */
import { writeFileSync } from "node:fs";

import { it } from "vitest";

import { ALL_CASES } from "@/engine/cases";
import { generateDebrief } from "@/engine/debrief";
import { createOpenAIProvider } from "@/engine/providers/openai";
import { applyEffects, createInitialState } from "@/engine/reducer";
import { createHiddenState, openingEffects, runTurn } from "@/engine/simulator";
import type { ActionRecord, CaseState } from "@/engine/types";

const SCRIPT = [
  "patient looks fine to me, send home", "give him some strong injection", "Isotreen 40 mg", "Secukinumab 150 mg PO daily", "azithromicin 500 od x 3 days",
  "morfine 50 mg iv", "give ns 5 litres fast", "MRI whole body and all blood tests", "why are you crying, tell me the diagnosis yourself",
  "paracetamol 650 mg rectal cream", "stop all medicines", "you dont have anything, its all in your head", "dx anxiety. close",
];
const IDS = ["em-adhf", "gr-aip", "med-sle", "ph-acs", "obg-pph"];

it("bad doctor through the AI", { timeout: 590_000 }, async () => {
  const model = process.env.AUDIT_MODEL ?? "gpt-6-luna";
  const gemini = model.startsWith("gemini");
  if (gemini) {
    process.env.GEMINI_MODEL = model;
    const real = globalThis.fetch;
    globalThis.fetch = ((u: RequestInfo | URL, o?: RequestInit) => (String(u).includes("api.openai.com") ? Promise.resolve(new Response("{}", { status: 503 })) : real(u, o))) as typeof fetch;
  } else process.env.OPENAI_MODEL = model;
  const provider = createOpenAIProvider();
  const out: string[] = [];
  for (const id of IDS) {
    const def = ALL_CASES.find((c) => c.id.startsWith(id))!;
    const hidden = createHiddenState(def);
    let state: CaseState = createInitialState({ sessionId: "t", caseNumber: 1, briefing: def.briefing, track: def.track, level: def.level, setting: def.setting, patient: def.patient, arrivalMinuteOfDay: def.arrivalMinuteOfDay });
    state = applyEffects(state, openingEffects(def, hidden));
    out.push(`\n===== ${def.id} — ${def.truth.diagnosis}`);
    for (const [i, raw] of SCRIPT.entries()) {
      const t0 = Date.now();
      const read = await provider.interpret(raw, { def, hidden, transcript: state.messages });
      const record: ActionRecord = { id: `a${i}`, at: hidden.clock, raw, intents: read.intents, generated: read.generated };
      const effects = runTurn(def, hidden, record);
      state = applyEffects(state, effects);
      out.push(`DR> ${raw}  [${Date.now() - t0}ms; ${read.intents.map((x) => `${x.kind}:${x.targetId ?? ""}`).join(" | ")}]`);
      for (const e of effects) if (e.type === "message") out.push(`   ${(e as { role: string }).role}: ${(e as { text: string }).text.slice(0, 260)}`);
      if (hidden.closed) break;
    }
    const d = hidden.closed ? generateDebrief(def, hidden, state) : null;
    out.push(`--- ${d ? `score ${d.score.total}/100 ${d.verdict} ${d.finalStatus}` : "not closed"}; status ${state.patientStatus}; drugs ${hidden.drugs.map((x) => `${x.generic} ${x.dose ?? ""}`).join(", ")}`);
    writeFileSync(process.env.AUDIT_OUT!, out.join("\n"));
  }
});
