"use client";

import { useEffect, useState } from "react";

import { useMe } from "@/lib/me-store";

import { InviteCard } from "./invite-card";
import { Profile } from "./profile";

type Invite = { username: string; credits: number; friends: number; code: string | null; left: number };

/** The profile, drawn at once; the invite card follows when its numbers arrive. */
export function ProfilePage() {
  const me = useMe();
  const [invite, setInvite] = useState<Invite | null>(null);
  useEffect(() => {
    fetch("/api/me/invite", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => setInvite(j?.invite ?? null)).catch(() => undefined);
  }, []);
  if (!me) return null;
  return (
    <>
      <Profile initial={me} />
      {invite && <InviteCard {...invite} />}
    </>
  );
}
