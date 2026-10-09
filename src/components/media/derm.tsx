/**
 * Procedural dermatology photograph.
 *
 * A close-up skin field (~55 mm across) rendered from lesion layers on a
 * Fitzpatrick-typed base: flash-like lighting falloff, colour mottling and
 * pore texture, then each lesion with consistent top-left lighting. Lesion
 * `size` is a diameter in millimetres. Deterministic per seed, never labelled.
 */
import { memo, useId, useMemo, type ReactElement } from "react";

import type { DermLesionLayer, DermSpec } from "@/engine/types";
import { prngFrom } from "@/lib/prng";

const W = 400;
const H = 300;
/** SVG units per millimetre of lesion diameter → radius. */
const MM = 3.6;

const SKIN: Record<number, string> = {
  1: "#f1d2bf",
  2: "#e6bd9c",
  3: "#d4a07a",
  4: "#bf8a66",
  5: "#8e5d41",
  6: "#5d3b2a",
};

type RGB = [number, number, number];
const hex = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const css = ([r, g, b]: RGB) => `rgb(${Math.round(Math.max(0, Math.min(255, r)))} ${Math.round(Math.max(0, Math.min(255, g)))} ${Math.round(Math.max(0, Math.min(255, b)))})`;
const mix = (a: string, b: string, t: number) => {
  const x = hex(a);
  const y = hex(b);
  return css([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
};
const toHex = (c: string) => {
  const m = c.match(/\d+(\.\d+)?/g)!.map(Number);
  return `#${m.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
};
const shade = (a: string, f: number) => {
  const x = hex(a);
  return css([x[0] * f, x[1] * f, x[2] * f]);
};

interface Palette {
  skin: string;
  red: string;
  redLight: string;
  redDark: string;
  deep: string;
  deepLight: string;
  cyst: string;
  pigment: string;
  pigmentLight: string;
  melasma: string;
  scar: string;
}

function palette(skin: string): Palette {
  const red = toHex(mix(skin, "#c2413e", 0.58));
  const deep = toHex(mix(skin, "#8a2f3d", 0.72));
  return {
    skin,
    red,
    redLight: toHex(mix(red, "#ffd9d2", 0.26)),
    redDark: toHex(shade(red, 0.78)),
    deep,
    deepLight: toHex(mix(deep, "#e9a4a6", 0.3)),
    cyst: toHex(mix(skin, "#7a3a58", 0.68)),
    pigment: toHex(mix(skin, "#4a2a1c", 0.5)),
    pigmentLight: toHex(mix(skin, "#6f4630", 0.3)),
    melasma: toHex(mix(skin, "#5e3219", 0.46)),
    scar: toHex(shade(skin, 0.8)),
  };
}

function regionPoint(region: DermLesionLayer["region"], rand: () => number, margin: number): [number, number] {
  for (let i = 0; i < 24; i++) {
    const x = margin + rand() * (W - margin * 2);
    const y = margin + rand() * (H - margin * 2);
    const nx = (x - W / 2) / (W / 2);
    const ny = (y - H / 2) / (H / 2);
    const ok =
      !region || region === "diffuse" || region === "extensor" || region === "flexor"
        ? true
        : region === "central"
          ? nx * nx + ny * ny < 0.4
          : region === "malar"
            ? ny < 0.25
            : region === "perioral"
              ? ny > 0.05
              : nx * nx + ny * ny > 0.5;
    if (ok) return [x, y];
  }
  return [W / 2, H / 2];
}

/** A smooth, irregular closed outline. */
function blob(cx: number, cy: number, r: number, rand: () => number, irregular = 0.35, points = 11, squash = 0.88): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    const rr = r * (1 - irregular / 2 + rand() * irregular);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * squash]);
  }
  const mid = (p: [number, number], q: [number, number]) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2] as const;
  let d = "";
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[(i + 1) % pts.length]!;
    const m0 = mid(pts[i]!, p1);
    const m1 = mid(p1, pts[(i + 2) % pts.length]!);
    if (i === 0) d += `M${m0[0].toFixed(1)} ${m0[1].toFixed(1)}`;
    d += `Q${p1[0].toFixed(1)} ${p1[1].toFixed(1)} ${m1[0].toFixed(1)} ${m1[1].toFixed(1)}`;
  }
  return `${d}Z`;
}

function lesion(layer: DermLesionLayer, key: number, x: number, y: number, r: number, p: Palette, id: (n: string) => string, rand: () => number): ReactElement {
  const k = `${layer.morphology}-${key}`;
  const url = (n: string) => `url(#${id(n)})`;
  switch (layer.morphology) {
    case "comedone-closed":
      return (
        <g key={k}>
          <circle cx={x + r * 0.18} cy={y + r * 0.22} r={r} fill={shade(p.skin, 0.84)} opacity="0.35" />
          <circle cx={x} cy={y} r={r} fill={url("closed")} />
          <circle cx={x - r * 0.05} cy={y - r * 0.02} r={r * 0.4} fill="#fbf3e3" opacity="0.85" />
        </g>
      );
    case "comedone-open":
      return (
        <g key={k}>
          <circle cx={x} cy={y} r={r} fill={url("closed")} opacity="0.85" />
          <circle cx={x} cy={y} r={r * 0.46} fill="#2a1b14" />
          <circle cx={x - r * 0.12} cy={y - r * 0.14} r={r * 0.14} fill="#ffffff" opacity="0.28" />
        </g>
      );
    case "papule":
    case "pustule": {
      const pus = layer.morphology === "pustule";
      const rot = q2((rand() - 0.5) * 60);
      const sq = 0.86 + rand() * 0.2;
      return (
        <g key={k}>
          <circle cx={x} cy={y} r={r * 2.6} fill={url("halo")} />
          <ellipse cx={x + r * 0.2} cy={y + r * 0.28} rx={r * 1.04} ry={r * sq} fill={p.redDark} opacity="0.28" transform={`rotate(${rot} ${x} ${y})`} />
          <ellipse cx={x} cy={y} rx={r} ry={r * sq} fill={url("dome-red")} transform={`rotate(${rot} ${x} ${y})`} />
          {pus && (
            <>
              <circle cx={x - r * 0.04} cy={y - r * 0.08} r={r * 0.5} fill={url("pus")} />
              <circle cx={x - r * 0.04} cy={y - r * 0.08} r={r * 0.5} fill="none" stroke="#e2c27f" strokeWidth={r * 0.05} opacity="0.6" />
            </>
          )}
          <ellipse cx={x - r * 0.34} cy={y - r * 0.38} rx={r * 0.24} ry={r * 0.12} fill="#ffffff" opacity={pus ? 0.55 : 0.2} transform={`rotate(-30 ${x - r * 0.34} ${y - r * 0.38})`} />
        </g>
      );
    }
    case "nodule":
    case "cyst": {
      const cyst = layer.morphology === "cyst";
      const rot = q2((rand() - 0.5) * 70);
      const sq = 0.78 + rand() * 0.18;
      return (
        <g key={k}>
          <circle cx={x} cy={y} r={r * 2.2} fill={url(cyst ? "halo-cyst" : "halo-deep")} />
          <ellipse cx={x + r * 0.2} cy={y + r * 0.26} rx={r * 1.05} ry={r * sq} fill="#2a0f14" opacity="0.16" transform={`rotate(${rot} ${x} ${y})`} />
          <ellipse cx={x} cy={y} rx={r} ry={r * sq} fill={url(cyst ? "dome-cyst" : "dome-deep")} transform={`rotate(${rot} ${x} ${y})`} />
          <ellipse cx={x - r * 0.32} cy={y - r * 0.32} rx={r * 0.26} ry={r * 0.11} fill="#ffffff" opacity={cyst ? 0.26 : 0.14} transform={`rotate(-28 ${x - r * 0.32} ${y - r * 0.32})`} />
        </g>
      );
    }
    case "macule":
    case "hyperpigment":
    case "patch": {
      const big = r > 40 || (layer.confluence ?? 0) > 0.4;
      const tone = layer.colour ?? (big ? p.melasma : p.pigment);
      if (!big) {
        return (
          <g key={k} filter={url("feather")} opacity="0.7">
            <path d={blob(x, y, r, rand, 0.4, 9)} fill={tone} />
          </g>
        );
      }
      // Overlapping irregular sheets darken where they overlap — natural variegation.
      const sheets = Array.from({ length: 5 }, () => blob(x + (rand() - 0.5) * r * 0.5, y + (rand() - 0.5) * r * 0.35, r * (0.55 + rand() * 0.45), rand, 0.62, 20, 0.8));
      const dots = Array.from({ length: Math.round(r * 0.8) }, () => {
        const a = rand() * Math.PI * 2;
        const d = Math.sqrt(rand()) * r * 0.8;
        return { cx: q2(x + Math.cos(a) * d), cy: q2(y + Math.sin(a) * d * 0.8), rr: 1.2 + rand() * 3 };
      });
      return (
        <g key={k}>
          <g filter={url("feather-md")}>
            {sheets.map((d, i) => (
              <path key={i} d={d} fill={tone} opacity={0.32 + i * 0.04} />
            ))}
          </g>
          <g filter={url("feather")} opacity="0.32">
            {dots.map((d, i) => (
              <circle key={i} cx={d.cx} cy={d.cy} r={d.rr} fill={shade(tone, 0.82)} />
            ))}
          </g>
        </g>
      );
    }
    case "erythema":
      return <ellipse key={k} cx={x} cy={y} rx={r * 1.4} ry={r} fill={url("halo-wide")} opacity={0.45 + (layer.confluence ?? 0.2) * 0.5} />;
    case "scar-atrophic": {
      const kind = rand();
      const rr = kind < 0.34 ? r * 0.42 : kind < 0.68 ? r * 0.8 : r * 1.35;
      return (
        <g key={k}>
          {kind < 0.34 ? (
            <ellipse cx={x} cy={y} rx={rr} ry={rr * 1.2} fill={shade(p.skin, 0.55)} />
          ) : kind < 0.68 ? (
            <path d={blob(x, y, rr, rand, 0.2, 7)} fill={p.scar} />
          ) : (
            <ellipse cx={x} cy={y} rx={rr} ry={rr * 0.8} fill={url("rolling")} />
          )}
          <path d={`M${x - rr * 0.85} ${y + rr * 0.35} Q ${x} ${y + rr * 1.15} ${x + rr * 0.85} ${y + rr * 0.35}`} fill="none" stroke={mix(p.skin, "#ffffff", 0.32)} strokeWidth={Math.max(0.6, rr * 0.16)} opacity="0.55" strokeLinecap="round" />
        </g>
      );
    }
    case "scar-hypertrophic": {
      const a = (rand() - 0.5) * 70;
      return (
        <g key={k} transform={`rotate(${a} ${x} ${y})`}>
          <ellipse cx={x} cy={y} rx={r * 1.8} ry={r * 0.62} fill={mix(p.skin, "#c97c86", 0.48)} />
          <ellipse cx={x - r * 0.3} cy={y - r * 0.2} rx={r * 0.9} ry={r * 0.16} fill="#ffffff" opacity="0.32" />
        </g>
      );
    }
    case "plaque": {
      const d = blob(x, y, r, rand, 0.3, 15, 0.82);
      const inner = blob(x, y, r * 0.84, rand, 0.32, 15, 0.82);
      const clip = id(`pq${key}`);
      const flakes = Array.from({ length: Math.round(r * 2.4) }, () => {
        const a = rand() * Math.PI * 2;
        const dd = Math.pow(rand(), 0.8) * r * 0.85;
        const cx = x + Math.cos(a) * dd;
        const cy = y + Math.sin(a) * dd * 0.82;
        const fr = (2 + rand() * 7) * (1.25 - dd / r);
        const pts = Array.from({ length: 5 }, (_, j) => {
          const b = (j / 5) * Math.PI * 2 + rand() * 0.6;
          const rr = fr * (0.55 + rand() * 0.6);
          return `${q2(cx + Math.cos(b) * rr)},${q2(cy + Math.sin(b) * rr * 0.7)}`;
        }).join(" ");
        return { pts, o: 0.55 + rand() * 0.4, c: rand() > 0.6 ? "#f7f6f2" : "#e4e1db" };
      });
      return (
        <g key={k}>
          <clipPath id={clip}>
            <path d={inner} />
          </clipPath>
          <path d={d} fill={p.redDark} opacity="0.35" transform="translate(2 3)" filter={url("feather")} />
          <path d={d} fill={url("plaque")} />
          <path d={d} fill={p.deep} opacity="0.18" />
          <g clipPath={`url(#${clip})`}>
            {flakes.map((f, i) => (
              <polygon key={i} points={f.pts} fill={f.c} opacity={f.o} />
            ))}
            {Array.from({ length: 4 }, (_, i) => (
              <path key={i} d={`M${q2(x - r * 0.6 + rand() * r * 1.2)} ${q2(y - r * 0.5 + rand() * r)} l${q2((rand() - 0.5) * r * 0.5)} ${q2((rand() - 0.5) * r * 0.4)}`} stroke={p.redDark} strokeWidth="0.9" opacity="0.45" />
            ))}
          </g>
          <path d={d} fill="none" stroke={p.redDark} strokeWidth="1" opacity="0.45" />
        </g>
      );
    }
    case "annular": {
      const d = blob(x, y, r, rand, 0.18, 16, 0.86);
      const border = Math.max(5, r * 0.1);
      const flecks = Array.from({ length: Math.round(r * 0.9) }, () => {
        const a = rand() * Math.PI * 2;
        const rr = r * (0.94 + rand() * 0.1);
        return { cx: q2(x + Math.cos(a) * rr), cy: q2(y + Math.sin(a) * rr * 0.86), w: 1 + rand() * 2.2 };
      });
      const edge = Array.from({ length: Math.round(r / 7) }, () => {
        const a = rand() * Math.PI * 2;
        const rr = r * (1.02 + rand() * 0.08);
        return { cx: q2(x + Math.cos(a) * rr), cy: q2(y + Math.sin(a) * rr * 0.86), rr: 1.6 + rand() * 1.8 };
      });
      return (
        <g key={k}>
          <path d={d} fill={p.pigmentLight} opacity="0.5" />
          <path d={d} fill="none" stroke={p.red} strokeWidth={border * 2.2} opacity="0.28" filter={url("feather-md")} />
          <path d={d} fill="none" stroke={p.red} strokeWidth={border} opacity="0.92" />
          <path d={d} fill="none" stroke={p.redLight} strokeWidth={border * 0.3} opacity="0.4" transform="translate(-0.8 -1)" />
          {flecks.map((f, i) => (
            <ellipse key={i} cx={f.cx} cy={f.cy} rx={f.w} ry={f.w * 0.55} fill="#f4efe8" opacity="0.8" />
          ))}
          {edge.map((e, i) => (
            <circle key={i} cx={e.cx} cy={e.cy} r={e.rr} fill={url("dome-red")} />
          ))}
        </g>
      );
    }
    case "scale":
      return <path key={k} d={blob(x, y, r, rand, 0.4)} fill={url("scale")} opacity="0.7" />;
    case "vesicle":
      return (
        <g key={k}>
          <circle cx={x} cy={y} r={r * 1.9} fill={url("halo")} />
          <circle cx={x} cy={y} r={r} fill="#f6eee2" opacity="0.7" stroke={mix(p.skin, "#ffffff", 0.45)} strokeWidth="0.6" />
          <ellipse cx={x - r * 0.32} cy={y - r * 0.36} rx={r * 0.32} ry={r * 0.18} fill="#ffffff" opacity="0.85" />
        </g>
      );
    case "wheal":
      return <path key={k} d={blob(x, y, r, rand, 0.55)} fill={mix(p.skin, "#efb3ae", 0.5)} stroke={p.red} strokeWidth="2" opacity="0.85" />;
    case "ulcer":
      return (
        <g key={k}>
          <path d={blob(x, y, r * 1.25, rand, 0.25)} fill={p.red} />
          <path d={blob(x, y, r, rand, 0.25)} fill="#d6b56c" />
          <path d={blob(x, y, r * 0.5, rand, 0.4)} fill="#b13f48" opacity="0.6" />
        </g>
      );
    case "target":
      return (
        <g key={k}>
          <circle cx={x} cy={y} r={r} fill={mix(p.skin, "#c8605a", 0.42)} />
          <circle cx={x} cy={y} r={r * 0.66} fill={mix(p.skin, "#f1d6cf", 0.4)} />
          <circle cx={x} cy={y} r={r * 0.32} fill={mix(p.skin, "#8c3446", 0.6)} />
        </g>
      );
    default:
      return <g key={k} />;
  }
}

/** Rounds trig-derived coordinates so server and browser render identical markup. */
const q2 = (v: number) => Math.round(v * 100) / 100;

const FLAT = new Set(["erythema", "patch", "hyperpigment", "macule", "plaque", "annular", "scale"]);
const ORDER = ["erythema", "patch", "hyperpigment", "macule", "plaque", "annular", "scale", "scar-atrophic", "scar-hypertrophic", "comedone-closed", "comedone-open", "papule", "nodule", "cyst", "pustule", "vesicle", "wheal", "ulcer", "target"];

export const DermPhoto = memo(function DermPhoto({ spec, className }: { spec: DermSpec; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (n: string) => `${uid}-${n}`;
  const p = useMemo(() => palette(SKIN[spec.phototype] ?? SKIN[4]!), [spec.phototype]);

  const content = useMemo(() => {
    const rand = prngFrom(spec.seed);
    const placed: { x: number; y: number; r: number }[] = [];
    const out: ReactElement[] = [];
    const layers = [...spec.lesions].sort((a, b) => ORDER.indexOf(a.morphology) - ORDER.indexOf(b.morphology));
    for (const layer of layers) {
      const base = (layer.size ?? 2.5) * MM;
      const flat = FLAT.has(layer.morphology);
      for (let i = 0; i < layer.count; i++) {
        const r = base * (0.78 + rand() * 0.44);
        let x = 0;
        let y = 0;
        for (let attempt = 0; attempt < 18; attempt++) {
          const margin = layer.morphology === "plaque" || layer.morphology === "annular" ? r * 0.55 : flat ? -r * 0.3 : r + 4;
          [x, y] = regionPoint(layer.region, rand, margin);
          if (flat || !placed.some((q) => Math.sqrt((q.x - x) ** 2 + (q.y - y) ** 2) < (q.r + r) * 1.05)) break;
        }
        if (!flat) placed.push({ x, y, r });
        out.push(lesion(layer, out.length, x, y, r, p, id, rand));
      }
    }
    const creases: ReactElement[] = [];
    if (spec.site === "forehead") {
      for (let i = 0; i < 4; i++) {
        const y = 55 + i * 58 + rand() * 12;
        creases.push(<path key={i} d={`M-10 ${y} C 120 ${y - 9}, 280 ${y + 11}, 410 ${y - 5}`} fill="none" stroke={shade(p.skin, 0.84)} strokeWidth="1.4" opacity="0.32" />);
      }
    }
    if (spec.site === "shin" || spec.site === "forearm" || spec.site === "hand") {
      for (let i = 0; i < 34; i++) {
        const x = rand() * W;
        const y = rand() * H;
        creases.push(<path key={i} d={`M${x} ${y} l${10 + rand() * 18} ${(rand() - 0.5) * 9}`} stroke={mix(p.skin, "#ffffff", 0.3)} strokeWidth="0.7" opacity="0.4" />);
      }
    }
    return { lesions: out, creases };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec, p, uid]);

  const poreFreq = spec.site === "back" || spec.site === "trunk" ? 0.5 : spec.site === "scalp" ? 0.35 : 0.8;
  const halo = (name: string, color: string, alpha: number) => (
    <radialGradient id={id(name)}>
      <stop offset="0%" stopColor={color} stopOpacity={alpha} />
      <stop offset="45%" stopColor={color} stopOpacity={alpha * 0.55} />
      <stop offset="100%" stopColor={color} stopOpacity="0" />
    </radialGradient>
  );
  const dome = (name: string, light: string, mid: string, dark: string) => (
    <radialGradient id={id(name)} cx="40%" cy="36%" r="68%">
      <stop offset="0%" stopColor={light} />
      <stop offset="55%" stopColor={mid} />
      <stop offset="100%" stopColor={dark} />
    </radialGradient>
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label="Clinical photograph of skin" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={id("light")} cx="38%" cy="30%" r="88%">
          <stop offset="0%" stopColor={mix(p.skin, "#ffffff", 0.14)} />
          <stop offset="55%" stopColor={p.skin} />
          <stop offset="100%" stopColor={shade(p.skin, 0.68)} />
        </radialGradient>
        {halo("halo", p.red, 0.34)}
        {halo("halo-wide", p.red, 0.5)}
        {halo("halo-deep", p.deep, 0.5)}
        {halo("halo-cyst", p.cyst, 0.45)}
        {dome("dome-red", p.redLight, p.red, p.redDark)}
        {dome("dome-deep", p.deepLight, p.deep, toHex(shade(p.deep, 0.75)))}
        {dome("dome-cyst", toHex(mix(p.cyst, "#f4d5df", 0.35)), p.cyst, toHex(shade(p.cyst, 0.72)))}
        {dome("closed", toHex(mix(p.skin, "#fff4e6", 0.45)), toHex(mix(p.skin, "#f4e2cf", 0.25)), toHex(shade(p.skin, 0.94)))}
        <radialGradient id={id("pus")} cx="42%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#fffdf2" />
          <stop offset="60%" stopColor="#f3e2b0" />
          <stop offset="100%" stopColor="#dcbf7c" />
        </radialGradient>
        <radialGradient id={id("rolling")} cx="38%" cy="34%" r="70%">
          <stop offset="0%" stopColor={shade(p.skin, 0.78)} />
          <stop offset="100%" stopColor={p.skin} stopOpacity="0" />
        </radialGradient>
        <filter id={id("feather")} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.8" />
        </filter>
        <filter id={id("feather-md")} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.6" />
        </filter>
        <radialGradient id={id("plaque")} cx="42%" cy="38%" r="70%">
          <stop offset="0%" stopColor={p.redLight} />
          <stop offset="70%" stopColor={p.red} />
          <stop offset="100%" stopColor={p.redDark} />
        </radialGradient>
        <filter id={id("feather-lg")} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <filter id={id("pores")} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency={poreFreq} numOctaves="2" seed={spec.seed % 97} result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.6 1.3" />
        </filter>
        <filter id={id("mottle")} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="3" seed={(spec.seed % 89) + 3} result="m" />
          <feColorMatrix in="m" type="matrix" values="0 0 0 0 0.36  0 0 0 0 0.12  0 0 0 0 0.08  0 0 0 0.95 -0.34" />
        </filter>
        <pattern id={id("scale")} width="9" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(16)">
          <path d="M0 3.5 Q2.2 0.6 4.5 3.5 T9 3.5" fill="none" stroke="#f5f2ee" strokeWidth="1.6" opacity="0.9" />
          <circle cx="2.4" cy="6" r="1" fill="#ffffff" opacity="0.8" />
        </pattern>
        <radialGradient id={id("vignette")} cx="50%" cy="46%" r="74%">
          <stop offset="60%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.3" />
        </radialGradient>
        <radialGradient id={id("sheen")} cx="34%" cy="26%" r="40%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={url(id("light"))} />
      <rect width={W} height={H} filter={url(id("mottle"))} opacity="0.55" />
      {content.creases}
      <rect width={W} height={H} filter={url(id("pores"))} opacity="0.14" style={{ mixBlendMode: "multiply" }} />
      {content.lesions}
      <rect width={W} height={H} fill={url(id("sheen"))} />
      <rect width={W} height={H} fill={url(id("vignette"))} />
    </svg>
  );
});

function url(id: string) {
  return `url(#${id})`;
}
