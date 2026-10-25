/**
 * Fills each clinical-image subject to 50 diagnoses: the model proposes common, recognisable conditions with their key
 * visual feature and Commons search words; an examiner pass checks them. Output: src/lib/banks/clinical-more.json.
 * Pictures are then found (real, licensed, AI-checked) by the practice pipeline as usual.
 * Run: node --env-file=.env.local scripts/gen-clinical.mjs '<{"Subject": ["existing label", ...]}>'
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
const KEY = process.env.OPENAI_API_KEY, MODEL = process.env.OPENAI_MODEL || "gpt-6-luna";
const OUT = "src/lib/banks/clinical-more.json";
const have = JSON.parse(process.argv[2]);
const out = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : [];
async function chat(messages, max = 8000) {
  for (let t = 0; t < 3; t++) {
    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, messages, response_format: { type: "json_object" }, max_completion_tokens: max, reasoning_effort: "low" }) });
      const j = await r.json(); if (!r.ok) throw new Error(JSON.stringify(j.error)); return JSON.parse(j.choices[0].message.content);
    } catch (e) { console.error("retry", String(e).slice(0, 160)); await new Promise((r) => setTimeout(r, 3000)); }
  }
  return null;
}
for (const [subject, labels] of Object.entries(have)) {
  let guard = 0;
  const count = () => labels.length + out.filter((x) => x.subject === subject).length;
  while (count() < 50 && guard++ < 6) {
    const need = Math.min(15, 50 - count());
    const existing = [...labels, ...out.filter((x) => x.subject === subject).map((x) => x.label)];
    const gen = await chat([
      { role: "system", content: `You list conditions that doctors learn to recognise from a clinical photograph (what is seen at the bedside, not a scan or slide). Reply in JSON: {"items": [{"id": "kebab-id", "label": "Diagnosis name", "key": "the visual feature to recognise it by, one sentence, with **bold** key words", "search": ["2 short Wikimedia Commons search phrases"], "describe": "what a typical photo shows, one line"}]}.` },
      { role: "user", content: `Subject: ${subject}. Give ${need} more, common and teachable, each clearly visible in a photograph. Not any of: ${existing.join("; ")}.` },
    ]);
    const items = (gen?.items ?? []).filter((x) => x?.label && x?.key && Array.isArray(x.search));
    if (!items.length) continue;
    const rev = await chat([
      { role: "system", content: `You are a strict dermatology/clinical-signs examiner. For each item: keep if it is a real, recognisable-from-a-photo condition with a correct key feature; fix small errors (return the corrected item); drop if wrong, not photo-recognisable, or a duplicate of another. Reply in JSON: {"results": [{"i": 0, "verdict": "keep|fix|drop", "item": {}}]}.` },
      { role: "user", content: JSON.stringify(items.map((x, i) => ({ i, ...x }))) },
    ]);
    for (const r of rev?.results ?? []) {
      const x = r.verdict === "keep" ? items[r.i] : r.verdict === "fix" ? r.item : null;
      if (x?.label && x?.key && !existing.some((e) => e.toLowerCase() === x.label.toLowerCase())) out.push({ ...x, id: `cx-${String(x.id || x.label).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30)}-${out.length}`, subject });
    }
    writeFileSync(OUT, JSON.stringify(out, null, 1));
    console.log(subject, count());
  }
}
console.log("done", out.length);
