import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app/app-shell";
import { Profile } from "@/components/profile/profile";
import { InviteCard } from "@/components/profile/invite-card";
import { creditsLeft, referralCount } from "@/server/credits";
import { getMe } from "@/server/me";

export const metadata: Metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const me = await getMe();
  if (!me) redirect("/login?next=/profile");
  return (
    <AppShell me={me}>
      <Profile initial={me} />
      {!me.user.isGuest && <InviteCard username={me.user.username} credits={await creditsLeft(me.user.id).catch(() => 0)} friends={await referralCount(me.user.id).catch(() => 0)} />}
    </AppShell>
  );
}
