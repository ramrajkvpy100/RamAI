import type { Metadata } from "next";

import { ClientShell } from "@/components/app/client-shell";
import { Planner } from "@/components/planner/planner";

export const metadata: Metadata = { title: "Planner", description: "Your most important task, to-dos, habits and an evening review." };

export default function PlanPage() {
  return (
    <ClientShell>
      <Planner />
    </ClientShell>
  );
}
