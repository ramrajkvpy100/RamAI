import type { Metadata } from "next";

import { LeaderboardShell } from "@/components/app/shells/leaderboard-shell";

export const metadata: Metadata = { title: "Leaderboard" };

export default function LeaderboardPage() {
  return <LeaderboardShell />;
}
