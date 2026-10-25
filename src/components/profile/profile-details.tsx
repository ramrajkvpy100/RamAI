"use client";

import { useState } from "react";

import { Icon } from "@/components/ui/icon";
import { primeMe, type Me } from "@/lib/me-store";
import { success } from "@/lib/haptics";
import { toast } from "@/lib/toast";

/** Bio, city and college — shown on the profile; city and college place them on the "near me" and "my college" boards. */
export function ProfileDetails({ user }: { user: Me["user"] }) {
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState(user.bio ?? "");
  const [city, setCity] = useState(user.city ?? "");
  const [college, setCollege] = useState(user.college ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const res = await fetch("/api/me/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bio, city, college }) }).catch(() => null);
    setSaving(false);
    if (!res?.ok) return toast("That didn't save — please try again.", { tone: "danger" });
    primeMe((await res.json()) as Me);
    setEditing(false);
    success();
    toast("Profile saved");
  };

  if (!editing) {
    return (
      <div className="mt-2 flex flex-col gap-1">
        {user.bio ? <p className="max-w-md text-[14px] leading-6 text-pretty">{user.bio}</p> : null}
        {(user.city || user.college) && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-fg-2">
            {user.city && <span>📍 {user.city}</span>}
            {user.college && <span>🏥 {user.college}</span>}
          </p>
        )}
        <button type="button" onClick={() => setEditing(true)} className="mt-1 inline-flex w-fit items-center gap-1 text-[12.5px] font-semibold text-accent-text hover:underline">
          <Icon name="plus" size={12} /> {user.bio || user.city || user.college ? "Edit bio, city and college" : "Add a bio, city and college"}
        </button>
      </div>
    );
  }
  const field = "h-10 rounded-xl border border-line bg-surface px-3 text-[14px] outline-none focus:border-accent-line";
  return (
    <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="mt-3 flex w-full max-w-md animate-enter flex-col gap-2">
      <label className="flex flex-col gap-1 text-[12.5px] font-medium text-fg-2">
        Bio
        <textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 160))} rows={2} placeholder="e.g. Final-year MBBS · loves emergency medicine" className="rounded-xl border border-line bg-surface p-3 text-[14px] text-fg outline-none focus:border-accent-line" />
        <span className="self-end text-[11px] text-fg-3 tabular">{bio.length}/160</span>
      </label>
      <label className="flex flex-col gap-1 text-[12.5px] font-medium text-fg-2">
        City
        <input value={city} onChange={(e) => setCity(e.target.value.slice(0, 60))} placeholder="e.g. Jaipur" className={field} autoComplete="address-level2" />
      </label>
      <label className="flex flex-col gap-1 text-[12.5px] font-medium text-fg-2">
        College or hospital
        <input value={college} onChange={(e) => setCollege(e.target.value.slice(0, 100))} placeholder="e.g. SMS Medical College" className={field} />
      </label>
      <p className="text-[11.5px] text-fg-3">City and college put you on the “Near me” and “My college” leaderboards. Leave them blank to stay off.</p>
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="h-10 rounded-full bg-accent px-5 text-[14px] font-semibold text-on-accent disabled:opacity-60">{saving ? "Saving…" : "Save"}</button>
        <button type="button" onClick={() => setEditing(false)} className="h-10 rounded-full px-4 text-[14px] font-medium text-fg-2">Cancel</button>
      </div>
    </form>
  );
}
