"use client";

import { EmptyState } from "@/components/ui/primitives";
import type { CaseState } from "@/engine/types";
import { money } from "@/lib/format";

import { ResultCard } from "./result-card";

export function ResultsList({ state, highlightIds }: { state: CaseState; highlightIds: Set<string> }) {
  const items = [...state.investigations].sort((a, b) => (a.status === b.status ? b.orderedAt - a.orderedAt : a.status === "pending" ? -1 : 1));
  if (items.length === 0) return <EmptyState title="No investigations" body="Tests you request will appear here." />;
  const spend = state.investigations.reduce((s, i) => s + (i.cost ?? 0), 0);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-[11.5px] text-fg-2">
        <span>{items.filter((i) => i.status === "pending").length} pending</span>
        <span className="tabular">Spent {money(spend, state.country)}</span>
      </div>
      {items.map((inv) => (
        <ResultCard key={inv.id} inv={inv} arrivalMinuteOfDay={state.arrivalMinuteOfDay} now={state.clock} country={state.country} highlight={highlightIds.has(inv.id)} />
      ))}
    </div>
  );
}
