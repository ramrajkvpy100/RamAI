import "server-only";

import { cookies } from "next/headers";

import { hasAuthCookie } from "./supabase-env";

/** Could this visitor be signed in? Their cookies say, with no trip to the database. */
export async function maybeSignedIn(): Promise<boolean> {
  const all = (await cookies()).getAll().map((c) => c.name);
  return hasAuthCookie(all) || all.includes("ramai_session");
}
