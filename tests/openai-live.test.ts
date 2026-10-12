/**
 * A real case against the real OpenAI API — skipped unless asked for:
 *   RAMAI_LIVE_OPENAI=1 npx vitest run tests/openai-live.test.ts
 * Uses the key and model in .env.local and spends a fraction of a cent.
 */
import { describe, expect, it } from "vitest";

const live = process.env.RAMAI_LIVE_OPENAI === "1";

describe.skipIf(!live)("OpenAI live", () => {
  it("plays a short case: the patient speaks through the model, and the debrief has feedback", async () => {
    process.loadEnvFile(".env.local");
    process.env.RAMAI_SESSION_SECRET ??= "test-secret-test-secret-test-secret-123";
    process.env.RAMAI_ENGINE = "openai";
    const { simulateCase, submitDoctorAction } = await import("@/engine/engine");
    const say = (state: { messages: { role: string; text: string }[] }) => state.messages.filter((m) => m.role === "patient" || m.role === "attendant").at(-1)?.text;

    const start = await simulateCase({ userId: "live", caseNumber: 1, daily: "2026-10-12" });
    let t = Date.now();
    const a = await submitDoctorAction(start.token, "What brings you here today?", "live");
    console.log(`Doctor: What brings you here today?\n  Patient (${Date.now() - t} ms): ${say(a.state)}`);
    t = Date.now();
    const b = await submitDoctorAction(a.token, "Do you keep any pets at home?", "live");
    console.log(`Doctor: Do you keep any pets at home?\n  Patient (${Date.now() - t} ms): ${say(b.state)}`);
    const c = await submitDoctorAction(b.token, "Check vitals", "live");
    t = Date.now();
    const end = await submitDoctorAction(c.token, "End case", "live");
    console.log(`Debrief (${Date.now() - t} ms) — score ${end.debrief?.score.total}/100 from the marking rules`);
    console.log(`  Feedback (${end.debrief?.coach?.model}): ${end.debrief?.coach?.summary}\n  ${end.debrief?.coach?.reasoning}\n  Next time: ${end.debrief?.coach?.nextTime.join(" | ")}`);
    expect(say(a.state)).toBeTruthy();
    expect(end.debrief?.coach?.model).toBe(process.env.OPENAI_MODEL || "gpt-6-luna");
  }, 120_000);
});
