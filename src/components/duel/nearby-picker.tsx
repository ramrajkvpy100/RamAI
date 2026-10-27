"use client";

import { useEffect, useState } from "react";

import { DoctorFigure } from "@/components/game/caricature";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import { tap } from "@/lib/haptics";
import { primeMe, type Me } from "@/lib/me-store";
import { toast } from "@/lib/toast";

interface Doctor { id: string; name: string; rankTier: number; rankLabel: string; activeAt: number | null; place: string | null }

const ago = (t: number | null) => {
  if (!t) return "hasn't played yet";
  const m = Math.round((Date.now() - t) / 60_000);
  return m < 15 ? "🟢 playing now" : m < 60 ? `active ${m} min ago` : m < 1440 ? `active ${Math.round(m / 60)} h ago` : `active ${Math.round(m / 1440)} d ago`;
};

/** "Near me": doctors around you — pick who to challenge to the same patient. */
export function NearbyPicker({ open, onClose, onChallenge, starting }: { open: boolean; onClose: () => void; onChallenge: (ids: string[]) => void; starting: boolean }) {
  const [data, setData] = useState<{ doctors: Doctor[]; place?: string; needs?: "location" | "account" } | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setData(null);
    fetch("/api/duels/nearby", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d) => live && setData(d))
      .catch(() => live && setData({ doctors: [] }));
    return () => { live = false; };
  }, [open, reload]);

  const save = async (body: object) => {
    setBusy(true);
    const res = await fetch("/api/me/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return toast("Couldn't save that — try again", { tone: "danger" });
    primeMe((await res.json()) as Me);
    setReload((n) => n + 1);
  };
  const locate = () => {
    if (!("geolocation" in navigator)) return toast("This phone can't share its location — type your city instead.", { tone: "warning" });
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => void save({ geo: { lat: pos.coords.latitude, lon: pos.coords.longitude } }),
      () => { setBusy(false); toast("Location is off — type your city instead.", { tone: "warning" }); },
      { enableHighAccuracy: false, maximumAge: 3_600_000, timeout: 15_000 },
    );
  };
  const toggle = (id: string) => { tap(); setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 5 ? p : [...p, id])); };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="📍 Doctors near you"
      placement="responsive"
      footer={
        data?.doctors.length ? (
          <button type="button" disabled={!picked.length || starting} onClick={() => onChallenge(picked)} className="shine h-12 w-full rounded-full text-[15px] font-semibold text-white shadow-glow disabled:opacity-60">
            {starting ? "Getting your patient…" : picked.length ? `⚔️ Challenge ${picked.length === 1 ? "1 doctor" : `${picked.length} doctors`}` : "Pick who to challenge"}
          </button>
        ) : undefined
      }
    >
      {data === null ? (
        <div className="flex flex-col gap-2" aria-busy="true">{[0, 1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-surface-2" />)}</div>
      ) : data.needs === "account" ? (
        <p className="text-[14px] text-fg-2">Create a free account to play doctors near you.</p>
      ) : data.needs === "location" ? (
        <div className="flex flex-col gap-3">
          <p className="text-[14px] text-fg-2">Say roughly where you are — rounded to about 10 km, never your exact spot — to find doctors within 50 km.</p>
          <button type="button" disabled={busy} onClick={locate} className="h-11 rounded-full bg-accent text-[14.5px] font-semibold text-on-accent disabled:opacity-60">{busy ? "Finding you…" : "📍 Use my location"}</button>
          <div className="flex gap-2">
            <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={60} placeholder="or type your city" aria-label="Your city" className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3.5 text-[14.5px] outline-none focus:border-accent-line" />
            <button type="button" disabled={busy || city.trim().length < 2} onClick={() => void save({ city: city.trim() })} className="h-11 rounded-xl border border-line px-4 text-[14px] font-medium disabled:opacity-50">Save</button>
          </div>
        </div>
      ) : !data.doctors.length ? (
        <p className="text-[14px] leading-6 text-fg-2">No other doctors {data.place ? `in ${data.place}` : "near you"} on RamAI yet. Use <b>👥 A friend</b> to send your classmates a link — once they join, they&apos;ll show up here.</p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-[12.5px] text-fg-3">{data.doctors.length} {data.doctors.length === 1 ? "doctor" : "doctors"} {data.place === "within about 50 km" ? "within about 50 km" : `in ${data.place}`} · pick up to 5. They get a notification and have 30 minutes to play the same patient.</p>
          {data.doctors.map((d) => {
            const on = picked.includes(d.id);
            return (
              <button key={d.id} type="button" aria-pressed={on} onClick={() => toggle(d.id)} className={cn("flex items-center gap-3 rounded-2xl border p-2.5 text-left transition-colors", on ? "border-accent-line bg-accent-soft" : "border-line bg-surface hover:bg-surface-2")}>
                <DoctorFigure tier={d.rankTier} seed={d.id} size={40} className="shrink-0 rounded-full" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold">{d.name}</span>
                  <span className="block truncate text-[12px] text-fg-3">{d.rankLabel} · {ago(d.activeAt)}</span>
                </span>
                <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[13px]", on ? "border-accent bg-accent text-on-accent" : "border-line")}>{on ? "✓" : ""}</span>
              </button>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}
