"use client";

import { useEffect, useState, type ReactNode } from "react";

import { PageLoading } from "@/components/shell/page-loading";
import { primeMe, useMe, type Me } from "@/lib/me-store";

import { AppShell } from "./app-shell";

const KEY = "ramai.me.v1";

/**
 * The signed-in frame for pages that need nothing from the server: drawn at once from what this phone already knows
 * (the last account details, kept here), then refreshed. The server never waits on the database for these pages.
 */
export function ClientShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const live = useMe();
  const [kept, setKept] = useState<Me | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw && !live) setKept(JSON.parse(raw) as Me);
    } catch {}
    let off = false;
    fetch("/api/me", { cache: "no-store" })
      .then(async (r) => {
        if (off) return;
        if (r.status === 401) {
          try { localStorage.removeItem(KEY); } catch {}
          window.location.href = `/login?next=${encodeURIComponent(location.pathname)}`;
          return;
        }
        if (!r.ok) return;
        const me = (await r.json()) as Me;
        primeMe(me);
        try { localStorage.setItem(KEY, JSON.stringify({ ...me, progress: { ...me.progress, history: me.progress.history.slice(-10) } })); } catch {}
      })
      .catch(() => undefined);
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const me = live ?? kept;
  if (!me) return <PageLoading />;
  return <AppShell me={me} wide={wide}>{children}</AppShell>;
}
