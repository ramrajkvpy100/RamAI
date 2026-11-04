import { useId, type ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * RamAI's own drawn icons: layered, shaded medical pictures on a soft pastel squircle. Drawn on a 48-unit grid, so they
 * stay sharp at any size. No images and no library. Pure markup, so they cost nothing on a page's first paint.
 */

export type MedicalIconName =
  | "medicine" | "surgery" | "pediatrics" | "obgyn" | "psychiatry" | "emergency" | "gp" | "radiology" | "dermatology"
  | "orthopedics" | "anesthesiology" | "neurology" | "cardiology" | "respiratory" | "gastro" | "nephrology" | "endocrine"
  | "infectious" | "ent" | "ophthalmology" | "urology"
  | "clinical-games" | "image-rush" | "synapses" | "probe"
  | "mnemonics" | "flowcharts" | "youtube" | "notes" | "research";

/** The pastel behind each icon: top-left colour, bottom-right colour. Dark mode keeps them, so the drawing always reads. */
const PLATE: Record<MedicalIconName, [string, string]> = {
  medicine: ["#e4efff", "#c9dfff"], surgery: ["#dcf7f0", "#bdeee1"], pediatrics: ["#e3f4ff", "#c8e9ff"], obgyn: ["#ffe8e6", "#ffd3cf"],
  psychiatry: ["#e7ecff", "#d0d9ff"], emergency: ["#fff0e4", "#ffdcc4"], gp: ["#e4efff", "#cfe2ff"], radiology: ["#e6eaf1", "#cdd5e1"],
  dermatology: ["#ffe9f0", "#ffd4e2"], orthopedics: ["#eef1f5", "#dbe1e9"], anesthesiology: ["#e2f3ff", "#c8e7ff"], neurology: ["#e7edff", "#cfdcff"],
  cardiology: ["#ffe7ea", "#ffd0d6"], respiratory: ["#e4f2ff", "#cce5ff"], gastro: ["#fff1df", "#ffe2bd"], nephrology: ["#f7e8e4", "#f0d4cd"],
  endocrine: ["#f1e9ff", "#e0d2ff"], infectious: ["#e6f8e8", "#ccf0d1"], ent: ["#fff3df", "#ffe6bf"], ophthalmology: ["#e2f7f8", "#c6eef0"],
  urology: ["#fff7d9", "#ffefb5"], "clinical-games": ["#e4efff", "#c9dfff"], "image-rush": ["#fff0e0", "#ffdcb8"], synapses: ["#efe8ff", "#dccfff"],
  probe: ["#e1f8f2", "#c2f0e4"], mnemonics: ["#fff6d8", "#ffeab0"], flowcharts: ["#e3f2ff", "#c9e5ff"], youtube: ["#ffe7e7", "#ffcfcf"],
  notes: ["#e8f8e6", "#d0f0cc"], research: ["#ece9ff", "#d9d4ff"],
};

type Draw = (id: (s: string) => string) => ReactNode;

/** A vertical shading, from light at the top to deep at the bottom: what makes a flat shape look solid. */
const shade = (id: string, top: string, bottom: string) => (
  <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stopColor={top} />
    <stop offset="1" stopColor={bottom} />
  </linearGradient>
);

const DRAW: Record<MedicalIconName, Draw> = {
  medicine: (u) => (
    <>
      <defs>{shade(u("b"), "#5b9bff", "#2563eb")}{shade(u("l"), "#ffb4b4", "#f0716f")}</defs>
      <path d="M17 7c-3 1-5 3-6 6l-2 9c-1 6-1 13 0 19h30c1-6 1-13 0-19l-2-9c-1-3-3-5-6-6l-3 3h-8z" fill={`url(#${u("b")})`} />
      <path d="M21 7h6l-1 4h-4z" fill="#1d4fc0" />
      <path d="M23 13h2v8h-2z" fill="#dbe9ff" />
      <path d="M23 20c-2 1-4 3-5 5M25 20c2 1 4 3 5 5" stroke="#dbe9ff" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M21 18c-4 0-7 4-8 9-1 4-1 7 0 8 3 1 7-1 8-3 1-4 1-9 0-14z" fill="#bcd6ff" opacity=".95" />
      <path d="M27 18c4 0 7 4 8 9 1 4 1 7 0 8-3 1-7-1-8-3-1-4-1-9 0-14z" fill="#bcd6ff" opacity=".95" />
      <path d="M24 25c-1-2-5-2-5 2 0 3 3 6 5 8 3-2 6-5 6-8 0-4-5-4-6-2z" fill={`url(#${u("l")})`} stroke="#c93c3c" strokeWidth=".6" />
    </>
  ),
  surgery: (u) => (
    <>
      <defs>{shade(u("t"), "#ffc9bd", "#f39a89")}{shade(u("m"), "#f2f7fa", "#9fb2c1")}{shade(u("h"), "#35d0ae", "#0f9a80")}</defs>
      <path d="M6 33l18-7 18 7-18 8z" fill={`url(#${u("t")})`} />
      <path d="M6 33v3l18 8v-3zM42 33v3l-18 8v-3z" fill="#d97968" />
      <path d="M16 31l9-3" stroke="#b5463a" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M25 26l15-18c1-1 2.600 0 2 2L31 30z" fill={`url(#${u("h")})`} />
      <path d="M25 26l6 4-5 2c-5 2-11 1-13 0 5-1 9-3 12-6z" fill={`url(#${u("m")})`} stroke="#7c8e9c" strokeWidth=".5" />
      <path d="M34 15l3 2.200" stroke="#0b7763" strokeWidth="1" />
    </>
  ),
  pediatrics: (u) => (
    <>
      <defs>{shade(u("b"), "#7cc8ff", "#3b9fe8")}{shade(u("s"), "#ffe0c4", "#f6c39c")}</defs>
      <circle cx="24" cy="14" r="9" fill={`url(#${u("s")})`} />
      <path d="M16 12c1-5 5-7 9-7s7 3 7 7c-3-3-5-3-8-3-3 1-6 1-8 3z" fill="#8a5a3b" />
      <circle cx="20.500" cy="15" r="1.200" fill="#35251a" /><circle cx="27.500" cy="15" r="1.200" fill="#35251a" />
      <path d="M21.500 18.500c1.500 1.400 3.500 1.400 5 0" stroke="#b85a3f" strokeWidth="1" fill="none" strokeLinecap="round" />
      <circle cx="17.800" cy="17.500" r="1.500" fill="#ff9d94" opacity=".55" /><circle cx="30.200" cy="17.500" r="1.500" fill="#ff9d94" opacity=".55" />
      <path d="M15 27c0-3 4-5 9-5s9 2 9 5l1 9H14z" fill={`url(#${u("b")})`} />
      <path d="M15 27l-6 7c-1 2 1 3 2.500 2l6-5zM33 27l6 7c1 2-1 3-2.500 2l-6-5z" fill={`url(#${u("s")})`} />
      <path d="M14 36c-5 0-7 3-5 5 1 2 11 2 15-1 4 3 14 3 15 1 2-2 0-5-5-5z" fill="#2e8bd6" />
      <ellipse cx="8.500" cy="41" rx="3" ry="2.200" fill={`url(#${u("s")})`} /><ellipse cx="39.500" cy="41" rx="3" ry="2.200" fill={`url(#${u("s")})`} />
    </>
  ),
  obgyn: (u) => (
    <>
      <defs>{shade(u("u"), "#ff9d92", "#e8605c")}</defs>
      <path d="M17 16c-3-3-7-4-10-2-2 1-2 4 0 4 3-1 6-1 9 3z" fill={`url(#${u("u")})`} />
      <path d="M31 16c3-3 7-4 10-2 2 1 2 4 0 4-3-1-6-1-9 3z" fill={`url(#${u("u")})`} />
      <ellipse cx="9" cy="23" rx="4" ry="3" fill="#ffc6b8" stroke="#e8605c" strokeWidth=".7" />
      <ellipse cx="39" cy="23" rx="4" ry="3" fill="#ffc6b8" stroke="#e8605c" strokeWidth=".7" />
      <path d="M16 13c5-2 11-2 16 0 2 4 1 10-2 15-2 3-3 5-3 8v4h-6v-4c0-3-1-5-3-8-3-5-4-11-2-15z" fill={`url(#${u("u")})`} />
      <path d="M20 16.500c3-1 5-1 8 0 1 3 0 7-2 10-1 1-1.500 2-2 3-.5-1-1-2-2-3-2-3-3-7-2-10z" fill="#ffd3cc" />
      <path d="M24 30v9" stroke="#b83f3d" strokeWidth="1.300" strokeLinecap="round" />
    </>
  ),
  psychiatry: (u) => (
    <>
      <defs>{shade(u("h"), "#6a9dff", "#2f5fd6")}{shade(u("b"), "#ffc0d0", "#f27ea0")}</defs>
      <path d="M12 42V33c-3-3-5-7-5-12C7 12 14 5 24 5s17 6 17 15l3 7c.5 1-.5 2-1.500 2H40v5c0 3-2 4-5 4h-4v4z" fill={`url(#${u("h")})`} />
      <path d="M15 19c0-5 4-8 9-8s10 3 10 8c1 3-1 5-3 5 0 3-4 4-6 3-3 2-7 1-8-2-2 0-3-3-2-6z" fill={`url(#${u("b")})`} stroke="#c94f76" strokeWidth=".6" />
      <path d="M21 13c-1 3 1 4 3 4M28 13c-2 2-1 5 1 6M18 19c2 0 3 1 3 3M25 21c1 2 3 2 5 2" stroke="#c94f76" strokeWidth="1" fill="none" strokeLinecap="round" />
    </>
  ),
  emergency: (u) => (
    <>
      <defs>{shade(u("s"), "#ff7a45", "#e22b2b")}</defs>
      <g fill={`url(#${u("s")})`}>
        <rect x="19.500" y="5" width="9" height="38" rx="1.500" />
        <rect x="19.500" y="5" width="9" height="38" rx="1.500" transform="rotate(60 24 24)" />
        <rect x="19.500" y="5" width="9" height="38" rx="1.500" transform="rotate(120 24 24)" />
      </g>
      <path d="M24 11v26" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <path d="M24 13c-1.600-1.500-.8-3 1-3" stroke="#fff" strokeWidth="1.400" fill="none" strokeLinecap="round" />
      <path d="M28 17c-3-1.500-6-.5-6 1.500s6 1.500 6 4-6 2-6 4.500 5 2 5 4c0 1.500-2 2-3 1.500" stroke="#fff" strokeWidth="1.500" fill="none" strokeLinecap="round" />
    </>
  ),
  gp: (u) => (
    <>
      <defs>{shade(u("c"), "#d9e5f3", "#7f97b3")}{shade(u("t"), "#5b9bff", "#2563eb")}</defs>
      <path d="M15 6c-4 1-5 6-4 11 1 6 5 10 11 10s9-4 10-10c1-5 0-10-4-11" stroke={`url(#${u("t")})`} strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="15" cy="6" r="2.200" fill="#1d3f8f" /><circle cx="28" cy="6" r="2.200" fill="#1d3f8f" />
      <path d="M22 27v5c0 6 4 9 9 9 4 0 7-3 7-7v-3" stroke={`url(#${u("t")})`} strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="38" cy="26" r="6" fill={`url(#${u("c")})`} stroke="#566d88" strokeWidth=".8" />
      <circle cx="38" cy="26" r="3" fill="#f4f8fc" />
    </>
  ),
  radiology: (u) => (
    <>
      <defs>{shade(u("f"), "#3b4a5f", "#141c28")}<radialGradient id={u("l")} cx=".5" cy=".4" r=".7"><stop offset="0" stopColor="#6b7f9a" /><stop offset="1" stopColor="#2a3647" /></radialGradient></defs>
      <rect x="7" y="5" width="34" height="38" rx="3.500" fill={`url(#${u("f")})`} stroke="#0d131b" strokeWidth=".8" />
      <path d="M22 13c-5 0-9 5-10 14-.5 4 0 8 1 9 3 1 7-1 9-3zM26 13c5 0 9 5 10 14 .5 4 0 8-1 9-3 1-7-1-9-3z" fill={`url(#${u("l")})`} />
      <path d="M22.500 8h3v31h-3z" fill="#dfe7f1" />
      <g stroke="#f4f7fb" strokeWidth="1.300" fill="none" strokeLinecap="round">
        <path d="M22 14c-4-1-7 0-9 3M26 14c4-1 7 0 9 3" /><path d="M22 18.500c-4-1-8 0-10 3M26 18.500c4-1 8 0 10 3" />
        <path d="M22 23c-4-1-8 0-10.500 3M26 23c4-1 8 0 10.500 3" /><path d="M22 27.500c-4-1-7.500 0-10 3M26 27.500c4-1 7.500 0 10 3" />
      </g>
      <path d="M13 11c3-2 6-2 9-1M35 11c-3-2-6-2-9-1" stroke="#f4f7fb" strokeWidth="1.400" fill="none" strokeLinecap="round" />
    </>
  ),
  dermatology: (u) => (
    <>
      <defs>{shade(u("t"), "#ffd9c6", "#fbb9a2")}{shade(u("m"), "#ff9bb1", "#ea6a8a")}</defs>
      <path d="M6 18l18-8 18 8-18 8z" fill={`url(#${u("t")})`} />
      <path d="M6 18v5l18 8v-5z" fill="#f4a08c" /><path d="M42 18v5l-18 8v-5z" fill="#e88d7a" />
      <path d="M6 23v12l18 8V31z" fill={`url(#${u("m")})`} /><path d="M42 23v12l-18 8V31z" fill="#d95c7d" />
      <g stroke="#5b3a2e" strokeWidth="1.200" strokeLinecap="round" fill="none">
        <path d="M16 18c0-3 1-6 3-9M24 17c0-4 0-7 1-11M31 19c0-3 1-6 3-8M21 21c0-2 0-4 1-6" />
      </g>
      <ellipse cx="15" cy="32" rx="1.700" ry="3" fill="#ffd9c6" opacity=".9" /><ellipse cx="33" cy="33" rx="1.700" ry="3" fill="#ffd9c6" opacity=".9" />
    </>
  ),
  orthopedics: (u) => (
    <>
      <defs>{shade(u("b"), "#f7f9fb", "#b6c0cc")}{shade(u("r"), "#7f8ea0", "#4b5a6c")}</defs>
      <path d="M21 6c-2-2-6-1-6 2 0 2 1 3 2 3l3 3v8l1 3v8l-2 3c-2 0-3 1-3 3 0 3 4 4 6 2 2 2 6 1 6-2 0-2-1-3-3-3l-1-3v-8l1-3v-8l2-3c2 0 3-1 3-3 0-3-4-4-6-2z" fill={`url(#${u("b")})`} stroke="#8592a1" strokeWidth=".7" transform="translate(-1 0)" />
      <path d="M12 24h24" stroke="#c0392b" strokeWidth="0" />
      <path d="M18 24.500l4-1.500 3 1.500" stroke="#73808f" strokeWidth=".9" fill="none" />
      <rect x="35" y="8" width="3.500" height="32" rx="1.700" fill={`url(#${u("r")})`} />
      <g stroke="#566575" strokeWidth="1.700" strokeLinecap="round"><path d="M17 13h20M17 18h20M17 30h20M17 35h20" /></g>
      <g fill="#2f3b49"><rect x="33.500" y="11.500" width="6.500" height="3" rx="1" /><rect x="33.500" y="16.500" width="6.500" height="3" rx="1" /><rect x="33.500" y="28.500" width="6.500" height="3" rx="1" /><rect x="33.500" y="33.500" width="6.500" height="3" rx="1" /></g>
    </>
  ),
  anesthesiology: (u) => (
    <>
      <defs>{shade(u("m"), "#7bc0ff", "#2f7fe0")}{shade(u("t"), "#5fdca5", "#1f9e7d")}</defs>
      <path d="M38 8c5 4 6 10 3 14-3 5-9 5-12 3" stroke={`url(#${u("t")})`} strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="1.800 1.100" />
      <path d="M38 8c5 4 6 10 3 14-3 5-9 5-12 3" stroke="#1f9e7d" strokeWidth="1.500" fill="none" opacity=".35" />
      <path d="M10 20c6-4 14-4 18 0 3 3 3 7 1 12-2 6-6 9-10 9s-8-3-10-9c-2-5-2-9 1-12z" fill={`url(#${u("m")})`} stroke="#1c5fb6" strokeWidth=".7" />
      <path d="M13.500 23c4-2.500 9-2.500 12 0 2 2 2 5 .5 8.500-1.500 4-4 6-7 6s-5.500-2-7-6c-1.500-3.500-1-6.500 1.500-8.500z" fill="#d8ecff" opacity=".85" />
      <circle cx="28" cy="25" r="3.200" fill="#1c5fb6" />
      <circle cx="19" cy="30" r="2.500" fill="#2f7fe0" opacity=".55" />
    </>
  ),
  neurology: (u) => (
    <>
      <defs>{shade(u("b"), "#7ba7ff", "#2d5fd1")}</defs>
      <path d="M12 30c-5-2-7-8-4-12 0-5 4-8 8-8 2-3 6-5 10-4 4-1 9 1 11 5 4 1 6 5 5 9 2 4-1 9-5 10-1 3-4 4-7 3-1 2-1 4 0 6h-5c-1-3-2-5-4-6-3 1-7 1-9-3z" fill={`url(#${u("b")})`} stroke="#1f4aa8" strokeWidth=".7" />
      <g stroke="#dbe7ff" strokeWidth="1.300" fill="none" strokeLinecap="round">
        <path d="M14 15c2 0 4 1 4 3s-3 2-3 4 3 3 5 2M22 10c-1 2 0 4 2 5 2 0 3 2 2 4M31 11c-2 1-3 3-2 5s4 1 5 3-1 4-3 4" />
        <path d="M17 28c2-1 4-1 5 1 2-2 5-2 6 0M34 27c-1 1-3 2-5 1M10 21c1 1 2 1 3 1" />
      </g>
      <path d="M14 12c3-3 7-4 12-4" stroke="#a9c5ff" strokeWidth="1.500" fill="none" strokeLinecap="round" opacity=".7" />
    </>
  ),
  cardiology: (u) => (
    <>
      <defs>{shade(u("h"), "#ff7f83", "#d4252f")}</defs>
      <path d="M20 8h4v6h-4zM27 7h4l-1 7h-4z" fill="#3e7fe0" /><path d="M16 11c1-1 3-1 4 0l1 4-4 1z" fill="#e8605c" />
      <path d="M24 42c-8-6-16-12-17-20-1-6 3-11 8-11 4 0 7 2 9 5 2-3 5-5 9-5 5 0 9 5 8 11-1 8-9 14-17 20z" fill={`url(#${u("h")})`} stroke="#a81a24" strokeWidth=".6" />
      <path d="M26 15c-2 5-2 9-1 13 1 3 0 6-1 9M26 21c3 0 5 2 7 4M25 27c-3 0-5 1-7 3" stroke="#ffd34d" strokeWidth="1.500" fill="none" strokeLinecap="round" />
      <path d="M12 15c1-1 3-2 5-2" stroke="#ffb3b3" strokeWidth="1.800" fill="none" strokeLinecap="round" />
    </>
  ),
  respiratory: (u) => (
    <>
      <defs>{shade(u("l"), "#8ec5ff", "#3f86e8")}</defs>
      <path d="M22.500 5h3v12h-3z" fill="#c7dcf5" stroke="#6d8fb5" strokeWidth=".5" />
      <path d="M21 16c-5 1-11 8-13 17-1 5 0 8 2 8 5 0 11-3 12-7 1-5 1-12-1-18z" fill={`url(#${u("l")})`} stroke="#2a68c4" strokeWidth=".6" />
      <path d="M27 16c5 1 11 8 13 17 1 5 0 8-2 8-5 0-11-3-12-7-1-5-1-12 1-18z" fill={`url(#${u("l")})`} stroke="#2a68c4" strokeWidth=".6" />
      <path d="M24 16l-5 5-1 5M19 21l-5 4M18 26l-3 5M24 16l5 5 1 5M29 21l5 4M30 26l3 5" stroke="#e8f2ff" strokeWidth="1.300" fill="none" strokeLinecap="round" />
    </>
  ),
  gastro: (u) => (
    <>
      <defs>{shade(u("s"), "#ffb18a", "#ec7d5a")}{shade(u("l"), "#b5574b", "#7f3027")}</defs>
      <path d="M6 15c0-4 5-7 12-7 5 0 7 3 6 7-1 5-6 9-11 10-5 0-7-5-7-10z" fill={`url(#${u("l")})`} />
      <path d="M31 5v8c-1 2 1 3 3 4 5 3 8 8 6 14-2 7-9 11-16 9-3-1-5-3-5-5s2-3 4-2c4 1 7-2 6-6-1-3-3-5-4-8-1-4 0-10 2-14z" fill={`url(#${u("s")})`} stroke="#c9583a" strokeWidth=".6" />
      <path d="M35 22c1 3 0 7-3 10M30 24c1 3 0 6-1 8" stroke="#d96442" strokeWidth="1.100" fill="none" strokeLinecap="round" />
    </>
  ),
  nephrology: (u) => (
    <>
      <defs>{shade(u("k"), "#c9685a", "#8f3a31")}</defs>
      <path d="M31 6c-8-2-17 3-20 12-3 8 0 18 7 22 6 3 12 1 13-3 1-3-2-5-3-8-1-2-1-5 1-7 2-3 7-4 8-8 1-4-2-7-6-8z" fill={`url(#${u("k")})`} stroke="#6f2b24" strokeWidth=".6" />
      <path d="M17 17c-2 4-2 11 2 16M22 14c-3 3-4 9-1 13" stroke="#e79c8e" strokeWidth="1.400" fill="none" strokeLinecap="round" />
      <path d="M28 23c3 0 5-1 8 1 2 2 3 8 2 14" stroke="#f2d268" strokeWidth="2.200" fill="none" strokeLinecap="round" />
      <circle cx="26" cy="23" r="2.600" fill="#ffd9d0" stroke="#6f2b24" strokeWidth=".6" />
    </>
  ),
  endocrine: (u) => (
    <>
      <defs>{shade(u("t"), "#b48cff", "#7a4bdb")}</defs>
      <path d="M21 6h6v5h-6z" fill="#d9c9ff" /><path d="M21 37h6v5h-6z" fill="#d9c9ff" />
      <path d="M21 10h6v28h-6z" fill="#e7ddff" /><g stroke="#a98ee8" strokeWidth="1"><path d="M21 13h6M21 17h6M21 31h6M21 35h6" /></g>
      <path d="M21 20c-2-6-7-11-12-9-4 2-4 10-3 16 1 7 5 11 9 10 4-2 5-6 6-11 1 1 5 1 6 0 1 5 2 9 6 11 4 1 8-3 9-10 1-6 1-14-3-16-5-2-10 3-12 9-1 1-5 1-6 0z" fill={`url(#${u("t")})`} stroke="#5a33a8" strokeWidth=".6" />
      <path d="M11 15c-1 3-1 7 0 11M37 15c1 3 1 7 0 11" stroke="#dccaff" strokeWidth="1.500" fill="none" strokeLinecap="round" />
    </>
  ),
  infectious: (u) => (
    <>
      <defs><radialGradient id={u("v")} cx=".38" cy=".32" r=".8"><stop offset="0" stopColor="#8fe89c" /><stop offset="1" stopColor="#23a24a" /></radialGradient></defs>
      <g stroke="#1f8a40" strokeWidth="2.200" strokeLinecap="round">
        <path d="M24 5v6M24 37v6M5 24h6M37 24h6M10.500 10.500l4.300 4.300M33.200 33.200l4.300 4.300M10.500 37.500l4.300-4.300M33.200 14.800l4.300-4.300" />
      </g>
      <g fill="#ef5b5b"><circle cx="24" cy="5" r="2.200" /><circle cx="24" cy="43" r="2.200" /><circle cx="5" cy="24" r="2.200" /><circle cx="43" cy="24" r="2.200" /><circle cx="10.500" cy="10.500" r="2.200" /><circle cx="37.500" cy="37.500" r="2.200" /><circle cx="10.500" cy="37.500" r="2.200" /><circle cx="37.500" cy="10.500" r="2.200" /></g>
      <circle cx="24" cy="24" r="14" fill={`url(#${u("v")})`} stroke="#1f8a40" strokeWidth=".7" />
      <circle cx="19" cy="20" r="2.800" fill="#1f8a40" opacity=".6" /><circle cx="29" cy="27" r="3.500" fill="#1f8a40" opacity=".55" /><circle cx="22" cy="31" r="1.800" fill="#1f8a40" opacity=".6" /><circle cx="30" cy="17" r="1.500" fill="#1f8a40" opacity=".6" />
    </>
  ),
  ent: (u) => (
    <>
      <defs>{shade(u("e"), "#ffcfa8", "#efa06e")}</defs>
      <path d="M28 6c-9-1-16 6-16 15 0 5 2 8 4 11s2 6 4 8c3 3 8 2 9-2 1-3 2-5 5-7 4-3 6-8 5-13-1-7-5-11-11-12z" fill={`url(#${u("e")})`} stroke="#c9774a" strokeWidth=".7" />
      <path d="M18 21c0-5 4-9 9-9s8 4 8 8c0 4-3 6-5 8-2 3-2 5-5 5-2 0-3-2-3-4" stroke="#c9774a" strokeWidth="1.600" fill="none" strokeLinecap="round" />
      <path d="M24 21c0-2 2-4 4-3s2 4 0 6c-1 1-3 2-3 4" stroke="#a65a30" strokeWidth="1.500" fill="none" strokeLinecap="round" />
      <path d="M6 24l9-2 2 4-9 3z" fill="#5d6b7c" /><path d="M15 22l7-1 .5 3-5.500 2z" fill="#aab6c4" />
      <circle cx="5.500" cy="26.500" r="2.200" fill="#ffd34d" />
    </>
  ),
  ophthalmology: (u) => (
    <>
      <defs><radialGradient id={u("i")} cx=".5" cy=".5" r=".55"><stop offset="0" stopColor="#7be3e8" /><stop offset="1" stopColor="#0f8d97" /></radialGradient></defs>
      <path d="M3 24C9 13 16 9 24 9s15 4 21 15c-6 11-13 15-21 15S9 35 3 24z" fill="#fff" stroke="#0f7a84" strokeWidth="1.300" />
      <path d="M6 22c3-2 5-2 7-1M6 27c3 1 5 1 6 0M42 22c-3-2-5-2-7-1M42 27c-3 1-5 1-6 0" stroke="#f08c8c" strokeWidth=".9" fill="none" strokeLinecap="round" />
      <circle cx="24" cy="24" r="11" fill={`url(#${u("i")})`} />
      <circle cx="24" cy="24" r="5.200" fill="#0b2a33" />
      <circle cx="21" cy="20.500" r="2.300" fill="#fff" opacity=".95" /><circle cx="28" cy="28" r="1" fill="#fff" opacity=".6" />
    </>
  ),
  urology: (u) => (
    <>
      <defs>{shade(u("k"), "#c9685a", "#8f3a31")}{shade(u("b"), "#ffe07a", "#efb72f")}</defs>
      <path d="M13 6c-5 0-8 4-8 9s3 9 8 9c3 0 3-3 2-5s-1-5 1-7c2-3 0-6-3-6zM35 6c5 0 8 4 8 9s-3 9-8 9c-3 0-3-3-2-5s1-5-1-7c-2-3 0-6 3-6z" fill={`url(#${u("k")})`} />
      <path d="M15 17c2 2 4 5 6 14M33 17c-2 2-4 5-6 14" stroke="#f2d268" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M16 31c0-2 4-3 8-3s8 1 8 3c0 5-3 8-8 8s-8-3-8-8z" fill={`url(#${u("b")})`} stroke="#c28f16" strokeWidth=".6" />
      <path d="M24 39v6" stroke="#f2d268" strokeWidth="2.500" strokeLinecap="round" />
    </>
  ),
  "clinical-games": (u) => (
    <>
      <defs>{shade(u("p"), "#5b9bff", "#2563eb")}</defs>
      <rect x="9" y="8" width="30" height="34" rx="4" fill="#fff" stroke="#aac3e8" strokeWidth=".8" />
      <rect x="17" y="5" width="14" height="7" rx="2.500" fill={`url(#${u("p")})`} />
      <path d="M12 26h6l2.500-6 4.500 12 3-6h8" stroke="#ef4444" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 37h20" stroke="#c6d6ee" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  "image-rush": (u) => (
    <>
      <defs>{shade(u("b"), "#ffd34d", "#f97316")}{shade(u("f"), "#3b4a5f", "#141c28")}</defs>
      <rect x="6" y="11" width="27" height="31" rx="3" fill={`url(#${u("f")})`} />
      <path d="M19.500 15v22M13 20c2-1.500 4.500-2 6.500-1.500M26 20c-2-1.500-4.500-2-6.500-1.500M12.500 26c2-1.500 5-2 7-1.500M26.500 26c-2-1.500-5-2-7-1.500M13 32c2-1.500 4.500-2 6.500-1.500M26 32c-2-1.500-4.500-2-6.500-1.500" stroke="#eaf0f7" strokeWidth="1.300" fill="none" strokeLinecap="round" />
      <path d="M33 4l-9 16h6.500L26 34l14-19h-7.500L38 4z" fill={`url(#${u("b")})`} stroke="#c2570c" strokeWidth=".7" strokeLinejoin="round" />
    </>
  ),
  synapses: (u) => (
    <>
      <defs><radialGradient id={u("n")} cx=".4" cy=".35" r=".8"><stop offset="0" stopColor="#c8acff" /><stop offset="1" stopColor="#6d3fe0" /></radialGradient></defs>
      <g stroke="#7f57e8" strokeWidth="2.200" strokeLinecap="round"><path d="M12 12L24 24M36 11L24 24M11 36L24 24M37 37L24 24M12 12L36 11M11 36L37 37" /></g>
      <circle cx="24" cy="24" r="6.500" fill={`url(#${u("n")})`} />
      <circle cx="12" cy="12" r="5" fill="#ffb84d" /><circle cx="36" cy="11" r="5" fill="#46c98a" /><circle cx="11" cy="36" r="5" fill="#4d9bff" /><circle cx="37" cy="37" r="5" fill="#ff6f8f" />
    </>
  ),
  probe: (u) => (
    <>
      <defs>{shade(u("h"), "#2fcfae", "#0d8f77")}</defs>
      <rect x="7" y="7" width="23" height="29" rx="3" fill="#fff" stroke="#9fd8cb" strokeWidth=".8" />
      <path d="M12 14h13M12 19h9M12 24h6" stroke="#bfe5dc" strokeWidth="2" strokeLinecap="round" />
      <path d="M32.500 33l7 7" stroke={`url(#${u("h")})`} strokeWidth="5" strokeLinecap="round" />
      <circle cx="27" cy="27" r="9" fill="#e4fbf5" fillOpacity=".85" stroke={`url(#${u("h")})`} strokeWidth="3.200" />
      <path d="M27 23c2 0 3 1 3 2.500S27 27.500 27 29.500M27 32v.2" stroke="#0d8f77" strokeWidth="1.800" fill="none" strokeLinecap="round" />
    </>
  ),
  mnemonics: (u) => (
    <>
      <defs>{shade(u("b"), "#ffe16b", "#f5a70f")}</defs>
      <path d="M24 5c-8 0-13 6-13 12 0 5 3 8 5 11 1 2 1 3 1 5h14c0-2 0-3 1-5 2-3 5-6 5-11 0-6-5-12-13-12z" fill={`url(#${u("b")})`} stroke="#c48208" strokeWidth=".7" />
      <path d="M19 19l3 3 2-4 2 4 3-3M24 22v11" stroke="#a96d04" strokeWidth="1.300" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="18" y="34" width="12" height="3.200" rx="1.500" fill="#7f8ea0" /><rect x="19.500" y="38.200" width="9" height="3" rx="1.500" fill="#566575" />
      <path d="M16 15c1-3 3-5 6-6" stroke="#fff7cf" strokeWidth="1.800" fill="none" strokeLinecap="round" />
    </>
  ),
  flowcharts: (u) => (
    <>
      <defs>{shade(u("b"), "#5baeff", "#1f7ae0")}{shade(u("g"), "#4fd6a2", "#16a071")}{shade(u("o"), "#ffb35c", "#ee7f1a")}</defs>
      <path d="M24 13v6M24 28l-11 5M24 28l11 5" stroke="#5b7ea8" strokeWidth="2" fill="none" strokeLinecap="round" />
      <rect x="15" y="4" width="18" height="9" rx="2.500" fill={`url(#${u("b")})`} />
      <path d="M24 18l10 6-10 6-10-6z" fill={`url(#${u("o")})`} />
      <rect x="4" y="33" width="17" height="9" rx="2.500" fill={`url(#${u("g")})`} />
      <rect x="27" y="33" width="17" height="9" rx="2.500" fill={`url(#${u("b")})`} />
    </>
  ),
  youtube: (u) => (
    <>
      <defs>{shade(u("r"), "#ff5a5a", "#d41c1c")}</defs>
      <rect x="4" y="11" width="40" height="27" rx="8" fill={`url(#${u("r")})`} />
      <path d="M20 18l12 6.500L20 31z" fill="#fff" />
    </>
  ),
  notes: (u) => (
    <>
      <defs>{shade(u("p"), "#59d28b", "#1f9e5c")}</defs>
      <path d="M11 5h20l8 8v30H11z" fill="#fff" stroke="#a9dcbc" strokeWidth=".8" />
      <path d="M31 5v8h8z" fill="#c9eed7" />
      <path d="M16 19h17M16 25h17M16 31h10" stroke="#bfe5cd" strokeWidth="2" strokeLinecap="round" />
      <path d="M26 39l1-5 12-12 4 4-12 12z" fill={`url(#${u("p")})`} stroke="#177a47" strokeWidth=".6" />
      <path d="M26 39l1-5 4 4z" fill="#ffd9a8" />
    </>
  ),
  research: (u) => (
    <>
      <defs>{shade(u("f"), "#b0a4ff", "#6a55e8")}</defs>
      <path d="M19 6h10v3h-1v11l10 17c1 3-1 5-3 5H13c-2 0-4-2-3-5l10-17V9h-1z" fill="#f6f4ff" stroke="#8d7ff0" strokeWidth=".9" />
      <path d="M15 29h18l5 8c1 3-1 5-3 5H13c-2 0-4-2-3-5z" fill={`url(#${u("f")})`} />
      <circle cx="20" cy="35" r="1.800" fill="#fff" opacity=".85" /><circle cx="28" cy="33" r="1.200" fill="#fff" opacity=".85" /><circle cx="27" cy="38" r="1" fill="#fff" opacity=".85" />
      <path d="M36 5l1.200 3 3 1.200-3 1.200L36 13.500l-1.200-3-3-1.200 3-1.200z" fill="#ffc94d" />
    </>
  ),
};

/** One icon on its squircle. 48 px by default. */
export function MedicalIcon({ name, size = 48, className }: { name: MedicalIconName; size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  const [from, to] = PLATE[name];
  return (
    <span aria-hidden className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-[inset_0_1px_0_rgb(255_255_255/0.7),0_1px_2px_rgb(0_0_0/0.08)]", className)} style={{ width: size, height: size, background: `linear-gradient(145deg, ${from}, ${to})` }}>
      <svg viewBox="0 0 48 48" width={size * 0.84} height={size * 0.84}>{DRAW[name]((s) => `${id}${s}`)}</svg>
    </span>
  );
}

/** The icon for each of the engine's specialties (and the two the brief adds that aren't case specialties). */
export const SPECIALTY_ICON: Record<string, MedicalIconName> = {
  "General Practice": "gp", Medicine: "medicine", Dermatology: "dermatology", Surgery: "surgery", Pediatrics: "pediatrics", OBGYN: "obgyn",
  Emergency: "emergency", Cardiology: "cardiology", Neurology: "neurology", Respiratory: "respiratory", Gastroenterology: "gastro",
  Nephrology: "nephrology", Endocrinology: "endocrine", Psychiatry: "psychiatry", ENT: "ent", Ophthalmology: "ophthalmology",
  Orthopedics: "orthopedics", Urology: "urology", "Infectious Disease": "infectious", Radiology: "radiology", Anesthesiology: "anesthesiology",
};

/** How each specialty is written on a card. */
export const SPECIALTY_LABEL: Record<string, string> = {
  "General Practice": "Family Medicine", Medicine: "Internal Medicine", OBGYN: "OB/GYN", Emergency: "Emergency Medicine",
  Pediatrics: "Pediatrics", Orthopedics: "Orthopedics", Anesthesiology: "Anesthesiology", "Infectious Disease": "Infectious Disease",
};

/** The 2-column grid of selectable cards. `onPick` gets the specialty's name. */
export function SpecialtyGrid({ items, selected, onPick }: { items: readonly string[]; selected?: string | null; onPick: (s: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((s) => (
        <button key={s} type="button" aria-pressed={selected === s} onClick={() => onPick(s)} className={cn("pick-card flex min-h-[108px] flex-col items-start justify-between gap-3 rounded-2xl border-2 bg-[var(--surface-solid)] p-3.5 text-left text-fg", selected === s ? "border-[#2563EB]" : "border-transparent shadow-[0_1px_3px_rgb(0_0_0/0.1)]")}>
          <MedicalIcon name={SPECIALTY_ICON[s] ?? "medicine"} />
          <span className="text-[14.5px] leading-tight font-bold">{SPECIALTY_LABEL[s] ?? s}</span>
        </button>
      ))}
    </div>
  );
}

/** The doctor-bot: a round blue face with a head mirror and a stethoscope. */
export function Mascot({ size = 96, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 96 96" width={size} height={size} className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6db0ff" /><stop offset="1" stopColor="#2563eb" /></linearGradient>
        <radialGradient id={`${id}m`} cx=".4" cy=".35" r=".7"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#a9b8c9" /></radialGradient>
      </defs>
      <circle cx="48" cy="48" r="47" fill="#eaf3ff" />
      <path d="M22 88c1-14 11-20 26-20s25 6 26 20a47 47 0 0 1-52 0z" fill="#fff" stroke="#c9d8ea" />
      <path d="M38 69l10 11 10-11" fill="none" stroke="#c9d8ea" strokeWidth="2" />
      <rect x="20" y="20" width="56" height="46" rx="22" fill={`url(#${id}f)`} />
      <rect x="28" y="31" width="40" height="26" rx="13" fill="#0f2547" />
      <circle cx="39" cy="44" r="4.500" fill="#7fe3ff" /><circle cx="57" cy="44" r="4.500" fill="#7fe3ff" />
      <path d="M43 51c3 2.400 7 2.400 10 0" stroke="#7fe3ff" strokeWidth="2.400" fill="none" strokeLinecap="round" />
      <path d="M21 28c8-8 46-8 54 0" stroke="#1d4fc0" strokeWidth="4" fill="none" />
      <circle cx="48" cy="21" r="9" fill={`url(#${id}m)`} stroke="#6f8196" strokeWidth="1.500" /><circle cx="48" cy="21" r="2.400" fill="#3b4a5f" />
      <path d="M33 68c-2 8 0 12 5 13M63 68c2 8 0 12-5 13M38 81c2 4 8 4 10 0" stroke="#1f3f7a" strokeWidth="2.400" fill="none" strokeLinecap="round" />
      <circle cx="43" cy="86" r="3.600" fill="#8fa3b8" stroke="#1f3f7a" strokeWidth="1.400" />
    </svg>
  );
}
