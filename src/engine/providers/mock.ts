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
    return { intents: resolveIntents(text, { def: ctx.def, setting: ctx.hidden.setting, weightKg }) };
  },

  async availability(country) {
    return libraryAvailability(country);
  },
};
