import "server-only";

import { NextResponse } from "next/server";
import type { z } from "zod";

import { EngineError } from "@/engine/engine";
import { ConfigError, SessionError } from "@/engine/session";
import { isAuthError } from "@supabase/supabase-js";

// Records each AI call's usage (see server/ai-usage) — loaded with every route.
import "@/server/ai-usage";
import { AuthError } from "@/server/auth";
import { AuthConfigError } from "@/server/supabase";
import { SuggestionsError } from "@/server/suggestions";

export interface ApiErrorBody {
  error: { code: string; message: string; ref?: string };
}

/** The only message users ever see for unexpected failures (spec §36). */
export const UNAVAILABLE = "Clinical engine temporarily unavailable.";

export function apiError(status: number, code: string, message: string) {
  return NextResponse.json<ApiErrorBody>({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}

export function ok<T>(body: T) {
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}

export async function parseBody<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S> | Response> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return apiError(400, "BAD_REQUEST", "Malformed request.");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) return apiError(400, "BAD_REQUEST", "Invalid request.");
  return parsed.data;
}

/** Maps engine errors to safe responses; logs everything else server-side only. */
export function handleError(err: unknown) {
  if (err instanceof AuthError) {
    return apiError(err.code === "UNAUTHENTICATED" ? 401 : err.code === "EXISTS" ? 409 : 401, err.code, err.message);
  }
  if (err instanceof EngineError) {
    const status = err.code === "BAD_SESSION" ? 410 : err.code === "CASE_CLOSED" || err.code === "NOT_CLOSED" ? 409 : err.code === "LIMIT" ? 429 : err.code === "NO_CASES" ? 404 : 400;
    return apiError(status, err.code, err.message);
  }
  if (err instanceof SuggestionsError) {
    const status = err.code === "UNAVAILABLE" ? 503 : err.code === "NOT_FOUND" ? 404 : err.code === "FORBIDDEN" ? 403 : 400;
    return apiError(status, err.code === "UNAVAILABLE" ? "SUGGESTIONS_UNAVAILABLE" : err.code, err.message);
  }
  if (err instanceof AuthConfigError) {
    console.error("[ramai] sign-in is not configured:", err.message);
    return apiError(503, "AUTH_UNAVAILABLE", "Sign-in isn't available right now. Please try again later.");
  }
  if (isAuthError(err)) {
    console.error("[ramai] Supabase Auth unavailable:", err.message);
    return apiError(503, "AUTH_UNAVAILABLE", "Sign-in is unavailable for a moment. Please try again.");
  }
  // A case the server can no longer open (its key changed): said plainly, not as an outage.
  if (err instanceof SessionError) {
    return apiError(410, "BAD_SESSION", "This case can't be continued after an update. Please start a new case.");
  }
  if (err instanceof ConfigError) {
    console.error("[ramai] configuration error:", err.message);
    return apiError(503, "ENGINE_UNAVAILABLE", UNAVAILABLE);
  }
  console.error("[ramai] unexpected engine error:", err);
  // Which part failed, in one word — never the error itself — so a screenshot of the problem says where to look.
  return NextResponse.json<ApiErrorBody>({ error: { code: "ENGINE_UNAVAILABLE", message: UNAVAILABLE, ref: failedPart(err) } }, { status: 503, headers: { "Cache-Control": "no-store" } });
}

function failedPart(err: unknown): string {
  const text = err instanceof Error ? `${err.name} ${err.message} ${err.stack ?? ""}` : String(err);
  if (/libsql|sqlite|SQL|LibsqlError|db\.ts/i.test(text)) return "db";
  if (/session|seal|token/i.test(text)) return "session";
  if (/openai|chatJSON|model/i.test(text)) return "ai";
  if (/fetch failed|network|ECONN|ETIMEDOUT|timeout/i.test(text)) return "net";
  return "engine";
}

/* -------------------------------------------------------------------------- */
/* Best-effort rate limiting (per instance). Use a shared store at scale.      */
/* -------------------------------------------------------------------------- */

const buckets = new Map<string, { count: number; reset: number }>();

/** The caller's address, as reported by the hosting proxy. */
export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";

/**
 * Each endpoint — and each method on it — has its own budget per address:
 * playing a case never uses up sign-up attempts, and reading a list never
 * uses up sending to it.
 */
export function rateLimited(req: Request, limit = 90, windowMs = 60_000): Response | null {
  const ip = clientIp(req);
  const key = `${req.method} ${new URL(req.url).pathname} ${ip}`;
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    if (buckets.size > 10_000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    return null;
  }
  bucket.count += 1;
  return bucket.count > limit ? apiError(429, "RATE_LIMITED", "Too many requests. Take a breath and try again.") : null;
}

/** Rejects cross-site state-changing requests (defence in depth on top of SameSite cookies). */
export function crossSite(req: Request): Response | null {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  try {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return new URL(origin).host === host ? null : apiError(403, "FORBIDDEN", "Cross-site request blocked.");
  } catch {
    return apiError(403, "FORBIDDEN", "Cross-site request blocked.");
  }
}
