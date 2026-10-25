"use client";

import { Rich } from "@/components/ui/rich-lines";
import { EmptyState } from "@/components/ui/primitives";
import { removeCard, restoreCard, useDeck } from "@/lib/revision-deck";
import { tap } from "@/lib/haptics";
import { toast } from "@/lib/toast";

/** The takeaways saved from debriefs — newest first, each removable (with Undo). */
export function RevisionDeck() {
  const cards = useDeck();
  return (
    <div className="flex flex-col gap-5 py-6">
      <header>
        <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Revision deck</h1>
        <p className="mt-1 text-[14.5px] text-fg-2">Takeaways and pearls you saved from your cases. Kept on this phone.</p>
      </header>
      {cards.length === 0 ? (
        <EmptyState icon="book" title="No cards yet" body="After a case, tap ＋ Deck next to a takeaway or pearl to save it here." action={{ label: "Play a case", href: "/cases" }} />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {[...cards].reverse().map((c, i) => (
            <li key={c.id} className="card flex animate-rise items-start gap-3 p-4" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] leading-6"><Rich text={c.text} /></p>
                <p className="mt-1 text-[12px] text-fg-3">{c.from}</p>
              </div>
              <button type="button" onClick={() => { tap(); removeCard(c.id); toast("Removed from your deck", { tone: "info", action: { label: "Undo", run: () => restoreCard(c) } }); }} aria-label="Remove" className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium text-fg-3 hover:bg-surface-3 hover:text-fg">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
