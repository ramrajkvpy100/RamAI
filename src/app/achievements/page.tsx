import type { Metadata } from "next";

import { ClientShell } from "@/components/app/client-shell";
import { AchievementsPage } from "@/components/achievements/achievements-page";

export const metadata: Metadata = { title: "Achievements", description: "Every RamAI achievement — the ones you've unlocked and the ones still to earn." };

export default function Page() {
  return (
    <ClientShell>
      <AchievementsPage />
    </ClientShell>
  );
}
