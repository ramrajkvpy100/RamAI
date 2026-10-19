import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { InviteAdmin } from "@/components/access/invite-admin";
import { AppShell } from "@/components/app/app-shell";
import { getMe } from "@/server/me";
import { isAdmin } from "@/server/suggestions";
import { getCurrentUser } from "@/server/auth";

export const metadata: Metadata = { title: "Invites · Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Invite codes and allowed emails — the owner's page. */
export default async function AccessAdminPage() {
  const me = await getMe();
  if (!me) redirect("/login?next=/admin/access");
  const user = await getCurrentUser();
  if (!user || !(await isAdmin(user))) notFound();
  return (
    <AppShell me={me}>
      <InviteAdmin />
    </AppShell>
  );
}
