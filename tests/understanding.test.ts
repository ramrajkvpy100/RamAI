import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getCase } from "@/engine/cases";
import { createOpenAIProvider, knownSoFar, leaksDiagnosis } from "@/engine/providers/openai";
import type { InterpretContext } from "@/engine/providers/types";
import { applyEffects } from "@/engine/reducer";
import { runTurn } from "@/engine/simulator";
import type { ActionRecord } from "@/engine/types";

import { converse, messagesOf, play } from "./helpers";

/**
 * Understanding the doctor: orders vs questions, history vs examination, new tests vs results already back,
 * ambiguous doses — and what the model is shown, what it may say, and what happens when it fails. OpenAI is mocked.
 */

const dengue = getCase("id-dengue-01")!;
const adhf = getCase("em-adhf-01")!;

interface Sent { system: string; user: string; effort?: string }

/** A stand-in for OpenAI: records each prompt and answers with `answer(sent)` (or fails). */
function fakeOpenAI(answer: (s: Sent) => unknown) {
  const sent: Sent[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { messages: { role: string; content: string }[]; reasoning_effort?: string };
    const s = { system: body.messages[0]?.content ?? "", user: body.messages.slice(1).map((m) => m.content).join("\n"), effort: body.reasoning_effort };
    sent.push(s);
    const a = answer(s);
    if (a instanceof Response) return a;
    return new Response(JSON.stringify({ choices: [{ message: { content: typeof a === "string" ? a : JSON.stringify(a) } }] }), { status: 200 });
  }));
  return sent;
}

const isVoice = (s: Sent) => s.system.includes("You voice patients");
const voiced = (s: Sent) => ({ replies: (s.user.match(/Reply \d+/g) ?? []).map(() => "Yes doctor, it started three days ago.") });

/** Plays `before` by the rules, then reads `line` through the OpenAI provider and runs the turn. */
async function turn(def = dengue, before: string[], line: string) {
  const played = await converse(def, before);
  const ctx: InterpretContext = { def, hidden: played.hidden, transcript: played.state.messages, country: "IN", lang: "en" };
  const read = await createOpenAIProvider().interpret(line, ctx);
  const record: ActionRecord = { id: "x", at: played.hidden.clock, raw: line, intents: read.intents, generated: read.generated };
  const effects = runTurn(def, played.hidden, record);
  const state = applyEffects(played.state, effects);
  return { read, effects, hidden: played.hidden, state, ctx };
}

const drugsGiven = (h: { drugs: { generic: string; mode: string }[] }) => h.drugs.map((d) => d.generic.toLowerCase());

describe("Understanding the doctor (OpenAI mocked)", () => {
  beforeEach(() => {
    process.env.RAMAI_ENGINE = "openai";
    process.env.OPENAI_API_KEY = "sk-test-" + "x".repeat(40);
    delete process.env.OPENAI_MODEL;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.RAMAI_ENGINE;
    delete process.env.OPENAI_API_KEY;
  });

  describe("1. medication orders vs questions", () => {
    it.each(["is he on aspirin?", "is aspirin indicated?", "should I give aspirin?", "what dose of paracetamol?"])("'%s' gives nothing", async (line) => {
      fakeOpenAI((s) => (isVoice(s) ? voiced(s) : { type: "patient_response", message: "", intents: [{ kind: "unknown", phrase: line }] }));
      const { hidden } = await turn(dengue, [], line);
      expect(hidden.drugs).toHaveLength(0);
    });

    it("'paracetamol 650 mg po' is an order: the nurse only asks how often and how long", async () => {
      fakeOpenAI((s) => (isVoice(s) ? voiced(s) : { intents: [] }));
      const { read, state } = await turn(dengue, [], "paracetamol 650 mg po");
      expect(read.intents.map((i) => [i.kind, i.targetId])).toEqual([["drug", "paracetamol"]]);
      expect(state.messages.at(-1)?.text).toMatch(/how often/);
    });

    it("a question the rules read as an order is checked by the model — and its reading (a question) stands", async () => {
      const sent = fakeOpenAI((s) => (isVoice(s) ? voiced(s) : { type: "patient_response", message: "No doctor, I haven't taken anything for it.", intents: [{ kind: "history", targetId: "meds", phrase: "" }] }));
      const { hidden } = await turn(dengue, [], "ondansetron given?");
      expect(sent.some((s) => !isVoice(s))).toBe(true);
      expect(hidden.drugs).toHaveLength(0);
    });

    it("the model can never write a dose: a drug it reads from a question is not given", async () => {
      fakeOpenAI((s) => (isVoice(s) ? voiced(s) : { type: "patient_response", message: "", intents: [{ kind: "drug", targetId: "ketorolac", phrase: "ketorolac 30 mg iv" }] }));
      const { hidden } = await turn(dengue, [], "pain killer ok for him?");
      expect(drugsGiven(hidden)).not.toContain("ketorolac");
    });
  });

  describe("2. examination vs history", () => {
    it("'any leg swelling?' is history; 'examine the legs for oedema' is examination", async () => {
      const asked = await converse(adhf, ["any leg swelling?"]);
      expect(Object.keys(asked.hidden.history)).toContain("swelling");
      expect(Object.keys(asked.hidden.exams)).toHaveLength(0);
      const examined = await converse(adhf, ["examine the legs for pedal oedema"]);
      expect(Object.keys(examined.hidden.exams).length).toBeGreaterThan(0);
    });
  });

  it.each(["need to know whether u ever had sugar problems", "any sugar ki bimari?", "history of sugar?"])("'%s' asks about diabetes, never checks the sugar", async (line) => {
    const tinea = getCase("derm-tinea-01")!;
    const { hidden, turns } = await converse(tinea, [line]);
    expect(Object.keys(hidden.history)).toContain("diabetes");
    expect(turns[0]!.record.intents.map((i) => i.kind)).not.toContain("vitals");
  });

  it("'how is this affecting your work?' is not 'what is your job?'", async () => {
    const { turns } = await converse(getCase("derm-tinea-01")!, ["how is this affecting your work?"]);
    expect(turns[0]!.record.intents.map((i) => i.targetId)).not.toContain("identity:occupation");
  });

  describe("3. investigation orders vs results already back", () => {
    it("'what did the ecg show' shows the ECG again and orders nothing new; 'repeat ecg' orders one", async () => {
      const first = await converse(adhf, ["ecg", "wait 15 min"]);
      const n = first.hidden.investigations.length;
      const again = await converse(adhf, ["ecg", "wait 15 min", "what did the ecg show"]);
      expect(again.hidden.investigations.length).toBe(n);
      const repeat = await converse(adhf, ["ecg", "wait 15 min", "repeat ecg"]);
      expect(repeat.hidden.investigations.length).toBe(n + 1);
    });
  });

  describe("4. ambiguous doses and frequencies", () => {
    it("'lasix 40 iv or 80?' gives nothing until the dose is chosen", async () => {
      const { hidden, turns } = await converse(adhf, ["lasix 40 iv or 80?"]);
      expect(hidden.drugs).toHaveLength(0);
      expect(messagesOf(turns.at(-1)!.effects).join(" ")).toMatch(/dose|how much|mg/i);
    });

    it("a bare number is never cut short ('paracetamol 650' is 650 mg, not 65)", async () => {
      const { turns } = play(dengue, ["paracetamol 650 po"]);
      expect(messagesOf(turns[0]!.effects).join(" ")).toMatch(/Paracetamol 650 mg oral/);
    });
  });

  describe("5. follow-up questions use what's been found", () => {
    it("the model is shown the results back with values and units, the history asked and what's pending", async () => {
      const played = await converse(dengue, ["since when is the fever?", "cbc", "wait 60 min", "send lft"]);
      const ctx: InterpretContext = { def: dengue, hidden: played.hidden, transcript: played.state.messages };
      const note = knownSoFar(ctx);
      expect(note).toMatch(/Results back: .*Haemoglobin [\d.]+ g\/dL/);
      expect(note).toMatch(/Platelet/i);
      expect(note).toMatch(/Results back: .*LFT/);
      expect(note).toMatch(/Pending: none/);
      expect(note).toMatch(/History obtained: (?!nothing)/);
      expect(note).toMatch(/Examination done: none yet/);
    });

    it("the prompt for an unplaced question carries those results", async () => {
      const sent = fakeOpenAI((s) => (isVoice(s) ? voiced(s) : { type: "patient_response", message: "", intents: [{ kind: "unknown", phrase: "" }] }));
      await turn(dengue, ["cbc", "wait 60 min"], "so what do u make of the counts and is that trending somewhere bad");
      const understood = sent.find((s) => !isVoice(s));
      expect(understood?.user).toMatch(/Results back: .*Platelet/i);
      expect(understood?.effort).toBe("low");
    });
  });

  describe("6. natural dialogue without diagnostic leakage", () => {
    it("leaksDiagnosis catches the diagnosis and its synonyms, unless the room has already said it", () => {
      expect(leaksDiagnosis(adhf, "Doctor says it is heart failure, na?", "")).toBe(true);
      expect(leaksDiagnosis(adhf, "My legs swell up by the evening.", "")).toBe(false);
      expect(leaksDiagnosis(dengue, "I've never had dengue before.", "")).toBe(false);
      expect(leaksDiagnosis(adhf, "So it is heart failure?", "Doctor: I think this is heart failure.")).toBe(false);
    });

    it("a voiced reply naming the diagnosis is dropped; the scripted words are said", async () => {
      fakeOpenAI((s) => (isVoice(s) ? { replies: (s.user.match(/Reply \d+/g) ?? ["Reply 1"]).map(() => "It's acute decompensated heart failure, doctor.") } : { intents: [] }));
      const { state } = await turn(adhf, [], "what happened?");
      const said = state.messages.filter((m) => m.role === "patient" || m.role === "attendant").map((m) => m.text).join(" ");
      expect(said).not.toMatch(/heart failure/i);
      expect(said.length).toBeGreaterThan(0);
    });

    it("an understood reply naming the diagnosis is dropped too", async () => {
      fakeOpenAI((s) => (isVoice(s) ? voiced(s) : { type: "patient_response", message: "The doctor in the village said heart failure.", intents: [{ kind: "history", targetId: "generated", phrase: "" }] }));
      const { state } = await turn(adhf, [], "what did the last doc tell u about all this business");
      expect(state.messages.map((m) => m.text).join(" ")).not.toMatch(/heart failure/i);
    });

    it("the voice prompt never contains the diagnosis, and asks for natural speech", async () => {
      const sent = fakeOpenAI((s) => (isVoice(s) ? voiced(s) : { intents: [] }));
      await turn(adhf, [], "what happened?");
      const v = sent.find(isVoice)!;
      expect(v).toBeTruthy();
      expect(`${v.system}\n${v.user}`.toLowerCase()).not.toContain("decompensated heart failure");
      expect(v.effort).not.toBe("medium");
    });
  });

  describe("7. invalid model output and API failure", () => {
    it.each([
      ["not JSON", () => "this is not json {"],
      ["the wrong shape", () => ({ foo: 1 })],
      ["a server error", () => new Response(JSON.stringify({ error: { code: "server_error" } }), { status: 500 })],
    ])("%s: the rules' reading and the scripted words stand", async (_name, bad) => {
      fakeOpenAI(bad as (s: Sent) => unknown);
      const { state, hidden } = await turn(adhf, [], "what happened?");
      expect(state.messages.filter((m) => m.role === "patient" || m.role === "attendant").length).toBeGreaterThan(0);
      expect(Object.keys(hidden.history).length).toBeGreaterThan(0);
    });

    it("a failed model call on an order changes nothing about the order", async () => {
      fakeOpenAI(() => new Response("{}", { status: 500 }));
      const { hidden } = await turn(adhf, [], "furosemide 40 mg iv stat");
      expect(hidden.drugs.map((d) => [d.generic.toLowerCase(), d.dose])).toEqual([["furosemide", expect.stringMatching(/40/)]]);
    });
  });

  describe("8. deterministic outcomes and scoring", () => {
    it("the same orders give the same course, vitals and record every time", () => {
      const lines = ["what happened?", "sit him up", "oxygen 4 l by nasal prongs", "furosemide 40 mg iv", "ecg", "wait 20 min", "vitals"];
      const a = play(adhf, lines);
      const b = play(adhf, lines);
      expect(a.hidden.vitals).toEqual(b.hidden.vitals);
      expect(a.hidden.status).toBe(b.hidden.status);
      expect(a.state.messages.map((m) => m.text)).toEqual(b.state.messages.map((m) => m.text));
    });
  });
});
