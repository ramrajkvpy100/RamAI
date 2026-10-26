import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app/app-shell";
import { Planner } from "@/components/planner/planner";
import { getMe } from "@/server/me";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Planner", description: "Your most important task, to-dos, habits and an evening review." };

export default async function PlanPage() {
  const me = await getMe();
  if (!me) redirect("/");
  return (
    <AppShell me={me}>
      <Planner />
    </AppShell>
  );
}
