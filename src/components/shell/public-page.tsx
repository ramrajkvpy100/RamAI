import type { ReactNode } from "react";

import { ClientShell } from "@/components/app/client-shell";
import { LandingNav } from "@/components/landing/landing";
import { maybeSignedIn } from "@/lib/server/signed-in";

import { Footer } from "./footer";

/** A page anyone can open: the app's chrome when signed in, the public one otherwise. */
export async function PublicPage({ children }: { children: ReactNode }) {
  // Drawn on the phone when signed in: the server doesn't wait on the database for the frame.
  if (await maybeSignedIn()) return <ClientShell publicPage>{children}</ClientShell>;
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div aria-hidden className="aurora-drift pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(60%_60%_at_20%_0%,var(--mesh-1),transparent_70%),radial-gradient(50%_50%_at_85%_10%,var(--mesh-3),transparent_70%)]" />
      <LandingNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-10 pb-16 sm:px-6">{children}</main>
      <Footer />
    </div>
  );
}
