/**
 * Mock provider — fully offline. Cases come from the scripted library and
 * language is handled by the deterministic rule-based resolver.
 */
import "server-only";

import { getCase, libraryAvailability, pickCase } from "../cases";
import { resolveIntents, type IntentContext } from "../intent";
import { completedIntent, completeOrder, DECLINE_RE, pendingQuestion } from "../orders";
import { SessionError } from "../session";
import { splitClauses } from "../text";
import type { ResolvedIntent } from "../types";

/** No case in the library matches the requested mode / level / specialty. */
export class NoCaseError extends Error {
  constructor(message = "No cases match that choice yet.") {
    super(message);
    this.name = "NoCaseError";
  }
}
import type { ClinicalProvider, InterpretContext } from "./types";

const AFFIRM = /^(y+a+|yes+|yeah|yep|ok(ay)?|haan|ha|sure|go ahead|do it|please do|of course|correct|right)[.!]*$/i;

const EXAM_VERB = /\b(exam|examination|examine|palpate|auscultate|listen|inspect|percuss|check|look|feel|elicit|see)\b/i;
/** Intents that are clearly something else, not an answer to the question about an order. */
const ELSEWHERE: ResolvedIntent["kind"][] = ["investigation", "action", "diagnosis", "differential", "followup", "wait", "reassess", "close", "results", "vitals"];

/**
 * The doctor answering the question about an order — "1 g IV", "PA", "plain", "4 litres by prongs",
 * "the usual dose": that order, completed. Null when the words aren't an answer (another order, a
 * question for the patient, a remark): then the order isn't carried out, as at a real bedside.
 */
/** Words an answer to "what dose, route, how often, how long?" is made of. */
const DETAIL_WORD = /^(mg|mcg|ug|g|gm|gms|gram|grams|ml|mls|l|litre|litres|liter|liters|unit|units|iu|vial|vials|amp|ampoule|puff|puffs|drop|drops|tab|tabs|tablet|tablets|cap|caps|capsule|syp|syr|syrup|susp|inj|injection|iv|im|sc|sq|po|oral|orally|sl|sublingual|neb|nebulised|nebulized|inh|inhaled|pr|top|topical|topically|local|locally|skin|drip|infusion|bolus|slow|slowly|fast|rapid|push|stat|now|od|bd|bid|tds|tid|qid|qds|hs|sos|prn|daily|weekly|monthly|once|twice|thrice|times|day|days|week|weeks|month|months|year|for|over|in|min|mins|minute|minutes|hour|hours|hr|hrs|h|every|each|at|night|nightly|bedtime|morning|evening|noon|with|without|and|or|then|the|a|an|of|to|usual|standard|normal|same|dose|doses|give|given|start|continue|it|that|this|per|kg|cream|gel|ointment|lotion|spray|apply|thin|layer|area|affected|before|after|food|meal|meals|empty|stomach|by|mouth|vein|muscle|yes|ok|okay|please|doctor|sir|ma'?am|until|till|up|to|repeat|again|more|less|half|one|two|three|four|five|six|seven|eight|nine|ten|first|loading|maintenance|followed|taper|tapering)$/i;

/** Is there a word here that names something else — another medicine — rather than this order's details? */
function namesSomethingElse(clause: string, pending: readonly { phrase?: string; targetId?: string }[]): boolean {
  const own = new Set(pending.flatMap((p) => `${p.phrase ?? ""} ${p.targetId ?? ""}`.toLowerCase().split(/[^a-z]+/)).filter(Boolean));
  return clause
    .toLowerCase()
    .split(/[^a-z']+/)
    .some((w) => w.length >= 4 && !DETAIL_WORD.test(w) && !own.has(w));
}

function answerPending(text: string, ctx: InterpretContext, rctx: IntentContext): ResolvedIntent[] | null {
  const pending = ctx.hidden.pendingOrders ?? [];
  if (pending.length === 0) return null;
  const out: ResolvedIntent[] = [];
  let answered = false;
  for (const clause of splitClauses(text)) {
    const own = resolveIntents(clause, rctx);
    const elsewhere = own.some(
      (i) =>
        // Another medicine named — even one we don't stock ("mycophenolate", "topical steroids") — is a new order, never this one's details.
        (i.kind === "drug" && i.targetId !== "unknown" && !pending.some((p) => p.kind === "drug" && p.targetId === i.targetId)) ||
        (pending.every((p) => p.kind === "drug") && namesSomethingElse(clause, pending)) ||
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
    // "No", "cancel": the order the nurse queried isn't given.
    const queried = ctx.hidden.pendingOrders?.find((o) => o.kind === "confirm");
    if (queried && DECLINE_RE.test(text) && splitClauses(text).length === 1) {
      return { intents: [{ kind: "unknown", phrase: text, matched: false, payload: { speaker: "nurse" } }], generated: { "0": "Okay, doctor — I'll hold it." } };
    }
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
    // (The last thing said must be that question — not an older one, nor the ward's "Which medicine?")
    const last = [...ctx.transcript].reverse().find((m) => m.role !== "doctor");
    if (intents.length === 1 && intents[0]!.kind === "unknown" && AFFIRM.test(text.trim()) && last && /\?\s*$/.test(last.text) && (last.role === "patient" || last.role === "attendant" || last.role === "nurse")) {
      return { intents: [{ ...intents[0]!, payload: { ...intents[0]!.payload, speaker: last.role } }], generated: { "0": last.role === "nurse" ? "Right away, doctor." : "Okay, doctor." } };
    }
    return { intents };
  },

  async availability(country) {
    return libraryAvailability(country);
  },
};
