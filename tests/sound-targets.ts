/**
 * The audit's targets, one list per sound: what it is meant to be, what the meter read, and whether that is on target.
 * Used by tests/sounds-calibration.test.ts. Heart and vessel sounds are read at 75 a minute (an 800 ms cycle); breath
 * and bowel sounds at the rate the drill gives them.
 */
import type { SoundItem } from "@/lib/banks/sounds";

import { breathCue, endInspiration, level, mean, phaseShape, played, readBowel, readClick, readHeart, readLungs, readRumble, readVessel, respiratoryRatio, rubParts, spectrum, splitGap, vesselPhases } from "./sound-measure";

export interface Check { name: string; ok: boolean; got: string }
export interface Audit { id: string; label: string; intended: string; checks: Check[] }

const within = (name: string, v: number, lo: number, hi: number, unit = ""): Check => ({ name: `${name} ${lo}–${hi}${unit}`, ok: v >= lo && v <= hi, got: `${name} ${Number.isFinite(v) ? v : "none"}${unit}` });
const atLeast = (name: string, v: number, lo: number, unit = ""): Check => ({ name: `${name} ≥${lo}${unit}`, ok: v >= lo, got: `${name} ${Number.isFinite(v) ? v : "none"}${unit}` });
const atMost = (name: string, v: number, hi: number, unit = ""): Check => ({ name: `${name} ≤${hi}${unit}`, ok: v <= hi, got: `${name} ${Number.isFinite(v) ? v : "none"}${unit}` });
const r2 = (v: number) => Number(v.toFixed(2));
const rd = (v: number) => Math.round(v);
const peakSlice = (v: number[], from: number) => (v.slice(from).reduce((b, x, i, a) => (x > a[b]! ? i : b), 0) + from + 0.5) / v.length;

const INTENDED: Record<string, string> = {
  as: "Diamond ejection murmur, 200–600 Hz, peak mid-systole, clear of S1 and S2",
  mr: "Plateau S1-to-S2, 200–600 Hz",
  ar: "Early decrescendo straight after S2, 300–600 Hz, soft",
  ms: "Mid-diastolic rumble 60–180 Hz, presystolic crescendo, loud S1",
  mvp: "Mid-systolic click, then late crescendo to S2, 200–600 Hz",
  vsd: "Plateau S1-to-S2, louder and rougher than MR",
  pda: "Continuous, peaking at S2, no gap through S2",
  os: "Snap 60–120 ms after S2, then the MS rumble",
  ps: "Early ejection click, diamond murmur, wide varying S2",
  tr: "Plateau S1-to-S2, louder on inspiration (Carvallo)",
  hocm: "Late-peaking ejection murmur, with S4",
  still: "Low musical tone, 100–250 Hz, early-mid systole (deliberately below the 200–600 Hz of pathological murmurs)",
  "normal-heart": "S1 70–150 ms 50–150 Hz; S2 60–120 ms 50–200 Hz, higher pitched, single; silent gaps",
  s3: "50–90 Hz, 120–160 ms after S2",
  s4: "50–80 Hz, 80–100 ms before S1",
  rub: "Three scratches: systole, early diastole, late diastole",
  af: "Irregular RR, varying S1 loudness, no atrial sounds",
  muffled: "Same timing, much fainter",
  "split-s2": "Fixed split about 50 ms, in and out",
  "split-physiologic": "A2–P2 40–60 ms in, <15 ms out",
  "split-wide": "Always split, wider in",
  "split-paradoxical": "A2–P2 40–60 ms out, narrow in, P2 first",
  mechanical: "Metallic click above 1 kHz at S2",
  vesicular: "Inspiration melting into short soft expiration, no gap",
  fine: "About 650 Hz, short bursts, late inspiration",
  coarse: "About 250 Hz, longer bursts, early inspiration",
  wheeze: "Several pitches 400–800 Hz through expiration",
  "wheeze-mono": "One fixed pitch, both phases",
  rhonchi: "Low-pitched snoring, about 120–175 Hz with harmonics",
  stridor: "Inspiratory, above 500 Hz",
  "stridor-biphasic": "Both phases, above 500 Hz",
  bronchial: "Loud, higher pitched, pause between inspiration and expiration",
  "bronchial-crackles": "Bronchial pattern with coarse crackles",
  "pleural-rub": "Creaks at end inspiration and start expiration",
  diminished: "Same pattern, much fainter",
  absent: "Near silence",
  "silent-chest": "Fast, faint, barely a wheeze",
  "bowel-normal": "Irregular gurgles, 5–30 a minute",
  "bowel-hyper": "Frequent loud gurgles",
  "bowel-sluggish": "Occasional faint gurgles",
  "bowel-absent": "True silence: room noise only",
  "bowel-tinkling": "High, metallic, frequent",
  succussion: "Low slopping bursts",
  "hepatic-rub": "Creaks with breathing over sparse gurgles",
  "aortic-bruit": "Systolic, low pitched",
  "renal-bruit": "Systolic with a short diastolic tail, higher pitched",
  "carotid-bruit": "Systolic only, higher pitched",
  "av-fistula": "Continuous low roar through the whole beat",
  "venous-hum": "Continuous low hum, swelling in diastole",
  "vessel-normal": "Soft pulse only",
};

function heartChecks(id: string, s: Extract<SoundItem["sound"], { kind: "heart" }>): Check[] {
  const a = { ...s, rate: 75 };
  const r = readHeart(a);
  const c: Check[] = [];
  if (id !== "af") c.push(within("systole", r.systoleMs, 270, 330, " ms"), within("diastole", r.diastoleMs, 470, 530, " ms"));
  if (id !== "still") c.push(within("S1", r.s1Ms, 70, 150, " ms"));
  // Still's tone starts 50 ms into S1, so S1 can't be read apart from it.
  if (id !== "still") c.push(within("S1 pitch", r.s1Hz, 50, 150, " Hz"));
  if (!s.splitS2 && !s.mechanical && id !== "pda") c.push(within("S2", r.s2Ms, 60, 120, " ms"));
  if (!s.mechanical) c.push(within("S2 pitch", r.s2Hz, 50, 200, " Hz"));
  if (!s.mechanical && id !== "still") c.push(atLeast("S2 pitch over S1", r.s2Hz - r.s1Hz, 10, " Hz"));
  const sys = () => phaseShape(a, "systole", 200, 600);
  const dia = (lo: number, hi: number) => phaseShape(a, "diastole", lo, hi);
  const gap = () => splitGap(a);
  if (id === "as" || id === "ps") c.push(atLeast("in 200–600 Hz", r.sysFrac, 0.75), within("peak at", r2(peakSlice(sys(), 6)), 0.4, 0.65), atMost("flatness", r.sysFlat, 0.5));
  // Loud enough to hear beside S1 (the band's level against S1's, averaged through the murmur).
  if (["as", "mr", "vsd", "tr", "ps", "hocm", "mvp"].includes(id)) c.push(atLeast("murmur vs S1", r.sysRatio, 0.08));
  if (id === "ar") c.push(atLeast("murmur vs S1", r.diaRatio, 0.08));
  if (["mr", "vsd", "tr"].includes(id)) c.push(atLeast("in 200–600 Hz", r.sysFrac, 0.7), atLeast("flatness", r.sysFlat, 0.65));
  if (id === "vsd") c.push(atLeast("loudness vs MR", r2(r.sysRatio / readHeart({ ...a, murmur: { phase: "systolic", shape: "plateau" } }).sysRatio), 1.15));
  if (id === "tr") c.push(atLeast("in/out loudness", respiratoryRatio(a), 1.8));
  if (id === "mr") c.push(within("in/out loudness", respiratoryRatio(a), 0.75, 1.3));
  if (id === "hocm") c.push(atLeast("in 200–600 Hz", r.sysFrac, 0.75), within("peak at", r2(peakSlice(sys(), 6)), 0.62, 0.85), within("S4 before S1", r.s4BeforeS1Ms, 80, 100, " ms"));
  if (id === "still") c.push(within("systolic centroid", r.sysHz, 90, 250, " Hz"));
  if (id === "mvp") {
    const k = readClick(a, "s1", 0.1, 0.2);
    const v = sys();
    c.push(within("click at", k.fractionOfSystole, 0.45, 0.65), atLeast("click pitch", k.peakHz, 180, " Hz"), atLeast("in 200–600 Hz", r.sysFrac, 0.75), atMost("before click", r2(mean(v.slice(5, 10))), 0.15), atLeast("crescendo", r2(mean(v.slice(16, 19)) / Math.max(mean(v.slice(13, 16)), 1e-6)), 1.15));
  }
  if (id === "ps") { const k = readClick(a, "s1", 0.04, 0.1); const g = gap(); c.push(within("click after S1", k.afterMs, 50, 90, " ms"), within("split in", rd(g.inspMs), 60, 90, " ms"), within("split out", rd(g.expMs), 25, 50, " ms")); }
  if (id === "ar") { const v = dia(300, 600); c.push(atLeast("in 300–600 Hz", r.diaFrac300, 0.65), atMost("peak at", r2(peakSlice(v, 0)), 0.25), atMost("end of diastole", r2(mean(v.slice(16))), 0.1)); }
  if (id === "ms" || id === "os") {
    const m = readRumble(a);
    const af = readRumble({ ...a, irregular: true });
    c.push(atLeast("rumble in 50–200 Hz", m.frac, 0.8), atLeast("presystolic/mid", r2(m.late / m.mid), 1.15), atMost("lull/mid", r2(m.lull / m.mid), 0.5), atMost("presystolic in AF/mid", r2(af.late / af.mid), 0.15), atLeast("S1 vs normal", r2(m.s1 / readRumble({ kind: "heart", rate: 75 }).s1), 1.03));
  }
  if (id === "os") { const k = readClick(a, "s2", 0.05, 0.12); c.push(within("snap after S2", k.afterMs, 60, 120, " ms"), atLeast("snap pitch", k.peakHz, 180, " Hz")); }
  if (id === "pda") { const v = sys(); const d = dia(200, 600); c.push(atLeast("end of systole", r2(mean(v.slice(18))), 0.8), atLeast("start of diastole", r2(mean(d.slice(0, 2))), 0.8), atLeast("mid-diastole", r2(mean(d.slice(8, 11))), 0.3), atMost("just after S1", r2(mean(v.slice(3, 5))), 0.35)); }
  if (id === "normal-heart") { const g = gap(); c.push(atMost("S2 parts apart", rd(Math.max(g.inspMs, g.expMs)), 15, " ms"), atMost("noise in systole", r2(r.sysRatio), 0.02)); }
  if (id === "s3") c.push(within("S3 after S2", r.s3AfterS2Ms, 120, 160, " ms"), within("S3 pitch", r.s3Hz, 50, 90, " Hz"));
  if (id === "s4") c.push(within("S4 before S1", r.s4BeforeS1Ms, 80, 100, " ms"), within("S4 pitch", r.s4Hz, 50, 80, " Hz"));
  if (id === "rub") {
    const p = rubParts(a);
    const top = Math.max(p.sys, p.early, p.late);
    c.push(atLeast("systolic part", r2(p.sys / top), 0.5), atLeast("early-diastolic part", r2(p.early / top), 0.5), atLeast("late-diastolic part", r2(p.late / top), 0.5), atLeast("loudness", r2(top), 0.03));
  }
  if (id === "af") c.push(atLeast("RR spread", r.rrSpread, 0.3), atLeast("S1 spread", r.s1Spread, 0.2));
  if (id === "muffled") c.push(atMost("loudness vs normal", r2(level(played(a)).rms / level(played({ kind: "heart", rate: 75 })).rms), 0.4));
  if (id === "mechanical") c.push(atLeast("S2 pitch", r.s2Hz, 1000, " Hz"));
  if (s.splitS2) {
    const g = gap();
    const i = rd(g.inspMs), e = rd(g.expMs);
    const b = breathCue(played(a));
    c.push(atLeast("breath audible, in/out", r2(b.insp / b.exp), 1.5));
    if (s.splitS2 === "fixed") c.push(within("split in", i, 40, 60, " ms"), within("split out", e, 40, 60, " ms"), atMost("in−out", Math.abs(i - e), 8, " ms"));
    if (s.splitS2 === "physiologic") c.push(within("split in", i, 40, 60, " ms"), atMost("split out", e, 18, " ms"));
    if (s.splitS2 === "paradoxical") c.push(within("split out", e, 40, 60, " ms"), atMost("split in", i, 18, " ms"));
    if (id === "split-wide") c.push(within("split in", i, 60, 90, " ms"), within("split out", e, 25, 50, " ms"));
  }
  return c;
}

function lungChecks(id: string, s: Extract<SoundItem["sound"], { kind: "lungs" }>): Check[] {
  const r = readLungs(s);
  const ves = () => readLungs({ kind: "lungs", rate: s.rate, breath: "vesicular" });
  if (id === "vesicular") return [atMost("pause", r.pauseMs, 80, " ms"), atLeast("insp/exp loudness", r2(r.inspRms / r.expRms), 2)];
  if (id === "fine") return [within("pitch", r.crackles.peakHz, 550, 750, " Hz"), atLeast("per breath", r.crackles.perBreath, 3), within("position in inspiration", r.crackles.atFraction, 0.6, 1), atLeast("inside inspiration", r.crackles.inInsp, 0.85), atMost("burst", r.crackles.widthMs, 16, " ms")];
  if (id === "coarse") return [within("pitch", r.crackles.peakHz, 200, 320, " Hz"), atLeast("per breath", r.crackles.perBreath, 2), within("position in inspiration", r.crackles.atFraction, 0, 0.5), atLeast("burst", r.crackles.widthMs, 12, " ms")];
  if (id === "wheeze") return [atLeast("pitches in 400–800 Hz", r.expPeaks.filter((f) => f >= 400 && f <= 800).length, 3), atLeast("in 400–800 Hz", r.expFrac400_800, 0.8), atLeast("exp/insp loudness", r2(r.expRms / r.inspRms), 1.1)];
  if (id === "wheeze-mono") return [within("pitches", r.expPeaks.length, 1, 1), atMost("insp−exp pitch", Math.abs((r.inspPeaks[0] ?? 0) - (r.expPeaks[0] ?? 999)), 15, " Hz"), atLeast("in 400–800 Hz", r.expFrac400_800, 0.8)];
  if (id === "rhonchi") return [atLeast("in 90–220 Hz", r2(spectrum(played(s), [[3, 3.18], [5, 5.18], [7, 7.18], [9, 9.18]]).fraction(90, 220)), 0.12), atMost("expiratory centroid", r.expCentroid, 700, " Hz")];
  if (id === "stridor") return [atLeast("above 500 Hz in", r.inspFracAbove500, 0.75), atLeast("in/out loudness", r2(r.inspRms / r.expRms), 3)];
  if (id === "stridor-biphasic") return [atLeast("above 500 Hz in", r.inspFracAbove500, 0.75), atLeast("out/in loudness", r2(r.expRms / r.inspRms), 0.45)];
  if (id === "bronchial") return [atLeast("pause", r.pauseMs, 120, " ms"), atLeast("loudness vs vesicular", r2(r.rms / ves().rms), 1.5), atLeast("exp/insp loudness", r2(r.expRms / r.inspRms), 0.8)];
  if (id === "bronchial-crackles") return [atLeast("pause", r.pauseMs, 120, " ms"), atLeast("crackles per breath", r.crackles.perBreath, 1)];
  if (id === "pleural-rub") return [atLeast("end-inspiration vs vesicular", r2(endInspiration(s) / endInspiration({ kind: "lungs", rate: s.rate, breath: "vesicular" })), 1.5)];
  if (id === "diminished") return [atMost("loudness vs vesicular", r2(r.rms / ves().rms), 0.4)];
  if (id === "absent") return [atMost("loudness", r.rms, 0.02)];
  if (id === "silent-chest") return [atMost("loudness vs vesicular", r2(r.rms / ves().rms), 0.25), atLeast("wheeze peak above 800 Hz", r.expPeaks.filter((f) => f > 800).length, 1)];
  return [];
}

function bowelChecks(id: string, s: Extract<SoundItem["sound"], { kind: "bowel" }>): Check[] {
  const r = readBowel(s);
  if (id === "bowel-normal") return [within("events/min", r.eventsPerMin, 5, 30)];
  if (id === "bowel-hyper") return [atLeast("events/min", r.eventsPerMin, 25), atLeast("active time", r.activeFrac, 0.15)];
  if (id === "bowel-sluggish") return [atMost("events/min", r.eventsPerMin, 8), atMost("peak", r.peak, 0.5)];
  if (id === "bowel-absent") return [within("events/min", r.eventsPerMin, 0, 0), atMost("peak", r.peak, 0.06), atMost("centroid", r.centroid, 250, " Hz")];
  if (id === "bowel-tinkling") return [atLeast("centroid", r.centroid, 1200, " Hz"), atLeast("events/min", r.eventsPerMin, 25)];
  if (id === "succussion") return [atMost("centroid", r.centroid, 500, " Hz"), atLeast("peak", r.peak, 0.6)];
  if (id === "hepatic-rub") return [atLeast("events/min", r.eventsPerMin, 15), within("centroid", r.centroid, 300, 800, " Hz")];
  return [];
}

function vesselChecks(id: string, s: Extract<SoundItem["sound"], { kind: "vessel" }>): Check[] {
  const a = { ...s, rate: 75 };
  const r = readVessel(a);
  const p = vesselPhases(a, 90, 900);
  const ratio = r2(p.dia / Math.max(p.sys, 1e-6));
  if (id === "aortic-bruit") return [within("centroid", r.centroid, 120, 300, " Hz"), atMost("diastole/systole", ratio, 0.1)];
  if (id === "carotid-bruit") return [within("centroid", r.centroid, 300, 550, " Hz"), atMost("diastole/systole", ratio, 0.1)];
  if (id === "renal-bruit") return [within("centroid", r.centroid, 300, 600, " Hz"), within("diastole/systole", ratio, 0.03, 0.35)];
  if (id === "av-fistula") return [within("centroid", r.centroid, 120, 350, " Hz"), atLeast("diastole/systole", ratio, 0.4)];
  if (id === "venous-hum") { const h = vesselPhases(a, 60, 300); return [atMost("centroid", r.centroid, 200, " Hz"), atLeast("diastole/systole", r2(h.dia / h.sys), 1.15)]; }
  if (id === "vessel-normal") return [atMost("level", r2(p.sys), 0.02)];
  return [];
}

export function audit(item: SoundItem): Audit {
  const s = item.sound;
  const checks = s.kind === "heart" ? heartChecks(item.id, s) : s.kind === "lungs" ? lungChecks(item.id, s) : s.kind === "bowel" ? bowelChecks(item.id, s) : vesselChecks(item.id, s);
  // After loud(): never over full scale, and hardly any of the loud part flattened against the top of its curve.
  const lv = level(played(s.kind === "heart" || s.kind === "vessel" ? { ...s, rate: 75 } : s));
  checks.push(atMost("peak", r2(lv.peak), 0.98), atMost("flat-topped", Number(lv.satOfLoud.toFixed(3)), 0.02));
  return { id: item.id, label: item.label, intended: INTENDED[item.id] ?? "", checks };
}
