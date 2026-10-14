import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createProfile, type User } from "@/server/auth";
import { answer, examStats, nextSet } from "@/server/exam-practice";
import { db } from "@/server/db";
import { examsFor } from "@/lib/exams";

process.env.RAMAI_DB_PATH = ":memory:";

const mcq = (i: number) => ({ stem: `Question ${i}: a 30-year-old man presents with a classic finding. What is the drug of choice?`, options: ["Alpha", "Bravo", "Charlie", "Delta"], answer: 0, explanation: `Alpha is right for question ${i}.`, topic: `Topic ${i}`, difficulty: "medium" });

/** The question writer and the examiner, stood in for: the examiner drops question 3 and re-keys question 1. */
function stubModel() {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: { body: string }) => {
      const body = JSON.parse(init.body) as { messages: { content: string }[] };
      const examiner = body.messages[0]!.content.includes("senior examiner");
      calls.push(examiner ? "examine" : "write");
      const content = examiner ? { fixes: [{ index: 3, drop: true, why: "two right answers" }, { index: 1, answer: 2, why: "key was wrong" }] } : { pearls: [], mcqs: Array.from({ length: 10 }, (_, i) => mcq(i)) };
      return Response.json({ choices: [{ message: { content: JSON.stringify(content) } }] });
    }),
  );
  return calls;
}

let priya: User;
let ravi: User;
beforeAll(async () => {
  priya = await createProfile({ email: "priya@example.com", username: "priya", name: "Priya N" });
  ravi = await createProfile({ email: "ravi@example.com", username: "ravi", name: "Ravi K" });
});
beforeEach(() => {
  process.env.OPENAI_API_KEY = "sk-test-" + "x".repeat(40);
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OPENAI_API_KEY;
});

describe("exam practice", () => {
  it("offers only the exams of the doctor's country", () => {
    expect(examsFor("IN").map((e) => e.id)).toEqual(["neet-pg", "ini-cet"]);
    expect(examsFor("US").map((e) => e.id)).toEqual(["usmle"]);
    expect(examsFor("UK").map((e) => e.id)).toEqual(["ukmla", "plab"]);
  });

  it("writes a set, has the examiner correct it, keeps the key on the server — and serves it to the next doctor at once", async () => {
    const calls = stubModel();
    const { set } = await nextSet(priya, "neet-pg", "Pharmacology");
    expect(calls).toEqual(["write", "examine"]);
    expect(set.questions).toHaveLength(9);
    expect(set.questions[0]).not.toHaveProperty("answer");
    expect(set.questions[0]).not.toHaveProperty("explanation");

    // Ravi gets the same set without a word written.
    const again = await nextSet(ravi, "neet-pg", "Pharmacology");
    expect(again.set.id).toBe(set.id);
    expect(calls).toHaveLength(2);

    // Answers are checked on the server; the first answer counts.
    const stem = set.questions[1]!.stem;
    const index = set.questions.findIndex((q) => q.stem === stem);
    const stored = JSON.parse((await db.get<{ data: string }>("SELECT data FROM exam_sets WHERE id = ?", set.id))!.data) as { answer: number; options: string[] }[];
    const key = stored[index]!.answer;
    expect(stored[index]!.options[key]).toBe("Charlie");
    const right = await answer(priya, set.id, index, key);
    expect(right).toMatchObject({ correct: true, answer: key });
    const wrong = await answer(priya, set.id, 0, (stored[0]!.answer + 1) % 4);
    expect(wrong.correct).toBe(false);
    await answer(priya, set.id, 0, stored[0]!.answer);
    expect(await examStats(priya.id, "neet-pg")).toMatchObject({ answered: 2, correct: 1, subjects: [{ subject: "Pharmacology", answered: 2, correct: 1 }] });

    // Priya has started that set: her next one is new.
    const next = await nextSet(priya, "neet-pg", "Pharmacology");
    expect(next.set.id).not.toBe(set.id);
  });

  it("says so when the question writer isn't switched on", async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(nextSet(priya, "usmle", "Surgery")).rejects.toMatchObject({ code: "UNAVAILABLE" });
  });
});
