import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app/app-shell";
import { SuggestionsPage } from "@/components/suggestions/suggestions-page";
import { getMe } from "@/server/me";

export const metadata: Metadata = { title: "Suggestions" };
export const dynamic = "force-dynamic";

export default async function Suggestions() {
  const me = await getMe();
  if (!me) redirect("/login?next=/suggestions");
  return (
    <AppShell me={me}>
      <SuggestionsPage guest={me.user.isGuest} />
    </AppShell>
  );
}
