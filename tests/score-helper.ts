import type { ClinicalCaseDefinition } from "@/engine/case-definition";
import { generateDebrief } from "@/engine/debrief";

import { converse } from "./helpers";

/** A game's marks by line, each as a share of its maximum. */
export async function generateScore(def: ClinicalCaseDefinition, orders: string[]): Promise<Record<string, number>> {
  const { hidden, state } = await converse(def, orders);
  const debrief = generateDebrief(def, hidden, state as never);
  return Object.fromEntries(debrief.score.lines.map((l) => [l.category, l.earned / l.max]));
}
