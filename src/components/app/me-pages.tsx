"use client";

import { useEffect, useState, type ComponentProps } from "react";

import { CaseScreen } from "@/components/case/case-screen";
import { PageLoading } from "@/components/shell/page-loading";
import { Hub } from "@/components/home/hub";
import { GroupsCard } from "@/components/leaderboard/groups-card";
import { Leaderboard } from "@/components/leaderboard/leaderboard";
import { Home } from "@/components/home/home";
import { ProgressView } from "@/components/progress/progress-view";
import type { LibraryInfo } from "@/lib/engine-client";
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

const EMPTY_LIBRARY: LibraryInfo = { engine: "openai", specialties: {}, tracks: {}, levels: {} };

export function CasesShell() {
  return (
    <ClientShell wide signedOut="/">
      <CasesNow />
    </ClientShell>
  );
}

function CasesNow() {
  const me = useMe();
  const [library, setLibrary] = useState<LibraryInfo | null>(null);
  // Last time's counts at once (they rarely change), then today's.
  useEffect(() => {
    try {
      const kept = localStorage.getItem("ramai.library.v1");
      if (kept) setLibrary(JSON.parse(kept) as LibraryInfo);
    } catch {}
    fetch("/api/cases/library", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((l: LibraryInfo | null) => {
        if (!l) return;
        setLibrary(l);
        try { localStorage.setItem("ramai.library.v1", JSON.stringify(l)); } catch {}
      })
      .catch(() => undefined);
  }, []);
  return me ? <Home initial={me} library={library ?? EMPTY_LIBRARY} /> : null;
}

export function ProgressShell() {
  return (
    <ClientShell wide signedOut="/">
      <ProgressNow />
    </ClientShell>
  );
}

function ProgressNow() {
  const [data, setData] = useState<Pick<ComponentProps<typeof ProgressView>, "detail" | "report"> | null>(null);
  useEffect(() => {
    fetch("/api/progress/detail", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then(setData).catch(() => undefined);
  }, []);
  if (!data) return <div className="flex flex-col gap-4">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-32 rounded-[22px]" />)}</div>;
  return <ProgressView detail={data.detail} report={data.report} />;
}
