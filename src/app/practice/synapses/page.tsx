import type { Metadata } from "next";

import { ClientShell } from "@/components/app/client-shell";
import { Synapses } from "@/components/games/synapses";

export const metadata: Metadata = { title: "Synapses", description: "Group medical concepts that belong together." };

export default function Page() {
  return (
    <ClientShell publicPage>
      <div className="mx-auto w-full max-w-2xl">
        <Synapses />
      </div>
    </ClientShell>
  );
}
