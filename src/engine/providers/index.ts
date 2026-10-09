import "server-only";

import { mockProvider } from "./mock";
import type { ClinicalProvider } from "./types";

let openai: ClinicalProvider | undefined;

/**
 * Selects the clinical provider from RAMAI_ENGINE ("mock" | "openai").
 * The OpenAI provider is only loaded when configured, and falls back to the
 * mock provider's library and rules wherever generation is unavailable.
 */
export async function getProvider(): Promise<ClinicalProvider> {
  if (process.env.RAMAI_ENGINE === "openai" && process.env.OPENAI_API_KEY) {
    if (!openai) openai = (await import("./openai")).createOpenAIProvider();
    return openai;
  }
  return mockProvider;
}

export type { ClinicalProvider } from "./types";
