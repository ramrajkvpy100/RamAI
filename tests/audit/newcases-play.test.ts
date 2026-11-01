import { it } from "vitest";
import { gpUtiPhc } from "@/engine/cases/gp-uti-phc";
import { pedDiarrhoeaPhc } from "@/engine/cases/ped-diarrhoea-phc";
import { generateDebrief } from "@/engine/debrief";
import { converse } from "../helpers";
const runs: [string, typeof gpUtiPhc, string[]][] = [
  ["GP good", gpUtiPhc, ["what brings you", "any fever or back pain", "any vaginal discharge", "lmp?", "how much water do you drink", "any allergy", "check vitals", "examine abdomen", "renal angle tenderness", "urine dipstick", "upt", "nitrofurantoin 100 mg bd x 5 days", "drink plenty of water, dont hold urine", "come back if fever, back pain or not better in 2 days", "follow up 3 days", "dx acute uncomplicated cystitis. close"]],
  ["GP bad", gpUtiPhc, ["wat hapnd", "inj ceftriaxone 1 g iv", "cipro 500 bd x 5 days", "cbc", "usg abdomen", "dexa 8 mg iv", "dx pyelonephritis close"]],
  ["Ped good", pedDiarrhoeaPhc, ["what happened", "any blood in stool", "is he alert or sleepy", "is he drinking", "urine?", "what does he eat", "any medicines given", "vaccinated?", "general exam", "check hydration", "capillary refill", "ors 750 ml over 4 hours", "zinc 20 mg od x 14 days", "continue breastfeeding and food", "dont give the syrup", "come back if he can't drink, very sleepy or blood in stool", "wait 4 hours", "check hydration", "dx acute watery diarrhoea with some dehydration. close"]],
  ["Ped bad", pedDiarrhoeaPhc, ["wat hapnd", "loperamide 2 mg", "yes", "metronidazole 200 mg tds x 5 days", "ns 1 litre over 1 hour", "stool r/m", "wait 2 hours", "dx dysentery close"]],
];
for (const [name, def, script] of runs) it(name, async () => {
  const { hidden, state, turns } = await converse(def, script);
  for (const t of turns) { console.log(`> ${t.input}`); for (const e of t.effects) if (e.type === "message") console.log(`    ${e.role}: ${e.text.slice(0, 180)}`); }
  const d = generateDebrief(def, hidden, state);
  console.log(`== ${name}: ${d.score.total}/100 verdict ${d.verdict} status ${d.finalStatus}`);
  for (const m of d.missed.slice(0, 8)) console.log(`   MISSED[${m.severity}] ${m.what}`);
}, 60000);
