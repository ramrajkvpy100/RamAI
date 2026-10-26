import type { Metadata } from "next";

import { ClientShell } from "@/components/app/client-shell";
import { RevisionDeck } from "@/components/practice/revision-deck";

// Per-request (the page carries this visit's security nonce) — but it waits on nothing.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Revision deck" };

/** Kept on the phone: nothing to wait for from the server. */
export default function RevisionPage() {
  return (
    <ClientShell>
      <RevisionDeck />
    </ClientShell>
  );
}
