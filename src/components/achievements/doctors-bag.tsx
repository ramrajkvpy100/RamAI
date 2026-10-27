"use client";

import { useState } from "react";

import { AvatarFace } from "@/components/game/avatar-face";
import { DEFAULT_AVATAR, ITEMS, itemNeed, itemProgress, itemUnlocked, type Extra } from "@/lib/avatar-style";
import { rankFor } from "@/engine/progression";
import { cn } from "@/lib/cn";
import { tap, success } from "@/lib/haptics";
import { primeMe, type Me } from "@/lib/me-store";
import { toast } from "@/lib/toast";

/** The doctor's bag: items collected by playing, each one worn on your avatar with a tap. */
export function DoctorsBag({ me }: { me: Me }) {
  const p = me.progress;
  const avatar = me.avatar ?? DEFAULT_AVATAR;
  const tier = rankFor(p.percent).tier;
  const [saving, setSaving] = useState<Extra | null>(null);
  const got = ITEMS.filter((i) => itemUnlocked(i.id, p));
  const next = ITEMS.find((i) => !itemUnlocked(i.id, p));

  const wear = async (id: Extra) => {
    tap();
    setSaving(id);
    const style = { ...avatar, extra: avatar.extra === id ? "none" : id };
    const res = await fetch("/api/me/avatar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ style }) }).catch(() => null);
    setSaving(null);
    if (!res?.ok) return toast("That didn't save — try again", { tone: "danger" });
    success();
    primeMe({ ...me, avatar: style } as Me);
  };

  return (
    <section aria-labelledby="bag" className="panel p-5">
      <div className="flex items-center gap-3">
        <AvatarFace style={avatar} size={56} tier={tier} className="shrink-0 rounded-full" />
        <div className="min-w-0 flex-1">
          <h2 id="bag" className="text-[17px] font-semibold">🎒 Your doctor&apos;s bag</h2>
          <p className="text-[13px] text-fg-2">{got.length} of {ITEMS.length} collected · tap one to wear it</p>
        </div>
      </div>
      {next && (
        <div className="mt-3 rounded-xl bg-surface-2 px-3 py-2.5">
          <div className="flex items-center justify-between text-[13px]">
            <span>Next: <b>{next.emoji} {next.name}</b></span>
            <span className="text-fg-3">{itemNeed(next.id)}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${Math.round(itemProgress(next.id, p) * 100)}%` }} />
          </div>
        </div>
      )}
      <div className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
        {ITEMS.map((it) => {
          const have = itemUnlocked(it.id, p);
          const on = avatar.extra === it.id;
          return (
            <button
              key={it.id}
              type="button"
              disabled={!have || saving !== null}
              onClick={() => void wear(it.id)}
              aria-pressed={on}
              className={cn(
                "relative flex flex-col items-center gap-1 rounded-2xl border p-2.5 text-center transition-transform active:scale-95",
                on ? "border-amber-400 bg-amber-50 shadow-[0_0_0_3px_rgba(251,191,36,0.25)] dark:bg-amber-400/10" : "border-line bg-surface",
                !have && "opacity-60",
              )}
            >
              <span className={cn("relative", !have && "grayscale")}>
                <AvatarFace style={{ ...avatar, extra: it.id }} size={58} tier={tier} className="rounded-full" />
                <span className="absolute -right-1 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full bg-surface text-[13px] shadow">{have ? it.emoji : "🔒"}</span>
              </span>
              <span className="text-[12px] leading-tight font-semibold">{it.name}</span>
              <span className="text-[10.5px] leading-tight text-fg-3">{have ? (on ? "Wearing ✓" : it.line) : itemNeed(it.id)}</span>
              {saving === it.id && <span className="absolute inset-0 animate-pulse rounded-2xl bg-surface/40" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
