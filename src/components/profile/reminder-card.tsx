"use client";

import { useEffect, useState } from "react";

import { Switch } from "@/components/app/app-options";
import { disableReminders, nativeReminderOn, reminderTime, setNativeReminder, turnOnReminders, usesNativeReminder, useReminders } from "@/lib/app-install";
import { useMe } from "@/lib/me-store";

/** The reminder's switch, on the profile too. The same route on every button: the Android app's own, or Web Push. */
export function ReminderCard() {
  const me = useMe();
  const web = useReminders();
  const [native, setNative] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    if (usesNativeReminder()) setNative(nativeReminderOn());
  }, []);
  if (!me || me.user.isGuest) return null;
  const on = native ?? web === "on";
  const blocked = native === null && web === "blocked";
  const change = async (want: boolean) => {
    setBusy(true);
    setNote(null);
    try {
      if (native !== null) {
        await setNativeReminder(want);
        setNative(want);
      } else if (want) {
        if ((await turnOnReminders()) === "blocked") setNote("Notifications are blocked for RamAI. Turn them on in your phone's settings, then try again.");
      } else await disableReminders();
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Couldn't change that. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  if (native === null && !["on", "off", "blocked"].includes(web)) return null;
  return (
    <section className="panel flex items-center gap-4 p-5" aria-label="Clinical reminders">
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-semibold">Enable Clinical Reminders</h2>
        <p className="mt-0.5 text-[13px] leading-5 text-fg-2">{blocked ? "Notifications are blocked for RamAI. Turn them on in your phone's settings." : `Today's case, at about ${reminderTime()}, only on days you haven't played. Change the time in the menu.`}</p>
        {note && <p role="alert" className="mt-1 text-[12.5px] text-danger">{note}</p>}
      </div>
      {!blocked && <Switch on={on} busy={busy} label="Clinical reminders" onChange={(v) => void change(v)} />}
    </section>
  );
}
