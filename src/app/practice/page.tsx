import type { Metadata } from "next";

import { SkillsLab } from "@/components/practice/skills-lab";
import { PublicPage } from "@/components/shell/public-page";
import { getCurrentUser } from "@/server/auth";
import { practiceStats } from "@/server/practice";

export const metadata: Metadata = { title: "Skills Lab", description: "Spot the diagnosis on real ECGs, X-rays, CT and ultrasound; report real radiology studies; antidotes, emergency algorithms and clinical calculations." };
export const dynamic = "force-dynamic";

/** Image-recognition drills — open to everyone; scores are kept for anyone with a session. */
export default async function PracticePage() {
  const user = await getCurrentUser().catch(() => null);
  const stats = user ? await practiceStats(user.id) : [];
  return (
    <PublicPage>
      <div className="mx-auto w-full max-w-4xl">
        <SkillsLab stats={stats} />
      </div>
    </PublicPage>
  );
}
