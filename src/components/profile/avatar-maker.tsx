"use client";

import { useState } from "react";

import { AvatarFace } from "@/components/game/avatar-face";
import { BGS, DEFAULT_AVATAR, EXTRA, EYES, HAIR, HAIR_COLORS, MOUTH, SKIN, type AvatarStyle } from "@/lib/avatar-style";
import { cn } from "@/lib/cn";
import { primeMe, useMe, type Me } from "@/lib/me-store";

const TABS = ["Skin", "Hair", "Colour", "Eyes", "Mouth", "Extra", "Background"] as const;
type Tab = (typeof TABS)[number];

const LABEL: Record<string, string> = {
  short: "Short", side: "Side part", long: "Long", bun: "Bun", curly: "Curly", bald: "Bald", hijab: "Hijab",
  round: "Round", happy: "Happy", wink: "Wink", sleepy: "Sleepy",
  smile: "Smile", grin: "Grin", calm: "Calm", open: "Surprised",
  none: "None", glasses: "Glasses", stethoscope: "Stethoscope", cap: "Surgical cap", mask: "Mask", headlight: "Head light",
};

/** Make your own avatar, piece by piece — every change shows at once; Save keeps it on every device. */
export function AvatarMaker({ onClose }: { onClose: () => void }) {
  const me = useMe();
  const [a, setA] = useState<AvatarStyle>(me?.avatar ?? DEFAULT_AVATAR);
  const [tab, setTab] = useState<Tab>("Hair");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<AvatarStyle>) => setA((x) => ({ ...x, ...patch }));
  const random = () =>
    setA({
      skin: Math.floor(Math.random() * SKIN.length),
      hair: HAIR[Math.floor(Math.random() * HAIR.length)]!,
      hairColor: Math.floor(Math.random() * HAIR_COLORS.length),
      eyes: EYES[Math.floor(Math.random() * EYES.length)]!,
      mouth: MOUTH[Math.floor(Math.random() * MOUTH.length)]!,
      extra: EXTRA[Math.floor(Math.random() * EXTRA.length)]!,
      bg: Math.floor(Math.random() * BGS.length),
    });

  const save = async () => {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/me/avatar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ style: a }) }).catch(() => null);
    setSaving(false);
    if (!res?.ok) return setError("That didn't save. Please try again.");
    if (me) primeMe({ ...me, avatar: a } as Me);
    onClose();
  };

  const swatches = (colors: string[], value: number, pick: (i: number) => void) => (
    <div className="flex flex-wrap gap-2.5">
      {colors.map((c, i) => (
        <button key={c} type="button" aria-label={`Colour ${i + 1}`} aria-pressed={value === i} onClick={() => pick(i)} className={cn("h-11 w-11 rounded-full ring-offset-2 ring-offset-surface transition-transform active:scale-90", value === i ? "ring-[3px] ring-accent" : "ring-1 ring-line")} style={{ background: c }} />
      ))}
    </div>
  );
  const pieces = <K extends keyof AvatarStyle>(key: K, values: readonly AvatarStyle[K][]) => (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {values.map((v) => (
        <button key={String(v)} type="button" aria-pressed={a[key] === v} onClick={() => set({ [key]: v } as Partial<AvatarStyle>)} className={cn("flex flex-col items-center gap-1 rounded-2xl border p-2 text-[11.5px] font-medium transition-transform active:scale-95", a[key] === v ? "border-accent-line bg-accent-soft text-accent-text" : "border-line bg-surface hover:bg-surface-2")}>
          <AvatarFace style={{ ...a, [key]: v }} size={52} />
          {LABEL[String(v)] ?? String(v)}
        </button>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 sm:items-center" role="dialog" aria-label="Make your avatar">
      <div className="flex max-h-[92dvh] w-full max-w-lg animate-enter flex-col overflow-hidden rounded-t-3xl bg-surface shadow-2xl sm:rounded-3xl">
        <div className="flex flex-col items-center gap-3 bg-[radial-gradient(60%_80%_at_50%_0%,var(--accent-soft),transparent)] px-5 pt-6 pb-4">
          <div key={JSON.stringify(a)} className="animate-pop">
            <AvatarFace style={a} size={128} className="drop-shadow-xl" />
          </div>
          <button type="button" onClick={random} className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-[12.5px] font-semibold hover:bg-surface-2">🎲 Surprise me</button>
        </div>
        <div className="flex gap-1 overflow-x-auto border-y border-line px-3 py-2 whitespace-nowrap">
          {TABS.map((t) => (
            <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)} className={cn("rounded-full px-3.5 py-1.5 text-[13px] font-medium", tab === t ? "bg-fg text-bg" : "text-fg-2 hover:bg-surface-2")}>
              {t}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {tab === "Skin" && swatches(SKIN, a.skin, (i) => set({ skin: i }))}
          {tab === "Hair" && pieces("hair", HAIR)}
          {tab === "Colour" && swatches(HAIR_COLORS, a.hairColor, (i) => set({ hairColor: i }))}
          {tab === "Eyes" && pieces("eyes", EYES)}
          {tab === "Mouth" && pieces("mouth", MOUTH)}
          {tab === "Extra" && pieces("extra", EXTRA)}
          {tab === "Background" && swatches(BGS, a.bg, (i) => set({ bg: i }))}
        </div>
        {error && <p className="px-4 text-[13px] text-danger">{error}</p>}
        <div className="flex gap-2 border-t border-line p-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          <button type="button" onClick={onClose} className="h-11 flex-1 rounded-full border border-line text-[14px] font-medium hover:bg-surface-2">Cancel</button>
          <button type="button" onClick={() => void save()} disabled={saving} className="h-11 flex-1 rounded-full bg-accent text-[14px] font-semibold text-on-accent disabled:opacity-60">{saving ? "Saving…" : "Save avatar"}</button>
        </div>
      </div>
    </div>
  );
}
