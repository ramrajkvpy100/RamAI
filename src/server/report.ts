/**
 * The personal report: the AI reads a doctor's recorded cases — the marks per
 * skill, why marks were lost, what was missed and done well, their practice
 * answers — and writes what they keep getting wrong, what they're good at,
 * where they're weak, how they're progressing and what to do next. Kept, and
 * rewritten only when there are new cases.
 */
import "server-only";

import { z } from "zod";

import { ALL_SPECIALTIES } from "@/engine/progression";
import { SKILL_LABELS } from "@/engine/scoring";
import { CASE_TRACKS, type ScoreCategory } from "@/engine/types";
import { REPORT_MIN_CASES, type PersonalReport, type ProgressDetail } from "@/lib/progress-types";

import type { User } from "./auth";
import { db } from "./db";
import { parseDetail, progressDetail } from "./progress-detail";

const EXAM = { IN: "NEET PG and INI-CET", US: "USMLE Step 2 CK", UK: "UKMLA and PLAB" } as const;

const text = (max: number) => z.preprocess((v) => (typeof v === "number" ? String(v) : v), z.string()).transform((t) => t.trim().slice(0, max));
const list = <T extends z.ZodType>(item: T, max: number) =>
  z.unknown().optional().transform((v) => (Array.isArray(v) ? v : []).map((x) => item.safeParse(x)).filter((r) => r.success).map((r) => r.data as z.output<T>).slice(0, max));

const ReportSchema = z.object({
  headline: text(200),
  strengths: list(text(260), 4),
  repeatedMistakes: list(z.object({ pattern: text(200), evidence: text(200), fix: text(260) }), 4),
  weakAreas: list(z.object({ area: text(80), why: text(260) }), 4),
  progress: text(600),
  recommendations: list(
    z.object({
      action: text(200),
      why: text(260),
      specialty: z.enum(ALL_SPECIALTIES as [string, ...string[]]).optional().catch(undefined),
      track: z.enum(CASE_TRACKS as unknown as [string, ...string[]]).optional().catch(undefined),
    }),
    4,
  ),
});

export async function savedReport(userId: string): Promise<PersonalReport | null> {
  const row = await db.get<{ data: string }>("SELECT data FROM progress_reports WHERE user_id = ?", userId);
  if (!row) return null;
  try {
    return JSON.parse(row.data) as PersonalReport;
  } catch {
    return null;
  }
}

/** What the AI reads: the numbers, then the last dozen cases in a line or two each — no names, nothing else. */
async function evidence(userId: string, detail: ProgressDetail) {
  const rows = await db.all<{ specialty: string; track: string; level: string; diagnosis: string; verdict: string | null; score: number; created_at: number; detail: string | null }>(
    "SELECT specialty, track, level, diagnosis, verdict, score, created_at, detail FROM results WHERE user_id = ? ORDER BY created_at DESC LIMIT 12",
    userId,
  );
  const cases = rows.reverse().map((r, i) => {
    const d = parseDetail(r.detail);
    return {
      n: i + 1,
      case: `${r.specialty} · ${r.track} · ${r.level} — ${r.diagnosis}`,
      score: r.score,
      diagnosed: r.verdict ?? "not stated",
      ...(d
        ? {
            weakestSkills: d.l.filter(([, e, m]) => m > 0 && e / m < 0.6).map(([c]) => SKILL_LABELS[c as ScoreCategory] ?? c),
            lostMarks: d.lost.slice(0, 5).map(([c, why]) => `${SKILL_LABELS[c as ScoreCategory] ?? c}: ${why}`),
            missed: d.missed.slice(0, 4).map(([what, sev]) => `${what} (${sev})`),
            didWell: d.well.slice(0, 3),
          }
        : {}),
    };
  });
  return {
    totals: { cases: detail.cases, averageLast10: detail.average.recent, averagePrevious10: detail.average.earlier, rank: detail.rank, streakDays: detail.streak },
    skills: detail.skills.map((s) => `${s.label} ${s.percent}% (${s.cases} cases)`),
    specialties: detail.specialties.slice(0, 8).map((s) => `${s.name}: ${s.cases} cases, average ${s.average}`),
    practiceQuestions: detail.mcq.answered ? { answered: detail.mcq.answered, correct: detail.mcq.correct, weakestTopics: detail.mcq.weakTopics.map((t) => `${t.topic} ${t.correct}/${t.answered}`) } : "none answered yet",
    recentCases: cases,
  };
}

/** Writes (or rewrites) the report. Null when there aren't enough cases yet or the AI can't be reached. */
export async function writeReport(user: User): Promise<PersonalReport | null> {
  const key = process.env.OPENAI_API_KEY;
  const detail = await progressDetail(user.id);
  if (!key || detail.cases < REPORT_MIN_CASES) return null;
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-6-luna";
  const data = await evidence(user.id, detail);
  try {
    const res = await fetch(`${(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        reasoning_effort: "low",
        max_completion_tokens: 2200,
        messages: [
          {
            role: "system",
            content: `You are a senior clinical tutor writing a personal progress report for a doctor who practises clinical cases on RamAI and prepares for ${EXAM[user.country]}. Use only the data given — never invent cases, numbers or habits. Be specific: name the pattern and the evidence ("in 4 of your last 8 cases…"). Honest and encouraging, plain words, no markdown. Output JSON only.`,
          },
          {
            role: "user",
            content: `THE DOCTOR'S RECORD:
${JSON.stringify(data)}

Return {"headline":"one line that sums up where they are","strengths":["2–4 things they reliably do well"],"repeatedMistakes":[{"pattern":"a mistake that recurs","evidence":"how often, from the data","fix":"exactly what to do differently"}] (up to 4 — only patterns seen more than once),"weakAreas":[{"area":"a skill, specialty or topic","why":"from the data"}] (up to 4),"progress":"two or three sentences on their trend","recommendations":[{"action":"a concrete next step — e.g. 'Play three emergency cases this week and state a diagnosis before treating'","why":"one line","specialty"?: one of ${ALL_SPECIALTIES.join(", ")},"track"?: "opd"|"emergency"|"phone"}] (3–4)}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    const json = (await res.json().catch(() => ({}))) as { choices?: { message?: { content?: string } }[] };
    const parsed = ReportSchema.safeParse(JSON.parse(json.choices?.[0]?.message?.content ?? "null"));
    if (!res.ok || !parsed.success) return null;
    const report: PersonalReport = { ...parsed.data, recommendations: parsed.data.recommendations as PersonalReport["recommendations"], writtenAt: Date.now(), cases: detail.cases, model };
    await db.run("INSERT INTO progress_reports (user_id, cases, data, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET cases = excluded.cases, data = excluded.data, created_at = excluded.created_at", user.id, detail.cases, JSON.stringify(report), report.writtenAt);
    return report;
  } catch (err) {
    console.error("[ramai] report unavailable:", err instanceof Error ? err.message : err);
    return null;
  }
}
