/**
 * Two more looks for a share card, beside the collectible (share-card.tsx):
 *   · Monitor — a bedside monitor: the doctor's avatar on the patient strip,
 *     a glowing ECG, and the result as the big numbers a monitor shows;
 *   · Badge — a hospital ID badge on its lanyard: the avatar as the photo, the
 *     rank as the designation, and the score stamped on as a seal.
 * Both draw a result or a doctor's progress, in every size.
 */
import "server-only";

import { AvatarDisc, Mark, mixHex, rankTier, serial, tierFor, VERDICT, type CardFormat, type Tier } from "./share-card";
import type { ProgressCard, ResultCard } from "./share";

export type CardStyle = "collectible" | "monitor" | "badge";
export const CARD_STYLES: CardStyle[] = ["collectible", "monitor", "badge"];

/** What either kind of card says, in one shape. */
interface View {
  name: string;
  avatar: { initials: string; color: string };
  rank: string;
  tier: Tier;
  score: number;
  scoreLabel: string;
  /** The tier's name for a result; the rank's for progress. */
  grade: string;
  title: string;
  kicker: string;
  line?: string;
  stats: [label: string, value: string][];
  chips: string[];
  serial: string;
  cta: string;
}

function viewOf(card: ResultCard | ProgressCard): View {
  if (card.kind === "result") {
    const tier = tierFor(card.score);
    const middle: [string, string] = card.streak > 0 ? ["STREAK", `${card.streak} ${card.streak === 1 ? "day" : "days"}`] : card.minutes ? ["TIME", card.minutes >= 120 ? `${Math.round(card.minutes / 60)} h` : `${card.minutes} min`] : ["MODE", card.mode];
    return {
      name: card.name,
      avatar: card.avatar,
      rank: card.rank,
      tier,
      score: card.score,
      scoreLabel: "SCORE",
      grade: tier.name,
      title: card.daily ? `Daily case #${card.daily.number}` : (card.diagnosis ?? card.specialty),
      kicker: card.daily ? "DAILY CASE" : "CASE SOLVED",
      line: card.verdict ? VERDICT[card.verdict] : undefined,
      stats: [["XP", `+${card.xp}`], middle, ["RANK", card.rank]],
      chips: [card.specialty, card.level, card.mode],
      serial: serial(card.caseNumber),
      cta: `Can you beat ${card.score}?`,
    };
  }
  const tier = rankTier(card.tier);
  return {
    name: card.name,
    avatar: card.avatar,
    rank: card.rank,
    tier,
    score: card.average,
    scoreLabel: "AVERAGE",
    grade: tierFor(card.average).name,
    title: card.rank,
    kicker: "TRACK RECORD",
    line: card.streak > 0 ? `${card.streak}-day streak, and counting` : undefined,
    stats: [["CASES", card.cases.toLocaleString("en-IN")], ["STREAK", `${Math.max(card.streak, card.bestStreak)}`], ["XP", card.xp.toLocaleString("en-IN")]],
    chips: card.badges.slice(0, 4),
    serial: "PROGRESS",
    cta: "Think like a doctor, every day.",
  };
}

/* -------------------------------------------------------------------------- */
/* Monitor                                                                     */
/* -------------------------------------------------------------------------- */

const GREEN = "#22c55e";
const CYAN = "#22d3ee";
const YELLOW = "#facc15";
const PINK = "#f472b6";
const PARAM = [CYAN, YELLOW, PINK];

/** A monitor's ECG sweep: sinus beats with a bright head and a fading trail. */
function Sweep({ width, height, color }: { width: number; height: number; color: string }) {
  const beat = (x: number) => `L${x} 60 l14 -9 l12 9 l9 0 l6 7 l11 -58 l11 78 l8 -27 l14 0 l16 -11 l16 11`;
  const d = `M0 60 ${[0.08, 0.3, 0.52, 0.74].map((f) => beat(width * f)).join(" ")} L${width * 0.93} 60`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} 120`} preserveAspectRatio="none">
      <path d={d} fill="none" stroke={color} strokeOpacity="0.22" strokeWidth="14" strokeLinejoin="round" strokeLinecap="round" />
      <path d={d} fill="none" stroke={color} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={width * 0.93} cy="60" r="7" fill="#fff" />
    </svg>
  );
}

/** The saturation probe's pleth wave, under the ECG. */
function Pleth({ width, height, color }: { width: number; height: number; color: string }) {
  const n = 7;
  const step = (width * 0.92) / n;
  let d = "M0 70";
  for (let i = 0; i < n; i++) {
    const x = i * step;
    d += ` C${x + step * 0.18} 70 ${x + step * 0.22} 14 ${x + step * 0.36} 14 S${x + step * 0.5} 46 ${x + step * 0.58} 44 S${x + step * 0.7} 52 ${x + step} 70`;
  }
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} 80`} preserveAspectRatio="none">
      <path d={d} fill="none" stroke={color} strokeOpacity="0.2" strokeWidth="12" strokeLinecap="round" />
      <path d={d} fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

function Param({ label, value, color, s, big = false }: { label: string; value: string; color: string; s: number; big?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: `${16 * s}px ${20 * s}px`, borderRadius: 18 * s, border: `2px solid ${color}55`, background: "rgba(255,255,255,0.025)" }}>
      <div style={{ display: "flex", fontSize: 21 * s, letterSpacing: 5 * s, color, fontWeight: 700 }}>{label}</div>
      <div style={{ display: "flex", fontSize: (big ? 64 : value.length > 9 ? 34 : 50) * s, fontWeight: 700, color, marginTop: 6 * s, lineHeight: 1.05 }}>{value}</div>
    </div>
  );
}

export function MonitorCardImage({ card, format, site }: { card: ResultCard | ProgressCard; format: CardFormat; site: string }) {
  const v = viewOf(card);
  const story = format === "story";
  const wide = format === "wide";
  const s = story ? 1 : wide ? 0.6 : 0.82;
  const width = story ? 968 : wide ? 1124 : 984;
  const score = (
    <div style={{ display: "flex", flexDirection: "column", padding: `${18 * s}px ${26 * s}px`, borderRadius: 22 * s, border: `2px solid ${GREEN}66`, background: "rgba(34,197,94,0.05)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24 * s, letterSpacing: 6 * s, color: GREEN, fontWeight: 700 }}>
        <div style={{ display: "flex" }}>{v.scoreLabel}</div>
        <div style={{ display: "flex", color: `${GREEN}aa` }}>{v.grade}</div>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 * s }}>
        <div style={{ display: "flex", fontSize: (story ? 290 : 190) * s, fontWeight: 700, color: GREEN, lineHeight: 1, letterSpacing: -8 * s }}>{String(v.score)}</div>
        <div style={{ display: "flex", fontSize: 48 * s, color: `${GREEN}99`, fontWeight: 600 }}>/100</div>
      </div>
    </div>
  );
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: story ? 56 : wide ? 32 : 44,
        fontFamily: "Geist",
        color: "#fff",
        backgroundColor: "#010403",
        backgroundImage: `radial-gradient(circle at 20% 0%, rgba(34,197,94,0.20), transparent 45%), radial-gradient(circle at 100% 100%, rgba(34,211,238,0.14), transparent 45%), linear-gradient(rgba(34,197,94,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,0.07) 1px, transparent 1px)`,
        backgroundSize: "100% 100%, 100% 100%, 40px 40px, 40px 40px",
      }}
    >
      {/* The monitor's top bar. */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 22 * s, letterSpacing: 5 * s, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 * s }}>
          <div style={{ display: "flex", width: 16 * s, height: 16 * s, borderRadius: 999, background: "#ef4444" }} />
          <Mark size={40 * s} />
          <div style={{ display: "flex" }}>RAMAI · BEDSIDE</div>
        </div>
        <div style={{ display: "flex", color: GREEN }}>{v.serial}</div>
      </div>
      {/* The patient strip — the doctor. */}
      <div style={{ display: "flex", alignItems: "center", gap: 22 * s, marginTop: 28 * s, paddingBottom: 22 * s, borderBottom: `2px solid ${GREEN}33` }}>
        <AvatarDisc avatar={v.avatar} size={104 * s} ring={4 * s} ringColor={GREEN} />
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ display: "flex", fontSize: 46 * s, fontWeight: 700 }}>{v.name}</div>
          <div style={{ display: "flex", fontSize: 26 * s, color: GREEN }}>{v.rank}</div>
        </div>
        {!wide && <div style={{ display: "flex", fontSize: 22 * s, letterSpacing: 5 * s, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>{v.kicker}</div>}
      </div>
      {wide ? (
        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 24 }}>
          {score}
          <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 14 }}>
            <div style={{ display: "flex", fontSize: 40, fontWeight: 700, lineHeight: 1.12 }}>{v.title}</div>
            <div style={{ display: "flex", gap: 12 }}>
              {v.stats.map(([label, value], i) => (
                <Param key={label} label={label} value={value} color={PARAM[i]!} s={0.62} />
              ))}
            </div>
            <div style={{ display: "flex", fontSize: 24, color: "#93c5fd" }}>{`${v.cta} · ${site}`}</div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 24 * s, marginTop: 24 * s }}>
          <Sweep width={width} height={(story ? 250 : 120) * s} color={GREEN} />
          {score}
          {story && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", fontSize: 20, letterSpacing: 5, color: CYAN, fontWeight: 700 }}>PLETH</div>
              <Pleth width={width} height={150} color={CYAN} />
            </div>
          )}
          <div style={{ display: "flex", gap: 16 * s }}>
            {v.stats.map(([label, value], i) => (
              <Param key={label} label={label} value={value} color={PARAM[i]!} s={s} />
            ))}
          </div>
          {story && <div style={{ display: "flex", flex: 1 }} />}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 * s }}>
            <div style={{ display: "flex", fontSize: 22 * s, letterSpacing: 5 * s, color: `${GREEN}cc`, fontWeight: 700 }}>{card.kind === "result" ? "DX" : "RANK"}</div>
            <div style={{ display: "flex", fontSize: (v.title.length > 34 ? 50 : 62) * s, fontWeight: 700, lineHeight: 1.08, letterSpacing: -1.2 * s }}>{v.title}</div>
            {v.line && <div style={{ display: "flex", fontSize: 28 * s, color: "rgba(255,255,255,0.65)" }}>{v.line}</div>}
          </div>
          {story && v.chips.length > 0 && (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {v.chips.map((c) => (
                <div key={c} style={{ display: "flex", padding: "9px 20px", borderRadius: 999, border: `2px solid ${GREEN}44`, color: "rgba(255,255,255,0.85)", fontSize: 24 }}>
                  {c}
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", flex: 1 }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 28 * s }}>
            <div style={{ display: "flex", fontWeight: 700 }}>{v.cta}</div>
            <div style={{ display: "flex", color: "#93c5fd" }}>{site}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Badge                                                                       */
/* -------------------------------------------------------------------------- */

/** The score as a stamped seal: a double ring, slightly askew. */
function Seal({ v, size }: { v: View; size: number }) {
  const ink = mixHex(v.tier.colors[1]!, "#1e1b4b", 0.25);
  return (
    <div style={{ display: "flex", position: "relative", width: size, height: size, alignItems: "center", justifyContent: "center", transform: "rotate(-12deg)" }}>
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: "absolute", top: 0, left: 0 }}>
        <circle cx="50" cy="50" r="47" fill={`${v.tier.colors[0]}33`} stroke={ink} strokeWidth="2.2" />
        <circle cx="50" cy="50" r="41" fill="none" stroke={ink} strokeWidth="1" strokeDasharray="2.4 2" />
      </svg>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", color: ink }}>
        <div style={{ display: "flex", fontSize: size * 0.1, letterSpacing: size * 0.012, fontWeight: 700 }}>{v.scoreLabel}</div>
        <div style={{ display: "flex", fontSize: size * 0.36, fontWeight: 700, lineHeight: 1, letterSpacing: -size * 0.015 }}>{String(v.score)}</div>
        <div style={{ display: "flex", fontSize: size * 0.085, fontWeight: 700, letterSpacing: size * 0.01, maxWidth: size * 0.78, textAlign: "center", justifyContent: "center" }}>{v.grade.length > 14 ? v.grade.slice(0, 14) : v.grade}</div>
      </div>
    </div>
  );
}

/** A barcode for the badge, its bars drawn from the serial. */
function Barcode({ text, width, height }: { text: string; width: number; height: number }) {
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  let h = 7;
  for (let i = 0; x < width; i++) {
    h = (h * 31 + text.charCodeAt(i % text.length)) >>> 0;
    const w = 2 + (h % 4) * 1.6;
    if (i % 2 === 0) bars.push({ x, w });
    x += w + 1.4;
  }
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y="0" width={b.w} height={height} fill="#0b1220" />
      ))}
    </svg>
  );
}

export function BadgeCardImage({ card, format, site }: { card: ResultCard | ProgressCard; format: CardFormat; site: string }) {
  const v = viewOf(card);
  const story = format === "story";
  const wide = format === "wide";
  const s = story ? 1 : wide ? 0.62 : 0.84;
  const ink = "#0b1220";
  const accent = mixHex(v.tier.colors[1]!, "#1e1b4b", 0.3);
  const header = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: (story ? 170 : 120) * s, padding: `0 ${44 * s}px`, backgroundImage: "linear-gradient(120deg, #7c3aed, #2563eb 55%, #06b6d4)", color: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 * s }}>
        <Mark size={56 * s} />
        <div style={{ display: "flex", fontSize: 42 * s, fontWeight: 700, letterSpacing: -1 * s }}>RamAI</div>
      </div>
      <div style={{ display: "flex", fontSize: 24 * s, letterSpacing: 7 * s, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>CLINICIAN</div>
    </div>
  );
  const stats = (scale: number) => (
    <div style={{ display: "flex", width: "100%", gap: 14 * scale }}>
      {v.stats.map(([label, value]) => (
        <div key={label} style={{ display: "flex", flexDirection: "column", flex: 1, padding: `${14 * scale}px ${18 * scale}px`, borderRadius: 18 * scale, background: "#f1f5f9" }}>
          <div style={{ display: "flex", fontSize: 19 * scale, letterSpacing: 4 * scale, color: "#64748b", fontWeight: 700 }}>{label}</div>
          <div style={{ display: "flex", fontSize: (value.length > 10 ? 28 : 38) * scale, fontWeight: 700, color: ink, marginTop: 4 * scale }}>{value}</div>
        </div>
      ))}
    </div>
  );
  const background = {
    display: "flex",
    width: "100%",
    height: "100%",
    fontFamily: "Geist",
    backgroundColor: "#e8ecfb",
    backgroundImage: `radial-gradient(circle at 10% 0%, ${v.tier.colors[0]}88, transparent 40%), radial-gradient(circle at 100% 80%, rgba(6,182,212,0.35), transparent 45%), radial-gradient(circle at 0% 100%, rgba(124,58,237,0.30), transparent 45%)`,
  } as const;

  if (wide) {
    return (
      <div style={{ ...background, padding: 36, alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, height: "100%", borderRadius: 34, overflow: "hidden", background: "#fff", boxShadow: "0 30px 60px -20px rgba(15,23,42,0.45)" }}>
          {header}
          <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 30, padding: "0 36px" }}>
            <AvatarDisc avatar={v.avatar} size={190} ring={8} ringColor="#e2e8f0" />
            <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 8 }}>
              <div style={{ display: "flex", fontSize: 44, fontWeight: 700, color: ink }}>{v.name}</div>
              <div style={{ display: "flex", fontSize: 24, color: accent, fontWeight: 600 }}>{v.rank}</div>
              <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: ink, marginTop: 6 }}>{v.title}</div>
              <div style={{ display: "flex", fontSize: 22, color: "#2563eb" }}>{`${v.cta} · ${site}`}</div>
            </div>
            <Seal v={v} size={200} />
          </div>
        </div>
      </div>
    );
  }

  const photo = story ? 330 : 230;
  return (
    <div style={{ ...background, flexDirection: "column", alignItems: "center", padding: story ? "0 70px 70px" : "0 56px 46px" }}>
      {/* The lanyard and its clip. */}
      <svg width={260 * s} height={(story ? 150 : 80) * s} viewBox="0 0 260 150" preserveAspectRatio="none">
        <path d="M40 0 L120 132 M220 0 L140 132" stroke="#4f46e5" strokeWidth="26" strokeLinecap="round" />
        <rect x="104" y="112" width="52" height="38" rx="9" fill="#94a3b8" />
      </svg>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, width: "100%", borderRadius: 56 * s, overflow: "hidden", background: "#fff", boxShadow: "0 40px 80px -24px rgba(15,23,42,0.5)" }}>
        {header}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, padding: `0 ${48 * s}px ${36 * s}px` }}>
          <div style={{ display: "flex", marginTop: -photo * 0.36 }}>
            <AvatarDisc avatar={v.avatar} size={photo * s} ring={12 * s} ringColor="#fff" />
          </div>
          <div style={{ display: "flex", fontSize: (story ? 76 : 62) * s, fontWeight: 700, color: ink, marginTop: 18 * s, letterSpacing: -1.5 * s }}>{v.name}</div>
          <div style={{ display: "flex", fontSize: (story ? 36 : 32) * s, color: accent, fontWeight: 600 }}>{v.rank}</div>
          {story && <div style={{ display: "flex", flex: 1 }} />}
          <div style={{ display: "flex", width: "100%", alignItems: "center", gap: 24 * s, marginTop: 34 * s }}>
            <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 10 * s }}>
              <div style={{ display: "flex", fontSize: 21 * s, letterSpacing: 5 * s, color: "#64748b", fontWeight: 700 }}>{v.kicker}</div>
              <div style={{ display: "flex", fontSize: (v.title.length > 30 ? 44 : 54) * s, fontWeight: 700, color: ink, lineHeight: 1.08, letterSpacing: -1 * s }}>{v.title}</div>
              {v.line && <div style={{ display: "flex", fontSize: 27 * s, color: "#475569" }}>{v.line}</div>}
            </div>
            <Seal v={v} size={(story ? 290 : 210) * s} />
          </div>
          {story && v.chips.length > 0 && (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", width: "100%", marginTop: 24 }}>
              {v.chips.map((c) => (
                <div key={c} style={{ display: "flex", padding: "9px 20px", borderRadius: 999, background: "#eef2ff", color: "#3730a3", fontSize: 24, fontWeight: 600 }}>
                  {c}
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", width: "100%", marginTop: 26 * s }}>{stats(s)}</div>
          <div style={{ display: "flex", flex: 1 }} />
          {story && (
            <svg width={780} height={90} viewBox="0 0 780 90">
              <path d="M0 45 L160 45 l12 -8 l10 8 l8 0 l6 6 l10 -44 l10 60 l7 -20 l12 0 l14 -8 l14 8 L520 45 l12 -8 l10 8 l8 0 l6 6 l10 -44 l10 60 l7 -20 l12 0 l14 -8 l14 8 L780 45" fill="none" stroke={accent} strokeOpacity="0.55" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
          )}
          <div style={{ display: "flex", width: "100%", alignItems: "flex-end", justifyContent: "space-between", marginTop: 20 * s }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 * s }}>
              <Barcode text={`${v.serial}${v.name}`} width={360 * s} height={70 * s} />
              <div style={{ display: "flex", fontSize: 20 * s, letterSpacing: 6 * s, color: "#64748b", fontWeight: 600 }}>{v.serial}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 * s }}>
              <div style={{ display: "flex", fontSize: 28 * s, fontWeight: 700, color: ink }}>{v.cta}</div>
              <div style={{ display: "flex", fontSize: 24 * s, color: "#2563eb" }}>{site}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
