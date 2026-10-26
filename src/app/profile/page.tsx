import type { Metadata } from "next";

import { ClientShell } from "@/components/app/client-shell";
import { ProfilePage } from "@/components/profile/profile-page";

// Per-request (the page carries this visit's security nonce) — but it waits on nothing.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Profile" };

export default function Page() {
  return (
    <ClientShell>
      <ProfilePage />
    </ClientShell>
  );
}
