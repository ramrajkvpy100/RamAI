import { cookies } from "next/headers";

import { endGuestSession } from "@/server/auth";
import { authConfigured, hasAuthCookie, supabaseServer } from "@/server/supabase";
import { crossSite, ok } from "@/lib/server/http";

export const runtime = "nodejs";

/** POST /api/auth/logout — ends this browser's session (Supabase's, or a guest's). */
export async function POST(req: Request) {
  const blocked = crossSite(req);
  if (blocked) return blocked;
  const jar = await cookies();
  if (authConfigured() && hasAuthCookie(jar.getAll().map((c) => c.name))) {
    try {
      await (await supabaseServer()).auth.signOut({ scope: "local" });
    } catch (err) {
      console.error("[ramai] Supabase sign-out failed:", err instanceof Error ? err.message : err);
    }
    // Signed out here even if Supabase couldn't be reached.
    for (const c of jar.getAll()) if (c.name.startsWith("sb-")) jar.delete(c.name);
  }
  await endGuestSession();
  return ok({ ok: true });
}
