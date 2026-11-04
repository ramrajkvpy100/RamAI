import type { Metadata } from "next";

import { ClientShell } from "@/components/app/client-shell";
import { ToolsHub } from "@/components/tools/tools-hub";

export const metadata: Metadata = { title: "Learning Tools", description: "Mnemonics, flowcharts, lecture summaries, smart notes and the latest guidelines." };

export default function Page() {
  return (
    <ClientShell publicPage>
      <div className="mx-auto w-full max-w-2xl">
        <ToolsHub />
      </div>
    </ClientShell>
  );
}
