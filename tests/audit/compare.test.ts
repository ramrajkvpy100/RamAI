/**
 * Comparison (temporary, uses AI credits): the same labelled doctor messages on written cases, read by the real
 * provider — run in the old tree and the new, so understanding, use of results, leakage, latency and tokens compare
 * like for like. AUDIT_OUT (JSON), AUDIT_REPEAT (times each probe is run).
 */
import { readFileSync, writeFileSync } from "node:fs";

import { it } from "vitest";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^"|"$/g, "");
}
process.env.RAMAI_DB_PATH = ":memory:";
process.env.RAMAI_ENGINE = "openai";
const OUT = process.env.AUDIT_OUT ?? "/tmp/compare.json";
const REPEAT = Number(process.env.AUDIT_REPEAT ?? 1);

type Check =
  | { noDrug: true } | { drug: string } | { noDrugGiven: string } | { history: string } | { exam: true } | { notExam: true }
  | { noNewTest: true } | { newTest: true } | { asksDose: true } | { says: string } | { noOrder: true };
interface Probe { area: string; caseId: string; before: string[]; line: string; checks: Check[] }

const SLE = "med-sle-apex-01", ADHF = "em-adhf-01", DENGUE = "id-dengue-01", UTI = "gp-uti-phc-01", DIARR = "ped-diarrhoea-phc-01", TINEA = "derm-tinea-01";
const PROBES: Probe[] = [
  // Medication orders vs questions
  { area: "med", caseId: DENGUE, before: [], line: "is he on any painkillers?", checks: [{ noDrug: true }] },
  { area: "med", caseId: DENGUE, before: [], line: "can we give ibuprofen for the fever?", checks: [{ noDrug: true }] },
  { area: "med", caseId: DENGUE, before: [], line: "should i start antibiotics?", checks: [{ noDrug: true }] },
  { area: "med", caseId: DENGUE, before: [], line: "ondansetron given?", checks: [{ noDrug: true }] },
  { area: "med", caseId: DENGUE, before: [], line: "did u take any dolo at home", checks: [{ noDrug: true }, { history: "meds" }] },
  { area: "med", caseId: ADHF, before: [], line: "is she taking her water pills regularly?", checks: [{ noDrug: true }] },
  { area: "med", caseId: ADHF, before: [], line: "nitro ok with this bp?", checks: [{ noDrug: true }] },
  { area: "med", caseId: ADHF, before: [], line: "give furosemide 40 mg iv now", checks: [{ drug: "furosemide" }] },
  { area: "med", caseId: UTI, before: [], line: "any allergy to medicines like sulfa?", checks: [{ noDrug: true }] },
  { area: "med", caseId: UTI, before: [], line: "nitrofurantoin 100 mg bd for 5 days", checks: [{ drug: "nitrofurantoin" }] },
  { area: "med", caseId: DIARR, before: [], line: "has he been given ors at home?", checks: [{ noDrug: true }] },
  { area: "med", caseId: TINEA, before: [], line: "which creams have you been putting on?", checks: [{ noDrug: true }, { history: "creams" }] },
  // Examination vs history
  { area: "exam", caseId: ADHF, before: [], line: "do your legs swell up?", checks: [{ notExam: true }, { history: "swelling" }] },
  { area: "exam", caseId: ADHF, before: [], line: "let me listen to your chest", checks: [{ exam: true }] },
  { area: "exam", caseId: ADHF, before: [], line: "press on the shins and see if it pits", checks: [{ exam: true }] },
  { area: "exam", caseId: UTI, before: [], line: "does it hurt in your back?", checks: [{ notExam: true }] },
  { area: "exam", caseId: UTI, before: [], line: "check for renal angle tenderness", checks: [{ exam: true }] },
  { area: "exam", caseId: DIARR, before: [], line: "is he drinking eagerly?", checks: [{ notExam: true }] },
  { area: "exam", caseId: DIARR, before: [], line: "pinch the skin of the belly", checks: [{ exam: true }] },
  { area: "exam", caseId: TINEA, before: [], line: "is it itchy?", checks: [{ notExam: true }, { history: "itch" }] },
  { area: "exam", caseId: TINEA, before: [], line: "show me the rash", checks: [{ exam: true }] },
  // Investigation orders vs existing results
  { area: "inv", caseId: DENGUE, before: ["cbc", "wait 60 min"], line: "what was the platelet count?", checks: [{ noNewTest: true }, { says: "\\d" }] },
  { area: "inv", caseId: DENGUE, before: ["cbc", "wait 60 min"], line: "cbc came?", checks: [{ noNewTest: true }] },
  { area: "inv", caseId: DENGUE, before: ["cbc", "wait 60 min"], line: "repeat the cbc", checks: [{ newTest: true }] },
  { area: "inv", caseId: ADHF, before: ["ecg", "wait 15 min"], line: "what did the ecg show", checks: [{ noNewTest: true }] },
  { area: "inv", caseId: ADHF, before: [], line: "has she had an echo before?", checks: [{ noNewTest: true }] },
  { area: "inv", caseId: UTI, before: ["urine dipstick", "wait 10 min"], line: "nitrites positive?", checks: [{ noNewTest: true }] },
  { area: "inv", caseId: UTI, before: [], line: "have you had a urine test done before?", checks: [{ noNewTest: true }] },
  // Ambiguous doses and frequencies
  { area: "dose", caseId: ADHF, before: [], line: "lasix 40 iv or 80?", checks: [{ noDrug: true }] },
  { area: "dose", caseId: ADHF, before: [], line: "furosemide iv", checks: [{ noDrug: true }, { asksDose: true }] },
  { area: "dose", caseId: DENGUE, before: [], line: "paracetamol as needed", checks: [{ noDrug: true }] },
  { area: "dose", caseId: UTI, before: [], line: "nitrofurantoin twice a day", checks: [{ noDrugGiven: "nitrofurantoin" }] },
  { area: "dose", caseId: DIARR, before: [], line: "zinc for the child", checks: [{ noDrugGiven: "zinc" }] },
  // Follow-up questions using previous findings
  { area: "followup", caseId: DENGUE, before: ["cbc", "wait 60 min"], line: "so the counts are low, any bleeding from gums or in the stool?", checks: [{ noOrder: true }] },
  { area: "followup", caseId: ADHF, before: ["listen to the chest"], line: "with those crackles, did the breathlessness wake you at night?", checks: [{ noOrder: true }, { history: "orthopnoea" }] },
  { area: "followup", caseId: DIARR, before: ["how many times has he passed stool?"], line: "and how many wet nappies since then?", checks: [{ noOrder: true }] },
  { area: "followup", caseId: UTI, before: ["since when?"], line: "and before these 2 days was it ever like this?", checks: [{ noOrder: true }] },
  // Natural dialogue without diagnostic leakage
  { area: "talk", caseId: ADHF, before: [], line: "what do you think is wrong with you?", checks: [{ noOrder: true }] },
  { area: "talk", caseId: DENGUE, before: [], line: "are you scared?", checks: [{ noOrder: true }] },
  { area: "talk", caseId: UTI, before: [], line: "tell me in your own words what's been happening", checks: [{ noOrder: true }] },
  { area: "talk", caseId: DIARR, before: [], line: "mummy, what worries you most?", checks: [{ noOrder: true }] },
  { area: "talk", caseId: TINEA, before: [], line: "how is this affecting your work?", checks: [{ noOrder: true }] },
];

// Loosely worded lines the rules can't place — these are read by the model.
const HARD: Probe[] = [
  { area: "hard-history", caseId: ADHF, before: [], line: "the swelling in ur legs, been there long or new?", checks: [{ notExam: true }, { history: "swelling" }] },
  { area: "hard-history", caseId: ADHF, before: [], line: "hows the breathing at night, need more pillows than before?", checks: [{ noOrder: true }, { history: "orthopnoea" }] },
  { area: "hard-history", caseId: UTI, before: [], line: "any blood when u pee or is it just kinda cloudy", checks: [{ noOrder: true }, { history: "urine-look" }] },
  { area: "hard-history", caseId: DIARR, before: [], line: "mm ok and the water at home, hand pump or do u boil it", checks: [{ noOrder: true }, { history: "water" }] },
  { area: "hard-history", caseId: DIARR, before: [], line: "is the little one still peeing like normal", checks: [{ noOrder: true }, { history: "urine" }] },
  { area: "hard-history", caseId: TINEA, before: [], line: "need to know whether u ever had sugar problems", checks: [{ noOrder: true }, { history: "diabetes" }] },
  { area: "hard-med", caseId: DENGUE, before: [], line: "u been popping any of those fever tablets from the chemist", checks: [{ noDrug: true }, { history: "meds" }] },
  { area: "hard-med", caseId: ADHF, before: [], line: "was thinking of some lasix but first, any trouble passing urine lately", checks: [{ noDrug: true }] },
  { area: "hard-med", caseId: UTI, before: [], line: "keep antibiotics in mind but not yet, first tell me about the burning", checks: [{ noDrug: true }] },
  { area: "hard-med", caseId: DIARR, before: [], line: "should we maybe think about a drip for him or is he drinking ok", checks: [{ noDrug: true }] },
  { area: "hard-med", caseId: TINEA, before: [], line: "did that cream from the chemist make it better or worse", checks: [{ noDrug: true }, { history: "creams" }] },
  { area: "hard-exam", caseId: UTI, before: [], line: "before i do anything else let me feel ur tummy", checks: [{ exam: true }] },
  { area: "hard-exam", caseId: TINEA, before: [], line: "gonna have a proper look at those patches on ur thigh now", checks: [{ exam: true }] },
  { area: "hard-results", caseId: DENGUE, before: ["cbc", "wait 60 min"], line: "the blood report from earlier, did it say anything about the cells that clot", checks: [{ noNewTest: true }] },
  { area: "hard-results", caseId: ADHF, before: ["ecg", "wait 15 min"], line: "ecg showed what again, remind me", checks: [{ noNewTest: true }] },
  { area: "hard-followup", caseId: DENGUE, before: ["cbc", "wait 60 min"], line: "with that platelet count im worried, any spots on the skin or black stools?", checks: [{ noOrder: true }] },
  { area: "hard-followup", caseId: UTI, before: ["urine dipstick", "wait 10 min"], line: "ok so the strip was positive, any fever with chills or pain in the back?", checks: [{ noOrder: true }] },
  { area: "hard-talk", caseId: ADHF, before: [], line: "honestly whats bothering u the most right now", checks: [{ noOrder: true }] },
  { area: "hard-talk", caseId: DENGUE, before: [], line: "do u know what u have? what did people at home say it is", checks: [{ noOrder: true }] },
  { area: "hard-talk", caseId: DIARR, before: [], line: "dont worry ma we will take care of him, any questions for me?", checks: [{ noOrder: true }] },
  // From doctors' reports (25 Oct 2026)
  { area: "report", caseId: SLE, before: [], line: "show me your previous reports n treatments", checks: [{ noNewTest: true }, { noDrug: true }] },
  { area: "report", caseId: SLE, before: [], line: "test for ana anca", checks: [{ newTest: true }] },
  { area: "report", caseId: SLE, before: [], line: "show pic of both hands", checks: [{ exam: true }] },
  { area: "report", caseId: SLE, before: [], line: "senior mam, what is the diagnosis", checks: [{ noOrder: true }] },
];

const TERMS: Record<string, string[]> = {};
const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

it("comparison", { timeout: 3_600_000 }, async () => {
  const { getCase } = await import("@/engine/cases");
  const { createOpenAIProvider } = await import("@/engine/providers/openai");
  const { runTurn } = await import("@/engine/simulator");
  const { applyEffects } = await import("@/engine/reducer");
  const { setUsageSink } = await import("@/engine/providers/usage");
  const { converse } = await import("../helpers");
  let tok = { input: 0, cached: 0, output: 0, calls: 0 };
  setUsageSink((u) => { tok.input += u.inputTokens; tok.cached += u.cachedTokens; tok.output += u.outputTokens; tok.calls++; });
  const provider = createOpenAIProvider();
  const rows: unknown[] = [];
  const jobs = (process.env.AUDIT_SET === "hard" ? HARD : process.env.AUDIT_SET === "all" ? [...PROBES, ...HARD] : PROBES).flatMap((p) => Array.from({ length: REPEAT }, () => p));
  const run = async (p: Probe) => {
    const def = getCase(p.caseId)!;
    TERMS[p.caseId] ??= [def.truth.diagnosis, ...def.rubric.diagnosisAccept].map(norm).filter((t) => t.length >= 4);
    const played = await converse(def, p.before);
    const invBefore = played.hidden.investigations.length;
    const ctx = { def, hidden: played.hidden, transcript: played.state.messages, country: "IN" as const, lang: "en" as const };
    const mine = { input: 0, output: 0 };
    const t0 = Date.now();
    const before = { ...tok };
    const read = await provider.interpret(p.line, ctx);
    const ms = Date.now() - t0;
    mine.input = tok.input - before.input; mine.output = tok.output - before.output;
    const record = { id: "x", at: played.hidden.clock, raw: p.line, intents: read.intents, generated: read.generated };
    const effects = runTurn(def, played.hidden, record);
    const state = applyEffects(played.state, effects);
    const replies = state.messages.slice(played.state.messages.length).filter((m) => m.role !== "doctor").map((m) => `${m.role}: ${m.text}`);
    const said = replies.join(" ");
    const h = played.hidden;
    const drugs = h.drugs.map((d) => d.generic.toLowerCase());
    const intents = read.intents.map((i) => `${i.kind}:${i.targetId ?? ""}`);
    const fails: string[] = [];
    for (const c of p.checks) {
      if ("noDrug" in c && drugs.length) fails.push(`gave ${drugs.join(",")}`);
      if ("drug" in c && !read.intents.some((i) => i.kind === "drug" && (i.targetId ?? "").includes(c.drug))) fails.push(`no ${c.drug} order`);
      if ("noDrugGiven" in c && h.drugs.some((d) => d.generic.toLowerCase().includes(c.noDrugGiven) && !d.dose)) fails.push(`${c.noDrugGiven} without a dose`);
      if ("history" in c && !(c.history in h.history)) fails.push(`history ${c.history} not reached`);
      if ("exam" in c && !read.intents.some((i) => i.kind === "exam")) fails.push("not examined");
      if ("notExam" in c && read.intents.some((i) => i.kind === "exam")) fails.push("examined instead of asking");
      if ("noNewTest" in c && h.investigations.length > invBefore) fails.push("ordered a new test");
      if ("newTest" in c && h.investigations.length <= invBefore) fails.push("no new test");
      if ("asksDose" in c && !/dose|how much|\bmg\b/i.test(said)) fails.push("didn't ask the dose");
      if ("says" in c && !new RegExp(c.says).test(said)) fails.push(`reply lacks /${c.says}/`);
      if ("noOrder" in c && (drugs.length || h.investigations.length > invBefore)) fails.push("an order was made");
    }
    const spoken = state.messages.slice(played.state.messages.length).filter((m) => m.role === "patient" || m.role === "attendant").map((m) => norm(m.text)).join(" ");
    const leak = TERMS[p.caseId]!.find((t) => new RegExp(`\\b${t}\\b`).test(spoken));
    if (leak) fails.push(`leaked "${leak}"`);
    if (!said.trim()) fails.push("no reply");
    rows.push({ area: p.area, caseId: p.caseId, line: p.line, intents, ms, tokens: mine, fails, replies });
    console.log(`${fails.length ? "✗" : "✓"} [${p.area}] ${p.line} → ${intents.join(" ")} (${ms} ms) ${fails.join("; ")}\n    ${replies.join(" / ").slice(0, 300)}`);
  };
  // Four at a time, as several players would.
  for (let i = 0; i < jobs.length; i += 4) await Promise.all(jobs.slice(i, i + 4).map(run));
  writeFileSync(OUT, JSON.stringify({ rows, tok }, null, 1));
});
