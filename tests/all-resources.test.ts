import { describe, expect, it } from "vitest";

import { emViperPhc } from "@/engine/cases/em-viper-phc";
import { applyEffects } from "@/engine/reducer";
import { runTurn } from "@/engine/simulator";

import { play } from "./helpers";

describe("all resources", () => {
  it("a PHC can't do an MRI brain; with all resources it can", () => {
    expect(play(emViperPhc, ["Order MRI brain"]).hidden.unavailable).toContain("mri-brain");
    const full = play({ ...emViperPhc, unlimited: true }, ["Order MRI brain"]);
    expect(full.hidden.unavailable).toHaveLength(0);
    expect(full.hidden.investigations.some((i) => i.defId === "mri-brain")).toBe(true);
  });

  it("a test the catalogue doesn't have is sent, and reports what the lab wrote", () => {
    const def = { ...emViperPhc, unlimited: true };
    const { hidden, state } = play(def, []);
    const rows = [{ analyte: "Anti-CCP", value: "4", unit: "U/mL", reference: "<17", flag: "normal" }];
    const fx = runTurn(def, hidden, { id: "a1", at: 0, raw: "anti ccp", intents: [{ kind: "investigation", targetId: "adhoc:Anti-CCP antibodies", phrase: "anti ccp", matched: true }], generated: { "lab:adhoc:Anti-CCP antibodies": JSON.stringify({ rows }) } });
    const next = applyEffects(state, fx);
    const inv = hidden.investigations.find((i) => i.defId === "adhoc:Anti-CCP antibodies");
    expect(inv?.result.rows?.[0]?.value).toBe("4");
    expect(next.investigations.some((i) => i.name === "Anti-CCP antibodies")).toBe(true);
  });

  it("without all resources, an unknown test isn't invented", () => {
    const { hidden, state } = play(emViperPhc, []);
    runTurn(emViperPhc, hidden, { id: "a1", at: 0, raw: "x", intents: [{ kind: "investigation", targetId: "adhoc:Anti-CCP", phrase: "x", matched: true }] });
    expect(hidden.investigations).toHaveLength(0);
    expect(state).toBeDefined();
  });
});
