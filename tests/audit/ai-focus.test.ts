/**
 * Audit (temporary, uses AI credits): AI cases in chosen specialties, played by a very bad doctor.
 * Every turn is checked automatically; a JSON summary per case is kept for error rates.
 * AUDIT_SPECIALTIES (comma list), AUDIT_N (cases each), AUDIT_SEED, AUDIT_OUT.
 */
import { readFileSync, writeFileSync } from "node:fs";

import { it } from "vitest";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^"|"$/g, "");
}
process.env.RAMAI_DB_PATH = ":memory:";
process.env.RAMAI_ENGINE = "openai";

const SEED = Number(process.env.AUDIT_SEED ?? 1);
const N = Number(process.env.AUDIT_N ?? 2);
const OUT = process.env.AUDIT_OUT ?? `/tmp/ai-focus-${SEED}.txt`;
const SPECIALTIES = (process.env.AUDIT_SPECIALTIES ?? "General Practice").split(",");
const LOGS: string[] = [];
for (const k of ["error", "warn"] as const) {
  const orig = console[k].bind(console);
  console[k] = (...a: unknown[]) => { LOGS.push(`[${k}] ${a.map((x) => (x instanceof Error ? x.message : String(x))).join(" ")}`.slice(0, 600)); orig(...a); };
}

let s = SEED || 1;
const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)]!;
const some = <T,>(a: readonly T[], k: number) => [...a].sort(() => rnd() - 0.5).slice(0, k);

const LEVELS = ["phc", "chc", "district", "college", "apex", "grandrounds"] as const;
const TRACKS = ["opd", "opd", "emergency"] as const;

// A very bad doctor: vague, misspelt, Hinglish, wrong drugs, wrong doses, wrong routes, shotgun tests, premature closure.
const HISTORY = ["wat hapnd", "since wen", "hw long", "fevr?", "koi dawai li?", "kab se hai", "kahan dard hai", "any allergy", "h/o dm htn tb", "lmp?", "smoking alcohol?", "family h/o", "any vomitng loose motion", "itching?", "any rash elsewhere", "child feeding ok?", "vaccinated?", "urine ok?", "breathing problem?", "chest pain?", "headache?", "tell me everything", "bukhar kab se hai", "what medicines r u on", "sleep ok?", "is this dengue"];
const EXAM = ["examine", "check vitals", "pulse bp", "spo2", "rbs", "gcs", "temp", "chest auscultation", "p/a", "cvs", "cns", "local exam", "check the skin", "look at the rash", "throat exam", "ear exam", "weigh the child", "check hydration", "knee exam", "fundus", "pv exam", "pr exam", "dermoscopy", "woods lamp"];
const TESTS = ["cbc", "cbc lft rft", "all tests", "order everything", "xray chest", "ct head", "mri brain", "usg abdomen", "ecg", "trop i", "urine r/m", "blood culture", "hba1c", "tsh", "dengue ns1", "malaria card", "widal", "s. electrolytes", "pet ct", "koh mount", "skin biopsy", "ana", "esr crp", "stool r/m", "lp csf", "abg", "upt"];
const DRUGS = [
  "pcm 10 g iv", "pcm 1 g stat", "paracetmol 650 tds x 3 days", "pcm 15 mg/kg", "inj ceftriaxon 2 g iv", "inj ceftriaxone 20 g iv", "amoxyclav 625 tds", "azithro 5 g", "amoxicillin 5 g tds",
  "inj diclofenec 75 im", "ibuprofen 400 tds", "ondansetron 80 mg iv", "inj morphine 50 mg iv", "insulin 50 units iv", "inj kcl 40 meq iv push", "inj adrenaline 1 mg iv", "adrenaline 0.5 mg im",
  "ns 5 litre over 10 min", "ns 20 ml/kg", "rl 1 litre stat", "hydrocortisone 100 mg iv", "dexa 8 mg iv", "prednisolone 60 mg od x 30 days", "salbutamol neb", "duolin neb", "o2 by mask",
  "cetirizine 10 mg od x 5 days", "avil iv", "betnovate cream bd", "clobetasol cream bd on face", "terbinafine cream", "fluconazole 150 weekly", "griseofulvin 500 od", "permethrin lotion", "isotretinoin 40 mg od", "doxycycline 100 bd",
  "metformin 500 bd", "glimepiride 4 mg", "amlodipine 5 od", "telma 40", "aspirin 325", "atorva 80", "heparin 5000 iv", "lasix 400 iv", "furosemide 40 iv",
  "digoxin 2 mg", "amiodarone 300 iv push", "phenytoin 1 g iv push", "midazolam 10 iv", "lorazepam 4 mg iv", "ors", "zinc 20 mg", "albendazole 400",
  "artesunate 2.4 mg/kg iv", "asv 10 vials", "atropine 1 mg iv", "pralidoxime 2 g iv", "vit k 10 mg iv", "tramadol 100 iv", "ciprofloxacin 500 bd", "metronidazol 400 tds",
  "iv antibiotics", "start antibiotics", "give steroids", "give something for pain", "inj amoxicillin tablet", "tab ceftriaxone", "misoprostol 800 sl", "methergin 0.2 im",
];
const WEIRD = ["yes", "no", "ok", "yes give it", "no dont", "wait 2 hrs", "wait 30 min", "wait 1 day", "how is the patient", "how r u feeling", "what are the reports", "stop all medicines", "repeat vitals", "call senior", "refer to higher centre", "admit", "admit in icu", "discharge", "discharge home with pcm", "follow up 1 week", "intubate", "shock 200 j", "cpr", "double the dose", "cancel that", "same as before", "change to iv", "reassure", "explain to relatives", "theek ho jaoge", "asdfgh", "lol", "?"];
const ENDINGS = ["dx viral fever. close", "diagnosis: gastritis. close case", "dx sepsis close case", "dx anxiety. done", "dx allergy. close", "dx ? close"];

const GIBBERISH = /^(asdfgh|lol|\?|\.\.\.|hmm|ok)$/i;
const DANGER = /^(pcm 10 g|inj ceftriaxone 20 g|azithro 5 g|amoxicillin 5 g|ondansetron 80|inj morphine 50|inj kcl 40 meq iv push|insulin 50 units iv|inj adrenaline 1 mg iv|lasix 400|digoxin 2 mg|amiodarone 300 iv push|phenytoin 1 g iv push|ns 5 litre over 10 min|midazolam 10 iv|lorazepam 4 mg iv)/;
const NOT_UNDERSTOOD = /could you say that (?:again|once more)|didn.t quite follow|what would you like me to do\?/i;
const BROKEN = /undefined|NaN|\[object|\bnull\b/;
const LAB_REFUSAL = /not (?:been )?performed|not available in|not obtained|no findings are available|imaging has not been|isn.t available in the medication list/i;

function script(): string[] {
  return [...[...some(HISTORY, 3 + Math.floor(rnd() * 4)), ...some(EXAM, 2 + Math.floor(rnd() * 3)), ...some(TESTS, 2 + Math.floor(rnd() * 3)), ...some(DRUGS, 6 + Math.floor(rnd() * 5)), ...some(WEIRD, 3 + Math.floor(rnd() * 4))].sort(() => rnd() - 0.5), pick(ENDINGS)];
}

it("very bad doctor on focus specialties", { timeout: 3_600_000 }, async () => {
  const { simulateCase, submitDoctorAction, sessionInfo } = await import("@/engine/engine");
  // Token use per case (and per kind of call), for the cost of a case.
  const TOKENS = { input: 0, cached: 0, output: 0, byKind: {} as Record<string, number> };
  const { setUsageSink } = await import("@/engine/providers/usage");
  setUsageSink((u) => { TOKENS.input += u.inputTokens; TOKENS.cached += u.cachedTokens; TOKENS.output += u.outputTokens; TOKENS.byKind[u.kind] = (TOKENS.byKind[u.kind] ?? 0) + u.inputTokens + u.outputTokens; });
  const out: string[] = [`SEED ${SEED}`];
  const summary: unknown[] = [];
  const save = () => { writeFileSync(OUT, out.join("\n")); writeFileSync(`${OUT}.json`, JSON.stringify(summary, null, 1)); writeFileSync(`${OUT}.log`, LOGS.join("\n")); };
  for (const specialty of SPECIALTIES) {
    for (let n = 0; n < N; n++) {
      const c = { specialty, level: pick(LEVELS), track: pick(TRACKS) };
      const lines = script();
      const flags: { kind: string; input: string; text: string }[] = [];
      const t0 = Date.now();
      TOKENS.input = 0; TOKENS.cached = 0; TOKENS.output = 0; TOKENS.byKind = {};
      let start;
      try {
        start = await simulateCase({ userId: "audit", caseNumber: 100 + n, specialty: c.specialty as never, level: c.level, track: c.track, country: "IN" });
      } catch (err) {
        out.push(`\n================ ${specialty} ${c.level} ${c.track} — !! START ERROR ${err instanceof Error ? err.message : String(err)}`);
        summary.push({ ...c, started: false, turns: 0, flags: [{ kind: "START_FAIL", input: "", text: "" }] });
        save();
        continue;
      }
      const generated = sessionInfo(start.token).generated;
      out.push(`\n================ ${specialty} ${c.level} ${c.track} — patient ${start.state.patient.age} ${start.state.patient.sex} (AI: ${generated}, ${Math.round((Date.now() - t0) / 1000)} s)`);
      out.push(`BRIEFING: ${start.state.briefing}`);
      for (const m of start.state.messages) out.push(`   ${m.role}/${m.kind}: ${m.text}`);
      let token = start.token;
      let seen = start.state.messages.length;
      let turns = 0;
      let diagnosis = "";
      for (const input of lines) {
        try {
          const res = await submitDoctorAction(token, input, "audit");
          token = res.token;
          turns += 1;
          const msgs = res.state.messages.slice(seen).filter((m) => m.role !== "doctor");
          seen = res.state.messages.length;
          out.push(`\nDR> ${input}`);
          for (const m of msgs) out.push(`   ${m.role}/${m.kind}: ${m.text}`);
          const text = msgs.map((m) => m.text).join(" ");
          if (NOT_UNDERSTOOD.test(text) && !GIBBERISH.test(input.trim())) flags.push({ kind: "NOT_UNDERSTOOD", input, text: text.slice(0, 200) });
          if (BROKEN.test(text)) flags.push({ kind: "BROKEN_TEXT", input, text: text.slice(0, 200) });
          if (LAB_REFUSAL.test(text)) flags.push({ kind: "LAB_OR_LIST_REFUSAL", input, text: text.slice(0, 200) });
          if (DANGER.test(input) && /— given\.|— running\./.test(text) && !/Do you still want/.test(text)) flags.push({ kind: "DANGER_GIVEN_QUIETLY", input, text: text.slice(0, 200) });
          if (res.debrief) {
            const d = res.debrief;
            diagnosis = d.diagnosis;
            out.push(`\n--- DEBRIEF true dx: ${d.diagnosis}${d.qualifier ? ` (${d.qualifier})` : ""} | verdict ${d.verdict} | score ${d.score.total} | status ${d.finalStatus}`);
            for (const m of d.missed.slice(0, 6)) out.push(`   MISSED[${m.severity}] ${m.what}`);
            out.push(`   sources: ${(d.sources ?? []).join(" | ")}`);
            out.push(`   drugs taught: ${d.drugs.map((x) => `${x.generic} ${x.dose} ${x.route}`).join(" ; ")}`);
            if (!d.drugs.length) flags.push({ kind: "NO_DRUGS_TAUGHT", input, text: "" });
            if (d.score.total > 45) flags.push({ kind: "SCORE_TOO_HIGH", input, text: String(d.score.total) });
            const inv = res.state.investigations.map((x) => `${x.name}: ${(x.rows ?? []).map((r) => `${r.analyte} ${r.value}${r.unit ? " " + r.unit : ""}${r.flag ? `(${r.flag})` : ""}`).join(", ")}${x.report ? ` | ${x.report}` : ""}`);
            out.push(`   RESULTS:\n     ${inv.join("\n     ")}`);
            for (const i of res.state.investigations) for (const r of i.rows ?? []) if (/not (?:obtained|measured|done)|pending/i.test(r.value)) flags.push({ kind: "LAB_NO_VALUE", input: i.name, text: `${r.analyte} ${r.value}` });
            break;
          }
        } catch (err) {
          flags.push({ kind: "TURN_ERROR", input, text: err instanceof Error ? err.message : String(err) });
          out.push(`\nDR> ${input}\n   !! ERROR ${err instanceof Error ? err.message : String(err)}`);
        }
        save();
      }
      summary.push({ ...c, started: true, generated, turns, diagnosis, flags, tokens: { ...TOKENS, byKind: { ...TOKENS.byKind } } });
      TOKENS.input = 0; TOKENS.cached = 0; TOKENS.output = 0; TOKENS.byKind = {};
      save();
    }
  }
  save();
});
