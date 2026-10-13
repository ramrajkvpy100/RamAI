import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { learnFor, simulateCase, submitDoctorAction } from "@/engine/engine";
import { applyExaminerReview } from "@/engine/providers/openai-review";
import { LearnSchema } from "@/engine/providers/openai-schema";

process.env.RAMAI_SESSION_SECRET ??= "test-secret-test-secret-test-secret-123";

const q = (stem: string, answer: number, topic = "STEMI — reperfusion") => ({ stem, options: ["Aspirin", "Thrombolysis", "Primary PCI", "Heparin alone"], answer, explanation: "Primary PCI within 120 minutes is the reperfusion of choice.", topic, difficulty: "medium" });
const DRAFT = {
  pearls: ["Time is muscle: door-to-balloon under 90 minutes.", "Aspirin is given on suspicion, unless allergic.", "A normal first troponin doesn't exclude MI."],
  mcqs: [q("A 58-year-old man with chest pain for 1 hour has ST elevation in V1–V4. The best reperfusion strategy is:", 2), q("Which drug should be given on suspicion of ACS, unless contraindicated?", 0, "ACS — first aid"), q("Second question with a wrong key, long enough to count:", 1), q("Fourth question about troponin timing in suspected MI:", 3), q("A muddled question that can't be saved in any way:", 0)],
};

describe("pearls and exam questions — checked by an examiner", () => {
  it("the examiner's corrections are applied; an unsalvageable question is dropped", () => {
    const draft = LearnSchema.parse(DRAFT);
    const { part, fixes } = applyExaminerReview(draft, { fixes: [{ index: 2, answer: 2, why: "PCI is the answer" }, { index: 4, drop: true, why: "ambiguous" }] });
    expect(part.mcqs).toHaveLength(4);
    expect(part.mcqs[2]!.answer).toBe(2);
    expect(fixes).toEqual(["Q3: PCI is the answer", "Q5 dropped: ambiguous"]);
    expect(applyExaminerReview(draft, "nonsense").part).toBe(draft);
  });

  it("a question needs four options, a valid key and a real stem — or it's left out", () => {
    const parsed = LearnSchema.parse({ pearls: [], mcqs: [{ ...q("Too few options in this one, sadly:", 0), options: ["A", "B"] }, { ...q("A key that points past the options:", 7) }, q("A fine question with everything it needs:", 1)] });
    expect(parsed.mcqs).toHaveLength(1);
  });
});

describe("learnFor — the questions name the diagnosis, so only after the case", () => {
  beforeEach(() => {
    process.env.RAMAI_ENGINE = "openai";
    process.env.OPENAI_API_KEY = "sk-test-" + "x".repeat(40);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.RAMAI_ENGINE;
    delete process.env.OPENAI_API_KEY;
  });

  it("refused during play; afterwards written, examined, and in the country's exam style", async () => {
    const prompts: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as { messages: { role: string; content: string }[] };
        const system = body.messages.find((m) => m.role === "system")?.content ?? "";
        prompts.push(system);
        const answer = system.includes("item writer") ? DRAFT : system.includes("senior examiner") ? { fixes: [{ index: 4, drop: true, why: "ambiguous" }] } : { type: "patient_response", message: "Yes, doctor.", intents: [] };
        return Response.json({ choices: [{ message: { content: JSON.stringify(answer) } }] });
      }),
    );
    const start = await simulateCase({ userId: "learner", caseNumber: 1, tutorial: true, country: "UK" });
    await expect(learnFor(start.token, "learner")).rejects.toMatchObject({ code: "NOT_CLOSED" });
    const closed = await submitDoctorAction(start.token, "End case", "learner");
    const pack = (await learnFor(closed.token, "learner"))!;
    expect(pack.exam).toBe("UKMLA & PLAB 1");
    expect(pack.mcqs).toHaveLength(4);
    expect(pack.pearls).toHaveLength(3);
    // Shuffled, but the key still points at the same answer.
    const first = pack.mcqs[0]!;
    expect(first.options[first.answer]).toBe("Primary PCI");
    expect(prompts.some((p) => p.includes("UKMLA & PLAB 1") && p.includes("NICE"))).toBe(true);
  });
});
