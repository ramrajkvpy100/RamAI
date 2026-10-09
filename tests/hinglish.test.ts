import { describe, expect, it } from "vitest";

import { ALL_CASES } from "@/engine/cases";
import { emAdhf } from "@/engine/cases/em-adhf";
import { phAcs } from "@/engine/cases/ph-acs";
import { localizeState, toHinglish } from "@/engine/i18n/hinglish";
import { CASE_LINES } from "@/engine/i18n/hinglish-lines";
import { hazardLibrary } from "@/engine/physiology";

import { play } from "./helpers";

const SPOKEN = new Set(["patient", "attendant"]);

describe("Hinglish", () => {
  it("has a translation for every line a patient or family member can say", () => {
    const missing: string[] = [];
    for (const def of ALL_CASES) {
      const lines = CASE_LINES[def.id] ?? {};
      const global = CASE_LINES["global-templates"] ?? {};
      const check = (text?: string) => {
        if (text && !lines[text] && !global[text]) missing.push(`${def.id}: ${text}`);
      };
      for (const b of def.opening) if (SPOKEN.has(b.role)) check(b.text);
      for (const h of def.history) check(h.reply);
      for (const e of def.exam) check(e.patientReaction);
      for (const h of hazardLibrary(def).values()) {
        for (const st of [...h.stages, ...h.recovery]) {
          if (st.observation && SPOKEN.has(st.observation.role)) check(st.observation.text);
          check(st.patientSays);
        }
      }
      for (const r of def.therapeutics) for (const x of r.response ?? []) if (SPOKEN.has(x.role)) check(x.text);
      for (const f of def.followUp) for (const l of f.lines) if (SPOKEN.has(l.role)) check(l.text);
      check(def.onResponse?.says);
      check(def.onResponse?.patientSays);
    }
    expect(missing).toEqual([]);
  });

  it("translates the lines the engine composes, with the speaker's gender", () => {
    const man = phAcs.patient;
    const woman = emAdhf.patient;
    expect(toHinglish("The machine shows BP 150/94, pulse 98.", phAcs.id, "attendant", man)).toBe("Machine mein BP 150/94, pulse 98 aa raha hai.");
    expect(toHinglish("Okay, doctor — he's taking the aspirin now.", phAcs.id, "attendant", man)).toBe("Theek hai doctor — abhi aspirin le rahe hain.");
    expect(toHinglish("Okay, doctor. I'll do that.", emAdhf.id, "patient", woman)).toBe("Theek hai doctor, main aisa hi karungi.");
    expect(toHinglish("Okay, doctor. I'll do that.", phAcs.id, "patient", man)).toBe("Theek hai doctor, main aisa hi karunga.");
    expect(toHinglish("We only have a BP machine and a sugar machine at home, doctor — I can't check the rest.", phAcs.id, "attendant", man)).toBe(
      "Ghar pe sirf BP machine aur sugar machine hai, doctor — baaki check nahi kar sakte.",
    );
    expect(toHinglish("I'm 56, doctor.", phAcs.id, "patient", man)).toBe("56 saal, doctor.");
  });

  it("changes only what the patient and family say", () => {
    const { state } = play(emAdhf, ["What happened?", "Attach cardiac monitor"]);
    const hi = localizeState(state, emAdhf.id, "hinglish");
    expect(hi.lang).toBe("hinglish");
    const pairs = state.messages.map((m, i) => [m, hi.messages[i]!] as const);
    for (const [en, h] of pairs) {
      if ((en.role === "patient" || en.role === "attendant") && en.kind === "speech") expect(h.text).not.toBe(en.text);
      else expect(h.text).toBe(en.text);
    }
    expect(localizeState(state, emAdhf.id, "en").messages).toEqual(state.messages);
  });
});

describe("condition history", () => {
  it("records every change in the patient's status, collapsing same-minute changes", () => {
    const { state } = play(emAdhf, ["Sit her up, start oxygen, attach monitor", "Give furosemide 40 mg IV", "Start BiPAP", "Wait 40 minutes"]);
    expect(state.statusHistory[0]).toEqual({ at: 0, status: "deteriorating" });
    expect(state.statusHistory.length).toBeGreaterThan(1);
    expect(state.statusHistory[state.statusHistory.length - 1]!.status).toBe(state.patientStatus);
    const times = state.statusHistory.map((h) => h.at);
    expect(new Set(times).size).toBe(times.length);
  });
});
