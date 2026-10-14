import { notFound } from "next/navigation";

import { AchievementReveal } from "@/components/game/achievement-reveal";

/** Development only: the achievement reveal with a promotion and a badge. */
export default function RevealPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <AchievementReveal
      storageKey={null}
      prizes={[
        { kind: "rank", label: "Junior Resident", tier: 3 },
        { kind: "badge", id: "sharp-eye", label: "Sharp eye", description: "Diagnosed five cases correctly in a row." },
      ]}
    />
  );
}
