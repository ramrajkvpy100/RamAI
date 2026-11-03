"use client";

/**
 * Each plant of the Clinical Grove, drawn by hand in code at every stage: no image files, so the grove works offline
 * and adds nothing to download. The habit of each is botanical: willow catkins, foxglove's one-sided spire, the
 * autumn crocus flowering with its leaves gone, red arils on the yew (a conifer has no flowers), and Penicillium as
 * what it is, a culture on a plate. Stages cross-fade, and only transform and opacity ever move.
 */
import { useId, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { STAGE_IDS, stageOf, withinStage, type PlantId, type StageId } from "@/lib/grove";

import styles from "./grove.module.css";

const n1 = (v: number) => Math.round(v * 10) / 10;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** A point `u` along the direction `a` (0 is up, clockwise) from (x, y), and `v` across it. */
function at(x: number, y: number, a: number, u: number, v: number): string {
  const s = Math.sin(rad(a));
  const c = Math.cos(rad(a));
  return `${n1(x + s * u + c * v)} ${n1(y - c * u + s * v)}`;
}
function point(x: number, y: number, a: number, u: number): [number, number] {
  return [x + Math.sin(rad(a)) * u, y - Math.cos(rad(a)) * u];
}
/** A leaf from (x, y), length l and width w, pointing along a. */
const leaf = (x: number, y: number, a: number, l: number, w: number) => `M${n1(x)} ${n1(y)}Q${at(x, y, a, l * 0.45, w)} ${at(x, y, a, l, 0)}Q${at(x, y, a, l * 0.45, -w)} ${n1(x)} ${n1(y)}Z`;
/** A midrib, or any short straight line. */
const line = (x: number, y: number, a: number, l: number) => `M${n1(x)} ${n1(y)}L${at(x, y, a, l, 0)}`;
const circle = (x: number, y: number, r: number) => `M${n1(x - r)} ${n1(y)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
/** A hanging tubular bell with a flared mouth. */
const bell = (x: number, y: number, a: number, l: number, w: number) =>
  `M${at(x, y, a, 0, -w * 0.22)}C${at(x, y, a, l * 0.4, -w * 0.5)} ${at(x, y, a, l * 0.75, -w * 0.5)} ${at(x, y, a, l, -w * 0.74)}Q${at(x, y, a, l * 1.12, 0)} ${at(x, y, a, l, w * 0.74)}C${at(x, y, a, l * 0.75, w * 0.5)} ${at(x, y, a, l * 0.4, w * 0.5)} ${at(x, y, a, 0, w * 0.22)}Z`;
/** A flower seen from the front: `n` petals round a point. */
function petals(x: number, y: number, n: number, l: number, w: number, turn = 0): string {
  return Array.from({ length: n }, (_, i) => leaf(x, y, turn + (i * 360) / n, l, w)).join("");
}
/** Evenly scattered points in a disc, the same every time. */
function disc(cx: number, cy: number, rx: number, ry: number, count: number): [number, number, number][] {
  return Array.from({ length: count }, (_, i) => {
    const r = Math.sqrt((i + 0.5) / count);
    const t = i * 137.508;
    return [cx + Math.sin(rad(t)) * r * rx, cy - Math.cos(rad(t)) * r * ry, t] as [number, number, number];
  });
}
/** Points along a curve from p0, bending towards c, to p1. */
function along(p0: [number, number], c: [number, number], p1: [number, number], count: number): [number, number][] {
  return Array.from({ length: count }, (_, i) => {
    const t = (i + 1) / count;
    const m = 1 - t;
    return [m * m * p0[0] + 2 * m * t * c[0] + t * t * p1[0], m * m * p0[1] + 2 * m * t * c[1] + t * t * p1[1]] as [number, number];
  });
}

const Fill = ({ d, c, o }: { d: string; c: string; o?: number }) => <path d={d} fill={c} opacity={o} />;
const Stroke = ({ d, c, w, o }: { d: string; c: string; w: number; o?: number }) => <path d={d} fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" opacity={o} />;
const Soil = () => (
  <>
    <ellipse cx="100" cy="174" rx="60" ry="9" fill="#6f5238" />
    <ellipse cx="100" cy="172" rx="44" ry="5" fill="#8a6a48" />
  </>
);
/** A seedling: a thin stem and two seed leaves. */
const Seedling = ({ h, c, stem, l = 15, w = 7 }: { h: number; c: string; stem: string; l?: number; w?: number }) => (
  <>
    <Soil />
    <Stroke d={`M100 172Q99 ${172 - h / 2} 100 ${172 - h}`} c={stem} w={2.4} />
    <Fill d={leaf(100, 172 - h, -58, l, w) + leaf(100, 172 - h, 58, l, w)} c={c} />
  </>
);

type Art = Record<StageId, ReactNode>;

function salix(): Art {
  const bark = "#7c6a58";
  const branch = (p0: [number, number], c: [number, number], p1: [number, number], count: number) => {
    const pts = along(p0, c, p1, count);
    return {
      stem: `M${n1(p0[0])} ${n1(p0[1])}Q${n1(c[0])} ${n1(c[1])} ${n1(p1[0])} ${n1(p1[1])}`,
      leaves: pts.map(([x, y], i) => leaf(x, y, 180 + (i % 2 ? 26 : -26), 13, 4)).join(""),
      end: p1,
    };
  };
  const small = [branch([100, 112], [76, 94], [68, 122], 6), branch([100, 112], [124, 94], [132, 122], 6), branch([100, 98], [90, 76], [78, 96], 5), branch([100, 98], [110, 76], [122, 96], 5)];
  const big = [
    branch([100, 92], [60, 44], [26, 108], 11),
    branch([100, 92], [140, 44], [174, 108], 11),
    branch([100, 84], [72, 26], [44, 84], 10),
    branch([100, 84], [128, 26], [156, 84], 10),
    branch([100, 78], [88, 18], [68, 68], 8),
    branch([100, 78], [112, 18], [132, 68], 8),
    branch([100, 104], [70, 78], [50, 134], 9),
    branch([100, 104], [130, 78], [150, 134], 9),
  ];
  return {
    seed: (
      <>
        <Soil />
        <Stroke d="M100 164l-7-9M100 164l-2-12M100 164l4-11M100 164l9-8" c="#fff" w={1.4} />
        <Fill d={leaf(100, 172, 0, 10, 4)} c="#8a6d44" />
      </>
    ),
    sprout: <Seedling h={26} c="#8fb27a" stem="#8a8a5a" l={17} w={4.5} />,
    sapling: (
      <>
        <Soil />
        <Stroke d="M100 172C99 150 101 130 100 96" c={bark} w={4.5} />
        <Stroke d={small.map((b) => b.stem).join("")} c={bark} w={1.5} />
        <Fill d={small.map((b) => b.leaves).join("")} c="#94b583" />
      </>
    ),
    canopy: (
      <>
        <Soil />
        <Stroke d="M100 173C96 146 104 120 100 80" c={bark} w={10} />
        <Stroke d={big.map((b) => b.stem).join("")} c={bark} w={1.8} />
        <Fill d={big.filter((_, i) => i % 2).map((b) => b.leaves).join("")} c="#a4c295" />
        <Fill d={big.filter((_, i) => !(i % 2)).map((b) => b.leaves).join("")} c="#7fa372" />
      </>
    ),
    flowering: <Fill d={big.flatMap((b) => along([b.end[0], b.end[1] - 22], [b.end[0], b.end[1] - 8], b.end, 3).map(([x, y]) => leaf(x, y - 2, 180, 11, 6))).join("")} c="#e6c43e" />,
  };
}

function digitalis(): Art {
  const fan = (n: number, l: number, w: number) => Array.from({ length: n }, (_, i) => leaf(100, 170, -78 + (156 * i) / (n - 1), l - (i % 2) * 6, w)).join("");
  const spire = Array.from({ length: 11 }, (_, i) => ({ y: 48 + i * 7, size: 7 + i * 0.85, side: i % 3 === 2 ? -1 : 1 }));
  return {
    seed: (
      <>
        <Soil />
        <Fill d={circle(93, 168, 1.8) + circle(100, 166, 1.8) + circle(107, 168, 1.8)} c="#5c4630" />
      </>
    ),
    sprout: <Seedling h={16} c="#7fae72" stem="#7f9b5f" l={15} w={9} />,
    sapling: (
      <>
        <Soil />
        <Fill d={fan(7, 40, 15)} c="#6c9f66" />
        <Stroke d={Array.from({ length: 7 }, (_, i) => line(100, 170, -78 + 26 * i, 30 - (i % 2) * 5)).join("")} c="#a7c99c" w={1} />
      </>
    ),
    canopy: (
      <>
        <Soil />
        <Fill d={fan(9, 54, 19)} c="#5f9560" />
        <Stroke d="M100 170C99 130 101 90 100 34" c="#6f8f4f" w={3.6} />
        <Fill d={leaf(100, 140, -58, 26, 9) + leaf(100, 126, 58, 24, 8) + leaf(100, 112, -58, 20, 6)} c="#6fa56a" />
        <Fill d={Array.from({ length: 11 }, (_, i) => leaf(100, 34 + i * 6, 118 - (i % 3 === 2 ? 236 : 0), 6 + i * 0.3, 3)).join("")} c="#9abb6d" />
      </>
    ),
    flowering: (
      <>
        <Fill d={spire.map((b) => bell(100, b.y, b.side > 0 ? 112 : -112, b.size * 2.1, b.size * 1.05)).join("")} c="#b0489c" />
        <Fill d={spire.map((b) => circle(100 + b.side * b.size * 1.85, b.y + b.size * 0.78, b.size * 0.34)).join("")} c="#f5dcef" />
        <Fill d={spire.map((b) => circle(100 + b.side * b.size * 1.85, b.y + b.size * 0.78, b.size * 0.13)).join("")} c="#6c1f5c" />
      </>
    ),
  };
}

function cinchona(): Art {
  const bark = "#8b4a35";
  const crown = disc(100, 78, 62, 54, 34);
  const leaves = crown.map(([x, y, t]) => ({ x, y, a: Math.atan2(x - 100, 78 - y) * (180 / Math.PI) + (t % 40) - 20 }));
  const tips = disc(100, 72, 58, 48, 9);
  return {
    seed: (
      <>
        <Soil />
        <Fill d={leaf(92, 170, 80, 16, 5)} c="#9a6c44" />
      </>
    ),
    sprout: <Seedling h={24} c="#3f8a58" stem="#8b5a3f" l={16} w={11} />,
    sapling: (
      <>
        <Soil />
        <Stroke d="M100 172C100 150 100 130 100 84" c={bark} w={4} />
        <Fill d={[122, 104, 86].flatMap((y, i) => [leaf(100, y, -68, 34 - i * 4, 16 - i * 2), leaf(100, y, 68, 34 - i * 4, 16 - i * 2)]).join("") + leaf(100, 86, 0, 22, 9)} c="#3a8354" />
        <Stroke d={[122, 104, 86].flatMap((y, i) => [line(100, y, -68, 30 - i * 4), line(100, y, 68, 30 - i * 4)]).join("")} c="#a84a3c" w={0.9} />
      </>
    ),
    canopy: (
      <>
        <Soil />
        <Stroke d="M100 173C99 150 101 128 100 90M100 116L68 92M100 106L134 86M100 94L86 62M100 94L116 58" c={bark} w={7} />
        <Fill d={leaves.filter((_, i) => i % 2).map((l) => leaf(l.x, l.y, l.a, 26, 15)).join("")} c="#2f7a4b" />
        <Fill d={leaves.filter((_, i) => !(i % 2)).map((l) => leaf(l.x, l.y, l.a, 25, 14)).join("")} c="#3f9460" />
        <Stroke d={leaves.map((l) => line(l.x, l.y, l.a, 21)).join("")} c="#b8574a" w={0.8} />
      </>
    ),
    flowering: (
      <>
        <Fill d={tips.flatMap(([x, y]) => disc(x, y, 8, 8, 6).map(([a, b, t]) => petals(a, b, 5, 3.6, 1.8, t))).join("")} c="#ec8fae" />
        <Fill d={tips.flatMap(([x, y]) => disc(x, y, 8, 8, 6).map(([a, b]) => circle(a, b, 0.8))).join("")} c="#fff4dc" />
      </>
    ),
  };
}

function artemisia(): Art {
  /** A finely cut, feathery leaf. */
  const frond = (x: number, y: number, a: number, l: number) => {
    let d = line(x, y, a, l);
    for (let i = 1; i <= 5; i++) {
      const [px, py] = point(x, y, a, (l * i) / 6);
      const side = l * 0.34 * (1 - i / 8);
      d += line(px, py, a - 48, side) + line(px, py, a + 48, side);
    }
    return d;
  };
  const tiers = Array.from({ length: 11 }, (_, i) => ({ y: 158 - i * 11, l: 42 - i * 3.1 }));
  const heads = tiers.slice(3).flatMap((t) =>
    [-1, 1].flatMap((side) =>
      [0.45, 0.72, 1].flatMap((f) => {
        const [x, y] = point(100, t.y, side * 58, t.l * f);
        return [circle(x, y, 2.3), circle(x + side * 3, y - 4, 1.8)];
      }),
    ),
  );
  return {
    seed: (
      <>
        <Soil />
        <Fill d={circle(96, 169, 1.3) + circle(101, 167, 1.3) + circle(105, 169, 1.3)} c="#6f5a3a" />
      </>
    ),
    sprout: (
      <>
        <Soil />
        <Stroke d="M100 172V150" c="#7c9d5a" w={2} />
        <Stroke d={frond(100, 154, -52, 16) + frond(100, 154, 52, 16) + frond(100, 150, 0, 12)} c="#79a65f" w={1.3} />
      </>
    ),
    sapling: (
      <>
        <Soil />
        <Stroke d="M100 172V84" c="#7c8f4f" w={2.8} />
        <Stroke d={[150, 134, 118, 102, 90].flatMap((y, i) => [frond(100, y, -60, 32 - i * 3.5), frond(100, y, 60, 32 - i * 3.5)]).join("") + frond(100, 88, 0, 16)} c="#6f9f58" w={1.4} />
      </>
    ),
    canopy: (
      <>
        <Soil />
        <Stroke d="M100 172V34" c="#7a8646" w={3.4} />
        <Stroke d={tiers.filter((_, i) => i % 2).flatMap((t) => [frond(100, t.y, -58, t.l), frond(100, t.y, 58, t.l)]).join("")} c="#5f934f" w={1.5} />
        <Stroke d={tiers.filter((_, i) => !(i % 2)).flatMap((t) => [frond(100, t.y, -58, t.l), frond(100, t.y, 58, t.l)]).join("") + frond(100, 42, 0, 18)} c="#7cae63" w={1.5} />
      </>
    ),
    flowering: <Fill d={heads.join("")} c="#d9c636" />,
  };
}

function papaver(): Art {
  const grey = "#7f9f92";
  /** A jagged, clasping leaf. */
  const lobed = (x: number, y: number, a: number, l: number) => {
    let d = leaf(x, y, a, l, l * 0.3);
    for (const f of [0.28, 0.52]) {
      const [px, py] = point(x, y, a, l * f);
      d += leaf(px, py, a - 42, l * 0.34, l * 0.1) + leaf(px, py, a + 42, l * 0.34, l * 0.1);
    }
    return d;
  };
  const low = lobed(100, 168, -70, 42) + lobed(100, 168, 70, 42) + lobed(100, 166, -36, 38) + lobed(100, 166, 36, 38) + lobed(100, 150, -62, 30) + lobed(100, 136, 62, 26) + lobed(100, 118, -58, 22);
  const bloom = (x: number, y: number, r: number) => (
    <>
      <Fill d={leaf(x, y, 0, r, r * 1.1) + leaf(x, y, 180, r, r * 1.1)} c="#c58fc2" />
      <Fill d={leaf(x, y, 90, r, r * 1.1) + leaf(x, y, -90, r, r * 1.1)} c="#d9a9d4" />
      <Fill d={circle(x, y, r * 0.42)} c="#4c2350" />
      <Fill d={circle(x, y, r * 0.24)} c="#a9bb76" />
      <Stroke d={Array.from({ length: 6 }, (_, i) => line(x, y, i * 60, r * 0.2)).join("")} c="#5c6a3a" w={0.9} />
    </>
  );
  return {
    seed: (
      <>
        <Soil />
        <Fill d={[90, 95, 100, 105, 110].map((x, i) => circle(x, 168 - (i % 2) * 2, 1.2)).join("")} c="#3f3f4c" />
      </>
    ),
    sprout: <Seedling h={18} c={grey} stem="#8ea57f" l={13} w={5} />,
    sapling: (
      <>
        <Soil />
        <Fill d={lobed(100, 168, -74, 36) + lobed(100, 168, 74, 36) + lobed(100, 166, -38, 32) + lobed(100, 166, 38, 32) + lobed(100, 166, 0, 28)} c={grey} />
      </>
    ),
    canopy: (
      <>
        <Soil />
        <Stroke d="M100 170C100 130 104 90 100 56C98 40 84 40 84 52M100 170C94 140 76 120 70 84M100 170C106 140 124 124 130 92" c="#8ca58b" w={2.6} />
        <Fill d={low} c={grey} />
        {/* Nodding buds: a poppy's bud hangs until the day it opens. */}
        <Fill d={leaf(84, 50, 180, 17, 10) + leaf(70, 84, 0, 15, 9) + leaf(130, 92, 0, 15, 9)} c="#7a9c75" />
      </>
    ),
    flowering: (
      <>
        {bloom(100, 44, 24)}
        {bloom(66, 76, 18)}
        <Fill d="M124 92c0-16 12-16 12 0c0 12-12 12-12 0Z" c="#8fae72" />
        <Fill d="M121 78h18l-2 4h-14Z" c="#5f7a4a" />
      </>
    ),
  };
}

function catharanthus(): Art {
  const bush = disc(100, 126, 62, 40, 30);
  const leaves = bush.map(([x, y, t]) => ({ x, y, a: Math.atan2(x - 100, 150 - y) * (180 / Math.PI) + (t % 30) - 15 }));
  const blooms: [number, number, number][] = [[100, 90, 15], [66, 106, 13], [134, 104, 13], [84, 128, 12], [120, 130, 12], [48, 134, 10], [152, 132, 10]];
  return {
    seed: (
      <>
        <Soil />
        <Fill d={leaf(94, 169, 90, 8, 3) + leaf(103, 167, 70, 8, 3)} c="#3a2c22" />
      </>
    ),
    sprout: <Seedling h={20} c="#3e8a54" stem="#7a9a66" l={15} w={10} />,
    sapling: (
      <>
        <Soil />
        <Stroke d="M100 172V112M100 150L80 132M100 146L120 128" c="#8a6f75" w={2.8} />
        <Fill d={[[100, 112, 0], [100, 124, -66], [100, 124, 66], [80, 132, -45], [80, 132, 40], [120, 128, 45], [120, 128, -40]].map(([x, y, a]) => leaf(x!, y!, a!, 24, 13)).join("")} c="#2f8050" />
        <Stroke d={[[100, 112, 0], [100, 124, -66], [100, 124, 66], [80, 132, -45], [80, 132, 40], [120, 128, 45], [120, 128, -40]].map(([x, y, a]) => line(x!, y!, a!, 20)).join("")} c="#cfe5c3" w={0.9} />
      </>
    ),
    canopy: (
      <>
        <Soil />
        <Stroke d="M100 172L100 110M100 168L58 128M100 168L142 128M100 150L74 104M100 150L126 104" c="#8a6f75" w={3} />
        <Fill d={leaves.map((l) => leaf(l.x, l.y, l.a, 25, 14)).join("")} c="#2a7a4a" />
        <Stroke d={leaves.map((l) => line(l.x, l.y, l.a, 21)).join("")} c="#cfe5c3" w={0.9} />
      </>
    ),
    flowering: (
      <>
        <Fill d={blooms.map(([x, y, r]) => petals(x, y, 5, r, r * 0.8, 12)).join("")} c="#e9609e" />
        <Fill d={blooms.map(([x, y, r]) => circle(x, y, r * 0.24)).join("")} c="#8e1b52" />
        <Fill d={blooms.map(([x, y, r]) => circle(x, y, r * 0.08)).join("")} c="#fff0c9" />
      </>
    ),
  };
}

function atropa(): Art {
  const stems = "M100 172L100 118M100 118L62 80M100 118L138 80M100 118L100 62M80 98L52 112M120 98L148 112";
  const spots: [number, number, number][] = [[62, 80, -30], [62, 80, -100], [138, 80, 30], [138, 80, 100], [100, 62, -40], [100, 62, 40], [52, 112, -95], [148, 112, 95], [80, 98, -10], [120, 98, 10], [100, 92, -60], [100, 92, 60], [100, 140, -70], [100, 140, 70], [70, 72, -60], [130, 72, 60]];
  const bells: [number, number][] = [[58, 92], [144, 90], [84, 104], [120, 106], [46, 124]];
  const berries: [number, number][] = [[154, 124], [70, 106], [130, 110], [100, 106]];
  return {
    seed: (
      <>
        <Soil />
        <Fill d={circle(95, 168, 2) + circle(103, 166, 2)} c="#2a2424" />
      </>
    ),
    sprout: <Seedling h={22} c="#58955a" stem="#7a7f52" l={16} w={10} />,
    sapling: (
      <>
        <Soil />
        <Stroke d="M100 172L100 110M100 124L78 100M100 124L122 100" c="#7a6a50" w={3} />
        <Fill d={[[100, 110, 0], [78, 100, -30], [122, 100, 30], [100, 142, -72], [100, 142, 72]].map(([x, y, a]) => leaf(x!, y!, a!, 32, 16)).join("")} c="#4a8a50" />
      </>
    ),
    canopy: (
      <>
        <Soil />
        <Stroke d={stems} c="#7a6a50" w={3.6} />
        <Fill d={spots.map(([x, y, a]) => leaf(x, y, a, 36, 18)).join("")} c="#44834a" />
      </>
    ),
    flowering: (
      <>
        <Fill d={bells.map(([x, y]) => bell(x, y, 176, 17, 11)).join("")} c="#6f3f73" />
        <Fill d={bells.map(([x, y]) => leaf(x, y + 1, 180, 7, 7)).join("")} c="#a5a35a" />
        <Fill d={berries.map(([x, y]) => petals(x, y, 5, 10, 4, 18)).join("")} c="#5d8f4c" />
        <Fill d={berries.map(([x, y]) => circle(x, y, 6)).join("")} c="#17131a" />
        <Fill d={berries.map(([x, y]) => circle(x - 2, y - 2, 1.4)).join("")} c="#e9e6ee" />
      </>
    ),
  };
}

function colchicum(): Art {
  const strap = (a: number, l: number, w: number) => leaf(100, 170, a, l, w);
  const goblet = (x: number, top: number, s: number) => (
    <>
      <Fill d={`M${x - 2.4} 172L${x - 1.4} ${top + s}L${x + 1.4} ${top + s}L${x + 2.4} 172Z`} c="#f3ecf4" />
      <Fill d={leaf(x, top + s * 1.5, -26, s * 1.6, s * 0.72) + leaf(x, top + s * 1.5, 26, s * 1.6, s * 0.72)} c="#b98ed0" />
      <Fill d={leaf(x, top + s * 1.5, 0, s * 1.75, s * 0.78)} c="#cfa9e0" />
      <Stroke d={line(x, top + s * 1.4, 0, s * 0.7)} c="#dd9b2c" w={1.6} />
    </>
  );
  return {
    seed: (
      <>
        <Soil />
        <path d="M100 150C114 152 118 164 112 174H88C82 164 86 152 100 150Z" fill="#8c6a48" />
        <Stroke d="M93 158C96 162 96 168 94 172M106 158C103 162 104 168 106 172" c="#6d5036" w={1} />
      </>
    ),
    sprout: (
      <>
        <Soil />
        <Fill d={leaf(100, 172, -6, 30, 8) + leaf(100, 172, 8, 24, 7)} c="#78a85e" />
      </>
    ),
    sapling: (
      <>
        <Soil />
        <Fill d={strap(-26, 56, 16) + strap(26, 56, 16) + strap(-8, 72, 16) + strap(10, 66, 15)} c="#5f9a58" />
      </>
    ),
    canopy: (
      <>
        <Soil />
        <Fill d={strap(-40, 72, 20) + strap(40, 72, 20) + strap(-22, 92, 22) + strap(22, 92, 22)} c="#4f8d50" />
        <Fill d={strap(-7, 108, 22) + strap(9, 100, 21)} c="#62a05e" />
      </>
    ),
    // It flowers in autumn with its leaves already gone: drawn on bare soil, as it grows.
    flowering: (
      <>
        <Soil />
        {goblet(68, 96, 20)}
        {goblet(130, 92, 21)}
        {goblet(100, 64, 25)}
      </>
    ),
  };
}

function taxus(): Art {
  const needles = (x: number, y: number, a: number, l: number, n: number) => {
    let d = line(x, y, a, l);
    for (let i = 1; i <= n; i++) {
      const [px, py] = point(x, y, a, (l * i) / (n + 1));
      d += line(px, py, a - 62, 7) + line(px, py, a + 62, 7);
    }
    return d;
  };
  const tiers = Array.from({ length: 8 }, (_, i) => ({ y: 146 - i * 14.5, l: 66 - i * 7.2 }));
  const sides = tiers.flatMap((t) => [needles(100, t.y, -100, t.l, Math.round(t.l / 4.6)), needles(100, t.y, 100, t.l, Math.round(t.l / 4.6))]);
  const arils = tiers.slice(0, 6).flatMap((t, i) => [point(100, t.y + 6, -100, t.l * (0.42 + (i % 3) * 0.17)), point(100, t.y + 6, 100, t.l * (0.6 - (i % 3) * 0.14))]);
  return {
    seed: (
      <>
        <Soil />
        <Fill d={circle(100, 165, 6)} c="#d6263d" />
        <Fill d={circle(100, 165, 2.6)} c="#26343a" />
      </>
    ),
    sprout: (
      <>
        <Soil />
        <Stroke d="M100 172V146" c="#7f5040" w={2.2} />
        <Stroke d={needles(100, 168, 0, 24, 5)} c="#2d6642" w={1.5} />
      </>
    ),
    sapling: (
      <>
        <Soil />
        <Stroke d="M100 172V84" c="#7a4635" w={3.4} />
        <Stroke d={[146, 128, 110, 94].flatMap((y, i) => [needles(100, y, -100, 36 - i * 7, 5 - i), needles(100, y, 100, 36 - i * 7, 5 - i)]).join("") + needles(100, 98, 0, 18, 3)} c="#2b6140" w={1.5} />
      </>
    ),
    canopy: (
      <>
        <Soil />
        <Stroke d="M100 173L100 34" c="#7a4032" w={8} />
        <Stroke d={sides.filter((_, i) => i % 4 < 2).join("")} c="#1f5135" w={1.8} />
        <Stroke d={sides.filter((_, i) => i % 4 >= 2).join("") + needles(100, 44, 0, 20, 3)} c="#2f6d48" w={1.8} />
      </>
    ),
    flowering: (
      <>
        <Fill d={arils.map(([x, y]) => circle(x, y, 4.6)).join("")} c="#d6263d" />
        <Fill d={arils.map(([x, y]) => circle(x, y + 0.5, 1.9)).join("")} c="#26343a" />
      </>
    ),
  };
}

function penicillium(): Art {
  /** A colony from above: a white growing edge round a blue-green, sporing centre. */
  const colony = (x: number, y: number, r: number, ripe: boolean) => (
    <g key={`${x}-${y}`}>
      <Fill d={circle(x, y, r)} c="#fbfbf4" />
      <Fill d={circle(x, y, r * 0.8)} c={ripe ? "#3f8f87" : "#a9cfc4"} />
      {ripe && <Fill d={circle(x, y, r * 0.48)} c="#2f736d" />}
      <Stroke d={Array.from({ length: 14 }, (_, i) => line(...point(x, y, i * 25.7, r * 0.3), i * 25.7, r * 0.42)).join("")} c={ripe ? "#6db3a8" : "#d6e7df"} w={0.8} />
    </g>
  );
  const Dish = ({ children }: { children: ReactNode }) => (
    <>
      <ellipse cx="100" cy="176" rx="66" ry="7" fill="#000" opacity="0.1" />
      <circle cx="100" cy="102" r="74" fill="#f3f7f6" stroke="#a7b8b4" strokeWidth="2.4" />
      <circle cx="100" cy="102" r="68" fill="#ecd9a0" />
      {children}
      <path d="M52 62C66 44 82 38 100 37" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
    </>
  );
  const big: [number, number, number][] = [[72, 80, 21], [126, 74, 18], [108, 122, 25], [60, 126, 14], [144, 118, 12]];
  return {
    seed: (
      <Dish>
        <Fill d={disc(100, 102, 42, 42, 7).map(([x, y]) => circle(x, y, 1.5)).join("")} c="#3f8f87" />
      </Dish>
    ),
    sprout: (
      <Dish>
        <Stroke d={disc(100, 102, 42, 42, 7).flatMap(([x, y, t]) => [line(x, y, t, 12), line(x, y, t + 130, 8)]).join("")} c="#fbfbf4" w={1.3} />
        <Fill d={disc(100, 102, 42, 42, 7).map(([x, y]) => circle(x, y, 1.5)).join("")} c="#3f8f87" />
      </Dish>
    ),
    sapling: <Dish>{[[76, 84, 11], [124, 80, 9], [106, 122, 13]].map(([x, y, r]) => colony(x!, y!, r!, false))}</Dish>,
    canopy: <Dish>{big.map(([x, y, r]) => colony(x, y, r, true))}</Dish>,
    // Ripe: spores dusted over the plate, and the yellow droplets that give chrysogenum ("golden") its name.
    flowering: (
      <>
        <Fill d={big.flatMap(([x, y, r]) => disc(x, y, r * 0.55, r * 0.55, 5).map(([a, b]) => circle(a, b, 1.5))).join("")} c="#efc832" />
        <Fill d={disc(100, 102, 58, 58, 26).map(([x, y]) => circle(x, y, 0.8)).join("")} c="#2f736d" />
      </>
    ),
  };
}

const DRAW: Record<PlantId, () => Art> = { salix, digitalis, cinchona, artemisia, papaver, catharanthus, atropa, colchicum, taxus, penicillium };
const cache = new Map<PlantId, Art>();
function artOf(plant: PlantId): Art {
  let art = cache.get(plant);
  if (!art) cache.set(plant, (art = DRAW[plant]()));
  return art;
}

/** What shows at a stage: the flower is added over the full plant, apart from the autumn crocus, whose leaves have gone. */
const layersOf = (plant: PlantId, stage: StageId): StageId[] => (stage !== "flowering" ? [stage] : plant === "colchicum" ? ["flowering"] : ["canopy", "flowering"]);

function Layers({ plant, stage, scale = 1 }: { plant: PlantId; stage: StageId; scale?: number }) {
  const art = artOf(plant);
  const on = layersOf(plant, stage);
  return (
    <>
      {STAGE_IDS.map((s) => {
        const shown = on.includes(s);
        return (
          <g key={s} className={cn(styles.layer, shown && styles.layerOn)} style={{ transform: shown ? `scale(${scale})` : "scale(0.82)" }}>
            {art[s]}
          </g>
        );
      })}
    </>
  );
}

/** A plant at this share of its session. `withered` fades in the browned, drooping one over the living one. */
export function PlantArt({ plant, progress, withered = false, className, label }: { plant: PlantId; progress: number; withered?: boolean; className?: string; label?: string }) {
  const stage = stageOf(progress);
  const scale = stage === "flowering" ? 1 : 0.9 + 0.1 * withinStage(progress);
  return (
    <svg viewBox="0 0 200 200" className={cn(styles.art, className)} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <g className={styles.dryLayer} style={{ opacity: withered ? 0 : 1 }}>
        <Layers plant={plant} stage={stage} scale={scale} />
      </g>
      <g className={cn(styles.dryLayer, withered && styles.droop)} style={{ opacity: withered ? 1 : 0 }}>
        <g className={styles.dry}>{withered && <Layers plant={plant} stage={stage} scale={scale} />}</g>
      </g>
    </svg>
  );
}

/** A plant that doesn't change, for the garden and the picker: only what shows is drawn, so a big garden stays light. */
export function StillPlant({ plant, stage, withered = false, className, label }: { plant: PlantId; stage: StageId; withered?: boolean; className?: string; label?: string }) {
  const art = artOf(plant);
  return (
    <svg viewBox="0 0 200 200" className={cn(styles.art, className)} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <g className={withered ? cn(styles.dry, styles.droop) : undefined}>
        {layersOf(plant, stage).map((s) => (
          <g key={s}>{art[s]}</g>
        ))}
      </g>
    </svg>
  );
}

/** The ring round the plant, filled by rotating two half-circles (transform only, so it stays smooth on any phone). */
export function GrowthRing({ progress, children, className }: { progress: number; children: ReactNode; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const p = Math.max(0, Math.min(1, progress));
  const arc = "M110 6A104 104 0 0 1 110 214";
  return (
    <div className={cn("relative aspect-square", className)} role="progressbar" aria-label="Growth" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p * 100)}>
      <div className={cn(styles.plate, "absolute inset-[7%] overflow-hidden rounded-full")}>{children}</div>
      <svg viewBox="0 0 220 220" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <clipPath id={`${id}r`}><rect x="110" y="0" width="112" height="220" /></clipPath>
          <clipPath id={`${id}l`}><rect x="-2" y="0" width="112" height="220" /></clipPath>
        </defs>
        <circle cx="110" cy="110" r="104" fill="none" strokeWidth="7" className={styles.ringTrack} />
        <g clipPath={`url(#${id}r)`}>
          <path d={arc} fill="none" strokeWidth="7" className={cn(styles.ringFill, styles.ringTurn)} style={{ transform: `rotate(${Math.min(p, 0.5) * 360 - 180}deg)` }} />
        </g>
        <g clipPath={`url(#${id}l)`}>
          <path d={arc} fill="none" strokeWidth="7" className={cn(styles.ringFill, styles.ringTurn)} style={{ transform: `rotate(${Math.max(0, p - 0.5) * 360}deg)` }} />
        </g>
        <g className={styles.ringTurn} style={{ transform: `rotate(${p * 360}deg)` }}>
          <circle cx="110" cy="6" r="5.5" className={styles.ringTip} />
        </g>
      </svg>
    </div>
  );
}
