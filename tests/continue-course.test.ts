import { describe, expect, it } from "vitest";

import { ALL_CASES } from "@/engine/cases";
import { formularyDrug } from "@/engine/formulary";
import { continuedCourse } from "@/engine/simulator";

const adhf = ALL_CASES.find((c) => c.id.startsWith("em-adhf"))!;

describe("continue a medicine", () => {
  it("paracetamol started for a fever is for as long as it's needed", () => {
    expect(continuedCourse(adhf, formularyDrug("paracetamol")!, "continue paracetamol 650 mg qid")).toBe("as needed");
  });
  it("a home medicine goes on", () => {
    expect(continuedCourse(adhf, formularyDrug("metformin")!, "continue metformin 500 mg bd")).toBeUndefined();
  });
  it("a long-term treatment goes on, even if started today", () => {
    expect(continuedCourse(adhf, formularyDrug("amlodipine")!, "continue amlodipine 5 mg od")).toBeUndefined();
  });
  it("saying long term means long term", () => {
    expect(continuedCourse(adhf, formularyDrug("paracetamol")!, "paracetamol long term")).toBeUndefined();
  });
});
