/**
 * Audit (temporary, uses AI credits): random AI cases — any specialty, level and mode — played by a
 * super-erratic doctor whose script is drawn at random from a large pool of mistakes.
 * AUDIT_SEED, AUDIT_N, AUDIT_OUT.
 */
import { readFileSync, writeFileSync } from "node:fs";

import { it } from "vitest";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^"|"$/g, "");
}
process.env.RAMAI_DB_PATH = ":memory:";
process.env.RAMAI_ENGINE = "openai";

const SEED = Number(process.env.AUDIT_SEED ?? Date.now() % 100000);
const N = Number(process.env.AUDIT_N ?? 3);
const OUT = process.env.AUDIT_OUT ?? `/tmp/ai-random-${SEED}.txt`;

// The engine's own logs (why a case was rejected or repaired), kept beside the transcript.
const LOGS: string[] = [];
for (const k of ["error", "warn", "info"] as const) {
  const orig = console[k].bind(console);
  console[k] = (...a: unknown[]) => { LOGS.push(`[${k}] ${a.map((x) => (x instanceof Error ? x.message : typeof x === "string" ? x : JSON.stringify(x))).join(" ")}`.slice(0, 1500)); writeFileSync(`${OUT}.log`, LOGS.join("\n")); orig(...a); };
}
let s = SEED || 1;
const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)]!;
const some = <T,>(a: readonly T[], k: number) => [...a].sort(() => rnd() - 0.5).slice(0, k);

const SPECIALTIES = ["Medicine", "Dermatology", "Surgery", "Pediatrics", "OBGYN", "Emergency", "Cardiology", "Neurology", "Respiratory", "Gastroenterology", "Nephrology", "Endocrinology", "Psychiatry", "ENT", "Ophthalmology", "Orthopedics", "Urology", "Infectious Disease"] as const;
const LEVELS = ["phc", "chc", "district", "college", "apex", "grandrounds"] as const;
const TRACKS = ["opd", "emergency", "phone"] as const;

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

function script(): string[] {
  const parts = [
    ...some(HISTORY, 2 + Math.floor(rnd() * 5)),
    ...some(EXAM, 1 + Math.floor(rnd() * 4)),
    ...some(TESTS, 1 + Math.floor(rnd() * 4)),
    ...some(DRUGS, 4 + Math.floor(rnd() * 6)),
    ...some(WEIRD, 3 + Math.floor(rnd() * 5)),
  ].sort(() => rnd() - 0.5);
  return [...parts, pick(ENDINGS)];
}

it("plays random AI cases with an erratic doctor", { timeout: 3_000_000 }, async () => {
  const { simulateCase, submitDoctorAction, sessionInfo } = await import("@/engine/engine");
  const out: string[] = [`SEED ${SEED}`];
  for (let n = 0; n < N; n++) {
    const c = { specialty: pick(SPECIALTIES), level: pick(LEVELS), track: pick(TRACKS) };
    const lines = script();
    const t0 = Date.now();
    let start;
    try {
      start = await simulateCase({ userId: "audit", caseNumber: 50 + n, specialty: c.specialty, level: c.level, track: c.track, country: "IN" });
      for (let tries = 1; tries < 3 && !sessionInfo(start.token).generated; tries++) {
        out.push(`(attempt ${tries} not AI-made — trying again)`);
        start = await simulateCase({ userId: "audit", caseNumber: 50 + n, specialty: c.specialty, level: c.level, track: c.track, country: "IN" });
      }
    } catch (err) {
      out.push(`\n================ CASE ${n + 1}: ${c.specialty} ${c.level} ${c.track} — !! START ERROR ${err instanceof Error ? err.message : String(err)}`);
      writeFileSync(OUT, out.join("\n"));
      continue;
    }
    out.push(`\n================ CASE ${n + 1}: ${c.specialty} ${c.level} ${c.track} — patient ${start.state.patient.age} ${start.state.patient.sex} (AI: ${sessionInfo(start.token).generated}, ${Math.round((Date.now() - t0) / 1000)} s)`);
    out.push(`BRIEFING: ${start.state.briefing}`);
    for (const m of start.state.messages) out.push(`   ${m.role}/${m.kind}: ${m.text}`);
    let token = start.token;
    let seen = start.state.messages.length;
    for (const input of lines) {
      const t = Date.now();
      try {
        const res = await submitDoctorAction(token, input, "audit");
        token = res.token;
        out.push(`\nDR> ${input}   (${((Date.now() - t) / 1000).toFixed(1)} s)`);
        for (const m of res.state.messages.slice(seen)) if (m.role !== "doctor") out.push(`   ${m.role}/${m.kind}: ${m.text}`);
        seen = res.state.messages.length;
        if (res.debrief) {
          const d = res.debrief;
          out.push(`\n--- DEBRIEF true dx: ${d.diagnosis}${d.qualifier ? ` (${d.qualifier})` : ""} | verdict ${d.verdict} | score ${d.score.total} | status ${d.finalStatus}`);
          for (const p of d.score.penalties) out.push(`   PENALTY ${p.label} ${p.points}: ${p.reason}`);
          for (const m of d.missed) out.push(`   MISSED[${m.severity}] ${m.what} — ${m.better}`);
          out.push(`   didWell: ${d.didWell.join(" / ")}`);
          out.push(`   sources: ${(d.sources ?? []).join(" | ")}`);
          out.push(`   drugs taught: ${d.drugs.map((x) => `${x.generic} ${x.dose} ${x.route} ${x.frequency ?? ""}`).join(" ; ")}`);
          const inv = res.state.investigations.map((x) => `${x.name}: ${(x.rows ?? []).map((r) => `${r.analyte} ${r.value}${r.unit ? " " + r.unit : ""}${r.flag ? `(${r.flag})` : ""}`).join(", ")}${x.report ? ` | ${x.report}` : ""}`);
          out.push(`   RESULTS:\n     ${inv.join("\n     ")}`);
          break;
        }
      } catch (err) {
        out.push(`\nDR> ${input}\n   !! ERROR ${err instanceof Error ? err.message : String(err)}`);
      }
      writeFileSync(OUT, out.join("\n"));
    }
  }
  writeFileSync(OUT, out.join("\n"));
});
