import type { Metadata } from "next";

import { ClientShell } from "@/components/app/client-shell";
import { Detective } from "@/components/games/detective";

export const metadata: Metadata = { title: "Case Detective", description: "Solve medical mysteries by connecting clues." };

export default function Page() {
  return (
    <ClientShell publicPage>
      <div className="mx-auto w-full max-w-2xl">
        <Detective />
      </div>
    </ClientShell>
  );
}
