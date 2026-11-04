import type { Metadata } from "next";

import { ClientShell } from "@/components/app/client-shell";
import { MnemonicsTool } from "@/components/tools/mnemonics";

export const metadata: Metadata = { title: "Visual Mnemonics", description: "High-yield visual mnemonics, or make one for any topic." };

export default function Page() {
  return (
    <ClientShell publicPage>
      <div className="mx-auto w-full max-w-2xl">
        <MnemonicsTool />
      </div>
    </ClientShell>
  );
}
