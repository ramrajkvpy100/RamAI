import { notFound } from "next/navigation";

import { MysteryBox } from "@/components/game/mystery-box";

/** Development only: the mystery box with a promotion and a badge in it. */
export default function BoxPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <MysteryBox
      storageKey={`dev-box-${Date.now()}`}
      prizes={[
        { kind: "rank", label: "Junior Resident", tier: 3 },
        { kind: "badge", label: "Sharp eye", description: "Diagnosed five cases correctly in a row." },
      ]}
    />
  );
}
