"use client";

import { useEffect, useState } from "react";

import { AvatarFace } from "@/components/game/avatar-face";
import { LookChoice } from "@/components/game/look-choice";
import { PersonaAvatar } from "@/components/game/specialist-avatar";
import { Sheet } from "@/components/ui/sheet";
import { SlidingPill } from "@/components/ui/motion-primitives";
import { personaParts, PERSONAS, PHOTO, type AvatarStyle, type PersonaSex } from "@/lib/avatar-style";
import { rankFor } from "@/engine/progression";
import { cn } from "@/lib/cn";
import { success, tap } from "@/lib/haptics";
import { primeMe, useMe, type Me } from "@/lib/me-store";

/** What's selected: a persona's id, "photo", or null for no persona (the cartoon they made, or the rank picture). */
type Choice = string | null;

const LINES: Record<string, string> = {
  "er-resus": "First hands on every crash.",
  "interventional-cardiologist": "Door to balloon, every minute counted.",
  "neuro-intensivist": "Guards the brain through the storm.",
  "trauma-surgeon": "The golden hour is yours.",
  "pediatric-healer": "Small patients, big smiles.",
  "clinical-detective": "The answer is in the history.",
  "toxicology-specialist": "Knows every poison and its antidote.",
  "maternal-fetal-guardian": "Two patients, one steady pair of hands.",
  "icu-night-owl": "Awake when the numbers turn.",
  "radiology-ace": "Sees what everyone else missed.",
  "infectious-disease-hunter": "Tracks the bug to its source.",
  "master-clinician": "Bedside wisdom, earned.",
  "airway-guardian": "Every breath is safe with you.",
  "rural-frontliner": "The whole hospital, in one doctor.",
  "bone-setter": "Puts people back together.",
  "mind-listener": "Heals by hearing.",
};
const NAME = new Map<string, string>(PERSONAS.map((p) => [p.id, p.name]));

function Tile({ on, label, onPick, children }: { on: boolean; label: string; onPick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onPick} className={cn("relative isolate flex min-h-[104px] flex-col items-center gap-1.5 rounded-2xl px-1 pt-2.5 pb-2 text-center text-[11px] leading-[1.2] font-medium", on ? "text-accent-text" : "text-fg-2")}>
      {on && <SlidingPill id="persona-choice" className="rounded-2xl bg-accent-soft ring-1 ring-accent-line" />}
      {children}
      <span className="w-full">{label}</span>
    </button>
  );
}

/** Choose how you appear: sixteen medical personas, your Google photo, or the cartoon you already made. Loaded only when opened. */
export function AvatarPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useMe();
  const current = me?.avatar;
  const [choice, setChoice] = useState<Choice>(current?.persona ?? null);
  const [sex, setSex] = useState<PersonaSex>(() => (current?.persona && current.persona !== PHOTO ? personaParts(current.persona).sex : undefined) ?? "m");
  const [photo, setPhoto] = useState<string | null>(current?.persona === PHOTO ? (current.photo ?? null) : null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cartoon = current && !current.auto ? current : null;
  const tier = me ? rankFor(me.progress.rating).tier : 1;

  useEffect(() => {
    if (!open) return;
    setChoice(me?.avatar?.persona ?? null);
    setError(null);
    if (me?.user.isGuest) return;
    let live = true;
    fetch("/api/me/avatar", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { photo?: string | null } | null) => { if (live && d?.photo) setPhoto(d.photo); })
      .catch(() => undefined);
    return () => { live = false; };
    // Only when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pick = (c: Choice) => { tap(); setChoice(c); };
  const unchanged = choice === (current?.persona ?? null);

  const save = async () => {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/me/avatar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ persona: choice }) }).catch(() => null);
    setSaving(false);
    if (!res?.ok) return setError("That didn't save. Please try again.");
    const { style } = (await res.json()) as { style: AvatarStyle | null };
    success();
    if (me) {
      const { avatar: _old, ...rest } = me;
      primeMe((style ? { ...rest, avatar: style } : rest) as Me);
    }
    onClose();
  };

  const name = choice === PHOTO ? "Your Google photo" : choice ? NAME.get(personaParts(choice).id) : cartoon ? "The cartoon you made" : "No avatar";
  const line = choice === PHOTO ? "Other doctors will see it on leaderboards." : choice ? LINES[choice] : cartoon ? "Just as you left it." : "Your rank picture and initials.";

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Choose your avatar"
      placement="responsive"
      footer={
        <button type="button" onClick={() => void save()} disabled={saving || unchanged} className="h-11 w-full rounded-full bg-accent text-[14px] font-semibold text-on-accent transition-opacity disabled:opacity-50">
          {saving ? "Saving…" : "Save"}
        </button>
      }
    >
      <div className="flex items-center gap-4">
        <div key={String(choice)} className="pop-in shrink-0">
          {choice ? (
            <PersonaAvatar persona={choice} photo={photo} size={96} />
          ) : cartoon ? (
            <AvatarFace style={cartoon} size={96} tier={tier} className="rounded-full" />
          ) : (
            <span aria-hidden className="block h-24 w-24 rounded-full bg-surface-3" />
          )}
        </div>
        <div className="min-w-0" aria-live="polite">
          <div className="text-[16px] leading-tight font-semibold tracking-[-0.01em]">{name}</div>
          <div className="mt-1 text-[13px] text-fg-2">{line}</div>
        </div>
      </div>

      <div role="radiogroup" aria-label="Male or female" className="mt-4 flex gap-1 rounded-xl bg-surface-3 p-1 text-[14px] font-semibold">
        {([["m", "Male"], ["f", "Female"]] as const).map(([v, t]) => (
          <button key={v} type="button" role="radio" aria-checked={sex === v} onClick={() => { setSex(v); if (choice && choice !== PHOTO) pick(`${personaParts(choice).id}~${v}` as Choice); }} className={`flex-1 rounded-lg py-2 ${sex === v ? "bg-[var(--surface-solid)] shadow-sm" : "text-fg-2"}`}>{t}</button>
        ))}
      </div>

      <div role="radiogroup" aria-label="Avatar" className="mt-3 grid grid-cols-4 gap-1 sm:grid-cols-5">
        {photo && (
          <Tile on={choice === PHOTO} label="Google photo" onPick={() => pick(PHOTO)}>
            <PersonaAvatar persona={PHOTO} photo={photo} size={56} />
          </Tile>
        )}
        {cartoon && (
          <Tile on={choice === null} label="My cartoon" onPick={() => pick(null)}>
            <AvatarFace style={cartoon} size={56} tier={tier} className="rounded-full" />
          </Tile>
        )}
        {PERSONAS.map((p) => (
          <Tile key={p.id} on={!!choice && choice !== PHOTO && personaParts(choice).id === p.id} label={p.name.replace("Interventional", "Inter\u00ADventional").replace("Resuscitationist", "Resusci\u00ADtationist")} onPick={() => pick(`${p.id}~${sex}` as Choice)}>
            <PersonaAvatar persona={`${p.id}~${sex}`} size={56} />
          </Tile>
        ))}
        {!cartoon && current?.persona && (
          <Tile on={choice === null} label="No avatar" onPick={() => pick(null)}>
            <span aria-hidden className="block h-14 w-14 rounded-full bg-surface-3" />
          </Tile>
        )}
      </div>

      {!cartoon && choice === null && (
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3 text-[13px] text-fg-2">
          <span>Doctor in your rank pictures</span>
          <LookChoice />
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-[13px] text-danger">{error}</p>}
    </Sheet>
  );
}
