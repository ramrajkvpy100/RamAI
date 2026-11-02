/** No two replies in a chat are word for word the same, whatever the doctor repeats. */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ALL_CASES, getCase } from "@/engine/cases";
import { toHinglish } from "@/engine/i18n/hinglish";
import { reworded } from "@/engine/reword";
import { generateScore } from "./score-helper";

import { converse } from "./helpers";

const replies = (state: { messages: readonly { role: string; text: string }[] }) => state.messages.filter((m) => m.role !== "doctor").map((m) => m.text);

describe("nothing is said twice", () => {
  it("the same questions and orders, over and over", async () => {
    for (const id of ["derm-acne-moderate-01", "em-adhf-01", "uro-colic-district-01"]) {
      const line = ["any allergy", "any allergy", "any allergy", "any allergy", "any allergy", "any allergy", "any allergy", "examine the chest", "examine the chest", "examine the chest", "asdf", "asdf", "asdf", "asdf", "asdf", "asdf", "cbc", "cbc", "show cbc report", "how are you", "how are you", "how are you", "how are you", "how are you", "how are you"];
      const { state } = await converse(getCase(id)!, line);
      const said = replies(state);
      const twice = said.filter((t, i) => said.indexOf(t) !== i);
      expect(twice).toEqual([]);
    }
  });

  it("every written case, under a chaotic doctor", async () => {
    for (const def of ALL_CASES.slice(0, 8)) {
      const { state } = await converse(def, ["hello", "hello", "any fever", "any fever", "ok", "ok", "wait 5 min", "wait 5 min", "vitals", "vitals", "vitals"]);
      const said = replies(state);
      expect(said.filter((t, i) => said.indexOf(t) !== i)).toEqual([]);
    }
  });

  it("the facts stay; only the way of saying it changes", async () => {
    const { state } = await converse(getCase("gp-uti-phc-01")!, ["any allergy", "any allergy"]);
    const said = replies(state).slice(-2);
    expect(said[1]).toContain(said[0]);
    expect(said[1]).not.toBe(said[0]);
  });

  it("short lines have real alternatives, and every repeat differs", () => {
    const seen = Array.from({ length: 14 }, (_, n) => reworded("About the same, doctor.", "patient", "speech", n + 1));
    expect(new Set(seen).size).toBe(14);
    expect(seen[0]).toBe("No real difference, doctor.");
  });

  it("works in Hinglish", () => {
    const def = getCase("gp-uti-phc-01")!;
    const out = toHinglish("As I told you, doctor: No allergies that I know of.", def.id, "patient", def.patient);
    expect(out).toMatch(/^Jaise maine bataya, doctor: /);
    expect(out).not.toMatch(/No allergies/);
    expect(toHinglish("No real difference, doctor.", def.id, "patient", def.patient)).toMatch(/farak/);
  });
});

describe("a patient who ended well", () => {
  it("gets full outcome marks and a fair treatment mark when the illness's own treatment worked", async () => {
    const lines = await generateScore(getCase("uro-colic-district-01")!, ["diclofenac 75 mg im"]);
    expect(lines.outcome).toBe(1);
    expect(lines.treatment).toBeGreaterThanOrEqual(0.65);
  });

  it("not when nothing was treated", async () => {
    const lines = await generateScore(getCase("uro-colic-district-01")!, ["any fever"]);
    expect(lines.outcome).toBeLessThan(1);
    expect(lines.treatment).toBeLessThan(0.65);
  });
});

describe("what a hospital can't do", () => {
  it("isn't asked about first", async () => {
    const { state, hidden } = await converse(getCase("gp-uti-phc-01")!, ["chest x-ray"]);
    expect(replies(state).join(" ")).toMatch(/isn't available/);
    expect(replies(state).join(" ")).not.toMatch(/PA, or AP/);
    expect(hidden.pendingOrders ?? []).toHaveLength(0);
  });

  it("is still asked about when sent privately", async () => {
    const { state } = await converse(getCase("gp-uti-phc-01")!, ["Send chest x-ray to a private lab"]);
    expect(replies(state).join(" ")).not.toMatch(/isn't available/);
  });
});

describe("from case report 52", () => {
  it("examining 'vital signs' gives the numbers", async () => {
    const { state } = await converse(getCase("resp-asthma-district-01")!, ["Examine general appearance and vital signs"]);
    expect(replies(state).join(" ")).toMatch(/SpO₂/);
  });

  it("days later the casualty's oxygen is long off", async () => {
    const { hidden } = await converse(getCase("uro-colic-district-01")!, ["oxygen face mask 6 l/min", "tamsulosin 0.4 mg hs for 5 days"]);
    expect(hidden.oxygenOn).toBeUndefined();
  });
});
