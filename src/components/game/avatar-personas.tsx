import type { ReactNode } from "react";

import type { PersonaId, PersonaSex } from "@/lib/avatar-style";

/**
 * The sixteen medical personas, drawn by hand on a 100 x 100 card: a gradient frame, a lit disc with the specialty's mark behind
 * the head, then clothes, face, hair and gear. Everything big enough to read at 28 px; the fine lines only show when there is room.
 * Loaded on its own, only once a persona is on screen (see specialist-avatar.tsx). No hooks: share cards draw these on the server.
 */
interface Art {
  /** Frame, from and to. */
  c: [string, string];
  /** Disc, lit centre and rim. */
  d: [string, string];
  skin: string;
  brow: string;
  /** Behind everything: the specialty's mark. */
  m: ReactNode;
  /** Behind the shoulders and head. */
  back?: ReactNode;
  /** The clothes. */
  o: ReactNode;
  /** In front of the face: hair, gear, collars. */
  f: ReactNode;
  neck?: "v" | "crew";
  eyes?: "open" | "soft" | "tired" | "none";
  mouth?: "smile" | "grin" | "calm" | "none";
  /** A bare scalp and no eyebrow shine needed. */
  lens?: string;
}

const SHOULDERS = "M9 101C9 83 27 75 43 71.5h14C73 75 91 83 91 101Z";

const P = ({ d, fill, o }: { d: string; fill: string; o?: number }) => <path d={d} fill={fill} opacity={o} />;
const L = ({ d, c, w = 2, o }: { d: string; c: string; w?: number; o?: number }) => <path d={d} fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" opacity={o} />;

const scrubs = (c: string, trim: string, pocket = true) => (
  <>
    <P d={SHOULDERS} fill={c} />
    <L d="M41 71 50 86l9-15" c={trim} w={3} />
    <L d="M26 101l2-14M74 101l-2-14" c="#000" w={1.2} o={0.18} />
    {pocket && <L d="M62 88h10v8" c={trim} w={1.2} o={0.7} />}
  </>
);
const coat = (shirt: string, edge = "#cbd5e1", fill = "#f8fafc") => (
  <>
    <P d={SHOULDERS} fill={fill} />
    <P d="M42 71h16l-8 21Z" fill={shirt} />
    <L d="M42 71 50 92l-6 9M58 71 50 92l6 9" c={edge} w={1.6} />
    <L d="M64 90h10M26 90h8" c={edge} w={1.2} />
  </>
);
const scope = (c = "#334155", piece = "#cbd5e1") => (
  <>
    <L d="M38 72.5C36 85 43 89 50 89s14-4 12-16.5" c={c} w={2.6} />
    <circle cx="50" cy="92.5" r="3.6" fill={piece} stroke={c} strokeWidth="1.4" />
  </>
);
const glasses = (c: string, r = 6.6) => (
  <>
    <circle cx="42.5" cy="47" r={r} fill="#fff" fillOpacity="0.12" stroke={c} strokeWidth="1.9" />
    <circle cx="57.5" cy="47" r={r} fill="#fff" fillOpacity="0.12" stroke={c} strokeWidth="1.9" />
    <L d="M49 46.5q1-.8 2 0" c={c} w={1.7} />
  </>
);
/** A mark on the disc: white, quiet, at its place and scale. */
const at = (x: number, y: number, s: number, node: ReactNode, o = 0.75) => <g transform={`translate(${x} ${y}) scale(${s})`} opacity={o}>{node}</g>;

const HEART = <P d="M0-3.5C-1.8-8-9-7.5-9-1.5-9 3.5-3 6.5 0 10 3 6.5 9 3.5 9-1.5 9-7.5 1.8-8 0-3.5Z" fill="#fff" />;
const STAR = <P d="M0-8 2.2-2.4 8-2.2 3.4 1.4 5 7 0 3.8-5 7-3.4 1.4-8-2.2-2.2-2.4Z" fill="#fff" />;
const SPARK = <P d="M0-6Q.8-.8 6 0 .8.8 0 6-.8.8-6 0-.8-.8 0-6Z" fill="#fff" />;

const ART: Record<PersonaId, Art> = {
  "er-resus": {
    c: ["#fb7185", "#ea580c"], d: ["#fecdd3", "#e11d48"], skin: "#c98a5e", brow: "#2b1a12",
    m: <L d="M4 33h13l3-9 5 19 5-14 2 4h36l3-9 5 19 5-14 2 4h13" c="#fff" w={2.6} o={0.85} />,
    back: <><P d="M60 26c13-9 25 1 22 15-1 7-5 14-9 19 0-9-2-20-13-26Z" fill="#2b1a12" /><L d="M66 26c8-2 12 3 12 9" c="#fff" w={1.2} o={0.2} /></>,
    o: scrubs("#1e3a8a", "#93c5fd"),
    f: <><P d="M30.5 49C26 16 74 16 69.5 49 68 41 64 36 58 33 50 30 40 31 36 35 33 39 32 43 30.5 49Z" fill="#2b1a12" /><rect x="58" y="24" width="7" height="6" rx="2" transform="rotate(-24 61 27)" fill="#fb7185" />{scope("#0f172a")}</>,
  },
  "interventional-cardiologist": {
    c: ["#f43f5e", "#7f1d1d"], d: ["#fda4af", "#9f1239"], skin: "#6f4529", brow: "#120b08",
    m: <>{at(81, 27, 1.05, HEART, 0.9)}{at(18, 36, 0.5, HEART, 0.6)}<L d="M81 38c-3 8 2 12-1 20" c="#fff" w={1.6} o={0.7} /></>,
    o: <><P d={SHOULDERS} fill="#7f1d1d" /><P d="M34 76h32l-5 25H39Z" fill="#450a0a" /><L d="M41 71 50 86l9-15" c="#fda4af" w={3} /></>,
    f: <><P d="M30.5 46C28 19 72 19 69.5 46 67 38 63 34 50 33.5 37 34 33 38 30.5 46Z" fill="#120b08" /><L d="M38 26q12-5 24 0" c="#fff" w={1.1} o={0.18} /><rect x="59" y="84" width="11" height="8" rx="1.6" fill="#fda4af" /><L d="M61 88h2l1-3 2 5 1-2h2" c="#7f1d1d" w={1} /></>,
    mouth: "grin",
  },
  "neuro-intensivist": {
    c: ["#a78bfa", "#4338ca"], d: ["#ddd6fe", "#5b21b6"], skin: "#f3cdb1", brow: "#7c2d12",
    m: <g opacity="0.85"><L d="M73 31c-3-7 3-11 7-8 3-4 10-2 10 3 4 2 3 9-1 10-1 5-8 5-10 2-4 1-7-3-6-7Z" c="#fff" w={2} /><L d="M80 23c-1 5 3 6 2 12M86 28c-3 1-3 4-5 4" c="#fff" w={1.4} /><L d="M6 42q3-6 5 0t5 0 5 0" c="#fff" w={2} /></g>,
    back: <P d="M26 68C17 13 83 13 74 68c-1 6-9 7-11 2H37c-2 5-10 4-11-2Z" fill="#9a3412" />,
    o: <>{coat("#7c3aed")}</>,
    f: <><P d="M31 47C29 21 71 21 69 47 66 37 58 33 50 32 46 37 37 39 31 47Z" fill="#9a3412" /><L d="M40 24q9-4 18-1" c="#fff" w={1.4} o={0.25} />{glasses("#312e81")}{scope("#312e81", "#c4b5fd")}</>,
  },
  "trauma-surgeon": {
    c: ["#34d399", "#0f766e"], d: ["#a7f3d0", "#047857"], skin: "#b97c55", brow: "#1c1410",
    m: <>{at(82, 30, 1, <><P d="M-8 8 3-6c3-3 7-1 5 3L-5 10Z" fill="#fff" /><L d="M-9 9-13 13" c="#fff" w={2.6} /></>, 0.85)}<L d="M10 34l6 3-6 3M18 28l6 3-6 3" c="#fff" w={1.8} o={0.55} /></>,
    o: scrubs("#0f766e", "#99f6e4", false),
    f: <>
      <P d="M31.5 55c0 15 9 20 18.5 20s18.5-5 18.5-20c-3 5-7 6-10 5-5-2-12-2-17 0-3 1-7 0-10-5Z" fill="#1c1410" />
      <P d="M29 44C25 13 75 13 71 44 62 37 38 37 29 44Z" fill="#134e4a" />
      <L d="M29.5 44C38 38 62 38 70.5 44" c="#5eead4" w={1.8} />
      <circle cx="41" cy="27" r="1.3" fill="#5eead4" /><circle cx="50" cy="24" r="1.3" fill="#5eead4" /><circle cx="59" cy="27" r="1.3" fill="#5eead4" />
      <P d="M36 74c8 5 20 5 28 0l-2 6c-7 3-17 3-24 0Z" fill="#bfdbfe" />
      <L d="M32 58l5 16M68 58l-5 16" c="#e0f2fe" w={1} o={0.7} />
    </>,
    mouth: "calm",
  },
  "pediatric-healer": {
    c: ["#fde047", "#ec4899"], d: ["#fef9c3", "#f97316"], skin: "#7a4a2c", brow: "#120b08",
    m: <>{at(16, 56, 0.8, STAR, 0.85)}{at(85, 54, 0.6, STAR, 0.8)}<circle cx="11" cy="42" r="1.6" fill="#fff" /><circle cx="89" cy="40" r="1.6" fill="#fff" /></>,
    back: <><circle cx="28" cy="25" r="13" fill="#120b08" /><circle cx="72" cy="25" r="13" fill="#120b08" /></>,
    o: <><P d={SHOULDERS} fill="#0ea5e9" /><L d="M41 71 50 86l9-15" c="#fef08a" w={3} />{[[24, 88], [34, 95], [66, 95], [76, 88]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="2.1" fill="#fde047" />)}</>,
    f: <><P d="M30.5 47C27 18 73 18 69.5 47 66 38 60 34 50 34 40 34 34 38 30.5 47Z" fill="#120b08" /><circle cx="35" cy="20" r="2.6" fill="#f472b6" /><circle cx="65" cy="20" r="2.6" fill="#f472b6" />{scope("#be185d", "#fde047")}</>,
    eyes: "soft", mouth: "grin",
  },
  "clinical-detective": {
    c: ["#818cf8", "#1e293b"], d: ["#c7d2fe", "#334155"], skin: "#efbf9c", brow: "#3b2413",
    m: <>{at(19, 34, 0.7, <P d="M-7 4c0-7 3-10 7-10s7 3 7 10c0 3-2 3-3 1-1 2-7 2-8 0-1 2-3 2-3-1Z" fill="#fff" />, 0.5)}<L d="M74 22h13M74 29h9M74 36h13" c="#fff" w={2} o={0.55} /></>,
    o: <><P d={SHOULDERS} fill="#78593a" /><P d="M42 71h16l-8 18Z" fill="#f8fafc" /><L d="M42 71l8 18 8-18" c="#4b3423" w={2.2} /><P d="M44 72l6 3 6-3v6l-6-3-6 3Z" fill="#b91c1c" /></>,
    f: <>
      <P d="M30.5 49C25 15 76 16 69.5 49 69 39 65 34 59 32 51 33 43 31 38 26 36 34 32 40 30.5 49Z" fill="#3b2413" />
      <L d="M44 22q8-3 15 1" c="#fff" w={1.3} o={0.22} />
      {glasses("#1e293b", 6.8)}
      <circle cx="73" cy="82" r="10" fill="#e0f2fe" fillOpacity="0.5" stroke="#fbbf24" strokeWidth="3" />
      <L d="M66 89 56 100" c="#fbbf24" w={4} />
    </>,
    mouth: "calm",
  },
  "toxicology-specialist": {
    c: ["#bef264", "#059669"], d: ["#d9f99d", "#047857"], skin: "#d9a07a", brow: "#2b1a12",
    m: <>{at(83, 31, 1, <><P d="M-3-11h6v8l7 13c1 2-1 4-3 4H-7c-2 0-4-2-3-4l7-13Z" fill="#fff" /><P d="M-6.5 5h13l2 5c.5 1.5-.5 3-2 3H-6.5c-1.5 0-2.5-1.5-2-3Z" fill="#65a30d" /></>, 0.9)}<circle cx="15" cy="30" r="3" fill="#fff" opacity="0.6" /><circle cx="20" cy="40" r="1.8" fill="#fff" opacity="0.6" /></>,
    o: <>{coat("#14532d")}</>,
    back: <P d="M50 18C26 18 22 44 25 62c-3 10-9 18-11 24 12 12 60 12 72 0-2-6-8-14-11-24C78 44 74 18 50 18Z" fill="#065f46" />,
    f: <>
      <path fillRule="evenodd" d="M50 19C28 19 24 44 27 62c2 12 13 22 23 22s21-10 23-22c3-18-1-43-23-43Zm0 12c-11 0-17 8-17 18 0 11 8 19 17 19s17-8 17-19c0-10-6-18-17-18Z" fill="#047857" />
      <L d="M31 40C34 26 44 23 54 23" c="#fff" w={1.5} o={0.25} />
      <L d="M34 72c10 12 22 12 32 0" c="#065f46" w={1.8} />
      <rect x="62" y="88" width="12" height="4" rx="2" fill="#65a30d" />
    </>,
    neck: "crew", eyes: "soft",
  },
  "maternal-fetal-guardian": {
    c: ["#f9a8d4", "#be185d"], d: ["#fce7f3", "#db2777"], skin: "#8d5a3b", brow: "#1a0f09",
    m: <>{at(81, 30, 1.1, <><path d="M0-3.5C-1.8-8-9-7.5-9-1.5-9 3.5-3 6.5 0 10 3 6.5 9 3.5 9-1.5 9-7.5 1.8-8 0-3.5Z" fill="#fff" /><circle cx="-1" cy="-.5" r="2.2" fill="#f472b6" /><L d="M1 1c3 1 3 5-1 5-2 0-3-1-3-2" c="#f472b6" w={1.6} /></>, 0.95)}{at(18, 34, 0.55, SPARK, 0.8)}{at(11, 46, 0.35, SPARK, 0.7)}</>,
    back: <circle cx="50" cy="17" r="10.5" fill="#1a0f09" />,
    o: scrubs("#9d174d", "#fbcfe8"),
    f: <>
      <P d="M30.5 49C26 17 74 17 69.5 49 68 40 62 33 50 32 38 33 32 40 30.5 49Z" fill="#1a0f09" />
      <L d="M34 24c5 3 10 3 16 2M66 24c-5 3-10 3-16 2" c="#fbcfe8" w={1.6} />
      <circle cx="31.5" cy="54" r="1.8" fill="#fbbf24" /><circle cx="68.5" cy="54" r="1.8" fill="#fbbf24" />
      {scope("#500724", "#fbcfe8")}
    </>,
    eyes: "soft",
  },
  "icu-night-owl": {
    c: ["#6366f1", "#0f172a"], d: ["#312e81", "#020617"], skin: "#a8714a", brow: "#17110d",
    m: <><P d="M84 18a11 11 0 1 0 5 19 13 13 0 0 1-5-19Z" fill="#fde68a" />{at(16, 24, 0.5, SPARK, 1)}{at(24, 14, 0.3, SPARK, 1)}{at(10, 40, 0.3, SPARK, 0.9)}{at(70, 13, 0.3, SPARK, 0.9)}</>,
    o: <>{scrubs("#1e293b", "#818cf8", false)}<rect x="62" y="84" width="14" height="13" rx="2.5" fill="#f8fafc" /><L d="M76 87c5 0 5 7 0 7" c="#f8fafc" w={2} /><L d="M66 81q2-2 0-4M71 81q2-2 0-4" c="#fff" w={1.3} o={0.8} /></>,
    f: <P d="M30 49c-2-8-2-14 0-18l3 2c0-5 3-9 7-11l1 4c3-5 8-7 13-6l-2 4c5-2 10-1 13 3l-4 1c4 2 7 7 8 21-2-7-6-12-11-14-8 3-16 3-22 1-3 3-5 7-6 13Z" fill="#17110d" />,
    eyes: "tired", mouth: "calm",
  },
  "radiology-ace": {
    c: ["#22d3ee", "#1d4ed8"], d: ["#0e7490", "#082f49"], skin: "#f7d9bf", brow: "#0b0f14",
    m: <g opacity="0.8"><L d="M82 16v34" c="#fff" w={2.2} /><L d="M82 22c-5-3-9-2-11 1M82 22c5-3 7-2 9 0M82 30c-6-3-11-2-13 2M82 30c5-3 7-2 9 1M82 38c-6-3-11-2-13 2M82 38c5-3 7-2 8 1" c="#fff" w={1.8} /><L d="M18 22c-5 2-8 8-8 16M18 30c-3 2-5 6-5 10" c="#67e8f9" w={1.8} /></g>,
    back: <P d="M28 66C20 14 80 14 72 66c-2 3-6 3-8 0H36c-2 3-6 3-8 0Z" fill="#0b0f14" />,
    o: <>{scrubs("#075985", "#7dd3fc", false)}<rect x="60" y="82" width="13" height="16" rx="1.5" fill="#e0f2fe" /><L d="M63 87h7M63 91h7" c="#0369a1" w={1.3} /></>,
    f: <><P d="M31 45C29 21 71 21 69 45c-6-3-32-3-38 0Z" fill="#0b0f14" /><L d="M38 25q12-4 24 0" c="#67e8f9" w={1.3} o={0.5} /></>,
    eyes: "soft",
  },
  "infectious-disease-hunter": {
    c: ["#fbbf24", "#15803d"], d: ["#fef08a", "#166534"], skin: "#5e3b26", brow: "#0d0805",
    m: <>{at(82, 30, 1, <><circle r="7.5" fill="#fff" />{[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <g key={a} transform={`rotate(${a})`}><rect x="-.9" y="-12.5" width="1.8" height="5.5" fill="#fff" /><circle cy="-12.5" r="1.8" fill="#fff" /></g>)}<circle cx="-2" cy="-2" r="1.8" fill="#16a34a" /><circle cx="2.5" cy="2" r="1.3" fill="#16a34a" /></>, 0.95)}{at(17, 34, 0.45, <><circle r="7.5" fill="#fff" />{[0, 60, 120, 180, 240, 300].map((a) => <rect key={a} transform={`rotate(${a})`} x="-1" y="-12" width="2" height="5" fill="#fff" />)}</>, 0.7)}</>,
    o: <>{scrubs("#14532d", "#bbf7d0", false)}<rect x="60" y="84" width="14" height="9" rx="1.5" fill="#fef08a" /><L d="M63 88h8" c="#14532d" w={1.4} /></>,
    f: <>
      <P d="M31 45C28 19 72 19 69 45 64 36 58 33 50 33 42 33 36 36 31 45Z" fill="#0d0805" />
      <rect x="31" y="27" width="38" height="11" rx="5.5" fill="#fde68a" fillOpacity="0.9" stroke="#14532d" strokeWidth="1.8" />
      <L d="M50 27.5v10" c="#14532d" w={1.8} />
      <P d="M31 53c7-3 31-3 38 0 0 11-8 20-19 20S31 64 31 53Z" fill="#f0fdf4" />
      <L d="M34 58c8 2 24 2 32 0M37 64c7 2 19 2 26 0" c="#86efac" w={1.2} />
      <L d="M31 52 28 47M69 52l3-5" c="#f0fdf4" w={1.4} />
    </>,
    mouth: "none",
  },
  "master-clinician": {
    c: ["#fde68a", "#b45309"], d: ["#fef3c7", "#d97706"], skin: "#c68f66", brow: "#94a3b8",
    m: <g opacity="0.95">{[0, 1, 2, 3, 4].map((i) => <g key={i}><ellipse cx={16 + i * 0.3} cy={62 - i * 9} rx="4.5" ry="2.2" transform={`rotate(${-52 + i * 14} ${16 + i * 0.3} ${62 - i * 9})`} fill="#fffbeb" /><ellipse cx={84 - i * 0.3} cy={62 - i * 9} rx="4.5" ry="2.2" transform={`rotate(${52 - i * 14} ${84 - i * 0.3} ${62 - i * 9})`} fill="#fffbeb" /></g>)}</g>,
    back: <circle cx="50" cy="18" r="9.5" fill="#cbd5e1" />,
    o: <>{coat("#92400e", "#fbbf24")}</>,
    f: <>
      <P d="M30.5 50C26 17 74 17 69.5 50 67 40 60 32 50 32 40 32 33 40 30.5 50Z" fill="#e2e8f0" />
      <L d="M40 24q10-4 20 0M36 29q6-3 10-3" c="#94a3b8" w={1.2} />
      {glasses("#92400e", 6.2)}
      {scope("#d97706", "#fde68a")}
    </>,
    mouth: "smile",
  },
  "airway-guardian": {
    c: ["#38bdf8", "#1e40af"], d: ["#bae6fd", "#1d4ed8"], skin: "#d9a07a", brow: "#17110d",
    m: <g opacity="0.85"><L d="M82 14v11" c="#fff" w={2.4} /><P d="M81 24c-3 3-9 5-10 12-1 6 1 10 5 9 3-1 4-5 4-9ZM83 24c3 3 9 5 10 12 1 6-1 10-5 9-3-1-4-5-4-9Z" fill="#fff" /><L d="M12 36c4-4 8-4 12 0M14 42c3-3 5-3 8 0" c="#fff" w={2} /></g>,
    o: <>{scrubs("#1e3a8a", "#7dd3fc", false)}</>,
    f: <>
      <P d="M31 52c-1 18 8 28 19 28s20-10 19-28c-3 6-8 7-11 6-5-2-11-2-16 0-3 1-8 0-11-6Z" fill="#17110d" />
      <P d="M27 44C22 22 34 12 50 12s28 10 23 32c-8-10-38-10-46 0Z" fill="#ea580c" />
      <L d="M28 40C36 26 54 20 70 26M29 33C38 22 52 16 64 18M34 22c4 4 26 12 37 21" c="#9a3412" w={1.6} o={0.7} />
      <P d="M46.5 20h7l-1 5h-5Z" fill="#fed7aa" />
      {scope("#0c4a6e", "#bae6fd")}
    </>,
    mouth: "smile",
  },
  "rural-frontliner": {
    c: ["#a3e635", "#0d9488"], d: ["#fef9c3", "#65a30d"], skin: "#b97c55", brow: "#1c1009",
    m: <><circle cx="82" cy="24" r="8" fill="#fde047" /><P d="M4 62c8-14 18-18 26-10l10 8H4ZM60 60c8-12 18-16 36 2H60Z" fill="#fff" o={0.55} /></>,
    back: <P d="M29 62c-3-10-2-20 2-28l-4 34 5-1Z" fill="#1c1009" />,
    o: <><P d={SHOULDERS} fill="#0f766e" /><L d="M41 71 50 86l9-15" c="#fbbf24" w={3} /><L d="M12 100c8-12 14-18 28-24" c="#fbbf24" w={2.5} /><rect x="60" y="86" width="16" height="12" rx="2" fill="#7f1d1d" /><L d="M65 86v-2h6v2" c="#7f1d1d" w={1.6} /><L d="M68 89v6M65 92h6" c="#fff" w={1.8} /></>,
    f: <>
      <P d="M30.5 49C26 17 74 17 69.5 49 68 41 63 34 51 32 45 37 36 39 30.5 49Z" fill="#1c1009" />
      {[0, 1, 2, 3, 4].map((i) => <ellipse key={i} cx={68 + i * 1.5} cy={56 + i * 7} rx="4.2" ry="4.4" fill="#1c1009" />)}
      <circle cx="68" cy="51" r="1.5" fill="#f43f5e" />
      <circle cx="50" cy="39" r="1.5" fill="#dc2626" />
      {scope("#334155")}
    </>,
    eyes: "soft", mouth: "grin",
  },
  "bone-setter": {
    c: ["#94a3b8", "#0f766e"], d: ["#e2e8f0", "#475569"], skin: "#f0c8a8", brow: "#44342a",
    m: <>{at(81, 30, 1, <g transform="rotate(-40)"><rect x="-8" y="-2.5" width="16" height="5" fill="#fff" /><circle cx="-9" cy="-3" r="3.4" fill="#fff" /><circle cx="-9" cy="3" r="3.4" fill="#fff" /><circle cx="9" cy="-3" r="3.4" fill="#fff" /><circle cx="9" cy="3" r="3.4" fill="#fff" /></g>, 0.95)}<L d="M12 28l4 8-5 2 5 9" c="#fff" w={2} o={0.6} /></>,
    o: <>{scrubs("#334155", "#5eead4", false)}<L d="M18 100V88M82 100V88" c="#5eead4" w={1.4} o={0.5} /></>,
    f: <>
      <P d="M36 33c6-6 22-6 28 0" fill="none" />
      <P d="M34 58c0 8 8 11 16 11s16-3 16-11c-4 3-8 3-11 2-3-1-7-1-10 0-3 1-7 1-11-2Z" fill="#44342a" o={0.28} />
      <L d="M40 31q7-5 15-4" c="#fff" w={2.4} o={0.55} />
    </>,
    mouth: "grin",
  },
  "mind-listener": {
    c: ["#c4b5fd", "#7e22ce"], d: ["#f3e8ff", "#7e22ce"], skin: "#5e3b26", brow: "#0d0805",
    m: <>{at(81, 28, 1, <><rect x="-11" y="-9" width="22" height="15" rx="6" fill="#fff" /><P d="M-5 5l-2 8 8-7Z" fill="#fff" /><circle cx="-5" cy="-1.5" r="1.7" fill="#9333ea" /><circle cy="-1.5" r="1.7" fill="#9333ea" /><circle cx="5" cy="-1.5" r="1.7" fill="#9333ea" /></>, 0.95)}{at(16, 34, 0.6, SPARK, 0.7)}</>,
    back: <g fill="none" stroke="#0d0805" strokeWidth="5.5" strokeLinecap="round"><path d="M31 38c-4 12-5 24-4 36M36 32c-6 14-3 28-3 40M69 38c4 12 5 24 4 36M64 32c6 14 3 28 3 40" /></g>,
    o: <><P d={SHOULDERS} fill="#6d28d9" /><P d="M42 71h16l-8 15Z" fill="#ede9fe" /><L d="M41 71 50 86l9-15" c="#ddd6fe" w={2.6} /><L d="M63 86l10 0M63 91l10 0" c="#ddd6fe" w={1.2} o={0.8} /></>,
    f: <>
      <g fill="none" stroke="#0d0805" strokeWidth="5" strokeLinecap="round"><path d="M34 42c2-12 8-15 14-15M66 42c-2-12-8-15-14-15M42 34c2-6 5-8 8-8M58 34c-2-6-5-8-8-8" /></g>
      <L d="M32 72v-8M68 72v-8" c="#fbbf24" w={1.8} />
      {glasses("#ddd6fe", 6.4)}
    </>,
    eyes: "soft", mouth: "smile",
  },
};


/** Short hair; long hair (behind the shoulders, and its fringe). The other half of each persona is built from these and its own gear. */
const crop = (c: string) => <P d="M30.5 46C28 19 72 19 69.5 46 67 38 63 34 50 33.5 37 34 33 38 30.5 46Z" fill={c} />;
const longBack = (c: string) => <P d="M26 68C17 13 83 13 74 68c-1 6-9 7-11 2H37c-2 5-10 4-11-2Z" fill={c} />;
const fringe = (c: string) => <P d="M31 47C29 21 71 21 69 47 66 37 58 33 50 32 46 37 37 39 31 47Z" fill={c} />;

/** How each persona was first drawn. */
const DRAWN_AS: Record<PersonaId, PersonaSex> = {
  "er-resus": "f", "interventional-cardiologist": "m", "neuro-intensivist": "f", "trauma-surgeon": "m", "pediatric-healer": "f", "clinical-detective": "m",
  "toxicology-specialist": "f", "maternal-fetal-guardian": "f", "icu-night-owl": "m", "radiology-ace": "f", "infectious-disease-hunter": "m", "master-clinician": "f",
  "airway-guardian": "m", "rural-frontliner": "f", "bone-setter": "m", "mind-listener": "f",
};
/** The same doctor as the other sex: the same clothes, gear and colours, with different hair. */
const OTHER: Record<PersonaId, Pick<Art, "back" | "f">> = {
  "er-resus": { back: null, f: <>{crop("#2b1a12")}{scope("#0f172a")}</> },
  "interventional-cardiologist": { back: longBack("#120b08"), f: <>{fringe("#120b08")}<rect x="59" y="84" width="11" height="8" rx="1.6" fill="#fda4af" /><L d="M61 88h2l1-3 2 5 1-2h2" c="#7f1d1d" w={1} /></> },
  "neuro-intensivist": { back: null, f: <>{crop("#9a3412")}{glasses("#312e81")}{scope("#312e81", "#c4b5fd")}</> },
  "trauma-surgeon": { back: longBack("#1c1410"), f: <>
    <P d="M29 44C25 13 75 13 71 44 62 37 38 37 29 44Z" fill="#134e4a" />
    <L d="M29.5 44C38 38 62 38 70.5 44" c="#5eead4" w={1.8} />
    <circle cx="41" cy="27" r="1.3" fill="#5eead4" /><circle cx="50" cy="24" r="1.3" fill="#5eead4" /><circle cx="59" cy="27" r="1.3" fill="#5eead4" />
    <P d="M36 74c8 5 20 5 28 0l-2 6c-7 3-17 3-24 0Z" fill="#bfdbfe" />
  </> },
  "pediatric-healer": { back: null, f: <>{crop("#120b08")}{scope("#be185d", "#fde047")}</> },
  "clinical-detective": { back: longBack("#3b2413"), f: <>
    {fringe("#3b2413")}{glasses("#1e293b", 6.8)}
    <circle cx="73" cy="82" r="10" fill="#e0f2fe" fillOpacity="0.5" stroke="#fbbf24" strokeWidth="3" />
    <L d="M66 89 56 100" c="#fbbf24" w={4} />
  </> },
  "toxicology-specialist": { back: null, f: <>{crop("#2b1a12")}<rect x="62" y="88" width="12" height="4" rx="2" fill="#65a30d" /></> },
  "maternal-fetal-guardian": { back: null, f: <>{crop("#1a0f09")}{scope("#500724", "#fbcfe8")}</> },
  "icu-night-owl": { back: longBack("#17110d"), f: fringe("#17110d") },
  "radiology-ace": { back: null, f: crop("#0b0f14") },
  "infectious-disease-hunter": { back: longBack("#0d0805"), f: <>
    <P d="M31 45C28 19 72 19 69 45 64 36 58 33 50 33 42 33 36 36 31 45Z" fill="#0d0805" />
    <rect x="31" y="27" width="38" height="11" rx="5.5" fill="#fde68a" fillOpacity="0.9" stroke="#14532d" strokeWidth="1.8" />
    <L d="M50 27.5v10" c="#14532d" w={1.8} />
    <P d="M31 53c7-3 31-3 38 0 0 11-8 20-19 20S31 64 31 53Z" fill="#f0fdf4" />
    <L d="M34 58c8 2 24 2 32 0M37 64c7 2 19 2 26 0" c="#86efac" w={1.2} />
    <L d="M31 52 28 47M69 52l3-5" c="#f0fdf4" w={1.4} />
  </> },
  "master-clinician": { back: null, f: <>{crop("#e2e8f0")}{glasses("#92400e", 6.2)}{scope("#d97706", "#fde68a")}</> },
  "airway-guardian": { back: longBack("#17110d"), f: <>
    <P d="M27 44C22 22 34 12 50 12s28 10 23 32c-8-10-38-10-46 0Z" fill="#ea580c" />
    <L d="M28 40C36 26 54 20 70 26M29 33C38 22 52 16 64 18M34 22c4 4 26 12 37 21" c="#9a3412" w={1.6} o={0.7} />
    <P d="M46.5 20h7l-1 5h-5Z" fill="#fed7aa" />
    {scope("#0c4a6e", "#bae6fd")}
  </> },
  "rural-frontliner": { back: null, f: <>{crop("#1c1009")}{scope("#334155")}</> },
  "bone-setter": { back: longBack("#44342a"), f: fringe("#44342a") },
  "mind-listener": { back: null, f: <>
    <g fill="none" stroke="#0d0805" strokeWidth="5" strokeLinecap="round"><path d="M34 42c2-12 8-15 14-15M66 42c-2-12-8-15-14-15M42 34c2-6 5-8 8-8M58 34c-2-6-5-8-8-8" /></g>
    {glasses("#ddd6fe", 6.4)}
  </> },
};

export function PersonaArt({ persona, sex, size = 40, className, uid }: { persona: PersonaId; /** A man or a woman; left out, as first drawn. */ sex?: PersonaSex; size?: number; className?: string; /** Keeps gradient ids apart when one page draws the same persona twice. */ uid?: string }) {
  const a: Art = sex && sex !== DRAWN_AS[persona] ? { ...ART[persona], ...OTHER[persona] } : ART[persona];
  const id = `p${uid ?? persona}`;
  const eyes = a.eyes ?? "open";
  const mouth = a.mouth ?? "smile";
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden style={{ display: "block" }}>
      <defs>
        <linearGradient id={`${id}f`} x1="0.1" y1="0" x2="0.9" y2="1"><stop offset="0" stopColor={a.c[0]} /><stop offset="1" stopColor={a.c[1]} /></linearGradient>
        <radialGradient id={`${id}d`} cx="0.5" cy="0.32" r="0.78"><stop offset="0" stopColor={a.d[0]} /><stop offset="1" stopColor={a.d[1]} /></radialGradient>
        <linearGradient id={`${id}s`} x1="0.2" y1="0" x2="0.8" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.2" /><stop offset="0.55" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.16" /></linearGradient>
        <clipPath id={`${id}c`}><circle cx="50" cy="50" r="45" /></clipPath>
      </defs>
      <circle cx="50" cy="50" r="50" fill={`url(#${id}f)`} />
      <circle cx="50" cy="50" r="45" fill={`url(#${id}d)`} />
      <g clipPath={`url(#${id}c)`}>
        {a.m}
        {a.back}
        {a.o}
        <path d={a.neck === "crew" ? "M44 58h12v15H44Z" : "M44 58h12v13L50 84l-6-13Z"} fill={a.skin} />
        <path d="M43 64h14v6q-7 5-14 0Z" fill="#000" opacity="0.16" />
        <ellipse cx="31.5" cy="49" rx="3.2" ry="4.6" fill={a.skin} />
        <ellipse cx="68.5" cy="49" rx="3.2" ry="4.6" fill={a.skin} />
        <ellipse cx="50" cy="47" rx="19" ry="21" fill={a.skin} />
        <ellipse cx="50" cy="47" rx="19" ry="21" fill={`url(#${id}s)`} />
        <ellipse cx="38.5" cy="54.5" rx="3.6" ry="2.3" fill="#f43f5e" opacity="0.2" />
        <ellipse cx="61.5" cy="54.5" rx="3.6" ry="2.3" fill="#f43f5e" opacity="0.2" />
        <path d="M37.5 41.5q5-3 9.5-.5M53 41q4.5-2.5 9.5.5" fill="none" stroke={a.brow} strokeWidth="2.2" strokeLinecap="round" />
        {eyes === "soft" ? (
          <path d="M38.5 47.5q4-4.5 8 0M53.5 47.5q4-4.5 8 0" fill="none" stroke="#120b08" strokeWidth="2.4" strokeLinecap="round" />
        ) : (
          <>
            <ellipse cx="42.5" cy="47" rx="3.7" ry="3.3" fill="#fff" />
            <ellipse cx="57.5" cy="47" rx="3.7" ry="3.3" fill="#fff" />
            <circle cx="42.8" cy="47.2" r="2.4" fill="#120b08" />
            <circle cx="57.8" cy="47.2" r="2.4" fill="#120b08" />
            <circle cx="43.6" cy="46.3" r="0.75" fill="#fff" />
            <circle cx="58.6" cy="46.3" r="0.75" fill="#fff" />
            {eyes === "tired" && (
              <>
                <path d="M38.3 46.3q4.2-3.6 8.4 0v-4h-8.4ZM53.3 46.3q4.2-3.6 8.4 0v-4h-8.4Z" fill={a.skin} />
                <path d="M38.5 46.2q4-3.2 8 0M53.5 46.2q4-3.2 8 0" fill="none" stroke="#120b08" strokeWidth="1.5" />
                <path d="M39 51.5q3.5 1.5 7 0M54 51.5q3.5 1.5 7 0" fill="none" stroke="#000" strokeOpacity="0.28" strokeWidth="1.3" strokeLinecap="round" />
              </>
            )}
          </>
        )}
        {mouth !== "none" && <path d="M49.5 50.5q-1.8 3 .3 3.8" fill="none" stroke="#000" strokeOpacity="0.28" strokeWidth="1.3" strokeLinecap="round" />}
        {mouth === "smile" && <path d="M43.5 58q6.5 5.5 13 0" fill="none" stroke="#5b1a10" strokeWidth="2" strokeLinecap="round" />}
        {mouth === "calm" && <path d="M45 59q5 1.8 10 0" fill="none" stroke="#5b1a10" strokeWidth="2" strokeLinecap="round" />}
        {mouth === "grin" && <path d="M42.5 57q7.5 2.2 15 0-1 7-7.5 7t-7.5-7Z" fill="#fff" stroke="#5b1a10" strokeWidth="1.5" strokeLinejoin="round" />}
        {a.f}
      </g>
      <path d="M13 33A41 41 0 0 1 40 10" fill="none" stroke="#fff" strokeOpacity="0.4" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
