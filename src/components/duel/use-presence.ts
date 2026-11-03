"use client";

import { useEffect, useRef, useState } from "react";

import { WORST_ACCURACY_M } from "@/lib/nearby-geo";

const HEARTBEAT_MS = 30_000;

export type PresenceStatus = "off" | "locating" | "live" | "rough" | "denied" | "unavailable";

/**
 * While `enabled` and the page is on screen: follows the phone's location and says "still here" every 30 s. Hidden or closed, it
 * stops watching altogether; the server forgets the doctor ten minutes later. Never turn this on before the doctor has said yes.
 */
export function usePresence(enabled: boolean, onRevoked?: () => void): { status: PresenceStatus; accuracyM: number | null } {
  const [status, setStatus] = useState<PresenceStatus>("locating");
  const [accuracyM, setAccuracyM] = useState<number | null>(null);
  const revoked = useRef(onRevoked);
  useEffect(() => { revoked.current = onRevoked; });

  useEffect(() => {
    if (!enabled) return;
    if (!("geolocation" in navigator)) { setStatus("unavailable"); return; }
    let watch: number | null = null;
    let timer: number | undefined;
    let latest: { lat: number; lng: number } | null = null;
    let sentOnce = false;
    let live = true;

    const pause = () => {
      if (watch !== null) navigator.geolocation.clearWatch(watch);
      window.clearInterval(timer);
      watch = null;
      latest = null;
      sentOnce = false;
    };
    const send = async () => {
      if (!latest || document.hidden) return;
      sentOnce = true;
      const res = await fetch("/api/location/heartbeat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(latest) }).catch(() => null);
      if (!live || !res) return;
      if (res.status === 403) { pause(); revoked.current?.(); }
      else if (res.ok) setStatus("live");
    };
    const start = () => {
      if (watch !== null || document.hidden) return;
      setStatus("locating");
      watch = navigator.geolocation.watchPosition(
        (pos) => {
          if (!live) return;
          setAccuracyM(pos.coords.accuracy);
          if (pos.coords.accuracy > WORST_ACCURACY_M) { latest = null; setStatus("rough"); return; }
          latest = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          if (!sentOnce) void send();
        },
        (err) => {
          if (!live) return;
          // A timeout indoors isn't the end: the watch keeps trying. A refusal is.
          if (err.code === err.PERMISSION_DENIED) { pause(); setStatus("denied"); }
        },
        { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
      );
      timer = window.setInterval(() => void send(), HEARTBEAT_MS);
    };
    const onVisibility = () => (document.hidden ? pause() : start());

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      live = false;
      pause();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled]);

  return { status: enabled ? status : "off", accuracyM: enabled ? accuracyM : null };
}

/** In a duel: keeps a doctor who already turned near-me on showing as active. Asks nothing of anyone who hasn't. */
export function useDuelPresence(): void {
  const [sharing, setSharing] = useState(false);
  useEffect(() => {
    let live = true;
    fetch("/api/location/heartbeat", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { sharing: boolean } | null) => { if (live && d?.sharing) setSharing(true); })
      .catch(() => undefined);
    return () => { live = false; };
  }, []);
  usePresence(sharing, () => setSharing(false));
}
