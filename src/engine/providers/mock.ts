/**
 * Mock provider — fully offline. Cases come from the scripted library and
 * language is handled by the deterministic rule-based resolver.
 */
import "server-only";

import { getCase, libraryAvailability, pickCase } from "../cases";
import { resolveIntents, type IntentContext } from "../intent";
import { completedIntent, completeOrder, pendingQuestion } from "../orders";
import { SessionError } from "../session";
import { splitClauses } from "../text";
import type { ResolvedIntent } from "../types";

/** No case in the library matches the requested mode / level / specialty. */
export class NoCaseError extends Error {
  constructor() {
    super("No cases match that choice yet.");
    this.name = "NoCaseError";
  }
}
import type { ClinicalProvider, InterpretContext } from "./types";

const AFFIRM = /^(y+a+|yes+|yeah|yep|ok(ay)?|haan|ha|sure|go ahead|do it|please do|of course|correct|right)[.!]*$/i;

const EXAM_VERB = /\b(examine|palpate|auscultate|listen|inspect|percuss|check|look|feel|elicit|see)\b/i;
/** Intents that are clearly something else, not an answer to the question about an order. */
const ELSEWHERE: ResolvedIntent["kind"][] = ["investigation", "action", "diagnosis", "differential", "followup", "wait", "reassess", "close", "results", "vitals"];

/**
 * The doctor answering the question about an order — "1 g IV", "PA", "plain", "4 litres by prongs",
 * "the usual dose": that order, completed. Null when the words aren't an answer (another order, a
 * question for the patient, a remark): then the order isn't carried out, as at a real bedside.
 */
function answerPending(text: string, ctx: InterpretContext, rctx: IntentContext): ResolvedIntent[] | null {
  const pending = ctx.hidden.pendingOrders ?? [];
  if (pending.length === 0) return null;
  const out: ResolvedIntent[] = [];
  let answered = false;
  for (const clause of splitClauses(text)) {
    const own = resolveIntents(clause, rctx);
    const elsewhere = own.some(
      (i) =>
        (i.kind === "drug" && i.targetId !== "unknown" && !pending.some((p) => p.kind === "drug" && p.targetId === i.targetId)) ||
        ELSEWHERE.includes(i.kind) ||
        (i.kind === "exam" && EXAM_VERB.test(clause)) ||
        (i.kind === "history" && /\?\s*$/.test(clause)),
    );
    const target = answered || elsewhere ? undefined : pending.find((p) => completeOrder(p, clause, rctx.weightKg));
    if (target) {
      out.push(completedIntent(target, completeOrder(target, clause, rctx.weightKg)!, clause));
      answered = true;
    } else out.push(...own);
  }
  return answered ? out : null;
}

export const mockProvider: ClinicalProvider = {
  id: "mock",

  async createCase(opts) {
    const def = pickCase(opts);
    if (!def) throw new NoCaseError();
    return { kind: "library", id: def.id };
  },

  resolveCase(src) {
    if (src.kind === "generated") return src.def;
    const def = getCase(src.id);
    if (!def) throw new SessionError("This case is no longer available.");
    return def;
  },

  async interpret(text, ctx) {
    const weightKg = parseFloat(ctx.hidden.vitals.weight.value) || 60;
    const rctx: IntentContext = { def: ctx.def, setting: ctx.hidden.setting, weightKg };
    // An order waiting on its details: these words may be the answer.
    const answer = answerPending(text, ctx, rctx);
    if (answer) return { intents: answer };
    // "Ok" isn't an answer to "what dose?" — the question is asked again, and the order keeps waiting.
    const waiting = ctx.hidden.pendingOrders?.[0];
    if (waiting && AFFIRM.test(text.trim())) {
      return { intents: [{ kind: "unknown", phrase: text, matched: false, payload: { speaker: ctx.def.track === "phone" ? "attendant" : "nurse", keepPending: true } }], generated: { "0": pendingQuestion(waiting, true) } };
    }
    const intents = resolveIntents(text, rctx);
    // "Ya", "yes", "ok" after someone in the room asked a question: they hear it and go along.
    const last = [...ctx.transcript].reverse().find((m) => m.role !== "doctor" && m.role !== "system");
    if (intents.length === 1 && intents[0]!.kind === "unknown" && AFFIRM.test(text.trim()) && last && /\?\s*$/.test(last.text) && (last.role === "patient" || last.role === "attendant" || last.role === "nurse")) {
      return { intents: [{ ...intents[0]!, payload: { ...intents[0]!.payload, speaker: last.role } }], generated: { "0": last.role === "nurse" ? "Right away, doctor." : "Okay, doctor." } };
    }
    return { intents };
  },

  async availability(country) {
    return libraryAvailability(country);
  },
};
