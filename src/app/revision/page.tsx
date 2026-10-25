import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app/app-shell";
import { RevisionDeck } from "@/components/practice/revision-deck";
import { getMe } from "@/server/me";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Revision deck" };

export default async function RevisionPage() {
  const me = await getMe();
  if (!me) redirect("/");
  return (
    <AppShell me={me}>
      <RevisionDeck />
    </AppShell>
  );
}
