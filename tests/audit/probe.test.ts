import { it } from "vitest";
import { emAdhf } from "@/engine/cases/em-adhf";
import { dermTinea } from "@/engine/cases/derm-tinea";
import { converse } from "../helpers";
const L = ["family h/o", "family history", "cns", "examine cns", "per abdomen", "p/a", "jvp", "cvs", "fundus", "visual acuity", "otoscopy", "s. electrolytes", "penicillin", "stop the drip", "iv antibiotics", "cancel that", "theek ho jaoge", "bhai kya hua", "call senior", "shift to ot", "lithium 900", "zinc 20 mg", "colchicine 0.5", "labetalol 20 iv", "iron sucrose 200", "cbnaat", "sputum afb", "hav u taken anything", "what do u eat", "travel history", "double the dose", "change to iv", "same as before", "no dont", "yes"];
it("p", async () => { for (const def of [emAdhf, dermTinea]) for (const l of L) { const { turns } = await converse(def, [l]); const t = turns[0]!; console.log(`${def.id.slice(0,8)} | ${l} | ${t.record.intents.map(i=>`${i.kind}:${i.targetId??""}`).join(",")} | ${t.effects.filter(e=>e.type==="message").map((e:any)=>e.text).slice(1).join(" / ").slice(0,140)}`); } }, 60000);
