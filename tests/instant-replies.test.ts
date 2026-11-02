/** What the rules can place is answered at once, with nothing asked of a model; orders typed ahead wait their turn safely. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { simulateCase, submitDoctorAction } from "@/engine/engine";
import { waitLabel } from "@/lib/wait-label";

const ER = "em-adhf-01";

describe("no model for what the rules know", () => {
  let calls = 0;
  beforeEach(() => {
    calls = 0;
    vi.stubEnv("OPENAI_API_KEY", "test");
    vi.stubEnv("RAMAI_ENGINE", "openai");
    vi.stubGlobal("fetch", vi.fn(async () => {
      calls += 1;
      return new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }));
    }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  const say = async (line: string, id = ER) => submitDoctorAction((await simulateCase({ userId: "u", caseNumber: 1, ready: { kind: "library", id }, country: "IN", lang: "en" } as never)).token, line, "u");

  it.each([
    "How are you feeling right now?",
    "Where exactly is the pain and does it radiate anywhere?",
    "Do you have any past medical history like diabetes, hypertension, or asthma?",
    "Are you taking any regular medications or allergic to anything?",
    "Since when did this breathlessness start and does lying flat make it worse?",
    "Do you smoke or drink alcohol?",
  ])("%s", async (line) => {
    const r = await say(line);
    expect(calls).toBe(0);
    expect(r.state.messages.at(-1)!.text.length).toBeGreaterThan(0);
  });

  it("a part the rules can't place still reaches the model", async () => {
    await say("Any cough at night, and do you own a tractor");
    expect(calls).toBeGreaterThan(0);
  });

  it("the seven-item emergency order is all done in one pass", async () => {
    const r = await say("iv access, o2 4L, ecg, cbc, rft, trop i, cxr stat");
    expect(calls).toBe(0);
    const text = r.state.messages.map((m) => m.text).join(" ");
    expect(text).toMatch(/IV access secured/);
    expect(text).toMatch(/Oxygen started/);
    expect(r.state.investigations.map((i) => i.name).join(" ")).toMatch(/ECG[\s\S]*Chest X-ray AP \(portable\)|Chest X-ray AP \(portable\)[\s\S]*ECG/);
    expect(r.state.investigations).toHaveLength(5);
    expect(text).not.toMatch(/PA, or AP/);
  });

  it.each([
    ["emset 4mg iv", /Ondansetron 4 mg IV given\./],
    ["pantocid 40mg iv", /Pantoprazole 40 mg IV given\./],
  ])("%s is given cleanly, with no talk of no change", async (line, want) => {
    const r = await say(line);
    expect(calls).toBe(0);
    const text = r.state.messages.map((m) => m.text).join(" ");
    expect(text).toMatch(want);
    expect(text).not.toMatch(/no change from it/);
  });

  it.each([
    ["pan iv 40", "Pantoprazole"], ["aug 625 bd for 5 days", "Amoxicillin"], ["duolin neb", "Levosalbutamol"], ["budecort neb", "Budesonide"],
    ["ecosprin 75", "Aspirin"], ["clopilet 75 od for 5 days", "Clopidogrel"], ["atorva 40 hs for 5 days", "Atorvastatin"], ["hydrocort 100 mg iv", "Hydrocortisone"],
    ["avil 22.75 mg iv", "Pheniramine"], ["dynapar 75 mg im", "Diclofenac"], ["levipil 1 g iv", "Levetiracetam"], ["optineuron iv", "Thiamine"], ["frusemide 40 iv", "Furosemide"],
  ])("%s means %s", async (line, generic) => {
    const r = await say(line);
    expect(r.state.messages.map((m) => m.text).join(" ")).toMatch(new RegExp(generic));
  });
});

describe("from the full games", () => {
  it("saline's strength isn't its dose, and every 24 hours is once a day", async () => {
    const { converse } = await import("./helpers");
    const def = (await import("@/engine/cases")).getCase("em-adhf-01")!;
    const { state } = await converse(def, ["0.9% saline 500 ml iv over 1 hour"]);
    expect(state.messages.map((m) => m.text).join(" ")).not.toMatch(/0\.9 %/);
    const { parseOrderDetails } = await import("@/engine/formulary");
    expect(parseOrderDetails("ceftriaxone 1 g iv every 24 hours").frequency).toBe("OD");
  });

  it("two creams with nothing to say don't leave a line hanging", async () => {
    const { converse } = await import("./helpers");
    const def = (await import("@/engine/cases")).getCase("derm-acne-moderate-01")!;
    const { state } = await converse(def, ["benzoyl peroxide gel od and clindamycin gel bd"]);
    const after = state.messages.filter((m) => /^After a few days/.test(m.text)).length;
    const said = state.messages.filter((m) => m.role === "patient").length;
    expect(after).toBeLessThanOrEqual(said);
  });
});

describe("what the bar says", () => {
  it.each([
    ["any fever?", "Patient is replying…"],
    ["cbc, rft", "Running lab & imaging orders…"],
    ["inj lasix 40 iv", "Nurse administering medication…"],
    ["examine the chest", "Examining patient…"],
  ])("%s", (input, label) => expect(waitLabel(input)).toBe(label));
});

describe("orders typed ahead", () => {
  it("wait their turn, and never answer a question the doctor hasn't seen", async () => {
    vi.resetModules();
    const answers: ((v: unknown) => void)[] = [];
    const sent: string[] = [];
    vi.doMock("@/lib/engine-client", async (orig) => ({
      ...(await orig<typeof import("@/lib/engine-client")>()),
      submitDoctorAction: vi.fn((_t: string, text: string) => {
        sent.push(text);
        return new Promise((resolve) => answers.push(resolve));
      }),
    }));
    const store = await import("@/lib/case-store");
    store.__testSession({ token: "t", state: { messages: [] } as never, begun: true });
    const reply = (text: string) => ({ token: "t", state: { messages: [{ role: "nurse", text }] }, effects: [] });

    const first = store.send("furosemide 400 mg iv");
    expect(await store.send("yes give it")).toBe(true);
    expect(sent).toEqual(["furosemide 400 mg iv"]);
    expect(store.caseSnapshot().queued).toEqual(["yes give it"]);
    // The nurse queries the dose: the queued "yes" stays where it is.
    answers[0]!(reply("Doctor — that much? Do you still want it given?"));
    await first;
    expect(sent).toHaveLength(1);
    expect(store.caseSnapshot().queued).toEqual(["yes give it"]);
    store.dropQueued(0);

    // With no question asked, the next goes by itself.
    const second = store.send("cbc");
    await store.send("ecg");
    answers[1]!(reply("CBC — sent."));
    await second;
    await Promise.resolve();
    expect(sent.at(-1)).toBe("ecg");
  });
});

describe("where the scans live", () => {
  it("every library path becomes one address on storage", async () => {
    const { scanUrl, SCAN_BASE } = await import("@/lib/scans");
    expect(scanUrl("/radiology/singles/nof/2.jpg")).toBe(`${SCAN_BASE}/singles/nof/2.jpg`);
    expect(scanUrl("lung-ca-ct-4/soft/000.jpg")).toBe(`${SCAN_BASE}/lung-ca-ct-4/soft/000.jpg`);
  });
});
