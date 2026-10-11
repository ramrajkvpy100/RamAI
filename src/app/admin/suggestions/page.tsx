import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app/app-shell";
import { SuggestionsAdmin } from "@/components/suggestions/suggestions-admin";
import { getMe } from "@/server/me";
import { listSuggestions, SuggestionsError } from "@/server/suggestions";

export const metadata: Metadata = { title: "Suggestions · Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Admins only — checked on the server, and again by the database for every query. */
export default async function AdminSuggestions() {
  const me = await getMe();
  if (!me) redirect("/login?next=/admin/suggestions");
  if (!me.admin) notFound();
  const initial = await listSuggestions().catch((err) => ({ error: err instanceof SuggestionsError ? err.message : "Couldn't load suggestions." }));
  return (
    <AppShell me={me} wide>
      <SuggestionsAdmin initial={initial} />
    </AppShell>
  );
}
