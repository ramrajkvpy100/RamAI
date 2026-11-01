/**
 * Audit (temporary): a careless doctor — wrong drugs and doses, wrong routes and units, misspellings, shotgun tests,
 * gibberish — plays every written case, twice in different orders. Every reply is kept, and replies that look wrong
 * (not understood, odd values, a dangerous order carried out without a word) are flagged for review.
 */
import { writeFileSync } from "node:fs";

import { it } from "vitest";

import { ALL_CASES } from "@/engine/cases";
import { generateDebrief } from "@/engine/debrief";
import { converse } from "../helpers";

const OUT = process.env.AUDIT_OUT ?? "/tmp/bad-doctor.txt";

const BAD = [
  "ok", "hmm", "asdf", "?", "wat", "yes",
  "paracetmol 650 tds", "amoxycilin 500 tds x 5 days", "ceftriaxon 1g iv", "metronidazol 400 tds", "ondansteron 4 iv", "pantaprazole 40 iv", "diclofenec 75 im",
  "amoxicillin 5 g tds", "paracetamol 6 g stat", "ondansetron 80 mg iv", "morphine 50 mg iv", "insulin 100 units iv", "kcl 40 meq iv stat", "ns 5 litre over 10 min",
  "adrenaline 1 mg iv", "digoxin 25 mg", "atropine 10 mg iv", "phenytoin 1 g iv push",
  "inj amoxicillin tablet", "iv tab paracetamol", "tab ceftriaxone",
  "order all tests", "mri brain", "pet scan", "ct whole body", "lft rft tft hba1c lipid profile", "cbc", "cbc",
  "any vomitng", "h/o fevr", "pain kaha hai", "bukhar kab se hai", "koi dawai lete ho",
  "give steroids", "start antibiotics", "give something for pain", "give the usual",
  "stop all medicines", "discharge the patient", "admit", "refer to higher centre",
  "wait 30 min", "how is the patient", "repeat vitals",
  "dx gastritis. close",
];

const shuffle = <T,>(xs: T[], seed: number) => {
  const a = [...xs];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};

const FLAGS: [RegExp, string][] = [
  [/could you say that again|didn.t quite follow|what would you like me to do|I want to get it right/i, "NOT UNDERSTOOD"],
  [/undefined|NaN|\[object|null\b/, "BROKEN TEXT"],
  [/No abnormality detected on that examination/, "FAKE NORMAL"],
];

it("a bad doctor plays every written case", { timeout: 600_000 }, async () => {
  const out: string[] = [];
  const flagged: string[] = [];
  for (const def of ALL_CASES) {
    for (const seed of [7, 31]) {
      const script = [...shuffle(BAD.slice(0, -1), seed + def.id.length), BAD[BAD.length - 1]!];
      const { hidden, state, turns } = await converse(def, script);
      out.push(`\n================ ${def.id} (seed ${seed}) — ${def.truth.diagnosis} (${def.track}, ${def.level}, ${def.patient.age} ${def.patient.sex})`);
      for (const t of turns) {
        const msgs = t.effects.filter((e) => e.type === "message").map((e) => `${(e as { role: string }).role}: ${(e as { text: string }).text}`);
        const drugs = t.effects.filter((e) => e.type === "drug").map((e) => { const d = (e as { drug: { generic: string; dose?: string; route?: string; mode?: string; doseError?: boolean } }).drug; return `DRUG ${d.generic} ${d.dose ?? ""} ${d.route ?? ""} ${d.mode ?? ""}${d.doseError ? " [dose error]" : ""}`; });
        const intents = t.record.intents.map((i) => `${i.kind}:${i.targetId ?? ""}${i.payload?.amount !== undefined ? `(${i.payload.amount}${i.payload.unit ?? ""})` : ""}`).join(" | ");
        out.push(`DR> ${t.input}   [${intents}]`);
        for (const l of [...drugs, ...msgs]) out.push(`   ${l}`);
        const text = [...drugs, ...msgs].join(" ");
        for (const [re, label] of FLAGS) if (re.test(text)) flagged.push(`${label} | ${def.id} | DR> ${t.input} → ${text.slice(0, 220)}`);
        // A grossly wrong dose given with no nurse query and no dose error recorded.
        if (/^(paracetamol 6 g|ondansetron 80|morphine 50|insulin 100|kcl 40|ns 5 litre|adrenaline 1 mg iv|digoxin 25|atropine 10|phenytoin 1 g iv push|amoxicillin 5 g)/.test(t.input) && drugs.length && !/dose error/.test(text)) flagged.push(`DANGER GIVEN QUIETLY | ${def.id} | DR> ${t.input} → ${text.slice(0, 220)}`);
      }
      if (hidden.closed) {
        const d = generateDebrief(def, hidden, state);
        out.push(`--- DEBRIEF ${d.score.total}/100 verdict ${d.verdict} status ${d.finalStatus}; penalties: ${d.score.penalties.map((p) => `${p.label} ${p.points}`).join("; ")}`);
        if (d.score.total > 40) flagged.push(`SCORE TOO HIGH FOR A BAD DOCTOR | ${def.id} seed ${seed} | ${d.score.total}/100`);
      } else flagged.push(`NOT CLOSED | ${def.id} seed ${seed}`);
    }
  }
  writeFileSync(OUT, `FLAGGED (${flagged.length}):\n${flagged.join("\n")}\n\n${out.join("\n")}`);
});
