import { afterEach, describe, expect, it, vi } from "vitest";

import { consistentLabs, expectedPH } from "@/engine/abg-check";
import { dermTinea } from "@/engine/cases/derm-tinea";
import { emAdhf } from "@/engine/cases/em-adhf";
import { createOpenAIProvider } from "@/engine/providers/openai";
import { createHiddenState } from "@/engine/simulator";
import { medSleApex } from "@/engine/cases/med-sle-apex";
import type { LabRow } from "@/engine/types";
import { joinSpeech } from "@/lib/use-speech";

import { converse } from "./helpers";

const said = (state: { messages: readonly { text: string }[] }) => state.messages.map((m) => m.text).join("\n");
const row = (analyte: string, value: string): LabRow => ({ analyte, value, flag: "normal" });

describe("problems doctors reported", () => {
  it("a new dose after a prescription changes the drug's dose", async () => {
    const { state } = await converse(dermTinea, ["Ibuprofen 400 mg TDS for 3 days", "800 mg"]);
    const last = state.drugs.at(-1)!;
    expect([last.generic, last.dose, last.frequency, last.duration]).toEqual(["Ibuprofen", "800 mg", "TDS", "3 days"]);
    const { state: raised } = await converse(dermTinea, ["Ibuprofen 400 mg TDS for 3 days", "increase to 600 mg"]);
    expect(raised.drugs.at(-1)!.dose).toBe("600 mg");
  });

  it("a bare dose with no drug given yet isn't an invented prescription", async () => {
    const { state } = await converse(dermTinea, ["800 mg"]);
    expect(state.drugs).toHaveLength(0);
  });

  it("a test the catalogue doesn't know is sent, not asked about as blood tests", async () => {
    for (const order of ["Send Fluorescein to a private lab", "Order Fluorescein examination"]) {
      const { state } = await converse(dermTinea, [order]);
      expect(said(state)).not.toMatch(/Which blood tests|Which system/);
      expect(said(state)).toMatch(/Fluorescein/);
    }
  });

  it("a known test sent to a private lab stays that test", async () => {
    const { state } = await converse(dermTinea, ["Send KOH to a private lab"]);
    expect(said(state)).toMatch(/KOH mount/);
  });

  it("a diagnosis said on its own is recorded, even after a prescription", async () => {
    for (const seq of [["fungal infection"], ["Fluconazole 150 mg OD for 5 days", "ringworm"], ["Hint", "ringworm"]]) {
      const { state } = await converse(dermTinea, seq);
      expect(said(state)).toMatch(/Working diagnosis recorded/);
    }
  });

  it("questions to the senior go to the senior, not the patient", async () => {
    for (const q of ["senior mam, what is the diagnosis", "madam senior what do you think", "sir what is the diagnosis"]) {
      const { state } = await converse(medSleApex, [q]);
      expect(said(state)).toMatch(/Your senior/);
    }
  });

  it("the usual dose of a methylprednisolone pulse is 500 mg, and the plain usual dose is unchanged", async () => {
    const pulse = await converse(medSleApex, ["Methylprednisolone pulse IV", "usual dose"]);
    expect(pulse.state.drugs.at(-1)!.dose).toBe("500 mg");
    const plain = await converse(medSleApex, ["Methylprednisolone IV", "usual dose"]);
    expect(plain.state.drugs.at(-1)!.dose).toBe("125 mg");
    const brand = await converse(medSleApex, ["Inj solumedrol 1 g IV OD for 3 days"]);
    expect(brand.state.drugs.at(-1)?.generic).toBe("Methylprednisolone");
  });

  it("voice typing's repeats are not written twice", () => {
    expect(joinSpeech(["diclofenac", "diclofenac 40", "diclofenac 40 mg"])).toBe("diclofenac 40 mg");
    expect(joinSpeech(["give him twice a day", "give him"])).toBe("give him twice a day");
    expect(joinSpeech(["ceftriaxone 1 g", "iv stat"])).toBe("ceftriaxone 1 g iv stat");
  });
});

describe("numbers that must agree", () => {
  it("replaces a pH that doesn't fit HCO3 and PaCO2", () => {
    const fixed = consistentLabs([row("pH", "7.12"), row("HCO3", "8"), row("PaCO2", "20")]);
    expect(fixed[0]!.value).toBe(expectedPH(8, 20).toFixed(2));
    expect(fixed[0]!.flag).toBe("low");
  });

  it("leaves results that agree, or that aren't plain numbers", () => {
    const fine = [row("pH", "7.40"), row("HCO3", "24"), row("PaCO2", "40")];
    expect(consistentLabs(fine)).toEqual(fine);
    const odd = [row("pH", "<7.0"), row("HCO3", "8"), row("PaCO2", "20")];
    expect(consistentLabs(odd)).toEqual(odd);
    const partial = [row("pH", "7.1"), row("HCO3", "8")];
    expect(consistentLabs(partial)).toEqual(partial);
  });

  it("corrects the anion gap from Na, Cl and HCO3", () => {
    const fixed = consistentLabs([row("Sodium", "140"), row("Chloride", "100"), row("HCO3", "10"), row("Anion gap", "12")]);
    expect(fixed[3]!.value).toBe("30");
    expect(fixed[3]!.flag).toBe("high");
  });
});

describe("the model can't change what the doctor ordered", () => {
  const modelReads = (intents: unknown[]) => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify({ intents, message: "" }) } }] }) }) as Response;
  const read = async (text: string, intents: unknown[]) => {
    vi.stubEnv("OPENAI_API_KEY", "test");
    vi.stubGlobal("fetch", vi.fn(async (u: unknown) => (String(u).includes("openai.com") ? modelReads(intents) : ({ ok: false, status: 503, json: async () => ({}) } as Response))));
    const hidden = createHiddenState(emAdhf);
    return (await createOpenAIProvider().interpret(text, { def: emAdhf, hidden, transcript: [] })).intents;
  };
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("keeps the dose the doctor wrote when the model loses it", async () => {
    const [i] = await read("morfineee 50 mg iv please now", [{ kind: "drug", targetId: "morphine", phrase: "morfineee", payload: { usual: true, route: "IV" } }]);
    expect(i).toMatchObject({ targetId: "morphine", payload: { amount: 50, unit: "mg", route: "IV" } });
    expect(i!.payload?.usual).toBeUndefined();
  });

  it("leaves the model's reading when no dose was written", async () => {
    const [i] = await read("zzzmorphine usual dose kindly today", [{ kind: "drug", targetId: "morphine", phrase: "x", payload: { usual: true } }]);
    expect(i!.payload?.usual).toBe(true);
  });

  it("'all blood tests' is asked about, not reported", async () => {
    const [i] = await read("do all blood tests for this one kindly", [{ kind: "investigation", targetId: "adhoc:All blood tests", phrase: "x" }]);
    expect(i).toMatchObject({ targetId: "blood", payload: { everything: true } });
  });
});
