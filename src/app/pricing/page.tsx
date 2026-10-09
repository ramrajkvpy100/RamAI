import type { Metadata } from "next";

import { AppShell } from "@/components/app/app-shell";
import { LandingNav } from "@/components/landing/landing";
import { Pricing } from "@/components/pricing/pricing";
import { Footer } from "@/components/shell/footer";
import { getMe } from "@/server/me";

export const metadata: Metadata = { title: "Pricing" };
export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const me = await getMe();
  if (me) {
    return (
      <AppShell me={me} wide>
        <Pricing initial={me} />
      </AppShell>
    );
  }
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px] bg-[radial-gradient(60%_60%_at_20%_0%,var(--mesh-1),transparent_70%),radial-gradient(50%_50%_at_85%_10%,var(--mesh-3),transparent_70%)]" />
      <LandingNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-10 pb-16 sm:px-6">
        <Pricing initial={null} />
      </main>
      <Footer />
    </div>
  );
}
