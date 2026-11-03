import { describe, expect, it } from "vitest";

import { ALL_CASES } from "@/engine/cases";
import { spokenLine, type SpeakerState } from "@/engine/spoken";

const calm: SpeakerState = { relative: false, aboutThem: (t) => t.replace("I don't", "He doesn't").replace("I haven't", "He hasn't") };

describe("how patients say it", () => {
  it.each([
    ["No sugar, BP or asthma.", "No doctor, I don't have sugar, high BP or asthma."],
    ["No allergies that I know of.", "I don't have any allergies that I know of."],
    ["No allergies, doctor.", "I don't have any allergies, doctor."],
    ["No alcohol or drugs, no smoking.", "I don't drink, smoke or take drugs."],
    ["No fever.", "I haven't had any fever."],
    ["No cough, burning urine, loose stools or rash.", "I haven't had any cough, burning urine, loose stools or rash."],
    ["No labour pains yet.", "I haven't had any labour pains yet."],
    ["No tablets.", "I'm not taking any tablets."],
    ["No glasses.", "I don't wear glasses."],
    ["No pets.", "We don't keep any pets."],
  ])("%s", (raw, said) => expect(spokenLine([raw], calm)).toBe(said));

  it("leaves real sentences alone", () => {
    for (const s of ["No, doctor.", "No one at home has this.", "No medicine helped.", "It started two days ago."]) expect(spokenLine([s], calm)).toBe(s);
  });

  it("a relative says it of the patient", () => {
    expect(spokenLine(["No fever."], { ...calm, relative: true })).toBe("He hasn't had any fever.");
  });

  it("a breathless patient says it in pieces", () => {
    const said = spokenLine(["It started yesterday. It's getting worse."], { ...calm, spo2: 86 });
    expect(said).toContain("It started yesterday… It's getting worse.");
  });

  it("joins two answers in one breath", () => {
    expect(spokenLine(["Here in my upper stomach.", "It started two days ago."], calm)).toMatch(/^Here in my upper stomach\. (?:And|Also,) it started two days ago\.$/);
  });

  it("no written case's reply stays a bare list", () => {
    const left: string[] = [];
    for (const c of ALL_CASES) for (const h of c.history) {
      const said = spokenLine([h.reply], calm);
      for (const s of said.split(/(?<=[.!?…])\s+/)) if (/^No [a-z]/i.test(s) && !/^No (?:one|idea|doctor)\b/i.test(s) && !/\b(?:is|are|was|were|has|have|had|helps?|helped|works?|worked|comes?|came|went|ever|changed|better|worse|relief|change|difference|need|more|effect|help)\b/i.test(s)) left.push(s);
    }
    expect(left).toEqual([]);
  });
});
