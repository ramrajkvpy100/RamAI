/**
 * Audit (costs credits): an average doctor, played by a model that doesn't know the diagnosis, on newly invented cases.
 * The opposite test to the bad doctor: sensible orders must be understood and carried out, with no false alarms, and
 * fair marks. Prints a transcript and counts what looks wrong.
 */
import { writeFileSync } from "node:fs";

import { it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { ClinicalCaseDefinition } from "@/engine/case-definition";
import { generateDebrief } from "@/engine/debrief";
import { chatJSON, createOpenAIProvider } from "@/engine/providers/openai";
import { applyEffects, createInitialState } from "@/engine/reducer";
import { createHiddenState, openingEffects, runTurn } from "@/engine/simulator";
import type { ActionRecord, CaseState } from "@/engine/types";

const DOCTOR = `You are playing an average junior doctor in a clinical simulator: competent, not brilliant. Ask a few relevant history questions, examine, order sensible tests, treat with normal doses (drug, dose, route, frequency), reassess. You may miss things or make an ordinary mistake, but you never do anything absurd. Type short, natural orders of at most two sentences, one or two things at a time. The results reported so far are listed for you. By about turn 15, or sooner if clear, state your diagnosis as "dx <diagnosis>", then a plan, then finally "close case". Reply as JSON only: {"say":"your next message"}.`;

const NOT_UNDERSTOOD = /could you say that again|didn.t quite follow|what would you like me to do|I want to get it right|once more/i;
const ALARM = /Do you still want it|far above|times the usual|could stop the breathing|liver-toxic|failing heart/i;

async function play(def: ClinicalCaseDefinition, out: string[], tally: Record<string, number>, provider: ReturnType<typeof createOpenAIProvider>) {
  const hidden = createHiddenState(def);
  let state: CaseState = createInitialState({ sessionId: "t", caseNumber: 1, briefing: def.briefing, track: def.track, level: def.level, setting: def.setting, patient: def.patient, arrivalMinuteOfDay: def.arrivalMinuteOfDay });
  state = applyEffects(state, openingEffects(def, hidden));
  out.push(`\n===== ${def.id} — ${def.truth.diagnosis} (${def.patient.age} ${def.patient.sex}, ${def.track}, ${def.level})`);
  for (let i = 0; i < 22 && !hidden.closed; i++) {
    const results = state.investigations.filter((inv) => inv.status === "resulted" || (inv.rows?.length ?? 0) > 0).map((inv) => `${inv.name}: ${(inv.rows ?? []).map((r) => `${r.analyte} ${r.value}`).join(", ") || inv.report || ""}`).join("\n");
    const transcript = `${state.messages.slice(-24).map((m) => `${m.role}: ${m.text}`).join("\n")}\n\nRESULTS ON SCREEN:\n${results}`;
    const next = (await chatJSON([{ role: "system", content: DOCTOR }, { role: "user", content: `${def.briefing}\nPatient: ${def.patient.age} ${def.patient.sex}. Turn ${i + 1}.\n${transcript}` }], 1500, false, 40_000)) as { say?: string };
    const raw = (next.say ?? "").trim().slice(0, 800);
    if (!raw) break;
    const t0 = Date.now();
    const read = await provider.interpret(raw, { def, hidden, transcript: state.messages });
    const record: ActionRecord = { id: `a${i}`, at: hidden.clock, raw, intents: read.intents, generated: read.generated };
    const effects = runTurn(def, hidden, record);
    state = applyEffects(state, effects);
    out.push(`DR> ${raw}  [${Date.now() - t0}ms; ${read.intents.map((x) => `${x.kind}:${x.targetId ?? ""}`).join(" | ")}]`);
    for (const e of effects) {
      if (e.type === "message" && e.role !== "doctor") {
        out.push(`   ${e.role}: ${e.text.slice(0, 220)}`);
        tally.replies = (tally.replies ?? 0) + 1;
        if (NOT_UNDERSTOOD.test(e.text)) { tally.notUnderstood = (tally.notUnderstood ?? 0) + 1; out.push("   ^^ NOT UNDERSTOOD"); }
        if (ALARM.test(e.text)) { tally.alarms = (tally.alarms ?? 0) + 1; out.push("   ^^ NURSE ALARM"); }
      }
    }
    tally.turns = (tally.turns ?? 0) + 1;
    tally.slowMs = Math.max(tally.slowMs ?? 0, Date.now() - t0);
  }
  if (!hidden.closed) {
    const record: ActionRecord = { id: "end", at: hidden.clock, raw: "close case", intents: [{ kind: "close", phrase: "close case", matched: true }] };
    state = applyEffects(state, runTurn(def, hidden, record));
  }
  const d = generateDebrief(def, hidden, state);
  out.push(`--- score ${d.score.total}/100, ${d.verdict}, ${d.finalStatus}; said dx: ${hidden.diagnosis?.text ?? "none"}; code: ${hidden.code ? `${hidden.code.rhythm}, ${hidden.code.outcome}` : "none"}; drugs: ${hidden.drugs.map((x) => `${x.generic} ${x.dose ?? ""}`).join(", ")}; lines: ${d.score.lines.map((l) => `${l.category} ${Math.round(l.earned)}/${l.max}`).join(" ")}`);
}

it("the average doctor", { timeout: 1_700_000 }, async () => {
  process.env.OPENAI_MODEL = process.env.AUDIT_MODEL ?? "gpt-6-luna";
  const provider = createOpenAIProvider();
  const out: string[] = [];
  const tally: Record<string, number> = {};
  // An order the engine failed on shows in the transcript, not only in a log nobody reads.
  const logged = console.error;
  console.error = (...args: unknown[]) => { out.push(`   !! ${args.join(" ").slice(0, 300)}`); tally.engineErrors = (tally.engineErrors ?? 0) + 1; logged(...args); };
  for (const spec of (process.env.AUDIT_NEW ?? "").split(",").filter(Boolean)) {
    const [specialty, track] = spec.split("/");
    try {
      const src = await provider.createCase({ specialty, track, country: "IN" } as never);
      if (src.kind !== "generated") { out.push(`\n(${spec}: fell back to a written case; not counted)`); continue; }
      await play(src.def, out, tally, provider);
    } catch (err) {
      out.push(`\n(${spec}: failed: ${err instanceof Error ? err.message : err})`);
    }
    writeFileSync(process.env.AUDIT_OUT!, `TALLY ${JSON.stringify(tally)}\n${out.join("\n")}`);
  }
});
