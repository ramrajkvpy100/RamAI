/**
 * Mock provider — fully offline. Cases come from the scripted library and
 * language is handled by the deterministic rule-based resolver.
 */
import "server-only";

import { getCase, libraryAvailability, pickCase } from "../cases";
import { resolveIntents } from "../intent";
import { SessionError } from "../session";

/** No case in the library matches the requested mode / level / specialty. */
export class NoCaseError extends Error {
  constructor() {
    super("No cases match that choice yet.");
    this.name = "NoCaseError";
  }
}
import type { ClinicalProvider } from "./types";

const AFFIRM = /^(y+a+|yes+|yeah|yep|ok(ay)?|haan|ha|sure|go ahead|do it|please do|of course|correct|right)[.!]*$/i;

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
    const intents = resolveIntents(text, { def: ctx.def, setting: ctx.hidden.setting, weightKg });
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
