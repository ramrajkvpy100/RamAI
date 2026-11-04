import type { Metadata } from "next";

import { ClientShell } from "@/components/app/client-shell";
import { ResearchTool } from "@/components/tools/research";

export const metadata: Metadata = { title: "Latest Research", description: "Guideline updates and trial pearls, with what changes at the bedside." };

export default function Page() {
  return (
    <ClientShell publicPage>
      <div className="mx-auto w-full max-w-2xl">
        <ResearchTool />
      </div>
    </ClientShell>
  );
}
