import type { Metadata } from "next";

import { PracticeDrill } from "@/components/practice/practice-drill";
import { PublicPage } from "@/components/shell/public-page";
import { getCurrentUser } from "@/server/auth";
import { practiceStats } from "@/server/practice";

export const metadata: Metadata = { title: "Practice", description: "Spot the diagnosis on real ECGs, X-rays, CT scans, ultrasound and blood smears — at your own pace or rapid-fire." };
export const dynamic = "force-dynamic";

/** Image-recognition drills — open to everyone; scores are kept for anyone with a session. */
export default async function PracticePage() {
  const user = await getCurrentUser().catch(() => null);
  const stats = user ? await practiceStats(user.id) : [];
  return (
    <PublicPage>
      <div className="mx-auto w-full max-w-4xl">
        <PracticeDrill stats={stats} />
      </div>
    </PublicPage>
  );
}
