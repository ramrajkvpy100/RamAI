import { notFound } from "next/navigation";

import { DebriefPreview } from "./preview";
import { emViperPhc } from "@/engine/cases/em-viper-phc";
import { generateDebrief } from "@/engine/debrief";
import { presentDebrief } from "@/engine/i18n/country";
import { resolveIntents } from "@/engine/intent";
import { applyEffects, createInitialState } from "@/engine/reducer";
import { createHiddenState, openingEffects, runTurn } from "@/engine/simulator";

/** Development only: a debrief from a written case, played by script — no AI. */
export default function DebriefDev() {
  if (process.env.NODE_ENV === "production") notFound();
  const def = emViperPhc;
  const hidden = createHiddenState(def);
  let state = createInitialState({ sessionId: "dev", caseNumber: 3, briefing: def.briefing, track: def.track, level: def.level, setting: def.setting, patient: def.patient, arrivalMinuteOfDay: def.arrivalMinuteOfDay });
  state = applyEffects(state, openingEffects(def, hidden));
  ["What happened?", "Do a 20 minute whole blood clotting test", "Give ASV 10 vials IV over 1 hour", "Final diagnosis: viper bite. Case close."].forEach((raw, i) => {
    state = applyEffects(state, runTurn(def, hidden, { id: `a${i}`, at: hidden.clock, raw, intents: resolveIntents(raw, { def, setting: hidden.setting, weightKg: 60 }) }));
  });
  const debrief = presentDebrief(generateDebrief(def, hidden, state), "IN");
  return <DebriefPreview state={state} debrief={debrief} />;
}
