"use client";

import { useState } from "react";

import { Icon } from "@/components/ui/icon";
import type { CaseRewards, CaseScore } from "@/engine/types";
import { enableReminders, useReminders } from "@/lib/app-install";
import { dailyNumber, shareResult, shareText, squares } from "@/lib/daily";
import { useMe } from "@/lib/me-store";

/** After the daily case: your place today and a spoiler-free card to share. */
export function DailyShare({ dayKey, score, minutes, place }: { dayKey: string; score: CaseScore; minutes: number; place?: CaseRewards["daily"] }) {
  const number = dailyNumber(dayKey);
  const [note, setNote] = useState<string | null>(null);
  const me = useMe();
  const reminder = useReminders();
  const [reminded, setReminded] = useState(false);
  const remind = async () => {
    try {
      if ((await enableReminders()) === "on") setReminded(true);
    } catch (err) {
      setNote(err instanceof Error ? err.message : null);
    }
  };
  const share = async () => {
    const how = await shareResult(shareText({ number, score, minutes, url: window.location.origin }));
    setNote(how === "copied" ? "Copied — paste it anywhere" : how === "shared" ? "Shared" : null);
  };
  return (
    <section className="panel mt-6 p-5" aria-labelledby="daily-share-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="daily-share-heading" className="flex items-center gap-2 text-[15px] font-semibold">
          <span className="bg-flame flex h-7 w-7 items-center justify-center rounded-lg text-white">
            <Icon name="calendar" size={15} />
          </span>
          Daily case #{number}
        </h2>
        {place && (
          <span className="text-[13px] font-medium text-fg-2">
            {place.ranked ? (
              <>
                <b className="text-fg tabular">#{place.position}</b> of {place.total} today
              </>
            ) : (
              "Practice — only your first attempt is ranked"
            )}
          </span>
        )}
      </div>
      <pre className="mt-3 font-sans text-[22px] leading-7 tracking-[3px]">{squares(score)}</pre>
      <p className="mt-1 text-[12px] text-fg-3">No spoilers: the squares show how each part of the case went — never the diagnosis.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void share()} className="bg-ai inline-flex h-10 items-center gap-1.5 rounded-full px-5 text-[13.5px] font-semibold text-white shadow-glow">
          <Icon name="send" size={14} /> Share result
        </button>
        {me && !me.user.isGuest && (reminder === "off" || reminded) && (
          <button type="button" onClick={() => void remind()} disabled={reminded} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-surface-2 px-4 text-[13.5px] font-medium text-fg hover:bg-surface-3 disabled:text-success">
            <Icon name={reminded ? "check" : "bell"} size={14} /> {reminded ? "We'll remind you" : "Remind me tomorrow"}
          </button>
        )}
        {note && <span className="text-[12.5px] font-medium text-success">{note}</span>}
      </div>
    </section>
  );
}
