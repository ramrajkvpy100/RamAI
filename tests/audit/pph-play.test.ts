import { it } from "vitest";
import { obgPphChc } from "@/engine/cases/obg-pph-chc";
import { converse } from "../helpers";

const good = ["how much bleeding", "feel the uterus", "massage the uterus", "two wide bore iv cannula", "send blood for group and crossmatch", "oxytocin 10 units iv", "yes", "tranexamic acid 1 g iv over 10 min", "oxytocin 40 units in 1 litre rl over 4 hours", "ringer lactate 1 litre over 30 min", "magnesium sulphate 4 g iv", "wait 30 min", "how are you feeling", "examine the uterus", "check vitals", "catheterise", "check the placenta", "look for tears", "check vitals", "diagnosis atonic pph", "close case"];
const bad = ["what happened", "methergin 0.5 mg iv", "pause 500 mg orally", "vaginal pack", "wait 30 min", "check vitals", "carboprost 2.5 mg im", "diagnosis retained placenta", "close case"];
for (const [name, script] of [["good", good], ["bad", bad]] as const) {
  it(name, async () => {
    const { state, turns } = await converse(obgPphChc, [...script]);
    for (const t of turns) {
      console.log(`\n> ${t.input}`);
      for (const e of t.effects) if (e.type === "message") console.log(`  ${e.role}: ${e.text.slice(0, 220)}`);
    }
    console.log("STATUS", state.status, JSON.stringify((state as any).debrief?.score ?? (state as any).score ?? "").slice(0, 400));
  }, 60000);
}
