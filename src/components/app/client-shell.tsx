"use client";

import { useEffect, useState, type ReactNode } from "react";

import { PageLoading } from "@/components/shell/page-loading";
import { primeMe, useMe, type Me } from "@/lib/me-store";

import { AppShell } from "./app-shell";

const KEY = "ramai.me.v1";

/**
 * The signed-in player, without the server waiting on the database: drawn at once from what this phone already knows
 * (the last account details, kept here), then refreshed in the background. `signedOut` is where to go if the cookie
 * turns out to be stale; null stays on the page.
 */
export function useShellMe(signedOut: string | null): { me: Me | null; out: boolean } {
  const live = useMe();
  const [out, setOut] = useState(false);
  useEffect(() => {
    // Already known from the page before: no second read on the way in.
    if (live) return;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) primeMe(JSON.parse(raw) as Me);
    } catch {}
    let off = false;
    fetch("/api/me", { cache: "no-store" })
      .then(async (r) => {
        if (off) return;
        if (r.status === 401) {
          try { localStorage.removeItem(KEY); } catch {}
          if (signedOut) window.location.replace(signedOut);
          else setOut(true);
          return;
        }
        if (r.status === 403) {
          window.location.replace("/invite?need=1");
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
  return { me: live, out };
}

/** The signed-in frame, for pages whose server waits on nothing. `publicPage`: a stale sign-in just shows the page without the frame. */
export function ClientShell({ children, wide = false, signedOut, publicPage = false }: { children: ReactNode; wide?: boolean; signedOut?: string; publicPage?: boolean }) {
  const { me, out } = useShellMe(publicPage ? null : (signedOut ?? (typeof window === "undefined" ? "/login" : `/login?next=${encodeURIComponent(location.pathname)}`)));
  if (out) return <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-10 pb-16 sm:px-6">{children}</main>;
  if (!me) return <PageLoading />;
  return <AppShell me={me} wide={wide}>{children}</AppShell>;
}
