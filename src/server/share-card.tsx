/**
 * The shareable cards, drawn as pictures (next/og): a case result, or a
 * doctor's progress — dark, quiet, unmistakably RamAI. Sizes for a WhatsApp
 * Status or Instagram Story (1080×1920), a post (1080×1080) and a link
 * preview (1200×630).
 */
import "server-only";

import type { ReactNode } from "react";

import type { ProgressCard, ResultCard } from "./share";

export type CardFormat = "story" | "square" | "wide";
export const CARD_SIZE: Record<CardFormat, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
  wide: { width: 1200, height: 630 },
};

/* -------------------------------------------------------------------------- */
/* Fonts: Geist, as on the site (fetched once per server, then kept)           */
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

/* -------------------------------------------------------------------------- */
/* Pieces                                                                      */
/* -------------------------------------------------------------------------- */

const INK = "#060a14";
const VIOLET = "#7c3aed";
const BLUE = "#2563eb";
const CYAN = "#06b6d4";

/** RamAI's mark: the gradient tile with the trace. */
function Mark({ size }: { size: number }) {
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
    <div style={{ display: "flex", alignItems: "center", gap: 18 * scale }}>
      <Mark size={64 * scale} />
      <div style={{ display: "flex", fontSize: 44 * scale, fontWeight: 700, letterSpacing: -1 * scale, color: "#fff" }}>
        Ram<span style={{ color: "#60a5fa" }}>AI</span>
      </div>
    </div>
  );
}

/** The score as a ring: green from 70, amber from 50. */
function ScoreRing({ score, size }: { score: number; size: number }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const color = score >= 70 ? "#34d399" : score >= 50 ? "#fbbf24" : "#f87171";
  return (
    <div style={{ display: "flex", position: "relative", width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: "absolute", top: 0, left: 0 }}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="7" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(c * Math.max(2, score)) / 100} ${c}`} transform="rotate(-90 50 50)" />
      </svg>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {/* The picture renderer wants text, not a bare number. */}
        <div style={{ display: "flex", fontSize: size * 0.34, fontWeight: 700, color: "#fff", letterSpacing: -size * 0.01, lineHeight: 1 }}>{String(score)}</div>
        <div style={{ fontSize: size * 0.085, color: "rgba(255,255,255,0.55)", marginTop: size * 0.02 }}>out of 100</div>
      </div>
    </div>
  );
}

function Chip({ children, scale }: { children: ReactNode; scale: number }) {
  return (
    <div style={{ display: "flex", padding: `${10 * scale}px ${22 * scale}px`, borderRadius: 999, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)", fontSize: 26 * scale }}>
      {children}
    </div>
  );
}

function Stat({ value, label, scale }: { value: string; label: string; scale: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: `${26 * scale}px ${28 * scale}px`, borderRadius: 28 * scale, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", textAlign: "left" }}>
      <div style={{ fontSize: 46 * scale, fontWeight: 700, color: "#fff", lineHeight: 1.05 }}>{value}</div>
      <div style={{ fontSize: 24 * scale, color: "rgba(255,255,255,0.55)", marginTop: 8 * scale }}>{label}</div>
    </div>
  );
}

/** The daily case's spoiler-free squares, drawn. */
function Squares({ grid, scale }: { grid: string; scale: number }) {
  const rows = grid.split("\n").map((row) => [...row].filter((ch) => ch.trim()));
  const color = (ch: string) => (ch === "🟩" ? "#34d399" : ch === "🟨" ? "#fbbf24" : ch === "🟥" ? "#f87171" : "rgba(255,255,255,0.18)");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 * scale }}>
      {rows.map((row, i) => (
        <div key={i} style={{ display: "flex", gap: 12 * scale }}>
          {row.map((ch, j) => (
            <div key={j} style={{ width: 56 * scale, height: 56 * scale, borderRadius: 12 * scale, background: color(ch) }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** The trace along the bottom: a little ECG, for the medical feel. */
function Trace({ width, scale }: { width: number; scale: number }) {
  const h = 90 * scale;
  return (
    <svg width={width} height={h} viewBox={`0 0 ${width} 90`} preserveAspectRatio="none">
      <path d={`M0 55 H${width * 0.38} l18 -10 l14 34 l20 -76 l16 62 l12 -10 H${width}`} fill="none" stroke="rgba(6,182,212,0.55)" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Backdrop({ children, padding }: { children: ReactNode; padding: number }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding,
        fontFamily: "Geist",
        color: "#fff",
        backgroundColor: INK,
        backgroundImage: `radial-gradient(circle at 12% 8%, rgba(124,58,237,0.55), transparent 42%), radial-gradient(circle at 92% 30%, rgba(37,99,235,0.40), transparent 40%), radial-gradient(circle at 70% 98%, rgba(6,182,212,0.35), transparent 45%)`,
      }}
    >
      {children}
    </div>
  );
}

const VERDICT: Record<string, { text: string; color: string }> = {
  correct: { text: "Diagnosed correctly", color: "#34d399" },
  implied: { text: "Recognised from the management", color: "#34d399" },
  partial: { text: "Partly diagnosed", color: "#fbbf24" },
  incorrect: { text: "A tough one", color: "#fbbf24" },
};

/* -------------------------------------------------------------------------- */
/* The cards                                                                   */
/* -------------------------------------------------------------------------- */

export function ResultCardImage({ card, format, site }: { card: ResultCard; format: CardFormat; site: string }) {
  const verdict = card.verdict ? VERDICT[card.verdict] : undefined;
  const title = card.daily ? `Daily case #${card.daily.number}` : (card.diagnosis ?? card.specialty);
  const chips = [card.specialty, card.level, card.mode];
  // A streak when there is one; otherwise how long the encounter took.
  const middle: [string, string] = card.streak > 0 ? [`${card.streak}`, card.streak === 1 ? "day streak" : "day streak"] : card.minutes ? [card.minutes >= 120 ? `${Math.round(card.minutes / 60)} h` : `${card.minutes} min`, "in the case"] : [card.mode, "mode"];
  const stats: [string, string][] = [[`+${card.xp}`, "XP earned"], middle, [card.rank, "rank"]];

  if (format === "wide") {
    const s = 0.62;
    return (
      <Backdrop padding={56}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Brand scale={s} />
          <div style={{ display: "flex", fontSize: 22, color: "rgba(255,255,255,0.55)" }}>{card.name}</div>
        </div>
        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 56, marginTop: 20 }}>
          <ScoreRing score={card.score} size={300} />
          <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 18 }}>
            {verdict && <div style={{ display: "flex", fontSize: 26, color: verdict.color, fontWeight: 600 }}>{verdict.text}</div>}
            <div style={{ display: "flex", fontSize: title.length > 40 ? 40 : 52, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1 }}>{title}</div>
            {card.daily?.grid ? <Squares grid={card.daily.grid} scale={0.6} /> : <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>{chips.map((c) => <Chip key={c} scale={0.8}>{c}</Chip>)}</div>}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 22, color: "rgba(255,255,255,0.55)" }}>Think like a doctor · {site}</div>
      </Backdrop>
    );
  }

  const story = format === "story";
  const s = story ? 1 : 0.86;
  return (
    <Backdrop padding={story ? 88 : 72}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Brand scale={s} />
        <div style={{ display: "flex", fontSize: 28 * s, color: "rgba(255,255,255,0.6)" }}>{card.name}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", alignItems: story ? "center" : "flex-start", gap: story ? 44 : 30, textAlign: story ? "center" : "left" }}>
        <div style={{ display: "flex", fontSize: 26 * s, letterSpacing: 6 * s, color: "#67e8f9", fontWeight: 600 }}>CASE COMPLETE</div>
        <div style={{ display: "flex", alignItems: "center", gap: 48 * s, flexDirection: story ? "column" : "row" }}>
          <ScoreRing score={card.score} size={story ? 460 : 330} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: story ? "center" : "flex-start", gap: 20 * s, maxWidth: story ? 880 : 520 }}>
            {verdict && <div style={{ display: "flex", fontSize: 34 * s, color: verdict.color, fontWeight: 600 }}>{verdict.text}</div>}
            <div style={{ display: "flex", fontSize: (title.length > 34 ? 58 : 76) * s, fontWeight: 700, lineHeight: 1.08, letterSpacing: -2 * s, justifyContent: story ? "center" : "flex-start" }}>{title}</div>
            {card.daily?.grid && <Squares grid={card.daily.grid} scale={s} />}
            <div style={{ display: "flex", gap: 14 * s, flexWrap: "wrap", justifyContent: story ? "center" : "flex-start" }}>
              {chips.map((c) => (
                <Chip key={c} scale={s}>
                  {c}
                </Chip>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 20 * s, width: "100%" }}>
          {stats.map(([value, label]) => (
            <Stat key={label} value={value} label={label} scale={s} />
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 * s }}>
        <Trace width={story ? 904 : 936} scale={s} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28 * s, color: "rgba(255,255,255,0.65)" }}>
          <div style={{ display: "flex" }}>Think like a doctor. Every single day.</div>
          <div style={{ display: "flex", color: "#93c5fd" }}>{site}</div>
        </div>
      </div>
    </Backdrop>
  );
}

export function ProgressCardImage({ card, format, site }: { card: ProgressCard; format: CardFormat; site: string }) {
  const story = format === "story";
  const wide = format === "wide";
  const s = story ? 1 : wide ? 0.6 : 0.86;
  const stats: [string, string][] = [
    [card.cases.toLocaleString("en-IN"), card.cases === 1 ? "case" : "cases"],
    [`${card.average}`, "average score"],
    [`${card.bestStreak}`, "best streak"],
    [card.xp.toLocaleString("en-IN"), "XP"],
  ];
  return (
    <Backdrop padding={story ? 88 : wide ? 52 : 72}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Brand scale={s} />
        <div style={{ display: "flex", fontSize: 26 * s, letterSpacing: 6 * s, color: "#67e8f9", fontWeight: 600 }}>MY PROGRESS</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", gap: story ? 56 : 28 * s }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 * s }}>
          <div style={{ display: "flex", fontSize: 36 * s, color: "rgba(255,255,255,0.65)" }}>{card.name}</div>
          <div style={{ display: "flex", fontSize: (story ? 110 : 92) * s, fontWeight: 700, letterSpacing: -3 * s, lineHeight: 1.02 }}>{card.rank}</div>
          {card.streak > 0 && <div style={{ display: "flex", fontSize: 32 * s, color: "#fdba74" }}>{card.streak}-day streak, and counting</div>}
        </div>
        <div style={{ display: "flex", gap: 18 * s, flexWrap: story ? "wrap" : "nowrap" }}>
          {stats.map(([value, label]) => (
            <div key={label} style={{ display: "flex", width: story ? "48%" : "auto", flex: story ? "none" : 1 }}>
              <Stat value={value} label={label} scale={s} />
            </div>
          ))}
        </div>
        {!wide && card.specialties.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 * s }}>
            {card.specialties.map((sp) => (
              <div key={sp.name} style={{ display: "flex", flexDirection: "column", gap: 10 * s }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28 * s, color: "rgba(255,255,255,0.8)" }}>
                  <div style={{ display: "flex" }}>{sp.name}</div>
                  <div style={{ display: "flex" }}>{sp.percent}%</div>
                </div>
                <div style={{ display: "flex", height: 14 * s, borderRadius: 999, background: "rgba(255,255,255,0.10)" }}>
                  <div style={{ display: "flex", width: `${Math.max(4, sp.percent)}%`, height: "100%", borderRadius: 999, backgroundImage: `linear-gradient(90deg, ${VIOLET}, ${BLUE}, ${CYAN})` }} />
                </div>
              </div>
            ))}
          </div>
        )}
        {!wide && card.badges.length > 0 && (
          <div style={{ display: "flex", gap: 14 * s, flexWrap: "wrap" }}>
            {card.badges.map((b) => (
              <Chip key={b} scale={s}>
                {b}
              </Chip>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 * s }}>
        {!wide && <Trace width={story ? 904 : 936} scale={s} />}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28 * s, color: "rgba(255,255,255,0.65)" }}>
          <div style={{ display: "flex" }}>Clinical cases, every day.</div>
          <div style={{ display: "flex", color: "#93c5fd" }}>{site}</div>
        </div>
      </div>
    </Backdrop>
  );
}
