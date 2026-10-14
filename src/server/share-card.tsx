/**
 * The shareable cards, drawn as pictures (next/og) — collectible case cards:
 * each result earns a tier (Distinction, Honours, Merit, Pass, Learning) with
 * its own colours, RamAI's beating heart inside the score ring, ECG paper
 * behind, and a patient monitor's readouts. Sizes for a WhatsApp Status or
 * Instagram Story (1080×1920), a post (1080×1080) and a link preview (1200×630).
 */
import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { ReactNode } from "react";

import type { AchievementCard, ProgressCard, ResultCard } from "./share";

export type CardFormat = "story" | "square" | "wide";
export const CARD_SIZE: Record<CardFormat, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
  wide: { width: 1200, height: 630 },
};

/* -------------------------------------------------------------------------- */
/* Assets: Geist (as on the site) and the heart                               */
/* -------------------------------------------------------------------------- */

const fonts = new Map<number, Promise<ArrayBuffer | null>>();

function geist(weight: 400 | 600 | 700): Promise<ArrayBuffer | null> {
  let f = fonts.get(weight);
  if (!f) {
    f = (async () => {
      try {
        // An old browser's name gets a font file the card renderer can read (not woff2).
        const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Geist:wght@${weight}`, { headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:10.0) Gecko/20100101 Firefox/10.0" }, signal: AbortSignal.timeout(4000) })).text();
        const url = css.match(/src: url\((.+?)\) format\('(?:woff|truetype|opentype)'\)/)?.[1];
        return url ? await (await fetch(url, { signal: AbortSignal.timeout(4000) })).arrayBuffer() : null;
      } catch {
        return null;
      }
    })();
    f.then((x) => x ?? fonts.delete(weight));
    fonts.set(weight, f);
  }
  return f;
}

export async function cardFonts() {
  const loaded = await Promise.all(([400, 600, 700] as const).map(async (weight) => ({ weight, data: await geist(weight) })));
  return loaded.filter((f): f is { weight: 400 | 600 | 700; data: ArrayBuffer } => !!f.data).map((f) => ({ name: "Geist", data: f.data, weight: f.weight, style: "normal" as const }));
}

let heart: Promise<string | null> | null = null;
/** RamAI's 3D heart, captured once from the site's own model (src/server/assets/share-heart.png, 474×720). */
export function heartImage(): Promise<string | null> {
  heart ??= readFile(join(process.cwd(), "src/server/assets/share-heart.png"), "base64").then(
    (b64) => `data:image/png;base64,${b64}`,
    () => null,
  );
  return heart;
}
const HEART_RATIO = 474 / 720;

/* -------------------------------------------------------------------------- */
/* Tiers                                                                       */
/* -------------------------------------------------------------------------- */

export interface Tier {
  name: string;
  /** The gradient: border, ring, score. */
  colors: string[];
  glow: string;
  accent: string;
}

const TIERS: Tier[] = [
  { name: "DISTINCTION", colors: ["#f0abfc", "#a78bfa", "#67e8f9", "#bef264"], glow: "rgba(167,139,250,0.55)", accent: "#e9d5ff" },
  { name: "HONOURS", colors: ["#fef3c7", "#fbbf24", "#f59e0b", "#fde68a"], glow: "rgba(245,158,11,0.45)", accent: "#fde68a" },
  { name: "MERIT", colors: ["#a5f3fc", "#22d3ee", "#3b82f6", "#a5b4fc"], glow: "rgba(34,211,238,0.42)", accent: "#a5f3fc" },
  { name: "PASS", colors: ["#a7f3d0", "#34d399", "#14b8a6", "#99f6e4"], glow: "rgba(52,211,153,0.38)", accent: "#a7f3d0" },
  { name: "LEARNING", colors: ["#ddd6fe", "#a78bfa", "#64748b", "#c4b5fd"], glow: "rgba(139,92,246,0.35)", accent: "#ddd6fe" },
];

export const tierFor = (score: number): Tier => (score >= 90 ? TIERS[0]! : score >= 80 ? TIERS[1]! : score >= 70 ? TIERS[2]! : score >= 50 ? TIERS[3]! : TIERS[4]!);

/** A rank's colours, from the first rung to the last. */
export const rankTier = (tier: number): Tier => (tier >= 9 ? TIERS[0]! : tier >= 7 ? TIERS[1]! : tier >= 5 ? TIERS[2]! : tier >= 3 ? TIERS[3]! : TIERS[4]!);

export const gradient = (colors: string[], angle = 135) => `linear-gradient(${angle}deg, ${colors.join(", ")})`;

/* -------------------------------------------------------------------------- */
/* Pieces                                                                      */
/* -------------------------------------------------------------------------- */

const VIOLET = "#7c3aed";
const BLUE = "#2563eb";
const CYAN = "#06b6d4";

export function Mark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={VIOLET} />
          <stop offset="0.5" stopColor={BLUE} />
          <stop offset="1" stopColor={CYAN} />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="19" fill="url(#g)" />
      <path d="M10 35h12l4-9 6 19 5-14 3 4h14" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Brand({ scale }: { scale: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 * scale }}>
      <Mark size={52 * scale} />
      <div style={{ display: "flex", fontSize: 38 * scale, fontWeight: 700, letterSpacing: -1 * scale, color: "#fff" }}>
        Ram<span style={{ color: "#60a5fa" }}>AI</span>
      </div>
    </div>
  );
}

/** A colour part-way to another ("#2563eb" towards navy) — the card renderer has no color-mix(). */
export function mixHex(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i]! - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

/** The doctor's avatar — their initials on their colour, as on the site. */
export function AvatarDisc({ avatar, size, ring = 0, ringColor = "#fff" }: { avatar: { initials: string; color: string }; size: number; ring?: number; ringColor?: string }) {
  return (
    <div style={{ display: "flex", width: size, height: size, borderRadius: 9999, padding: ring, background: ringColor }}>
      <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 9999, backgroundImage: `linear-gradient(135deg, ${avatar.color}, ${mixHex(avatar.color, "#0b1220", 0.45)})`, color: "#fff", fontSize: (size - ring * 2) * 0.38, fontWeight: 700, letterSpacing: -0.5 }}>
        {avatar.initials}
      </div>
    </div>
  );
}

/** The heart inside a ring that fills with the score, in the tier's colours. */
function HeartRing({ score, size, tier, img }: { score: number; size: number; tier: Tier; img: string | null }) {
  const r = 45;
  const c = 2 * Math.PI * r;
  const h = size * 0.7;
  return (
    <div style={{ display: "flex", position: "relative", width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", position: "absolute", top: size * 0.1, left: size * 0.1, width: size * 0.8, height: size * 0.8, borderRadius: 9999, backgroundImage: `radial-gradient(circle, ${tier.glow}, transparent 68%)` }} />
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: "absolute", top: 0, left: 0 }}>
        <defs>
          <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            {tier.colors.map((col, i) => (
              <stop key={col} offset={i / (tier.colors.length - 1)} stopColor={col} />
            ))}
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.6" />
        {Array.from({ length: 60 }, (_, i) => {
          const a = (i / 60) * 2 * Math.PI;
          return <line key={i} x1={50 + Math.cos(a) * 48.6} y1={50 + Math.sin(a) * 48.6} x2={50 + Math.cos(a) * (i % 5 ? 49.4 : 50)} y2={50 + Math.sin(a) * (i % 5 ? 49.4 : 50)} stroke="rgba(255,255,255,0.22)" strokeWidth="0.35" />;
        })}
        <circle cx="50" cy="50" r={r} fill="none" stroke="url(#ring)" strokeWidth="2.6" strokeLinecap="round" strokeDasharray={`${(c * Math.max(2, score)) / 100} ${c}`} transform="rotate(-90 50 50)" />
      </svg>
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} width={h * HEART_RATIO} height={h} style={{ marginTop: size * 0.02 }} alt="" />
      ) : (
        <div style={{ display: "flex" }} />
      )}
    </div>
  );
}

function TierPill({ tier, scale }: { tier: Tier; scale: number }) {
  return (
    <div style={{ display: "flex", alignSelf: "flex-start", padding: 2 * scale, borderRadius: 999, backgroundImage: gradient(tier.colors, 90) }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 * scale, padding: `${10 * scale}px ${24 * scale}px`, borderRadius: 999, background: "#0b0d18", color: tier.accent, fontSize: 24 * scale, fontWeight: 700, letterSpacing: 6 * scale }}>
        <svg width={22 * scale} height={22 * scale} viewBox="0 0 24 24">
          <path d="M12 1.5l2.6 7.9 7.9 2.6-7.9 2.6L12 22.5l-2.6-7.9L1.5 12l7.9-2.6z" fill={tier.accent} />
        </svg>
        {tier.name}
      </div>
    </div>
  );
}

/** A monitor's readout: a coloured label and a big value. */
function Readout({ label, value, color, scale, flex = 1 }: { label: string; value: string; color: string; scale: number; flex?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex, padding: `${18 * scale}px ${22 * scale}px`, borderRadius: 22 * scale, background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.08)", textAlign: "left" }}>
      <div style={{ display: "flex", fontSize: 20 * scale, letterSpacing: 4 * scale, color, fontWeight: 600 }}>{label}</div>
      <div style={{ display: "flex", fontSize: (value.length > 10 ? 34 : 46) * scale, fontWeight: 700, color: "#fff", marginTop: 6 * scale, lineHeight: 1.05 }}>{value}</div>
    </div>
  );
}

function Chip({ children, scale }: { children: ReactNode; scale: number }) {
  return (
    <div style={{ display: "flex", padding: `${9 * scale}px ${20 * scale}px`, borderRadius: 999, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)", fontSize: 24 * scale }}>
      {children}
    </div>
  );
}

/** The daily case's spoiler-free squares, drawn. */
function Squares({ grid, scale }: { grid: string; scale: number }) {
  const rows = grid.split("\n").map((row) => [...row].filter((ch) => ch.trim()));
  const color = (ch: string) => (ch === "🟩" ? "#34d399" : ch === "🟨" ? "#fbbf24" : ch === "🟥" ? "#f87171" : "rgba(255,255,255,0.18)");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 * scale }}>
      {rows.map((row, i) => (
        <div key={i} style={{ display: "flex", gap: 10 * scale }}>
          {row.map((ch, j) => (
            <div key={j} style={{ width: 48 * scale, height: 48 * scale, borderRadius: 10 * scale, background: color(ch) }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** An ECG trace in the tier's colour: a soft glow under a bright line. */
function Trace({ width, scale, color }: { width: number; scale: number; color: string }) {
  const h = 110 * scale;
  const beat = (x: number) => `L${x} 60 l12 -8 l10 8 l8 0 l6 6 l10 -52 l10 70 l7 -24 l12 0 l14 -10 l14 10`;
  const beats = [0.16, 0.5, 0.84].map((f) => beat(width * f)).join(" ");
  const d = `M0 60 ${beats} L${width} 60`;
  return (
    <svg width={width} height={h} viewBox={`0 0 ${width} 110`} preserveAspectRatio="none">
      <path d={d} fill="none" stroke={color} strokeOpacity="0.25" strokeWidth="12" strokeLinejoin="round" strokeLinecap="round" />
      <path d={d} fill="none" stroke={color} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** The card itself: a gradient frame, ECG paper, a sheen — on a dark aurora. */
function Frame({ tier, children, padding, inset, radius }: { tier: Tier; children: ReactNode; padding: number; inset: number; radius: number }) {
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        padding: inset,
        fontFamily: "Geist",
        color: "#fff",
        backgroundColor: "#04060d",
        backgroundImage: `radial-gradient(circle at 15% 5%, ${tier.glow}, transparent 45%), radial-gradient(circle at 95% 40%, rgba(37,99,235,0.35), transparent 42%), radial-gradient(circle at 50% 105%, rgba(6,182,212,0.30), transparent 50%)`,
      }}
    >
      <div style={{ display: "flex", flex: 1, padding: 3, borderRadius: radius, backgroundImage: gradient(tier.colors) }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            padding,
            borderRadius: radius - 3,
            backgroundColor: "#090b16",
            backgroundImage: `linear-gradient(160deg, rgba(255,255,255,0.07), transparent 38%), linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)`,
            backgroundSize: "100% 100%, 44px 44px, 44px 44px",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export const VERDICT: Record<string, string> = {
  correct: "Diagnosed correctly",
  implied: "Recognised from the management",
  partial: "Partly diagnosed",
  incorrect: "A tough one",
};

export const serial = (n: number) => `Nº ${String(n).padStart(4, "0")}`;

/* -------------------------------------------------------------------------- */
/* The cards                                                                   */
/* -------------------------------------------------------------------------- */

export function ResultCardImage({ card, format, site, img }: { card: ResultCard; format: CardFormat; site: string; img: string | null }) {
  const tier = tierFor(card.score);
  const title = card.daily ? `Daily case #${card.daily.number}` : (card.diagnosis ?? card.specialty);
  const verdict = card.verdict ? VERDICT[card.verdict] : undefined;
  const chips = [card.specialty, card.level, card.mode];
  const middle: [string, string] = card.streak > 0 ? ["STREAK", `${card.streak} ${card.streak === 1 ? "day" : "days"}`] : card.minutes ? ["TIME", card.minutes >= 120 ? `${Math.round(card.minutes / 60)} h` : `${card.minutes} min`] : ["MODE", card.mode];
  const readouts: [string, string, string][] = [["XP", `+${card.xp}`, "#34d399"], [middle[0], middle[1], "#22d3ee"], ["RANK", card.rank, "#fbbf24"]];
  const score = (size: number) => (
    <div style={{ display: "flex", alignItems: "baseline", gap: size * 0.12 }}>
      <div style={{ display: "flex", fontSize: size, fontWeight: 700, letterSpacing: -size * 0.04, lineHeight: 1, backgroundImage: gradient(tier.colors, 90), backgroundClip: "text", color: "transparent" }}>{String(card.score)}</div>
      <div style={{ display: "flex", fontSize: size * 0.3, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>/100</div>
    </div>
  );
  const head = (s: number) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 * s }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Brand scale={s} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 * s }}>
          <div style={{ display: "flex", fontSize: 20 * s, letterSpacing: 6 * s, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>CASE CARD</div>
          <div style={{ display: "flex", fontSize: 26 * s, color: tier.accent, fontWeight: 600, letterSpacing: 2 * s }}>{serial(card.caseNumber)}</div>
        </div>
      </div>
      {format !== "wide" && (
        <div style={{ display: "flex", alignItems: "center", gap: 18 * s }}>
          <AvatarDisc avatar={card.avatar} size={78 * s} ring={3 * s} ringColor={tier.colors[1]!} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 32 * s, fontWeight: 700 }}>{card.name}</div>
            <div style={{ display: "flex", fontSize: 22 * s, color: tier.accent }}>{card.rank}</div>
          </div>
        </div>
      )}
    </div>
  );
  const foot = (s: number, width: number) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 * s }}>
      <Trace width={width} scale={s} color={tier.colors[1]!} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 26 * s }}>
        <div style={{ display: "flex", color: "#fff", fontWeight: 600 }}>Can you beat {card.score}?</div>
        <div style={{ display: "flex", color: "#93c5fd" }}>{site}</div>
      </div>
    </div>
  );

  if (format === "story") {
    return (
      <Frame tier={tier} padding={64} inset={44} radius={72}>
        {head(1)}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, justifyContent: "center", gap: 26 }}>
          <HeartRing score={card.score} size={600} tier={tier} img={img} />
          {score(150)}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <TierPill tier={tier} scale={1} />
          </div>
          {verdict && <div style={{ display: "flex", fontSize: 30, color: "rgba(255,255,255,0.7)" }}>{verdict}</div>}
          <div style={{ display: "flex", fontSize: title.length > 34 ? 52 : 66, fontWeight: 700, lineHeight: 1.08, letterSpacing: -1.5, textAlign: "center", justifyContent: "center", maxWidth: 860 }}>{title}</div>
          {card.daily?.grid ? <Squares grid={card.daily.grid} scale={1} /> : <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>{chips.map((c) => <Chip key={c} scale={1}>{c}</Chip>)}</div>}
        </div>
        <div style={{ display: "flex", gap: 16, marginBottom: 28 }}>
          {readouts.map(([label, value, color]) => (
            <Readout key={label} label={label} value={value} color={color} scale={1} />
          ))}
        </div>
        {foot(1, 860)}
      </Frame>
    );
  }

  if (format === "square") {
    const s = 0.86;
    return (
      <Frame tier={tier} padding={48} inset={32} radius={60}>
        {head(s)}
        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 36 }}>
          <HeartRing score={card.score} size={400} tier={tier} img={img} />
          <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 16 }}>
            {score(118)}
            <TierPill tier={tier} scale={0.86} />
            <div style={{ display: "flex", fontSize: title.length > 34 ? 38 : 46, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1 }}>{title}</div>
            {card.daily?.grid ? <Squares grid={card.daily.grid} scale={0.72} /> : <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{chips.map((c) => <Chip key={c} scale={0.82}>{c}</Chip>)}</div>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, marginBottom: 18 }}>
          {readouts.map(([label, value, color]) => (
            <Readout key={label} label={label} value={value} color={color} scale={0.82} />
          ))}
        </div>
        {foot(s, 900)}
      </Frame>
    );
  }

  // wide — the link preview
  return (
    <Frame tier={tier} padding={36} inset={22} radius={44}>
      {head(0.7)}
      <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 32 }}>
        <HeartRing score={card.score} size={330} tier={tier} img={img} />
        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {score(96)}
            <TierPill tier={tier} scale={0.7} />
          </div>
          <div style={{ display: "flex", fontSize: title.length > 40 ? 34 : 42, fontWeight: 700, lineHeight: 1.12, letterSpacing: -0.8 }}>{title}</div>
          <div style={{ display: "flex", fontSize: 22, color: "rgba(255,255,255,0.6)" }}>
            {card.name} · {chips.join(" · ")}
          </div>
          <div style={{ display: "flex", fontSize: 24, color: "#93c5fd", marginTop: 6 }}>Can you beat {card.score}? · {site}</div>
        </div>
      </div>
    </Frame>
  );
}

export function ProgressCardImage({ card, format, site, img }: { card: ProgressCard; format: CardFormat; site: string; img: string | null }) {
  const tier = rankTier(card.tier);
  const story = format === "story";
  const wide = format === "wide";
  const s = story ? 1 : wide ? 0.62 : 0.86;
  const readouts: [string, string, string][] = [
    ["CASES", card.cases.toLocaleString("en-IN"), "#34d399"],
    ["AVERAGE", `${card.average}`, "#22d3ee"],
    ["STREAK", `${Math.max(card.streak, card.bestStreak)}`, "#fb923c"],
    ["XP", card.xp.toLocaleString("en-IN"), "#fbbf24"],
  ];
  const ringSize = story ? 520 : wide ? 300 : 360;
  return (
    <Frame tier={tier} padding={story ? 64 : wide ? 36 : 48} inset={story ? 44 : wide ? 22 : 32} radius={story ? 72 : wide ? 44 : 60}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Brand scale={s} />
        <div style={{ display: "flex", fontSize: 20 * s, letterSpacing: 6 * s, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>MY PROGRESS</div>
      </div>
      <div style={{ display: "flex", flex: 1, flexDirection: story ? "column" : "row", alignItems: "center", justifyContent: "center", gap: story ? 30 : 36 }}>
        <HeartRing score={card.average} size={ringSize} tier={tier} img={img} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: story ? "center" : "flex-start", gap: 14 * s, ...(story ? {} : { flex: 1 }) }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 * s }}>
            <AvatarDisc avatar={card.avatar} size={72 * s} ring={3 * s} ringColor={tier.colors[1]!} />
            <div style={{ display: "flex", fontSize: 34 * s, color: "rgba(255,255,255,0.8)" }}>{card.name}</div>
          </div>
          <div style={{ display: "flex", fontSize: (story ? 100 : 74) * s, fontWeight: 700, letterSpacing: -3 * s, lineHeight: 1.02, backgroundImage: gradient(tier.colors, 90), backgroundClip: "text", color: "transparent" }}>{card.rank}</div>
          {card.streak > 0 && <div style={{ display: "flex", fontSize: 30 * s, color: "#fdba74" }}>{`${card.streak}-day streak, and counting`}</div>}
          {!wide && card.badges.length > 0 && (
            <div style={{ display: "flex", gap: 10 * s, flexWrap: "wrap", justifyContent: story ? "center" : "flex-start", maxWidth: story ? 880 : 520 }}>
              {card.badges.slice(0, story ? 6 : 4).map((b) => (
                <Chip key={b} scale={s}>
                  {b}
                </Chip>
              ))}
            </div>
          )}
        </div>
      </div>
      {!wide && (
        <div style={{ display: "flex", gap: 14 * s, marginBottom: 22 * s }}>
          {readouts.map(([label, value, color]) => (
            <Readout key={label} label={label} value={value} color={color} scale={story ? 0.92 : 0.78} />
          ))}
        </div>
      )}
      {!wide && card.specialties.length > 0 && story && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 26 }}>
          {card.specialties.map((sp) => (
            <div key={sp.name} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: "rgba(255,255,255,0.8)" }}>
                <div style={{ display: "flex" }}>{sp.name}</div>
                <div style={{ display: "flex" }}>{`${sp.percent}%`}</div>
              </div>
              <div style={{ display: "flex", height: 12, borderRadius: 999, background: "rgba(255,255,255,0.10)" }}>
                <div style={{ display: "flex", width: `${Math.max(4, sp.percent)}%`, height: "100%", borderRadius: 999, backgroundImage: gradient(tier.colors, 90) }} />
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 * s }}>
        {!wide && <Trace width={story ? 860 : 900} scale={s} color={tier.colors[1]!} />}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26 * s }}>
          <div style={{ display: "flex", color: "#fff", fontWeight: 600 }}>Think like a doctor, every day.</div>
          <div style={{ display: "flex", color: "#93c5fd" }}>{site}</div>
        </div>
      </div>
    </Frame>
  );
}

/** A medal on a burst of light: a ribbon, a ring in the tier's colours, a star (a badge) or the heart (a rank). */
function Medal({ size, tier, rank, img }: { size: number; tier: Tier; rank: boolean; img: string | null }) {
  const rays = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * 2 * Math.PI;
    const b = a + Math.PI / 48;
    const c = a - Math.PI / 48;
    return `M50 50 L${50 + Math.cos(b) * 50} ${50 + Math.sin(b) * 50} L${50 + Math.cos(c) * 50} ${50 + Math.sin(c) * 50} Z`;
  });
  const disc = size * 0.56;
  return (
    <div style={{ display: "flex", position: "relative", width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: "absolute", top: 0, left: 0 }}>
        <defs>
          <radialGradient id="glow" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor={tier.colors[1]!} stopOpacity="0.55" />
            <stop offset="1" stopColor={tier.colors[1]!} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="ribbon" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={tier.colors[0]!} />
            <stop offset="1" stopColor={tier.colors[2]!} />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="50" fill="url(#glow)" />
        {rays.map((d, i) => (
          <path key={i} d={d} fill={tier.accent} fillOpacity={i % 2 ? 0.1 : 0.18} />
        ))}
        <path d="M37 62 L30 92 L40 86 L46 95 L50 66 Z" fill="url(#ribbon)" />
        <path d="M63 62 L70 92 L60 86 L54 95 L50 66 Z" fill="url(#ribbon)" />
      </svg>
      <div style={{ display: "flex", width: disc, height: disc, borderRadius: 9999, padding: disc * 0.05, backgroundImage: gradient(tier.colors), boxShadow: `0 0 ${disc * 0.4}px ${tier.glow}` }}>
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 9999, backgroundImage: "radial-gradient(circle at 35% 30%, #2a2f5a, #0b0d18 70%)" }}>
          {rank && img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} width={disc * 0.5 * HEART_RATIO} height={disc * 0.5} alt="" />
          ) : (
            <svg width={disc * 0.52} height={disc * 0.52} viewBox="0 0 24 24">
              <defs>
                <linearGradient id="star" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#fef3c7" />
                  <stop offset="1" stopColor={tier.colors[1]!} />
                </linearGradient>
              </defs>
              <path d="M12 1.8l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.6l-6.2 3.3L7 14 2 9.1l6.9-1z" fill="url(#star)" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

/** An achievement, as a card to post: the medal, what was earned, by whom — and their record so far. */
export function AchievementCardImage({ card, format, site, img }: { card: AchievementCard; format: CardFormat; site: string; img: string | null }) {
  const tier = rankTier(card.tier);
  const story = format === "story";
  const wide = format === "wide";
  const s = story ? 1 : wide ? 0.62 : 0.86;
  const rank = card.prize.kind === "rank";
  const medal = story ? 600 : wide ? 360 : 360;
  const label = card.prize.label;
  const readouts: [string, string, string][] = [
    ["CASES", card.cases.toLocaleString("en-IN"), "#34d399"],
    ["BADGES", `${card.unlocked}/${card.of}`, "#22d3ee"],
    [rank ? "XP" : "RANK", rank ? card.xp.toLocaleString("en-IN") : card.rank, "#fbbf24"],
  ];
  return (
    <Frame tier={tier} padding={story ? 64 : wide ? 36 : 48} inset={story ? 44 : wide ? 22 : 32} radius={story ? 72 : wide ? 44 : 60}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Brand scale={s} />
        <div style={{ display: "flex", fontSize: 20 * s, letterSpacing: 6 * s, color: tier.accent, fontWeight: 700 }}>{rank ? "PROMOTED" : "ACHIEVEMENT UNLOCKED"}</div>
      </div>
      <div style={{ display: "flex", flex: 1, flexDirection: wide ? "row" : "column", alignItems: "center", justifyContent: "center", gap: wide ? 30 : 10 * s }}>
        <Medal size={medal} tier={tier} rank={rank} img={img} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: wide ? "flex-start" : "center", gap: 14 * s, ...(wide ? { flex: 1 } : {}) }}>
          <div style={{ display: "flex", fontSize: (label.length > 18 ? 72 : 92) * s, fontWeight: 700, letterSpacing: -3 * s, lineHeight: 1.02, textAlign: wide ? "left" : "center", backgroundImage: gradient(tier.colors, 90), backgroundClip: "text", color: "transparent" }}>{label}</div>
          <div style={{ display: "flex", fontSize: 32 * s, lineHeight: 1.35, color: "rgba(255,255,255,0.78)", maxWidth: story ? 860 : wide ? 620 : 820, textAlign: wide ? "left" : "center" }}>{card.prize.description}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 * s, marginTop: 10 * s, marginBottom: wide ? 0 : 18 * s }}>
            <AvatarDisc avatar={card.avatar} size={64 * s} ring={3 * s} ringColor={tier.colors[1]!} />
            <div style={{ display: "flex", fontSize: 32 * s, color: "#fff", fontWeight: 600 }}>{card.name}</div>
          </div>
        </div>
      </div>
      {!wide && (
        <div style={{ display: "flex", gap: 14 * s, marginBottom: 22 * s }}>
          {readouts.map(([l, value, color]) => (
            <Readout key={l} label={l} value={value} color={color} scale={story ? 0.92 : 0.78} />
          ))}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 * s }}>
        {!wide && <Trace width={story ? 860 : 900} scale={s} color={tier.colors[1]!} />}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26 * s }}>
          <div style={{ display: "flex", color: "#fff", fontWeight: 600 }}>Think like a doctor, every day.</div>
          <div style={{ display: "flex", color: "#93c5fd" }}>{site}</div>
        </div>
      </div>
    </Frame>
  );
}
