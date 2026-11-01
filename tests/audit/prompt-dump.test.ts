/** Audit (read-only): records the exact requests sent to OpenAI on a few turns (fake OpenAI; no key, no cost). */
import { writeFileSync } from "node:fs";
import { it, vi } from "vitest";
process.env.RAMAI_SESSION_SECRET ??= "test-secret-test-secret-test-secret-123";
process.env.RAMAI_DB_PATH = ":memory:";
it("dump", async () => {
  process.env.RAMAI_ENGINE = "openai";
  process.env.OPENAI_API_KEY = "sk-test-" + "x".repeat(40);
  const bodies: unknown[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    bodies.push(body);
    const sys = body.messages.find((m: { role: string }) => m.role === "system")?.content ?? "";
    const ans = sys.includes("You voice patients") ? { replies: (body.messages[1].content.match(/Reply \d+/g) ?? ["x"]).map(() => "Yes doctor.") } : { type: "patient_response", message: "I don't know, doctor.", intents: [{ kind: "history", targetId: "generated", phrase: "" }] };
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(ans) } }], usage: { prompt_tokens: 0 } }), { status: 200 });
  }));
  const { simulateCase, submitDoctorAction } = await import("@/engine/engine");
  const start = await simulateCase({ userId: "dump", caseNumber: 1, daily: "2026-10-12" });
  let token = start.token;
  for (const t of ["What brings you here today?", "pcm 1 g stat", "oral", "check vitals", "do you get this every monsoon and does your neighbour also have it"]) {
    const r = await submitDoctorAction(token, t, "dump"); token = r.token;
  }
  writeFileSync("/private/tmp/claude-501/-Users-rsk-Startup/a0103bfd-fc22-4950-9d58-89d9ac74e3bc/scratchpad/prompts.json", JSON.stringify(bodies, null, 1));
});
