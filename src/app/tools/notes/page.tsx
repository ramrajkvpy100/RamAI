import type { Metadata } from "next";

import { ClientShell } from "@/components/app/client-shell";
import { NotesTool } from "@/components/tools/notes";

export const metadata: Metadata = { title: "Smart Notes", description: "Turn your notes into flashcards, questions and concept maps." };

export default function Page() {
  return (
    <ClientShell publicPage>
      <div className="mx-auto w-full max-w-2xl">
        <NotesTool />
      </div>
    </ClientShell>
  );
}
