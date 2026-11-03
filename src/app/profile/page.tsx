import type { Metadata } from "next";

import { ClientShell } from "@/components/app/client-shell";
import { ProfilePage } from "@/components/profile/profile-page";

export const metadata: Metadata = { title: "Profile" };

export default function Page() {
  return (
    <ClientShell>
      <ProfilePage />
    </ClientShell>
  );
}
