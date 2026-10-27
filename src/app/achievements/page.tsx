import type { Metadata } from "next";

import { ClientShell } from "@/components/app/client-shell";
import { AchievementsPage } from "@/components/achievements/achievements-page";

// Per-request (the page carries this visit's security nonce) — but it waits on nothing.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Achievements", description: "Every RamAI achievement — the ones you've unlocked and the ones still to earn." };

export default function Page() {
  return (
    <ClientShell>
      <AchievementsPage />
    </ClientShell>
  );
}
