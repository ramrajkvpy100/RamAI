import type { CSSProperties } from "react";

import { cn } from "@/lib/cn";
import type { NearbyView } from "@/lib/nearby-geo";

import styles from "./radar.module.css";

/** A steady angle for each doctor, from their id. The server knows no direction to give, and this shows none: only how far. */
const angleOf = (id: string) => {
  let h = 0;
  for (const ch of id) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  return (h % 360) * (Math.PI / 180);
};

export function Radar({ doctors, rangeM }: { doctors: readonly NearbyView[]; rangeM: number }) {
  const blips = doctors.filter((d) => d.distanceM !== null).slice(0, 16);
  return (
    <div className={styles.radar} aria-hidden>
      <span className={styles.sweep} />
      {["16%", "33%"].map((inset) => <span key={inset} className={styles.ring} style={{ "--inset": inset } as CSSProperties} />)}
      <span className={styles.you} />
      {blips.map((d) => {
        const radius = 44 * Math.min(1, Math.sqrt(d.distanceM! / rangeM)), angle = angleOf(d.id);
        return <span key={d.id} className={cn(styles.blip, (d.seenMinAgo ?? 0) >= 2 && styles.stale)} style={{ left: `${50 + radius * Math.cos(angle)}%`, top: `${50 + radius * Math.sin(angle)}%` }} />;
      })}
    </div>
  );
}
