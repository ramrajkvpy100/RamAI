import type { Metadata } from "next";

import { ClientShell } from "@/components/app/client-shell";
import { Planner } from "@/components/planner/planner";

// Per-request (the page carries this visit's security nonce) — but it waits on nothing.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Planner", description: "Your most important task, to-dos, habits and an evening review." };

export default function PlanPage() {
  return (
    <ClientShell>
      <Planner />
    </ClientShell>
  );
}
