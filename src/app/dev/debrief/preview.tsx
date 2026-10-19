"use client";

import { DebriefView } from "@/components/debrief/debrief-view";
import type { CaseDebrief, CaseState } from "@/engine/types";

export function DebriefPreview({ state, debrief }: { state: CaseState; debrief: CaseDebrief }) {
  return (
    <DebriefView
      session={{ token: "dev", state, debrief, begun: true } as never}
      progress={{ history: [], badges: [], mastery: [], percent: 0, xp: 0, casesCompleted: 0, streakDays: 0, dailyXp: 0, dailyGoal: 50 } as never}
      onNext={() => undefined}
      onHome={() => undefined}
      starting={false}
    />
  );
}
