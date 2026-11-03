import type { Metadata } from "next";

import { ClientShell } from "@/components/app/client-shell";
import { RevisionDeck } from "@/components/practice/revision-deck";

export const metadata: Metadata = { title: "Revision deck" };

/** Kept on the phone: nothing to wait for from the server. */
export default function RevisionPage() {
  return (
    <ClientShell>
      <RevisionDeck />
    </ClientShell>
  );
}
