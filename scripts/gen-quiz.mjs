/**
 * Fills each Skills Lab subcategory (antidotes, emergency algorithms) to 50 questions: the model writes them in
 * batches, a second "examiner" pass checks each against standard guidelines and drops or fixes anything wrong.
 * Output: src/lib/banks/quiz-more.json. Run: node --env-file=.env.local scripts/gen-quiz.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || "gpt-6-luna";
const OUT = "src/lib/banks/quiz-more.json";
const TARGET = 50;
const have = JSON.parse(process.argv[2] ?? "{}"); // { drill: { cat: { count, stems: [] } } }
const out = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : { antidotes: [], algorithms: [] };

async function chat(messages, max = 7000) {
  for (let t = 0; t < 3; t++) {
    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, messages, response_format: { type: "json_object" }, max_completion_tokens: max, reasoning_effort: "low" }) });
      const j = await r.json();
      if (!r.ok) throw new Error(JSON.stringify(j.error));
      return JSON.parse(j.choices[0].message.content);
    } catch (e) { console.error("retry", String(e).slice(0, 200)); await new Promise((r) => setTimeout(r, 3000)); }
  }
  return null;
}

const SHAPE = `Each question: {"id": "short-kebab-id", "stem": "a short clinical vignette (1–3 sentences), ending without the question", "right": "the correct answer (short)", "explain": "why it's right — 1–3 short lines, key words in **bold**", "wrong": [["wrong option", "why not, one line"], [..], [..]], "source": "the specific guideline or reference (e.g. BNF; TOXBASE; AHA ACLS 2020; ERC 2021; NICE NG..; WHO; ATLS 10th; RCOG GTG..)"}. Exactly 3 wrong options, each plausible. Indian and international practice where they differ: follow the named guideline.`;

for (const drill of ["antidotes", "algorithms"]) {
  for (const [cat, info] of Object.entries(have[drill] ?? {})) {
    const done = () => info.count + out[drill].filter((q) => q.cat === cat).length;
    let guard = 0;
    while (done() < TARGET && guard++ < 8) {
      const need = Math.min(10, TARGET - done());
      const stems = [...info.stems, ...out[drill].filter((q) => q.cat === cat).map((q) => q.stem)].map((s) => s.slice(0, 90));
      const ask = drill === "antidotes" ? `poisoning or drug overdose where the question is "the specific treatment / antidote?"` : `emergency where the question is "what comes next?" (the next step in the guideline algorithm)`;
      const gen = await chat([
        { role: "system", content: `You write accurate, exam-quality single-best-answer questions for doctors. ${SHAPE} Reply in JSON: {"questions": [...]}.` },
        { role: "user", content: `Write ${need} NEW questions for the subcategory "${cat}" — each a ${ask}. Do not repeat any of these existing ones:\n- ${stems.join("\n- ")}` },
      ]);
      const qs = (gen?.questions ?? []).filter((q) => q?.stem && q?.right && Array.isArray(q.wrong) && q.wrong.length === 3);
      if (!qs.length) continue;
      const rev = await chat([
        { role: "system", content: `You are a strict medical examiner. For each question decide: keep (correct, one best answer, current guideline), fix (small factual or wording error — return the corrected question), or drop (wrong, ambiguous, outdated, two defensible answers, or a duplicate). Reply in JSON: {"results": [{"i": index, "verdict": "keep|fix|drop", "question": <corrected question when fix>}]}.` },
        { role: "user", content: JSON.stringify(qs.map((q, i) => ({ i, ...q }))) },
      ], 9000);
      for (const r of rev?.results ?? []) {
        const q = r.verdict === "keep" ? qs[r.i] : r.verdict === "fix" ? r.question : null;
        if (q?.stem && q?.right && Array.isArray(q.wrong) && q.wrong.length === 3) out[drill].push({ ...q, id: `${String(q.id || "q").slice(0, 30)}-${out[drill].length}`, cat });
      }
      writeFileSync(OUT, JSON.stringify(out, null, 1));
      console.log(drill, cat, done(), "/", TARGET);
    }
  }
}
console.log("done", out.antidotes.length, out.algorithms.length);
