import type { Metadata } from "next";

import { InviteGate } from "@/components/access/invite-gate";

export const metadata: Metadata = { title: "Invite only", robots: { index: false, follow: false } };

/** RamAI is invite-only: enter a code, or sign in with an invited account. */
export default async function InvitePage({ searchParams }: { searchParams: Promise<{ next?: string; need?: string }> }) {
  const { next, need } = await searchParams;
  return <InviteGate next={next && next.startsWith("/") && !next.startsWith("//") ? next : "/"} signedInNeedsCode={need === "1"} />;
}
