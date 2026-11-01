/**
 * Audit (temporary): plays every written case with a messy, realistic doctor — typos, wrong drugs and
 * doses, odd tests, shorthand — through the rules engine, and writes the transcripts for review.
 */
import { writeFileSync } from "node:fs";

import { it } from "vitest";

import { ALL_CASES } from "@/engine/cases";
import { generateDebrief } from "@/engine/debrief";
import { converse } from "../helpers";

const OUT = process.env.AUDIT_OUT ?? "/tmp/rules-audit.txt";

const COMMON = [
  "hi",
  "wat happened",
  "since when",
  "any fever?",
  "h/o dm htn tb asthma?",
  "any drug allergy",
  "check vitals",
  "o/e general exam",
  "check pulse and bp",
  "auscultate chest",
  "examine abdomen",
];

const SCRIPTS: Record<string, string[]> = {
  "id-dengue": ["cbc, ns1 antigen, dengue igm", "tab ibuprofen 400 mg tds", "inj diclofenac 75mg im stat", "paracetmol 1g po qid", "platelet transfusion 1 unit", "start ivf ns 500 ml over 1 hr", "wait 2 hours", "repeat cbc", "lft", "usg abdomen", "ask patient to drink plenty of fluids", "final dx: dengue fever. case close"],
  "em-viper-phc": ["tie tourniquet above the bite", "cut and suck the wound", "20wbct", "inj tetanus toxoid", "give asv 2 vials iv", "asv 10 vial iv over 1 hr", "inj hydrocortisone 100mg iv", "inj adrenalin 0.5 mg iv", "rft", "pt inr", "refer to district hospital", "dx neurotoxic snake bite. close case"],
  "em-adhf": ["give oxygen", "ecg", "cxr pa", "inj furosemide 40 mg iv", "inj lasix 400mg iv", "ivf ns 2 litre fast", "tab metoprolol 50 mg", "gtn spray sl", "nitroglycerin infusion", "bnp", "trop i", "2d echo", "make him lie flat", "sit him up", "dx: pneumonia. close"],
  "ph-acs": ["what happened", "is he sweating", "chew aspirn 325", "take sorbitrate under tongue", "give him a pain killer like brufen", "call 108", "drive him to hospital yourself", "dx acs. close case"],
  "surg-appendicitis": ["examine rif", "check mcburney point", "rovsing sign", "cbc", "crp", "usg abdomen", "ct abdomen with contrast", "inj morphine 10mg iv", "inj ceftriaxon 1 gm iv bd", "inj metro 500 mg iv tds", "inj pantop 40 iv od", "keep npo", "plan emergency appendicectomy", "dx acute appendicitis. close"],
  "tut-hypoglycaemia": ["check grbs", "give 25% dextrose 100 ml iv", "inj insulin 10 units", "glucagon 1mg im", "give sugar water orally", "stop glimepiride", "dx hypoglycemia. close"],
  "derm-acne": ["examine face", "doxycyclin 100mg bd", "isotretinoin 20 mg od", "adapalene gel at night", "benzoyl peroxide 2.5% gel", "ask about periods and pregnancy", "dx acne. close"],
  "derm-tinea": ["koh mount", "betamethasone cream bd", "clotrimazole cream bd for 4 weeks", "tab terbinafine 250 mg od", "tab fluconazol 150mg weekly", "advise loose cotton clothes", "dx tinea. close"],
  "derm-melasma": ["woods lamp exam", "hydroquinone 4% cream", "triple combination cream", "sunscreen spf 50", "oral tranexamic acid 250 bd", "dx melasma. close"],
  "derm-psoriasis": ["examine nails and joints", "auspitz sign", "methotrexate 7.5 mg weekly", "methotrexate 7.5 mg daily", "folic acid 5mg", "topical steroids", "x ray hands", "rf", "dx psoriasis with psoriatic arthritis. close"],
  "med-pad": ["check peripheral pulses", "abi", "arterial doppler lower limbs", "aspirin 75 od", "atorvastatin 40 mg", "cilostazol 100 bd", "stop smoking", "ct angiography", "dx pad. close"],
  "med-sle-apex": ["ana", "anti dsdna", "c3 c4", "urine r/m", "24 hr urine protein", "kidney biopsy", "prednisolone 1mg/kg", "hcq 200 bd", "mycophenolate 1 g bd", "cyclophosphamide", "dx sle. close"],
  "gr-aip": ["urine porphobilinogen", "serum sodium", "give iv dextrose 10%", "inj hemin", "phenytoin for seizures", "tab paracetamol for pain", "inj tramadol", "dx acute intermittent porphyria. close"],
};

it("plays every written case with a messy doctor", async () => {
  const out: string[] = [];
  for (const def of ALL_CASES) {
    const key = Object.keys(SCRIPTS).find((k) => def.id.startsWith(k));
    const script = [...COMMON, ...((key && SCRIPTS[key]) ?? ["cbc", "paracetamol 650 mg tds", "dx not sure. close"])];
    const { hidden, state, turns } = await converse(def, script);
    out.push(`\n================ ${def.id} — ${def.truth.diagnosis} (${def.track}, ${def.level}, ${def.patient.age} ${def.patient.sex})`);
    for (const t of turns) {
      out.push(`\nDR> ${t.input}`);
      out.push(`   [${t.record.intents.map((i) => `${i.kind}:${i.targetId ?? ""}${i.payload ? JSON.stringify(i.payload) : ""}`).join(" | ")}]`);
      for (const e of t.effects) {
        if (e.type === "message") out.push(`   ${e.role}/${e.kind}: ${e.text}`);
        else if (e.type === "investigation_ordered") out.push(`   ORDER ${e.name} (${e.turnaroundMin} min, cost ${e.cost})`);
        else if (e.type === "drug") out.push(`   DRUG ${e.drug.generic ?? ""} ${e.drug.dose ?? ""} ${e.drug.route ?? ""} ${e.drug.mode ?? ""}${(e.drug as { doseError?: boolean }).doseError ? " DOSE-ERROR" : ""}`);
      }
    }
    if (hidden.closed) {
      const d = generateDebrief(def, hidden, state);
      out.push(`\n--- DEBRIEF score ${d.score.total} verdict ${d.verdict} status ${d.finalStatus}`);
      for (const l of d.score.lines) out.push(`   ${l.category}: ${(l as unknown as { points?: number }).points}/${l.max}`);
      for (const p of d.score.penalties) out.push(`   PENALTY ${p.label} ${p.points}: ${p.reason}`);
      for (const m of d.missed) out.push(`   MISSED[${m.severity}] ${m.what}`);
      out.push(`   didWell: ${d.didWell.join(" / ")}`);
    } else out.push("\n--- (case not closed)");
  }
  writeFileSync(OUT, out.join("\n"));
});
