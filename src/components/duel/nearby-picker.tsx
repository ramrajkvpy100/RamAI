"use client";

import { PersonaAvatar } from "@/components/game/specialist-avatar";
import type { PublicAvatar } from "@/lib/avatar-style";
import { useCallback, useEffect, useState } from "react";

import { Avatar } from "@/components/game/avatar";
import { SlidingPill } from "@/components/ui/motion-primitives";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import { tap } from "@/lib/haptics";
import { primeMe, type Me } from "@/lib/me-store";
import { filterDoctors, formatDistance, formatSeen, NEARBY_FILTERS, type NearbyFilter, type NearbyView } from "@/lib/nearby-geo";
import { toast } from "@/lib/toast";

import { Radar } from "./radar";
import { usePresence } from "./use-presence";

type NearbyRow = NearbyView & { avatar?: PublicAvatar };
interface Data { sharing: boolean; hidden: boolean; doctors: NearbyRow[]; city?: NearbyRow[]; place?: string; needs?: "location" | "account" }

const POLL_MS = 30_000;

const lastPlayed = (t: number | null) => {
  if (!t) return "hasn't played yet";
  const m = Math.round((Date.now() - t) / 60_000);
  return m < 60 ? `played ${Math.max(1, m)} min ago` : m < 1440 ? `played ${Math.round(m / 60)} h ago` : `played ${Math.round(m / 1440)} d ago`;
};

/** "Near me": doctors around you, live, with one tap to play the same patient. They play it when they open it. */
export function NearbyPicker({ open, onClose, onChallenge, starting }: { open: boolean; onClose: () => void; onChallenge: (ids: string[]) => void; starting: boolean }) {
  const [data, setData] = useState<Data | null>(null);
  const [cityList, setCityList] = useState<NearbyRow[]>([]);
  const [chosen, setChosen] = useState<NearbyFilter | null>(null);
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [asked, setAsked] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const sharing = !!data?.sharing;
  const { status, accuracyM } = usePresence(open && sharing, () => setReload((n) => n + 1));

  const load = useCallback(async (liveOnly: boolean) => {
    const res = await fetch(`/api/duels/nearby${liveOnly ? "?scope=live" : ""}`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return null;
    return (await res.json()) as Data;
  }, []);

  useEffect(() => {
    if (!open) return;
    let live = true;
    void load(false).then((d) => {
      if (!live) return;
      setData(d ?? { sharing: false, hidden: false, doctors: [] });
      setCityList(d?.city ?? []);
    });
    return () => { live = false; };
  }, [open, reload, load]);

  // Who's around changes: look again while this is on screen, and straight away once the first heartbeat is in.
  useEffect(() => {
    if (!open || !sharing || status !== "live") return;
    let live = true;
    const refresh = () => {
      if (document.hidden) return;
      void load(true).then((d) => { if (live && d) setData((was) => (was ? { ...was, sharing: d.sharing, doctors: d.doctors } : d)); });
    };
    refresh();
    const t = window.setInterval(refresh, POLL_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => { live = false; window.clearInterval(t); document.removeEventListener("visibilitychange", refresh); };
  }, [open, sharing, status, load]);

  const stop = useCallback(async () => {
    setBusy(true);
    const res = await fetch("/api/location/heartbeat", { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (!res?.ok) { toast("Couldn't stop sharing. Check your connection and try again.", { tone: "danger" }); return false; }
    setData((d) => d && { ...d, sharing: false, doctors: [] });
    return true;
  }, []);

  // The phone refused: nothing was shared, so take the yes back too.
  useEffect(() => {
    if (status !== "denied" && status !== "unavailable") return;
    void stop().then((done) => { if (done) setNote(status === "denied" ? "Location is blocked for RamAI, so nothing was shared. Allow it in your phone's settings to use this, or use My City." : "This phone can't share its location. You can still use My City."); });
  }, [status, stop]);

  const turnOn = async () => {
    tap();
    setBusy(true);
    setNote(null);
    const res = await fetch("/api/location/heartbeat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ consent: true }) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return toast("Couldn't turn that on. Try again.", { tone: "danger" });
    setChosen(null);
    setData((d) => d && { ...d, sharing: true, hidden: false });
  };
  const setHidden = async (hidden: boolean) => {
    setBusy(true);
    const res = await fetch("/api/duels/nearby", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hidden }) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return toast("Couldn't save that. Try again.", { tone: "danger" });
    setData((d) => d && { ...d, hidden, sharing: false, doctors: [] });
  };
  const saveCity = async () => {
    setBusy(true);
    const res = await fetch("/api/me/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ city: city.trim() }) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return toast("Couldn't save that. Try again.", { tone: "danger" });
    primeMe((await res.json()) as Me);
    setReload((n) => n + 1);
  };

  const filter: NearbyFilter = chosen ?? (sharing ? "2km" : "city");
  const everyone = data ? [...data.doctors, ...cityList.filter((c) => !data.doctors.some((d) => d.id === c.id))] : [];
  const shown = filterDoctors(everyone, filter);
  const rangeM = NEARBY_FILTERS.find((f) => f.id === filter)?.meters ?? Math.max(10_000, ...shown.map((d) => d.distanceM ?? 0));
  const challenge = (id: string) => { tap(); setAsked(id); onChallenge([id]); };

  return (
    <Sheet open={open} onClose={onClose} title="📍 Doctors near you" placement="responsive">
      {data === null ? (
        <div className="flex flex-col gap-2" aria-busy="true">{[0, 1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-surface-2" />)}</div>
      ) : data.needs === "account" ? (
        <p className="text-[14px] text-fg-2">Create a free account to play doctors near you.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {data.hidden ? (
            <div className="rounded-2xl border border-line bg-surface p-3.5">
              <p className="text-[13.5px] leading-6 text-fg-2">You&apos;re hidden: no one sees you on Near me or can challenge you from it.</p>
              <button type="button" disabled={busy} onClick={() => void setHidden(false)} className="mt-2 h-10 rounded-full border border-line px-4 text-[13.5px] font-medium disabled:opacity-60">Show me again</button>
            </div>
          ) : sharing ? (
            <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface px-3 py-2">
              <span aria-hidden className={cn("h-2.5 w-2.5 shrink-0 rounded-full", status === "live" ? "bg-emerald-500" : "bg-amber-500")} />
              <p role="status" className="min-w-0 flex-1 text-[12.5px] leading-5 text-fg-2">
                {status === "live" ? (accuracyM !== null && accuracyM > 300 ? "Sharing. Your phone's reading is rough indoors, so distances may be off." : "Sharing your rough location, to about 100 m") : status === "rough" ? "Your phone can't find you well enough yet. Try near a window." : "Finding you…"}
              </p>
              <button type="button" disabled={busy} onClick={() => void stop()} className="h-9 shrink-0 rounded-full border border-line px-3.5 text-[13px] font-semibold disabled:opacity-60">Stop sharing</button>
            </div>
          ) : (
            <div className="rounded-2xl border border-accent-line bg-accent-soft p-3.5">
              <p className="text-[14px] font-semibold">See doctors within 1 to 2 km</p>
              <p className="mt-1 text-[13px] leading-6 text-fg-2">While this screen is open, other doctors who have turned this on see your name, your rank and how far away you are, rounded to 50 or 100 m. Never your exact spot or your direction. It is deleted 10 minutes after you leave, and you can stop at any time.</p>
              <button type="button" disabled={busy} onClick={() => void turnOn()} className="mt-2.5 h-11 w-full rounded-full bg-accent text-[14.5px] font-semibold text-on-accent disabled:opacity-60">Share my rough location</button>
              {note && <p role="status" className="mt-2 text-[12.5px] leading-5 text-fg-2">{note}</p>}
            </div>
          )}

          {sharing && (
            <div className="flex flex-col items-center gap-1.5">
              <Radar doctors={shown} rangeM={rangeM} />
              <p className="text-[11.5px] text-fg-3">Distances are rounded. Direction isn&apos;t shown, on purpose.</p>
            </div>
          )}

          <div role="radiogroup" aria-label="How far" className="grid grid-cols-4 gap-1 rounded-xl bg-surface-2 p-1">
            {NEARBY_FILTERS.map((f) => (
              <button key={f.id} type="button" role="radio" aria-checked={filter === f.id} onClick={() => { tap(); setChosen(f.id); }} className={cn("relative isolate min-h-10 rounded-[9px] px-0.5 text-[11.5px] leading-tight font-medium transition-colors", filter === f.id ? "text-fg" : "text-fg-2")}>
                {filter === f.id && <SlidingPill id="nearby-range" className="rounded-[inherit] bg-surface shadow-sm" />}
                {f.label}
              </button>
            ))}
          </div>

          {shown.length ? (
            <ul className="flex flex-col gap-2">
              {shown.map((d) => (
                <li key={d.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-2.5">
                  {/* Swap for <PersonaAvatar/> when it lands. */}
                  <PersonaAvatar persona={d.avatar?.persona} photo={d.avatar?.photo} size={40} fallback={<Avatar name={d.name} size={40} />} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold">{d.name}</span>
                    <span className="block truncate text-[12px] text-fg-3">{d.rankLabel}</span>
                    <span className="mt-0.5 block text-[12px] leading-4 font-medium text-fg-2">
                      {d.distanceM !== null ? `${formatDistance(d.distanceM)} · ${formatSeen(d.seenMinAgo ?? 0)}` : `In your city · ${lastPlayed(d.activeAt)}`}
                    </span>
                  </span>
                  <button type="button" disabled={starting} onClick={() => challenge(d.id)} className="h-10 shrink-0 rounded-full bg-accent px-3 text-[13px] font-semibold text-on-accent disabled:opacity-60">
                    {starting && asked === d.id ? "Starting…" : "Challenge"}
                  </button>
                </li>
              ))}
            </ul>
          ) : filter === "city" && data.needs === "location" ? (
            <div className="flex gap-2">
              <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={60} placeholder="Type your city" aria-label="Your city" className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3.5 text-[14.5px] outline-none focus:border-accent-line" />
              <button type="button" disabled={busy || city.trim().length < 2} onClick={() => void saveCity()} className="h-11 rounded-xl border border-line px-4 text-[14px] font-medium disabled:opacity-50">Save</button>
            </div>
          ) : (
            <p className="text-[13.5px] leading-6 text-fg-2">
              {filter === "city" ? `No other doctors ${data.place ? `in ${data.place}` : "near you"} on RamAI yet.` : sharing ? "No one has this on within that distance right now." : "Turn on sharing above to see distances."} Doctors show up here once they join and turn it on. Use <b>👥 A friend</b> to send your classmates a link.
            </p>
          )}

          {!!shown.length && <p className="text-[12px] text-fg-3">One tap starts your case. They get a notification and can play the same patient when they open it, within a day.</p>}
          {!data.hidden && <button type="button" disabled={busy} onClick={() => void setHidden(true)} className="self-center py-1 text-[12.5px] text-fg-3 underline underline-offset-2 disabled:opacity-60">Don&apos;t show me on Near me at all</button>}
        </div>
      )}
    </Sheet>
  );
}
