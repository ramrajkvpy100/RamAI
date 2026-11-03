import type { Metadata } from "next";

import { ClientShell } from "@/components/app/client-shell";
import { FocusTimer } from "@/components/focus/focus-timer";

export const metadata: Metadata = { title: "Focus timer", description: "A calm 25-minute focus timer for study, with short breaks — kept on your phone." };

export default function FocusPage() {
  return (
    <ClientShell>
      <FocusTimer />
    </ClientShell>
  );
}
