import type { Metadata } from "next";

import { ClientShell } from "@/components/app/client-shell";
import { FlowchartsTool } from "@/components/tools/flowcharts";

export const metadata: Metadata = { title: "Flowcharts", description: "Clinical decision flowcharts on demand, and flashcards from them." };

export default function Page() {
  return (
    <ClientShell publicPage>
      <div className="mx-auto w-full max-w-2xl">
        <FlowchartsTool />
      </div>
    </ClientShell>
  );
}
