import type { Metadata } from "next";

import { SkillsLab } from "@/components/practice/skills-lab";
import { ClientShell } from "@/components/app/client-shell";

export const metadata: Metadata = { title: "Skills Lab", description: "Spot the diagnosis on real ECGs, X-rays, CT and ultrasound; report real radiology studies; antidotes, emergency algorithms and clinical calculations." };

/** Image-recognition drills — open to everyone; scores are kept for anyone with a session. */
export default function PracticePage() {
  return (
    <ClientShell publicPage>
      <div className="mx-auto w-full max-w-4xl">
        <SkillsLab />
      </div>
    </ClientShell>
  );
}
