import type { ClinicalCaseDefinition } from "@/engine/case-definition";
import { resolveIntents } from "@/engine/intent";
import { applyEffects, createInitialState } from "@/engine/reducer";
import { createHiddenState, openingEffects, runTurn } from "@/engine/simulator";
import type { ActionRecord, CaseState, TurnEffect } from "@/engine/types";

export function play(def: ClinicalCaseDefinition, inputs: string[]) {
  const hidden = createHiddenState(def);
  let state: CaseState = createInitialState({
    sessionId: "test", caseNumber: 1, briefing: def.briefing, track: def.track, level: def.level, setting: def.setting,
    patient: def.patient, arrivalMinuteOfDay: def.arrivalMinuteOfDay,
  });
  state = applyEffects(state, openingEffects(def, hidden));
  const turns: { input: string; record: ActionRecord; effects: TurnEffect[] }[] = [];
  inputs.forEach((raw, i) => {
    const intents = resolveIntents(raw, { def, setting: hidden.setting, weightKg: parseFloat(hidden.vitals.weight.value) || 60 });
    const record: ActionRecord = { id: `a${i + 1}`, at: hidden.clock, raw, intents };
    const effects = runTurn(def, hidden, record);
    state = applyEffects(state, effects);
    turns.push({ input: raw, record, effects });
  });
  return { hidden, state, turns };
}

export const messagesOf = (effects: TurnEffect[]) =>
  effects.filter((e): e is Extract<TurnEffect, { type: "message" }> => e.type === "message").map((e) => `${e.role}: ${e.text}`);
