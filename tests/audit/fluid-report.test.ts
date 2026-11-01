/** Audit (costs credits): the reported orders on newly invented cases who aren't short of fluid. */
import { writeFileSync } from "node:fs";
import { it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createOpenAIProvider } from "@/engine/providers/openai";
import { applyEffects, createInitialState } from "@/engine/reducer";
import { createHiddenState, openingEffects, runTurn, vitalsNow } from "@/engine/simulator";

it("fluids", { timeout: 900_000 }, async () => {
  process.env.OPENAI_MODEL = "gpt-6-luna";
  const provider = createOpenAIProvider();
  const out: string[] = [];
  for (const spec of (process.env.AUDIT_NEW ?? "").split(",")) {
    const [specialty, track] = spec.split("/");
    const src = await provider.createCase({ specialty, track, country: "IN" } as never);
    if (src.kind !== "generated") continue;
    const def = src.def;
    const hidden = createHiddenState(def);
    let state = createInitialState({ sessionId: "t", caseNumber: 1, briefing: def.briefing, track: def.track, level: def.level, setting: def.setting, patient: def.patient, arrivalMinuteOfDay: def.arrivalMinuteOfDay });
    state = applyEffects(state, openingEffects(def, hidden));
    out.push("===== " + def.truth.diagnosis + " " + def.patient.age + " " + def.track + " volume=" + def.profile?.volume + " start BP " + hidden.vitals.bp.value);
    for (const [i, raw] of ["Iv ns 500 ml in 50 sec", "Bp", "Give 500 ml rl iv in 10 sec", "Bp", "wait 4 hours", "Bp"].entries()) {
      const read = await provider.interpret(raw, { def, hidden, transcript: state.messages });
      const fx = runTurn(def, hidden, { id: "a" + i, at: hidden.clock, raw, intents: read.intents, generated: read.generated });
      state = applyEffects(state, fx);
      out.push("DR> " + raw);
      for (const e of fx) if (e.type === "message" && e.role !== "doctor") out.push("   " + e.role + ": " + e.text.slice(0, 200));
      out.push("   [BP now " + vitalsNow(hidden).bp.value + "]");
    }
    writeFileSync(process.env.AUDIT_OUT!, out.join("\n"));
  }
});
