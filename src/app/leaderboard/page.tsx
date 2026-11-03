import type { Metadata } from "next";

import { LeaderboardShell } from "@/components/app/me-pages";

export const metadata: Metadata = { title: "Leaderboard" };

export default function LeaderboardPage() {
  return <LeaderboardShell />;
}
