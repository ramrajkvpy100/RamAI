import { describe, expect, it } from "vitest";
import baseline from "./fixtures/skills-baseline.json";
import { ALGORITHM_COUNT, ALGORITHM_IDS, ANTIDOTE_COUNT, ANTIDOTE_IDS, algorithmQuestions, allQuizQuestions, antidoteQuestions } from "../src/lib/skills";

const all = allQuizQuestions();

describe("Know it quizzes: antidotes and emergency algorithms", () => {
  it("keeps every baseline question id", () => {
    const antidotes = new Set(ANTIDOTE_IDS().map((x) => x.id));
    const algorithms = new Set(ALGORITHM_IDS().map((x) => x.id));
    expect(baseline.antidotes.filter((id) => !antidotes.has(id))).toEqual([]);
    expect(baseline.algorithms.filter((id) => !algorithms.has(id))).toEqual([]);
  });

  it("has no duplicate ids and reaches the agreed totals", () => {
    const ids = all.map((x) => x.question.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ANTIDOTE_COUNT).toBeGreaterThanOrEqual(65);
    expect(ALGORITHM_COUNT).toBeGreaterThanOrEqual(75);
  });

  it("puts every question in a real category, each holding 8 to 35", () => {
    const counts = new Map<string, number>();
    for (const x of all) counts.set(`${x.kind}:${x.cat}`, (counts.get(`${x.kind}:${x.cat}`) ?? 0) + 1);
    expect([...counts.keys()].filter((k) => k.endsWith(":Other"))).toEqual([]);
    for (const [cat, n] of counts) {
      expect(n, cat).toBeGreaterThanOrEqual(8);
      expect(n, cat).toBeLessThanOrEqual(35);
    }
  });

  it("meets the category floors the user asked for", () => {
    const n = (kind: string, cat: string) => all.filter((x) => x.kind === kind && x.cat === cat).length;
    expect(n("antidote", "Bites, Stings & Envenomations")).toBeGreaterThanOrEqual(12);
    expect(n("antidote", "Anaesthesia, Perioperative & ICU Reversal")).toBeGreaterThanOrEqual(10);
    expect(n("antidote", "Heart & blood drugs")).toBeGreaterThanOrEqual(11);
    expect(n("antidote", "Diabetes & metabolic")).toBeGreaterThanOrEqual(10);
    expect(n("algorithm", "Children")).toBeGreaterThanOrEqual(10);
    expect(n("algorithm", "Women & babies")).toBeGreaterThanOrEqual(10);
    expect(n("algorithm", "Brain & nerves")).toBeGreaterThanOrEqual(8);
    expect(n("algorithm", "Shock, sepsis & bleeding")).toBeGreaterThanOrEqual(8);
    expect(n("algorithm", "Surgery & trauma")).toBeGreaterThanOrEqual(8);
  });

  it("gives every question 4 distinct options, a valid answer, a why-not per wrong option and a source", () => {
    for (const { question: q } of all) {
      expect(q.options, q.id).toHaveLength(4);
      expect(new Set(q.options).size, q.id).toBe(4);
      expect(q.options[q.answer], q.id).toBeTruthy();
      expect(q.explain.trim(), q.id).not.toBe("");
      expect(q.source.trim(), q.id).not.toBe("");
      q.options.forEach((_, i) => {
        if (i !== q.answer) expect(q.whyNot?.[i]?.trim(), `${q.id} option ${i}`).toBeTruthy();
      });
    }
  });

  it("doesn't let length give the answer away", () => {
    const strictlyLongest = all.filter(({ question: q }) => q.options.every((o, i) => i === q.answer || o.length < q.options[q.answer]!.length));
    // Chance is 25%. Far below it would be a tell too: "the longest option is never right".
    expect(strictlyLongest.length / all.length).toBeLessThanOrEqual(0.35);
    expect(strictlyLongest.length / all.length).toBeGreaterThanOrEqual(0.1);
    // No option is many times the length of another. A lone tell is what this catches.
    for (const { question: q } of all) {
      const lengths = q.options.map((o) => o.length);
      expect(Math.max(...lengths) / Math.min(...lengths), q.id).toBeLessThanOrEqual(2.5);
    }
  });

  it("leaves enough questions in each category at the basic level", () => {
    for (const { cat, kind } of all) {
      const deal = kind === "antidote" ? antidoteQuestions : algorithmQuestions;
      expect(deal("basic", null, cat).length, cat).toBeGreaterThanOrEqual(5);
    }
  });
});
