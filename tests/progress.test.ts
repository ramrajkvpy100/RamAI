import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { dermAcne } from "@/engine/cases/derm-acne";
import { surgAppendicitis } from "@/engine/cases/surg-appendicitis";
import { generateDebrief } from "@/engine/debrief";
import { createProfile, type User } from "@/server/auth";
import { db } from "@/server/db";
import { progressDetail } from "@/server/progress-detail";
import { savedReport, writeReport } from "@/server/report";
import { recordCase } from "@/server/results";

import { play } from "./helpers";

process.env.RAMAI_DB_PATH = ":memory:";

let nisha: User;
beforeAll(async () => {
  nisha = await createProfile({ email: "nisha@example.com", username: "nisha", name: "Dr. Nisha Rao" });
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OPENAI_API_KEY;
});

const weakAppendix = () => {
  const { hidden, state } = play(surgAppendicitis, ["Order CT abdomen", "Give pantoprazole 40 mg IV", "Diagnosis: gastritis", "Case close"]);
  return generateDebrief(surgAppendicitis, hidden, state);
};
const goodAcne = () => {
  const { hidden, state } = play(dermAcne, ["What brings you here?", "Examine the face", "Diagnosis: moderate acne vulgaris", "Adapalene with benzoyl peroxide gel at night", "Case close"]);
  return generateDebrief(dermAcne, hidden, state);
};

describe("progress, from what each case showed", () => {
  it("each case keeps its marks per skill; the page shows the weakest skill first, specialties, activity and practice answers", async () => {
    await recordCase(nisha, "p-1", weakAppendix());
    await recordCase(nisha, "p-2", goodAcne());
    await db.run("INSERT INTO mcq_answers (user_id, session_id, q, topic, correct, created_at) VALUES (?, 'p-1', 0, 'Appendicitis — imaging', 0, ?), (?, 'p-1', 1, 'Appendicitis — imaging', 0, ?), (?, 'p-2', 0, 'Acne — treatment', 1, ?)", nisha.id, Date.now(), nisha.id, Date.now(), nisha.id, Date.now());
    const detail = await progressDetail(nisha.id);
    expect(detail.cases).toBe(2);
    expect(detail.skills.length).toBeGreaterThan(3);
    expect(detail.skills[0]!.percent).toBeLessThanOrEqual(detail.skills.at(-1)!.percent);
    expect(detail.specialties.map((s) => s.name).sort()).toEqual(["Dermatology", "Surgery"]);
    expect(detail.activity).toHaveLength(84);
    expect(detail.activity.at(-1)!.cases).toBe(2);
    expect(detail.mcq).toMatchObject({ answered: 3, correct: 1, weakTopics: [{ topic: "Appendicitis — imaging", answered: 2, correct: 0 }] });
    const row = await db.get<{ detail: string }>("SELECT detail FROM results WHERE session_id = 'p-1'");
    expect(JSON.parse(row!.detail).lost.length).toBeGreaterThan(0);
  });

  it("no report before three cases; then one written from the record — kept until there are new cases", async () => {
    process.env.OPENAI_API_KEY = "sk-test-" + "x".repeat(40);
    let sent = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        sent = String(init?.body ?? "");
        return Response.json({
          choices: [{ message: { content: JSON.stringify({ headline: "Strong on skin, rushed in surgery", strengths: ["You examine the skin closely."], repeatedMistakes: [{ pattern: "Treating before a diagnosis", evidence: "in 2 of your 3 cases", fix: "State a working diagnosis first." }], weakAreas: [{ area: "Investigation selection", why: "CT before ultrasound" }], progress: "Improving.", recommendations: [{ action: "Play two surgical emergencies", why: "Your weakest area", specialty: "Surgery", track: "emergency" }, { action: "Bad one", why: "x", specialty: "Not a specialty" }] }) } }],
        });
      }),
    );
    expect(await writeReport(nisha)).toBeNull();
    await recordCase(nisha, "p-3", weakAppendix());
    const report = (await writeReport(nisha))!;
    expect(report).toMatchObject({ headline: "Strong on skin, rushed in surgery", cases: 3, model: "gpt-6-luna" });
    expect(report.recommendations[0]).toMatchObject({ specialty: "Surgery", track: "emergency" });
    expect(report.recommendations[1]!.specialty).toBeUndefined();
    expect(sent).toContain("Investigation selection");
    expect(sent).not.toContain("nisha@example.com");
    expect(await savedReport(nisha.id)).toEqual(report);
  });
});
