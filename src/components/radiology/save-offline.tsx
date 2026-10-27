"use client";

import { useEffect, useRef, useState } from "react";

import SINGLES from "@/lib/radiology-singles.json";
import STACKS from "@/lib/radiology-stacks.json";
import { tap, success } from "@/lib/haptics";

const KEY = "ramai.scans.saved";

/** Every file a study needs: a stack's slices (in each of its windows), or a single image. */
export function stackUrls(s: { id: string; slices: number; windows?: string[] }, onlyFirst = false): string[] {
  const folders = s.windows?.length ? (onlyFirst ? [s.windows[0]!] : s.windows) : [""];
  return folders.flatMap((f) => Array.from({ length: s.slices }, (_, n) => `/radiology/${s.id}/${f ? `${f}/` : ""}${String(n).padStart(3, "0")}.jpg`));
}

/** Fetches quietly, a few at a time (the app keeps what it fetches on the phone). */
export async function warm(urls: string[], onEach?: () => void, stop?: () => boolean, at = 6) {
  let next = 0;
  await Promise.all(
    Array.from({ length: at }, async () => {
      while (next < urls.length && !stop?.()) {
        const u = urls[next++]!;
        await fetch(u).then((r) => (r.ok ? r.blob() : null)).catch(() => undefined);
        onEach?.();
      }
    }),
  );
}

/** "Save every scan for offline": all the scroll series and kept images, onto the phone (about 160 MB). */
export function SaveOffline() {
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const stopped = useRef(false);
  useEffect(() => {
    try { if (localStorage.getItem(KEY)) setState("saved"); } catch {}
  }, []);

  const save = async () => {
    tap();
    stopped.current = false;
    setState("saving");
    setDone(0);
    // The picture bank's images too (X-ray, CT, ultrasound): their addresses come with each tab's studies.
    const bank: string[] = [];
    for (const m of ["xray", "ct", "usg"]) {
      const r = await fetch("/api/radiology/round", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ modality: m }) }).catch(() => null);
      const items = r?.ok ? ((await r.json()) as { items: { image: string | null }[] }).items : [];
      for (const it of items) if (it.image && !it.image.startsWith("/radiology/")) bank.push(it.image);
    }
    const urls = [...STACKS.flatMap((s) => stackUrls(s as { id: string; slices: number; windows?: string[] })), ...SINGLES.map((s) => s.src), ...bank];
    setTotal(urls.length);
    let n = 0;
    await warm(urls, () => setDone(++n), () => stopped.current, 8);
    if (stopped.current) return setState("idle");
    try { localStorage.setItem(KEY, String(Date.now())); } catch {}
    success();
    setState("saved");
  };

  if (state === "saving") {
    const pct = total ? Math.round((done / total) * 100) : 0;
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-[13px]">
        <div className="min-w-0 flex-1">
          <div className="flex justify-between"><span>Saving scans for offline…</span><span className="tabular text-fg-3">{pct}%</span></div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} /></div>
        </div>
        <button type="button" onClick={() => (stopped.current = true)} className="shrink-0 rounded-full px-2.5 py-1 text-[12px] text-fg-3 hover:bg-surface-3">Stop</button>
      </div>
    );
  }
  return (
    <button type="button" onClick={() => void save()} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-left text-[13px] hover:bg-surface-2">
      <span>
        <b>{state === "saved" ? "✓ Scans saved for offline" : "⬇ Save all scans for offline"}</b>
        <span className="block text-[12px] text-fg-3">{state === "saved" ? "They open at once, even without internet. Tap to refresh." : "Opens every study instantly, even without internet · about 160 MB, best on Wi-Fi"}</span>
      </span>
    </button>
  );
}
