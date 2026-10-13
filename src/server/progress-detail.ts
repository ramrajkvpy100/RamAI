/** The Progress page's numbers, from a doctor's recorded results and practice answers. */
import "server-only";

import { istDayKey, rankFor } from "@/engine/progression";
import { SKILL_LABELS } from "@/engine/scoring";
import type { ScoreCategory } from "@/engine/types";
import type { ProgressDetail } from "@/lib/progress-types";

import { db } from "./db";
import { progressFor } from "./progress";
import type { CaseDetail } from "./results";

const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

export const parseDetail = (raw: string | null): CaseDetail | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CaseDetail;
  } catch {
    return null;
  }
};

export async function progressDetail(userId: string): Promise<ProgressDetail> {
  const [p, rows, answers] = await Promise.all([
    progressFor(userId),
    db.all<{ score: number; specialty: string; created_at: number; detail: string | null }>("SELECT score, specialty, created_at, detail FROM results WHERE user_id = ? ORDER BY created_at ASC", userId),
    db.all<{ topic: string; correct: number }>("SELECT topic, correct FROM mcq_answers WHERE user_id = ?", userId),
  ]);
  const scores = rows.map((r) => r.score);

  // Skills: each category's share of its marks, over the last twenty cases that recorded them.
  const recent = rows.filter((r) => r.detail).slice(-20).map((r) => parseDetail(r.detail)).filter((d): d is CaseDetail => !!d);
  const skills = (Object.keys(SKILL_LABELS) as ScoreCategory[])
    .map((id) => {
      const lines = recent.flatMap((d) => d.l.filter(([c, , max]) => c === id && max > 0));
      return { id, label: SKILL_LABELS[id], percent: mean(lines.map(([, earned, max]) => (earned / max) * 100)) ?? 0, cases: lines.length };
    })
    .filter((s) => s.cases > 0)
    .sort((a, b) => a.percent - b.percent);

  const bySpecialty = new Map<string, number[]>();
  for (const r of rows) bySpecialty.set(r.specialty, [...(bySpecialty.get(r.specialty) ?? []), r.score]);

  const today = Date.parse(`${istDayKey(new Date())}T00:00:00Z`);
  const perDay = new Map<string, number>();
  for (const r of rows) {
    const day = istDayKey(new Date(r.created_at));
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  const activity = Array.from({ length: 84 }, (_, i) => {
    const day = new Date(today - (83 - i) * 86_400_000).toISOString().slice(0, 10);
    return { day, cases: perDay.get(day) ?? 0 };
  });

  const topics = new Map<string, { answered: number; correct: number }>();
  for (const a of answers) {
    const t = topics.get(a.topic) ?? { answered: 0, correct: 0 };
    t.answered += 1;
    t.correct += a.correct;
    topics.set(a.topic, t);
  }
  const rank = rankFor(p.percent);
  return {
    cases: rows.length,
    trend: rows.slice(-30).map((r) => ({ score: r.score, at: r.created_at, specialty: r.specialty })),
    average: { recent: scores.length >= 3 ? mean(scores.slice(-10)) : null, earlier: scores.length >= 13 ? mean(scores.slice(-20, -10)) : null },
    skills,
    specialties: [...bySpecialty].map(([name, s]) => ({ name, cases: s.length, average: mean(s.slice(-10)) ?? 0 })).sort((a, b) => b.cases - a.cases),
    activity,
    mcq: {
      answered: answers.length,
      correct: answers.reduce((n, a) => n + a.correct, 0),
      weakTopics: [...topics].map(([topic, t]) => ({ topic, ...t })).filter((t) => t.answered >= 2).sort((a, b) => a.correct / a.answered - b.correct / b.answered).slice(0, 5),
    },
    streak: p.streakDays,
    bestStreak: p.bestStreak,
    xp: p.xp,
    rank: rank.label,
    rankTier: rank.tier,
  };
}
