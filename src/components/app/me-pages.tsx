"use client";

import { CaseScreen } from "@/components/case/case-screen";
import { PageLoading } from "@/components/shell/page-loading";
import { Hub } from "@/components/home/hub";
import { GroupsCard } from "@/components/leaderboard/groups-card";
import { Leaderboard } from "@/components/leaderboard/leaderboard";
import { useMe } from "@/lib/me-store";

import { ClientShell, useShellMe } from "./client-shell";

/** Pages drawn from what the phone knows: tapping between them never waits on the server. */
export function HomeShell() {
  return (
    <ClientShell wide signedOut="/?landing=1">
      <HubNow />
    </ClientShell>
  );
}

function HubNow() {
  const me = useMe();
  return me ? <Hub initial={me} /> : null;
}

export function CaseShell() {
  const { me } = useShellMe("/login?next=/case");
  return me ? <CaseScreen me={me} /> : <PageLoading />;
}

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
