import { describe, expect, it } from "vitest";

import { ALL_CASES } from "@/engine/cases";
import { mockProvider } from "@/engine/providers/mock";
import { applyEffects, createInitialState } from "@/engine/reducer";
import { createHiddenState, openingEffects, runTurn } from "@/engine/simulator";
import type { ActionRecord, CaseState, TurnEffect } from "@/engine/types";

/** Pressing only "Ask your senior" and the button it gives finishes every case. */
async function seniorOnly(def: (typeof ALL_CASES)[number]) {
  const hidden = createHiddenState(def);
  let state: CaseState = createInitialState({ sessionId: "t", caseNumber: 1, briefing: def.briefing, track: def.track, level: def.level, setting: def.setting, patient: def.patient, arrivalMinuteOfDay: def.arrivalMinuteOfDay });
  state = applyEffects(state, openingEffects(def, hidden));
  let next = "Hint";
  const said: string[] = [];
  for (let i = 0; i < 160 && !hidden.closed; i++) {
    const read = await mockProvider.interpret(next, { def, hidden, transcript: state.messages });
    const record: ActionRecord = { id: `a${i}`, at: hidden.clock, raw: next, intents: read.intents };
    const fx: TurnEffect[] = runTurn(def, hidden, record);
    state = applyEffects(state, fx);
    said.push(`${next} → ${fx.filter((e) => e.type === "message").map((e) => (e as { text: string }).text).join(" | ").slice(0, 160)}`);
    // The nurse's or the senior's first button, else ask the senior again.
    const replies = fx.flatMap((e) => (e.type === "message" && "replies" in e && e.replies ? e.replies : []));
    next = next === "Hint" && replies[0] ? replies[0].text : replies[0]?.text && next !== replies[0].text ? replies[0].text : "Hint";
  }
  return { closed: hidden.closed, said };
}

describe("a case can be finished with the senior's help alone", () => {
  for (const def of ALL_CASES.filter((c) => !c.guided && c.track !== "phone")) {
    it(def.id, async () => {
      const r = await seniorOnly(def);
      if (!r.closed) console.log(def.id, "\n" + r.said.slice(-12).join("\n"));
      expect(r.closed).toBe(true);
    });
  }
});
