"use client";

import { ClientShell } from "@/components/app/client-shell";
import { Hub } from "@/components/home/hub";
import { useMe } from "@/lib/me-store";

/** A signed-in doctor's home, drawn from what the phone knows. */
export function HomeShell() {
  return (
    <ClientShell wide signedOut="/?landing=1">
      <HubNow />
    </ClientShell>
  );
}

function HubNow() {
  const me = useMe();
  return me ? <Hub initial={me} /> : null;
}
