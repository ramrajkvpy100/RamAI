/**
 * Audit (temporary): random erratic doctors on every written case — many seeds, random scripts.
 */
import { writeFileSync } from "node:fs";

import { it } from "vitest";

import { ALL_CASES } from "@/engine/cases";
import { generateDebrief } from "@/engine/debrief";
import { converse } from "../helpers";

const OUT = process.env.AUDIT_OUT ?? "/tmp/rules-random.txt";
const SEEDS = Number(process.env.AUDIT_SEEDS ?? 8);
let s = 1;
const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)]!;
const some = <T,>(a: readonly T[], k: number) => [...a].sort(() => rnd() - 0.5).slice(0, k);

const HISTORY = [
  "wat hapnd", "hw long", "since wen", "fevr?", "any vomitng loose motion", "koi dawai li?", "kab se hai", "kahan dard hai", "h/o dm htn tb", "smoking alcohol?",
  "any allergy", "lmp?", "periods regular?", "any sexual contacts", "family h/o", "what do u eat", "sleep ok?", "any weight loss", "pain radiating?", "travel history",
  "hav u taken anything", "tell me everything", "ok", "hmm", "what medicines r u on", "did u fall", "any fits", "breathing problem?", "urine ok?", "is he vaccinated",
  "how much does baby feed", "any blood in stool", "any headache or blurring", "suicidal thoughts?", "occupation", "chest pain on walking?", "cough with sputum?",
];
const EXAM = [
  "examine", "check vitals", "pulse bp", "spo2", "rbs", "gcs", "temp", "chest auscultation", "p/a", "per abdomen", "cvs", "cns", "local exam", "look at the throat",
  "fundus", "ear exam", "check pupils", "pr exam", "pv exam", "check the skin", "knee exam", "weigh the baby", "general exam", "jvp", "check feet", "otoscopy", "visual acuity",
];
const TESTS = [
  "cbc", "cbc lft rft", "all tests", "order everything", "xray chest", "ct head", "mri brain", "usg abdomen", "ecg", "trop i", "abg", "urine r/m", "blood culture",
  "hba1c", "tsh", "dengue ns1", "malaria card", "widal", "s. electrolytes", "pet ct", "echo", "lp csf", "ct abdomen with contrast", "upt", "lipid profile", "esr crp",
  "xray knee", "stool r/m", "sputum afb", "cbnaat", "hiv hbsag hcv", "serum amylase lipase", "d dimer", "procalcitonin", "usg kub", "mri spine",
];
const DRUGS = [
  "pcm 1 g stat", "pcm 10 g iv", "inj ceftriaxon 2 g iv", "inj ceftriaxone 20 g iv", "amoxyclav 625 tds", "azithro 5 g", "inj diclofenec 75 im", "ibuprofen 400 tds",
  "metronidazol 500 iv", "ns 2 litre stat", "ns 5 litre over 10 min", "rl 500 ml over 1 hr", "inj pantop 40 iv", "ondansetron 4 mg iv", "ondansetron 80 mg iv",
  "inj morphine 50 mg iv", "tramadol 100 iv", "inj kcl 40 meq iv push", "insulin 50 units iv", "inj adrenaline 1 mg iv", "adrenaline 0.5 mg im", "hydrocortisone 100 mg iv",
  "salbutamol neb", "duolin neb", "budecort neb", "o2 by mask", "intubate", "aspirin 325", "clopidogrel 600", "atorva 80", "heparin 5000 iv", "enoxaparin 60 sc",
  "furosemide 40 iv", "lasix 400 iv", "digoxin 2 mg", "amiodarone 300 iv push", "phenytoin 1 g iv push", "levetiracetam 1 g iv", "lorazepam 4 mg iv", "midazolam 10 iv",
  "dexa 8 mg iv", "prednisolone 60", "cetirizine 10", "avil iv", "metformin 500 bd", "glimepiride 4 mg", "amlodipine 5", "telma 40", "labetalol 20 iv", "nifedipine sl",
  "mgso4 4 g iv", "oxytocin 10 units im", "misoprostol 800 sl", "methergin 0.2 im", "tranexamic acid 1 g iv", "vit k 10 mg iv", "ors", "zinc 20 mg", "iv antibiotics",
  "start antibiotics", "give something for pain", "blood transfusion 2 units", "ffp 4 units", "platelets 6 units", "dextrose 25% 100 ml", "d10 500 ml", "thiamine 100 iv",
  "naloxone 0.4 iv", "atropine 1 mg iv", "pralidoxime 2 g iv", "asv 10 vials", "artesunate 2.4 mg/kg iv", "oseltamivir 75 bd", "acyclovir 800 5 times", "fluconazole 150",
  "terbinafine cream", "clobetasol cream bd", "permethrin lotion", "ciprofloxacin eye drops", "timolol drops", "atropine eye drops", "ear drops ciprofloxacin",
  "olanzapine 10", "haloperidol 5 im", "sertraline 50", "lithium 900", "allopurinol 300", "colchicine 0.5", "levothyroxine 100 mcg", "carbimazole 20",
  "pcm 15 mg/kg", "amoxicillin 50 mg/kg", "ceftriaxone 100 mg/kg", "ns 20 ml/kg", "paracetamol syrup 5 ml", "gentamicin 80 iv", "vanco 1 g iv push",
  "penicillin", "cefixime 200 bd", "doxycycline 100 bd", "albendazole 400", "iron sucrose 200", "calcium gluconate 10 ml iv", "sodium bicarb 100 meq",
];
const WEIRD = [
  "yes", "no", "yes give it", "no dont", "ok go ahead", "wait 2 hrs", "wait 30 min", "wait 1 day", "how is the patient", "how r u feeling", "what are the reports",
  "stop all medicines", "stop the drip", "repeat vitals", "call senior", "call surgeon", "refer to higher centre", "admit in icu", "admit", "shift to ot", "npo",
  "ryles tube", "foley", "catheterise", "cpr", "shock 200 j", "explain to relatives", "reassure", "counsel", "discharge", "discharge home with pcm", "follow up 1 week",
  "asdfgh", "?", "...", "bhai kya hua", "theek ho jaoge", "doctor sahab aa rahe hain", "lol", "what is the diagnosis", "tell me the answer", "is this dengue",
  "give everything", "i dont know", "same as before", "repeat last order", "cancel that", "double the dose", "half the dose", "change to iv", "make it oral",
];
const ENDINGS = ["dx viral fever. close", "diagnosis: gastritis. close case", "close", "diagnosis migraine", "dx sepsis close case", "dx ? close", "end case", "dx anxiety. done"];


const DANGER = /^(pcm 10 g|inj ceftriaxone 20 g|azithro 5 g|ondansetron 80|inj morphine 50|inj kcl 40 meq iv push|insulin 50 units iv|inj adrenaline 1 mg iv|lasix 400|digoxin 2 mg|amiodarone 300 iv push|phenytoin 1 g iv push|ns 5 litre over 10 min|vanco 1 g iv push)/;
const FLAGS: [RegExp, string][] = [
  [/could you say that again|didn.t quite follow|what would you like me to do|I want to get it right/i, "NOT UNDERSTOOD"],
  [/undefined|NaN|\[object|\bnull\b/, "BROKEN TEXT"],
  [/No abnormality detected on that examination/, "FAKE NORMAL"],
];

it("random erratic doctors play every written case", { timeout: 1_200_000 }, async () => {
  const out: string[] = [];
  const flagged: string[] = [];
  for (const def of ALL_CASES) {
    for (let seed = 1; seed <= SEEDS; seed++) {
      s = seed * 7919 + def.id.length * 104729 + Number(process.env.AUDIT_SALT ?? 0);
      const script = [...[
        ...some(HISTORY, 2 + Math.floor(rnd() * 6)), ...some(EXAM, 1 + Math.floor(rnd() * 5)), ...some(TESTS, 1 + Math.floor(rnd() * 5)),
        ...some(DRUGS, 4 + Math.floor(rnd() * 8)), ...some(WEIRD, 3 + Math.floor(rnd() * 6)),
      ].sort(() => rnd() - 0.5), pick(ENDINGS)];
      let res;
      try {
        res = await converse(def, script);
      } catch (err) {
        flagged.push(`CRASH | ${def.id} seed ${seed} | ${err instanceof Error ? err.stack?.split("\n").slice(0, 3).join(" ") : String(err)}\n   script: ${script.join(" / ")}`);
        continue;
      }
      const { hidden, state, turns } = res;
      out.push(`\n================ ${def.id} (seed ${seed}) — ${def.truth.diagnosis} (${def.track}, ${def.level}, ${def.patient.age} ${def.patient.sex})`);
      for (const t of turns) {
        const msgs = t.effects.filter((e) => e.type === "message").map((e) => `${(e as { role: string }).role}: ${(e as { text: string }).text}`);
        const drugs = t.effects.filter((e) => e.type === "drug").map((e) => { const d = (e as { drug: { generic: string; dose?: string; route?: string; mode?: string; doseError?: boolean } }).drug; return `DRUG ${d.generic} ${d.dose ?? ""} ${d.route ?? ""} ${d.mode ?? ""}${d.doseError ? " [dose error]" : ""}`; });
        const intents = t.record.intents.map((i) => `${i.kind}:${i.targetId ?? ""}${i.payload?.amount !== undefined ? `(${i.payload.amount}${i.payload.unit ?? ""})` : ""}`).join(" | ");
        out.push(`DR> ${t.input}   [${intents}]`);
        for (const l of [...drugs, ...msgs]) out.push(`   ${l}`);
        const text = [...drugs, ...msgs].join(" ");
        for (const [re, label] of FLAGS) if (re.test(text)) flagged.push(`${label} | ${def.id} | DR> ${t.input} → ${text.slice(0, 220)}`);
        if (DANGER.test(t.input) && drugs.length && !/dose error/.test(text)) flagged.push(`DANGER GIVEN QUIETLY | ${def.id} | DR> ${t.input} → ${text.slice(0, 220)}`);
      }
      if (hidden.closed) {
        const d = generateDebrief(def, hidden, state);
        out.push(`--- DEBRIEF ${d.score.total}/100 verdict ${d.verdict} status ${d.finalStatus}; penalties: ${d.score.penalties.map((p) => `${p.label} ${p.points}`).join("; ")}`);
        if (d.score.total > 45) flagged.push(`SCORE HIGH FOR AN ERRATIC DOCTOR | ${def.id} seed ${seed} | ${d.score.total}/100`);
      } else flagged.push(`NOT CLOSED | ${def.id} seed ${seed} | last: ${script.slice(-2).join(" / ")}`);
    }
  }
  const counts = new Map<string, number>();
  for (const f of flagged) counts.set(f.split(" | ")[0]!, (counts.get(f.split(" | ")[0]!) ?? 0) + 1);
  writeFileSync(OUT, `FLAGGED (${flagged.length}): ${[...counts].map(([k, v]) => `${k} ${v}`).join(", ")}\n${flagged.join("\n")}\n\n${out.join("\n")}`);
});
