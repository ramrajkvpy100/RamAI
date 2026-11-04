import type { Metadata } from "next";

import { ClientShell } from "@/components/app/client-shell";
import { Probe } from "@/components/games/probe";

export const metadata: Metadata = { title: "Probe", description: "Solve medical mysteries by connecting clues." };

export default function Page() {
  return (
    <ClientShell publicPage>
      <div className="mx-auto w-full max-w-2xl">
        <Probe />
      </div>
    </ClientShell>
  );
}
