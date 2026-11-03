import type { Metadata } from "next";

import { ClientShell } from "@/components/app/client-shell";
import { FocusTimer } from "@/components/focus/focus-timer";

export const metadata: Metadata = { title: "Clinical Grove", description: "A focus timer that grows a medicinal plant while you study, with a garden of every session you complete." };

export default function FocusPage() {
  return (
    <ClientShell>
      <FocusTimer />
    </ClientShell>
  );
}
