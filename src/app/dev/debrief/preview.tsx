"use client";

import { DebriefView } from "@/components/debrief/debrief-view";
import type { CaseDebrief, CaseState } from "@/engine/types";

export function DebriefPreview({ state, debrief }: { state: CaseState; debrief: CaseDebrief }) {
  return (
    <DebriefView
      session={{ token: "dev", state, debrief, begun: true, rewards: { xp: 120, streakDays: 3, streakExtended: true, dailyXp: 120, dailyGoal: 150, rankBefore: "Senior Resident", rankAfter: "Senior Resident", newBadges: [], rating: { before: 1480, after: 1508, delta: 28, caseRating: 1650, expected: 0.27, score: 89 } } } as never}
      progress={{ history: [], badges: [], mastery: [], percent: 0, xp: 0, casesCompleted: 0, streakDays: 0, dailyXp: 0, dailyGoal: 50 } as never}
      onNext={() => undefined}
      onHome={() => undefined}
      starting={false}
    />
  );
}
