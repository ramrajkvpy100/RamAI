import type { Metadata } from "next";

import { ClientShell } from "@/components/app/client-shell";
import { YoutubeTool } from "@/components/tools/youtube";

export const metadata: Metadata = { title: "Lecture Summaries", description: "Turn long medical videos into bite-sized study summaries." };

export default function Page() {
  return (
    <ClientShell publicPage>
      <div className="mx-auto w-full max-w-2xl">
        <YoutubeTool />
      </div>
    </ClientShell>
  );
}
