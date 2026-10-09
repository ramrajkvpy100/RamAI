import "server-only";

import { NextResponse } from "next/server";
import type { z } from "zod";

import { EngineError } from "@/engine/engine";
import { ConfigError } from "@/engine/session";
import { AuthError } from "@/server/auth";

export interface ApiErrorBody {
  error: { code: string; message: string };
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
    const status = err.code === "BAD_SESSION" ? 410 : err.code === "CASE_CLOSED" ? 409 : err.code === "LIMIT" ? 429 : err.code === "NO_CASES" ? 404 : 400;
    return apiError(status, err.code, err.message);
  }
  if (err instanceof ConfigError) {
    console.error("[ramai] configuration error:", err.message);
    return apiError(503, "ENGINE_UNAVAILABLE", UNAVAILABLE);
  }
  console.error("[ramai] unexpected engine error:", err);
  return apiError(503, "ENGINE_UNAVAILABLE", UNAVAILABLE);
}

/* -------------------------------------------------------------------------- */
/* Best-effort rate limiting (per instance). Use a shared store at scale.      */
/* -------------------------------------------------------------------------- */

const buckets = new Map<string, { count: number; reset: number }>();

/** Each endpoint has its own budget per address — playing a case never uses up sign-up or password-reset attempts. */
export function rateLimited(req: Request, limit = 90, windowMs = 60_000): Response | null {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  const key = `${new URL(req.url).pathname} ${ip}`;
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
