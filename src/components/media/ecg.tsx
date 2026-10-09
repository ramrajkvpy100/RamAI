/**
 * Procedural 12-lead ECG.
 *
 * Synthesises each lead from Gaussian P/Q/R/S/T components with lead-specific
 * amplitudes for a normal axis, then applies case morphology (ST shift,
 * T inversion, Q waves, LVH voltage, wide QRS) and rhythm (sinus, AF, flutter,
 * SVT, VT, junctional). Drawn in millimetres on standard paper:
 * 25 mm/s, 10 mm/mV, 1 mm minor and 5 mm major grid.
 */
import { memo, useId, useMemo } from "react";

import { prngFrom } from "@/lib/prng";
import type { EcgSpec } from "@/engine/types";

import { beatTimes, LAYOUT, makeSignal } from "./ecg-signal";

function pathFor(fn: (t: number) => number, t0: number, t1: number, x0: number, y0: number, step = 0.004) {
  let d = "";
  for (let t = t0; t <= t1 + 1e-9; t += step) {
    const x = x0 + (t - t0) * 25;
    const y = y0 - fn(t) * 10;
    d += d ? `L${x.toFixed(2)} ${y.toFixed(2)}` : `M${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return d;
}

const ROW_H = 30;
const MARGIN_L = 8;
const WIDTH = 250 + MARGIN_L + 4;
const HEIGHT = ROW_H * 4 + 8;

export const EcgTrace = memo(function EcgTrace({ spec, seed = 7, className }: { spec: EcgSpec; seed?: number; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const paths = useMemo(() => {
    const rand = prngFrom(seed * 9973 + Math.round(spec.rate));
    const beats = beatTimes(spec, 10, rand);
    const out: { d: string; label: string; x: number; y: number }[] = [];
    LAYOUT.forEach((row, ri) => {
      row.forEach((lead, ci) => {
        const fn = makeSignal(spec, lead, beats, rand);
        const t0 = ci * 2.5;
        out.push({ d: pathFor(fn, t0, t0 + 2.5, MARGIN_L + ci * 62.5, 6 + ri * ROW_H + ROW_H * 0.55), label: lead, x: MARGIN_L + ci * 62.5 + 1.5, y: 6 + ri * ROW_H + 4 });
      });
    });
    const rhythm = makeSignal(spec, "II", beats, rand);
    out.push({ d: pathFor(rhythm, 0, 10, MARGIN_L, 6 + 3 * ROW_H + ROW_H * 0.55), label: "II", x: MARGIN_L + 1.5, y: 6 + 3 * ROW_H + 4 });
    return out;
  }, [spec, seed]);

  const calib = (row: number) => {
    const y = 6 + row * ROW_H + ROW_H * 0.55;
    return `M1.5 ${y} h1.5 v-10 h5 v10 h1`;
  };

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className={className} role="img" aria-label="Electrocardiogram tracing" preserveAspectRatio="xMidYMid meet">
      <defs>
        <pattern id={`${uid}-minor`} width="1" height="1" patternUnits="userSpaceOnUse">
          <path d="M1 0H0V1" fill="none" stroke="var(--ecg-grid-minor)" strokeWidth="0.08" />
        </pattern>
        <pattern id={`${uid}-major`} width="5" height="5" patternUnits="userSpaceOnUse">
          <rect width="5" height="5" fill={`url(#${uid}-minor)`} />
          <path d="M5 0H0V5" fill="none" stroke="var(--ecg-grid-major)" strokeWidth="0.16" />
        </pattern>
      </defs>
      <rect width={WIDTH} height={HEIGHT} fill="var(--ecg-paper)" />
      <rect width={WIDTH} height={HEIGHT} fill={`url(#${uid}-major)`} />
      {[0, 1, 2, 3].map((r) => (
        <path key={r} d={calib(r)} fill="none" stroke="var(--ecg-trace)" strokeWidth="0.32" strokeLinejoin="round" />
      ))}
      {[1, 2, 3].map((c) => (
        <path key={c} d={`M${MARGIN_L + c * 62.5} ${6 + 4} v${ROW_H * 3 - 8}`} stroke="var(--ecg-trace)" strokeWidth="0.3" opacity="0.5" />
      ))}
      {paths.map((p, i) => (
        <g key={i}>
          <path d={p.d} fill="none" stroke="var(--ecg-trace)" strokeWidth="0.34" strokeLinejoin="round" strokeLinecap="round" />
          <text x={p.x} y={p.y} fontSize="3.2" fontFamily="var(--font-mono)" fill="var(--ecg-trace)" opacity="0.8">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
});
