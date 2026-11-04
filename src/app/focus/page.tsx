import type { Metadata } from "next";

import { ClientShell } from "@/components/app/client-shell";
import { FocusTimer } from "@/components/focus/focus-timer";

export const metadata: Metadata = { title: "Focus", description: "A focus timer: grow a medicinal plant in the Clinical Grove, or order a drink and sit in the café." };

export default function FocusPage() {
  return (
    <ClientShell>
      <FocusTimer />
    </ClientShell>
  );
}
