import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app/app-shell";
import { ProgressView } from "@/components/progress/progress-view";
import { getMe } from "@/server/me";
import { progressDetail } from "@/server/progress-detail";
import { savedReport } from "@/server/report";

export const metadata: Metadata = { title: "Progress" };
export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const me = await getMe();
  if (!me) redirect("/");
  const [detail, report] = await Promise.all([progressDetail(me.user.id), savedReport(me.user.id)]);
  return (
    <AppShell me={me} wide>
      <ProgressView detail={detail} report={report} />
    </AppShell>
  );
}
