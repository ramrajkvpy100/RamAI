"use client";

import { useEffect, ViewTransition, type ReactNode } from "react";

import { VerifyBanner } from "@/components/auth/verify-banner";
import { Footer } from "@/components/shell/footer";
import { primeMe, type Me } from "@/lib/me-store";

import { AppHeader } from "./app-header";

/** Signed-in chrome: header, page, footer. Seeds the client store with server data. */
export function AppShell({ me, children, wide = false }: { me: Me; children: ReactNode; wide?: boolean }) {
  useEffect(() => primeMe(me), [me]);
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(60%_60%_at_15%_0%,var(--mesh-1),transparent_70%),radial-gradient(50%_50%_at_90%_10%,var(--mesh-3),transparent_70%)]" />
      <AppHeader initial={me} />
      <main className={wide ? "mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-8 sm:px-6 sm:pt-8" : "mx-auto w-full max-w-4xl flex-1 px-4 pt-6 pb-8 sm:px-6 sm:pt-8"}>
        <VerifyBanner me={me} />
        {/* Each page fades in as the last one fades out (where the browser supports view transitions). */}
        <ViewTransition enter="page-in" exit="page-out" default="none">
          <div>{children}</div>
        </ViewTransition>
      </main>
      <Footer />
    </div>
  );
}
