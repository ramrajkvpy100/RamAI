import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Achievements } from "@/components/achievements/achievements";
import { AppShell } from "@/components/app/app-shell";
import { getMe } from "@/server/me";

export const metadata: Metadata = { title: "Achievements", description: "Every RamAI achievement — the ones you've unlocked and the ones still to earn." };
export const dynamic = "force-dynamic";

export default async function AchievementsPage() {
  const me = await getMe();
  if (!me) redirect("/login?next=/achievements");
  return (
    <AppShell me={me}>
      <Achievements initial={me} />
    </AppShell>
  );
}
