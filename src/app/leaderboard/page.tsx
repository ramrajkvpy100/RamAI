import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LeaderboardShell } from "@/components/app/me-pages";
import { maybeSignedIn } from "@/lib/server/signed-in";

export const metadata: Metadata = { title: "Leaderboard" };
export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  if (!(await maybeSignedIn())) redirect("/login?next=/leaderboard");
  return <LeaderboardShell />;
}
