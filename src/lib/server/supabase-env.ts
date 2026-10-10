/**
 * The Supabase project, read from the environment at runtime (never inlined
 * at build time) under the names Supabase and Vercel use. Shared by the
 * server and the proxy; only public values are read here.
 */

export interface SupabaseConfig {
  url: string;
  /** Publishable (sb_publishable_…) or legacy anon key — public by design. */
  key: string;
}

const first = (env: Record<string, string | undefined>, names: string[]) => names.map((n) => env[n]?.trim()).find((v) => !!v);

/** A secret or service-role key must never stand in for the public one. */
export function isSecretKey(key: string): boolean {
  if (key.startsWith("sb_secret_")) return true;
  const payload = key.split(".")[1];
  if (!payload) return false;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()).role === "service_role";
  } catch {
    return false;
  }
}

let warned = false;

export function supabaseConfig(env: Record<string, string | undefined> = process.env): SupabaseConfig | null {
  const url = first(env, ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"]);
  const key = first(env, ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY"]);
  if (!url || !key) return null;
  if (isSecretKey(key)) {
    if (!warned) console.error("[ramai] The Supabase publishable/anon key setting holds a SECRET key. Replace it with the publishable key — sign-in is off until then.");
    warned = true;
    return null;
  }
  return { url: url.replace(/\/+$/, ""), key };
}

/** Server-only secret key (account deletion), never a NEXT_PUBLIC_ name. */
export const supabaseSecretKey = (env: Record<string, string | undefined> = process.env) => first(env, ["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"]);

/** Supabase's session cookies (sb-<project>-auth-token, possibly split into .0, .1 …). */
export const hasAuthCookie = (names: Iterable<string>) => [...names].some((n) => n.startsWith("sb-") && /-auth-token(\.\d+)?$/.test(n));

/**
 * The session cookies: RamAI only talks to Supabase from the server, so page
 * scripts never need to read them — HttpOnly keeps an injected script from
 * stealing a session.
 */
export const authCookieOptions = () => ({ path: "/", sameSite: "lax" as const, httpOnly: true, secure: process.env.NODE_ENV === "production" });
