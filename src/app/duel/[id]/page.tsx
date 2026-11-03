import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DuelCard } from "@/components/duel/duel-card";
import { DuelInvite } from "@/components/duel/duel-invite";
import { PublicPage } from "@/components/shell/public-page";
import { getCurrentUser } from "@/server/auth";
import { duelInvite } from "@/server/duels";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const invite = /^[a-f0-9]{12}$/.test(id) ? await duelInvite(id).catch(() => null) : null;
  return { title: invite ? `${invite.host} challenges you` : "Duel", description: "Same patient, two doctors — who scores higher?" };
}

/** A duel invite: the friend's challenge — play the same patient. */
export default async function DuelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9]{12}$/.test(id)) notFound();
  const invite = await duelInvite(id).catch(() => null);
  if (!invite) notFound();
  const user = await getCurrentUser().catch(() => null);
  return (
    <PublicPage>
      {user && (user.id === invite.hostId || user.id === invite.guestId) && !(invite.open && user.id !== invite.hostId) ? <DuelCard id={id} className="mx-auto mt-10 max-w-md" /> : <DuelInvite id={id} host={invite.host} open={invite.open} score={invite.hostScore} />}
    </PublicPage>
  );
}
