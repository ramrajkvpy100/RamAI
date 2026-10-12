import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resumeCase, simulateCase, submitDoctorAction } from "@/engine/engine";

process.env.RAMAI_SESSION_SECRET ??= "test-secret-test-secret-test-secret-123";

interface Call {
  url: string;
  model: string;
  system: string;
}

/** A stand-in for OpenAI that records every request and answers each kind of prompt. */
function fakeOpenAI(opts: { fail?: boolean; understood?: object } = {}) {
  const calls: Call[] = [];
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { model: string; messages: { role: string; content: string }[] };
    const system = body.messages.find((m) => m.role === "system")?.content ?? "";
    calls.push({ url: String(url), model: body.model, system });
    if (opts.fail) return new Response(JSON.stringify({ error: { code: "server_error" } }), { status: 500 });
    const answer = system.includes("You voice patients")
      ? { replies: body.messages[1]!.content.match(/Reply \d+/g)!.map((_, i) => `[voiced ${i + 1}] Yes doctor, it is as I said.`) }
      : system.includes("senior clinician")
        ? { summary: "You stabilised the patient.", reasoning: "You asked the key questions early.", nextTime: ["Attach the monitor sooner."] }
        : (opts.understood ?? { type: "patient_response", message: "[generated] No, doctor.", intents: [{ kind: "history", targetId: "generated", phrase: "" }] });
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(answer) } }] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

const DAY = "2026-10-12";

describe("OpenAI in the simulation — the model words it, the backend decides it", () => {
  beforeEach(() => {
    process.env.RAMAI_ENGINE = "openai";
    process.env.OPENAI_API_KEY = "sk-test-" + "x".repeat(40);
    delete process.env.OPENAI_MODEL;
    delete process.env.RAMAI_AI_VOICE;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.RAMAI_ENGINE;
    delete process.env.OPENAI_API_KEY;
    delete process.env.RAMAI_AI_VOICE;
  });

  it("voices the patient with gpt-6-luna only, keeps the feedback with the case, and never pays twice", async () => {
    const calls = fakeOpenAI();
    const start = await simulateCase({ userId: "ai-1", caseNumber: 1, daily: DAY });
    // The patient comes from the case library: starting a case asks the model nothing.
    expect(calls).toHaveLength(0);
    const turn = await submitDoctorAction(start.token, "What brings you here today?", "ai-1");
    const spoken = turn.state.messages.filter((m) => m.role === "patient" || m.role === "attendant").at(-1);
    expect(spoken?.text).toMatch(/^\[(voiced 1|generated)\]/);
    expect(calls.length).toBeGreaterThan(0);
    // One model, one address — nothing else, ever.
    expect(new Set(calls.map((c) => c.model))).toEqual(new Set(["gpt-6-luna"]));
    expect(calls.every((c) => c.url === "https://api.openai.com/v1/chat/completions")).toBe(true);

    const closed = await submitDoctorAction(turn.token, "End case", "ai-1");
    expect(closed.debrief?.coach).toMatchObject({ summary: "You stabilised the patient.", model: "gpt-6-luna" });
    // The score is the marking rules' — the same with or without the feedback.
    expect(closed.debrief?.score.total).toBeGreaterThanOrEqual(0);
    const before = calls.length;
    const again = await resumeCase(closed.token, "ai-1");
    expect(again.debrief?.coach).toEqual(closed.debrief?.coach);
    expect(calls.length).toBe(before);
  });

  it("when OpenAI fails, the turn uses the scripted reply — and never tries another model", async () => {
    const calls = fakeOpenAI({ fail: true });
    const start = await simulateCase({ userId: "ai-2", caseNumber: 1, daily: DAY });
    const turn = await submitDoctorAction(start.token, "What brings you here today?", "ai-2");
    const spoken = turn.state.messages.filter((m) => m.role === "patient" || m.role === "attendant").at(-1);
    expect(spoken?.text).toBeTruthy();
    expect(spoken?.text).not.toMatch(/^\[/);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.model).toBe("gpt-6-luna");
    const closed = await submitDoctorAction(turn.token, "End case", "ai-2");
    expect(closed.debrief).toBeDefined();
    expect(closed.debrief?.coach).toBeUndefined();
  });

  it("the guided demo's scripted steps cost nothing", async () => {
    const calls = fakeOpenAI();
    const start = await simulateCase({ userId: "ai-3", caseNumber: 1, tutorial: true });
    const turn = await submitDoctorAction(start.token, "What medicines does he take?", "ai-3");
    await submitDoctorAction(turn.token, "End case", "ai-3");
    expect(calls).toHaveLength(0);
  });

  it("words the rules can't place get the model's answer, in the demo too — kept, never asked twice", async () => {
    const reply = "[ai] The anaesthetist is in theatre, doctor.";
    const calls = fakeOpenAI({ understood: { type: "patient_response", speaker: "nurse", message: reply, intents: [{ kind: "unknown", phrase: "Call the anaesthetist" }] } });
    const start = await simulateCase({ userId: "ai-5", caseNumber: 1, daily: DAY });
    const turn = await submitDoctorAction(start.token, "Call the anaesthetist", "ai-5");
    expect(turn.state.messages.at(-1)).toMatchObject({ kind: "speech", text: reply });
    expect(calls).toHaveLength(1);

    const demo = await simulateCase({ userId: "ai-6", caseNumber: 1, tutorial: true });
    const said = await submitDoctorAction(demo.token, "Call the anaesthetist", "ai-6");
    expect(said.state.messages.at(-1)).toMatchObject({ role: "nurse", kind: "speech", text: reply });
    expect(calls).toHaveLength(2);
    const again = await resumeCase(said.token, "ai-6");
    expect(again.state.messages.at(-1)?.text).toBe(reply);
    expect(calls).toHaveLength(2);
  });

  it("a reassurance gets the patient's own reply", async () => {
    fakeOpenAI({ understood: { type: "patient_response", speaker: "patient", message: "[ai] Thank you, doctor.", intents: [] } });
    const demo = await simulateCase({ userId: "ai-7", caseNumber: 1, tutorial: true });
    const turn = await submitDoctorAction(demo.token, "Don't worry, you'll be fine", "ai-7");
    const last = turn.state.messages.at(-1);
    expect(["patient", "attendant"]).toContain(last?.role);
    expect(last?.text).toBe("[ai] Thank you, doctor.");
  });

  it("if the model can't be reached, someone in the room still answers — never 'Instruction not recognised'", async () => {
    fakeOpenAI({ fail: true });
    const start = await simulateCase({ userId: "ai-8", caseNumber: 1, tutorial: true });
    const turn = await submitDoctorAction(start.token, "Call the anaesthetist", "ai-8");
    expect(turn.state.messages.at(-1)).toMatchObject({ role: "nurse", kind: "speech" });
    expect(turn.state.messages.some((m) => /not recognised/i.test(m.text))).toBe(false);
  });

  it("saving mode: scripted answers stay free; only what the script can't answer goes to the model", async () => {
    process.env.RAMAI_AI_VOICE = "unscripted";
    const calls = fakeOpenAI();
    const start = await simulateCase({ userId: "ai-4", caseNumber: 1, daily: DAY });
    await submitDoctorAction(start.token, "Check vitals", "ai-4");
    expect(calls).toHaveLength(0);
  });
});
