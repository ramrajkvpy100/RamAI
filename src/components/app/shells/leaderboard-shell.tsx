"use client";

import { ClientShell } from "@/components/app/client-shell";
import { GroupsCard } from "@/components/leaderboard/groups-card";
import { Leaderboard } from "@/components/leaderboard/leaderboard";
import { useMe } from "@/lib/me-store";

export function LeaderboardShell() {
  return (
    <ClientShell>
      <LeaderboardNow />
    </ClientShell>
  );
}

function LeaderboardNow() {
  const me = useMe();
  if (!me) return null;
  return (
    <>
      <Leaderboard me={me} />
      {!me.user.isGuest && (
        <div className="mx-auto mt-5 w-full max-w-3xl">
          <GroupsCard />
        </div>
      )}
    </>
  );
}
