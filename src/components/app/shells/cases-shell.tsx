"use client";

import { useEffect, useState } from "react";

import { ClientShell } from "@/components/app/client-shell";
import { Home } from "@/components/home/home";
import type { LibraryInfo } from "@/lib/engine-client";
import { useMe } from "@/lib/me-store";

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
