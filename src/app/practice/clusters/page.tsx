import type { Metadata } from "next";

import { ClientShell } from "@/components/app/client-shell";
import { Clusters } from "@/components/games/clusters";

export const metadata: Metadata = { title: "Clusters", description: "Group medical concepts that belong together." };

export default function Page() {
  return (
    <ClientShell publicPage>
      <div className="mx-auto w-full max-w-2xl">
        <Clusters />
      </div>
    </ClientShell>
  );
}
