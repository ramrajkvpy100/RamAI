import { describe, expect, it } from "vitest";

import { advanceRealTime, resumeCase, simulateCase, submitDoctorAction } from "@/engine/engine";

process.env.RAMAI_SESSION_SECRET = "test-secret-test-secret-test-secret-123";

describe("real-time mode", () => {
  it("each tick is one silent minute, recorded so the case replays exactly", async () => {
    const start = await simulateCase({ userId: "rt", caseNumber: 1, tutorial: true });
    const messages = start.state.messages.length;
    let token = start.token;
    for (let i = 0; i < 3; i++) token = (await advanceRealTime(token, "rt")).token;
    const after = await resumeCase(token, "rt");
    expect(after.state.clock).toBeCloseTo(start.state.clock + 3, 5);
    expect(after.state.messages.filter((m) => m.role === "doctor")).toHaveLength(0);
    expect(after.state.messages.filter((m) => /later$/.test(m.text))).toHaveLength(0);
    expect(after.state.messages.length).toBeGreaterThanOrEqual(messages);
  });

  it("hesitation costs: untreated, the hypoglycaemic patient seizes as the minutes run", async () => {
    const start = await simulateCase({ userId: "rt2", caseNumber: 1, tutorial: true });
    let token = start.token;
    let res;
    for (let i = 0; i < 26; i++) {
      res = await advanceRealTime(token, "rt2");
      token = res.token;
    }
    expect(["critical", "deceased"]).toContain(res!.state.patientStatus);
    expect(res!.state.messages.some((m) => m.role === "nurse")).toBe(true);
  });

  it("orders still work between ticks, and ticks don't use up actions", async () => {
    const start = await simulateCase({ userId: "rt3", caseNumber: 1, tutorial: true });
    let token = (await advanceRealTime(start.token, "rt3")).token;
    const turn = await submitDoctorAction(token, "Check RBS", "rt3");
    expect(turn.state.vitals.rbs).toBeDefined();
    token = (await advanceRealTime(turn.token, "rt3")).token;
    const after = await resumeCase(token, "rt3");
    expect(after.state.messages.filter((m) => m.role === "doctor").map((m) => m.text)).toEqual(["Check RBS"]);
  });
});
