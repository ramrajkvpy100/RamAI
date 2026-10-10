/**
 * Supabase Auth. Supabase keeps the passwords, sends the six-digit codes and
 * reset links, and issues the session (in HttpOnly cookies). RamAI keeps only
 * the profile and progress, linked by the Supabase user id.
 *
 * Only the project URL and the publishable (anon) key are needed — the same
 * public values a browser app would use. An optional server-only secret key
 * lets account deletion remove the sign-in record too.
 */
import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { authCookieOptions, hasAuthCookie, isSecretKey, supabaseConfig, supabaseSecretKey, type SupabaseConfig } from "@/lib/server/supabase-env";

/** Thrown when the Supabase settings are missing or wrong. */
export class AuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthConfigError";
  }
}

export { hasAuthCookie, isSecretKey, supabaseConfig, type SupabaseConfig };

export const authConfigured = () => supabaseConfig() !== null;

function requireConfig(): SupabaseConfig {
  const config = supabaseConfig();
  if (!config) throw new AuthConfigError("Sign-in isn't set up yet: add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  return config;
}

/**
 * Supabase for this request, reading and writing the session cookies. In Server
 * Components cookies can't be written; the proxy refreshes sessions for those.
 */
export async function supabaseServer(): Promise<SupabaseClient> {
  const { url, key } = requireConfig();
  const jar = await cookies();
  return createServerClient(url, key, {
    cookieOptions: authCookieOptions(),
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) jar.set(name, value, options);
        } catch {
          // Called from a Server Component — the proxy keeps the session fresh instead.
        }
      },
    },
  });
}

/** A one-off client that never touches cookies — to check a password before deleting an account. */
export function supabaseDetached(): SupabaseClient {
  const { url, key } = requireConfig();
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

/** Server-only admin access, if a secret key is configured (never NEXT_PUBLIC_). */
export function supabaseAdmin(): SupabaseClient | null {
  const config = supabaseConfig();
  const secret = supabaseSecretKey();
  if (!config || !secret) return null;
  return createClient(config.url, secret, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

export interface AuthAccount {
  id: string;
  email: string;
}

/** The signed-in Supabase account on this request — its token checked against the project's keys — or null. */
export async function currentAccount(): Promise<AuthAccount | null> {
  if (!authConfigured()) return null;
  const jar = await cookies();
  if (!hasAuthCookie(jar.getAll().map((c) => c.name))) return null;
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub || claims.is_anonymous || typeof claims.email !== "string") return null;
  return { id: claims.sub, email: claims.email.toLowerCase() };
}
