import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app/app-shell";
import { Profile } from "@/components/profile/profile";
import { InviteCard } from "@/components/profile/invite-card";
import { creditsLeft, personalInvite, referralCount } from "@/server/credits";
import { getMe } from "@/server/me";

export const metadata: Metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const me = await getMe();
  if (!me) redirect("/login?next=/profile");
  // Together, not one after another: each is a trip to the database.
  const invite = me.user.isGuest
    ? null
    : await Promise.all([creditsLeft(me.user.id).catch(() => 0), referralCount(me.user.id).catch(() => 0), personalInvite(me.user.username).catch(() => ({ code: null, left: 0 }))]);
  return (
    <AppShell me={me}>
      <Profile initial={me} />
      {invite && <InviteCard username={me.user.username} credits={invite[0]} friends={invite[1]} {...invite[2]} />}
    </AppShell>
  );
}
