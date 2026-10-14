/**
 * Exam practice — sets of single-best-answer questions for NEET PG, INI-CET, USMLE, UKMLA and PLAB.
 *
 * A set is written by the model in the exam's own style, checked question by question by a second
 * pass playing the examiner (wrong keys corrected, unsalvageable questions dropped), then kept: the
 * next doctor practising the same exam and subject gets it at once. Each doctor is served sets they
 * haven't answered yet. The key and explanation stay on the server until the doctor has chosen.
 * Scores are their own — they don't touch XP, rank or the case leaderboards.
 */
import "server-only";

import { randomUUID } from "node:crypto";

import { chatJSON, openAIConfig, type ChatMessage } from "@/engine/providers/openai";
import { applyExaminerReview, GUIDELINES } from "@/engine/providers/openai-review";
import { ExamReviewSchema, ExamSetSchema } from "@/engine/providers/openai-schema";
import type { Mcq } from "@/engine/types";
import { EXAMS, MIXED, SET_SIZE, type ExamId, type ExamSet, type ExamStats, type ExamStyle } from "@/lib/exams";

import type { User } from "./auth";
import { db } from "./db";

export class ExamError extends Error {
  constructor(
    public readonly code: "UNAVAILABLE" | "NOT_FOUND" | "BAD_REQUEST",
    message: string,
  ) {
    super(message);
  }
}

export const examWritingAvailable = () => !!openAIConfig().key;

function writerPrompt(exam: ExamId, subject: string, style: ExamStyle, avoid: string[]): ChatMessage[] {
  const e = EXAMS[exam];
  const scope = subject === MIXED ? `a mix across ${e.subjects.join(", ")} — no more than two from any one subject` : `${subject}`;
  const year = new Date().getFullYear();
  const pyq =
    style === "pyq"
      ? `\nPREVIOUS-YEAR PATTERN: choose the topics and question patterns that were actually asked in ${e.label} papers from ${year - 7} to ${year - 1} (as known from candidates' recalls) — the classic, repeatedly asked facts and the way they are framed. Write each question afresh in that pattern; never reproduce a paper's or a coaching book's wording, and never claim a question is the actual one. Tag each with "pattern": "${e.label} <year> pattern" for the year whose pattern it follows.`
      : "";
  return [
    { role: "system", content: `You are a senior clinician and an experienced item writer for ${e.label} (${e.board}). Every fact you write is accurate and current — ${GUIDELINES[e.country]}. Output JSON only.` },
    {
      role: "user",
      content: `Write ${SET_SIZE} practice questions for ${e.label}: ${scope}.
Style: ${e.style}.
Cover different high-yield topics — no two questions on the same fact.${pyq} A spread of difficulty: about a third easy, half medium, the rest hard.${avoid.length ? `\nTopics already in recent sets — choose others: ${avoid.slice(0, 40).join("; ")}.` : ""}
Exactly one best answer each; plausible, homogeneous distractors; no "all of the above" or "none of the above". In explanations, refer to options by their content, never by letter or position.
Each question: {"stem","options":[${e.options} options],"answer": the 0-based index of the best answer,"explanation":"why it's right, and briefly why each other option isn't","topic":"a short tag, e.g. 'Brachial plexus — Erb palsy'","difficulty":"easy"|"medium"|"hard"${style === "pyq" ? ',"pattern"' : ""}}
Return {"pearls":[],"mcqs":[…]}`,
    },
  ];
}

function examinerPrompt(exam: ExamId, mcqs: Mcq[]): ChatMessage[] {
  const e = EXAMS[exam];
  return [
    { role: "system", content: `You are a senior examiner for ${e.label} (${e.board}). You check every question before a candidate sees it, against ${GUIDELINES[e.country]}. Output JSON only.` },
    {
      role: "user",
      content: `QUESTIONS: ${JSON.stringify(mcqs.map((q, index) => ({ index, ...q })))}

For each question: is there exactly one best answer, and is the key right per current guidelines and standard textbooks? Is the explanation correct? Is the stem unambiguous, with homogeneous, plausible options, in ${e.label} style?
Return {"fixes":[{"index","answer"?: corrected 0-based key,"stem"?,"options"?: the whole corrected list,"explanation"?,"drop"?: true if it can't be saved,"why":"one line"}]} — {"fixes":[]} if all is right.`,
    },
  ];
}

/** The best answer in a random place — models favour the second option. Explanations name options by content. */
function shuffle(q: Mcq): Mcq {
  const order = q.options.map((_, i) => i).sort(() => Math.random() - 0.5);
  return { ...q, options: order.map((i) => q.options[i]!), answer: order.indexOf(q.answer) };
}

/** Writes a set, has it examined, and keeps it for everyone — within a minute (the writer 40 s, the examiner 15 s; an unexamined draft is kept if the examiner runs out of time). */
export async function writeSet(exam: ExamId, subject: string, style: ExamStyle = "pyq"): Promise<{ id: string; mcqs: Mcq[] }> {
  if (!examWritingAvailable()) throw new ExamError("UNAVAILABLE", "Exam practice needs the AI question writer, which isn't switched on here.");
  const recent = await db.all<{ data: string }>("SELECT data FROM exam_sets WHERE exam = ? AND subject = ? AND style = ? ORDER BY created_at DESC LIMIT 4", exam, subject, style);
  const avoid = recent.flatMap((r) => (JSON.parse(r.data) as Mcq[]).map((q) => q.topic));
  const parsed = ExamSetSchema.safeParse(await chatJSON(writerPrompt(exam, subject, style, avoid), 7000, true, 40_000));
  if (!parsed.success || parsed.data.mcqs.length < 5) throw new ExamError("UNAVAILABLE", "The questions couldn't be written just now. Please try again.");
  const draft = { pearls: [] as string[], mcqs: parsed.data.mcqs };
  const reviewed = await chatJSON(examinerPrompt(exam, draft.mcqs as Mcq[]), 3600, true, 15_000)
    .then((raw) => applyExaminerReview(draft, raw, ExamReviewSchema))
    .catch(() => ({ part: draft, fixes: [] as string[] }));
  if (reviewed.fixes.length) console.info(`[ramai] exam examiner (${exam}/${subject}): ${reviewed.fixes.join(" | ").slice(0, 600)}`);
  const mcqs = (reviewed.part.mcqs as Mcq[]).slice(0, SET_SIZE).map(shuffle);
  if (mcqs.length < 5) throw new ExamError("UNAVAILABLE", "The questions couldn't be written just now. Please try again.");
  const id = randomUUID();
  await db.run("INSERT INTO exam_sets (id, exam, subject, style, data, model, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", id, exam, subject, style, JSON.stringify(mcqs), openAIConfig().model, Date.now());
  return { id, mcqs };
}

const forPlayer = (id: string, exam: ExamId, subject: string, style: ExamStyle, mcqs: Mcq[]): ExamSet => ({
  id,
  exam,
  subject,
  style,
  questions: mcqs.map((q) => ({ stem: q.stem, options: q.options, topic: q.topic, difficulty: q.difficulty, ...(style === "pyq" && q.pattern ? { pattern: q.pattern } : {}) })),
});

/** A set they haven't answered — kept from before if there is one, else written now. `ready` says whether another is waiting. */
export async function nextSet(user: User, exam: ExamId, subject: string, style: ExamStyle = "pyq"): Promise<{ set: ExamSet; another: boolean }> {
  const fresh = await db.all<{ id: string; data: string }>(
    "SELECT id, data FROM exam_sets s WHERE exam = ? AND subject = ? AND style = ? AND NOT EXISTS (SELECT 1 FROM exam_answers a WHERE a.user_id = ? AND a.set_id = s.id) ORDER BY created_at ASC LIMIT 2",
    exam, subject, style, user.id,
  );
  const first = fresh[0];
  if (first) return { set: forPlayer(first.id, exam, subject, style, JSON.parse(first.data) as Mcq[]), another: fresh.length > 1 };
  const written = await writeSet(exam, subject, style);
  return { set: forPlayer(written.id, exam, subject, style, written.mcqs), another: false };
}

/** Checks an answer, records the first one, and returns the key and explanation. */
export async function answer(user: User, setId: string, q: number, choice: number): Promise<{ correct: boolean; answer: number; explanation: string }> {
  const row = await db.get<{ exam: string; subject: string; data: string }>("SELECT exam, subject, data FROM exam_sets WHERE id = ?", setId);
  if (!row) throw new ExamError("NOT_FOUND", "That question set isn't available.");
  const mcq = (JSON.parse(row.data) as Mcq[])[q];
  if (!mcq || choice < 0 || choice >= mcq.options.length) throw new ExamError("BAD_REQUEST", "That answer isn't one of the options.");
  const correct = choice === mcq.answer;
  await db.run(
    "INSERT OR IGNORE INTO exam_answers (user_id, set_id, q, exam, subject, topic, correct, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    user.id, setId, q, row.exam, row.subject, mcq.topic, correct ? 1 : 0, Date.now(),
  );
  return { correct, answer: mcq.answer, explanation: mcq.explanation };
}

/** How they're doing on one exam: overall, and by subject (weakest first). */
export async function examStats(userId: string, exam: ExamId): Promise<ExamStats> {
  const rows = await db.all<{ subject: string; answered: number; correct: number }>(
    "SELECT subject, COUNT(*) AS answered, SUM(correct) AS correct FROM exam_answers WHERE user_id = ? AND exam = ? GROUP BY subject",
    userId, exam,
  );
  const subjects = rows.map((r) => ({ subject: r.subject, answered: Number(r.answered), correct: Number(r.correct) })).sort((a, b) => a.correct / a.answered - b.correct / b.answered);
  return { answered: subjects.reduce((s, r) => s + r.answered, 0), correct: subjects.reduce((s, r) => s + r.correct, 0), subjects };
}
