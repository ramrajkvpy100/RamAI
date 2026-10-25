import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app/app-shell";
import { FocusTimer } from "@/components/focus/focus-timer";
import { getMe } from "@/server/me";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Focus timer", description: "A calm 25-minute focus timer for study, with short breaks — kept on your phone." };

export default async function FocusPage() {
  const me = await getMe();
  if (!me) redirect("/");
  return (
    <AppShell me={me}>
      <FocusTimer />
    </AppShell>
  );
}
