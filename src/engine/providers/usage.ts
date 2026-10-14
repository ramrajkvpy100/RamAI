import { AsyncLocalStorage } from "node:async_hooks";

/**
 * What each AI call costs, in tokens and pictures — so the price of Pro can follow the real cost of a
 * case. A route says what the work is for (`withUsage`); every OpenAI call inside it reports its usage
 * here, and the server stores it (`setUsageSink`). Nothing is recorded where no sink is set (tests).
 */
export interface Usage {
  kind: string;
  sessionId?: string;
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
  images: number;
}

/** What a stretch of work is for. `sessionId` may be filled in once the case exists (it is read when the usage is stored). */
export interface UsageScope {
  kind: string;
  sessionId?: string;
}

const scope = new AsyncLocalStorage<UsageScope>();
let sink: ((u: Usage) => void) | null = null;

export const setUsageSink = (fn: (u: Usage) => void) => {
  sink = fn;
};

/** Runs `fn` with its AI calls counted as `kind` (and against the case, when there is one). */
export const withUsage = <T>(s: UsageScope, fn: () => T): T => scope.run(s, fn);

/** One call's usage, as OpenAI reports it in `usage`. */
export function noteUsage(usage: unknown, images = 0) {
  if (!sink) return;
  const u = (usage ?? {}) as {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
    input_tokens?: number;
    output_tokens?: number;
    input_tokens_details?: { cached_tokens?: number };
  };
  const s = scope.getStore();
  try {
    sink({
      kind: s?.kind ?? "other",
      get sessionId() {
        return s?.sessionId;
      },
      inputTokens: Number(u.prompt_tokens ?? u.input_tokens ?? 0) || 0,
      cachedTokens:
        Number(
          u.prompt_tokens_details?.cached_tokens ??
            u.input_tokens_details?.cached_tokens ??
            0,
        ) || 0,
      outputTokens: Number(u.completion_tokens ?? u.output_tokens ?? 0) || 0,
      images,
    });
  } catch {
    // Counting must never break a case.
  }
}
