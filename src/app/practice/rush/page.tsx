import type { Metadata } from "next";

import { ClientShell } from "@/components/app/client-shell";
import { ImageRush } from "@/components/games/image-rush";

export const metadata: Metadata = { title: "Image Rush", description: "A 60-second spotter blitz on real medical images." };

export default function Page() {
  return (
    <ClientShell publicPage>
      <div className="mx-auto w-full max-w-2xl">
        <ImageRush />
      </div>
    </ClientShell>
  );
}
