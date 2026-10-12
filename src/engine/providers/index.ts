import "server-only";

import { mockProvider } from "./mock";
import type { ClinicalProvider } from "./types";

let openai: ClinicalProvider | undefined;

/**
 * Selects the clinical provider. With an OpenAI key on the server, the model
 * words patient replies and debrief feedback (RAMAI_ENGINE=mock turns that
 * off); without a key, the scripted engine runs. Wherever the model is
 * unavailable, the scripted rules take over.
 */
export async function getProvider(): Promise<ClinicalProvider> {
  const engine = process.env.RAMAI_ENGINE || (process.env.OPENAI_API_KEY ? "openai" : "mock");
  if (engine === "openai" && process.env.OPENAI_API_KEY) {
    if (!openai) openai = (await import("./openai")).createOpenAIProvider();
    return openai;
  }
  return mockProvider;
}

export type { ClinicalProvider } from "./types";
