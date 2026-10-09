import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app/app-shell";
import { Leaderboard } from "@/components/leaderboard/leaderboard";
import { getMe } from "@/server/me";

export const metadata: Metadata = { title: "Leaderboard" };
export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const me = await getMe();
  if (!me) redirect("/login?next=/leaderboard");
  return (
    <AppShell me={me}>
      <Leaderboard me={me} />
    </AppShell>
  );
}
