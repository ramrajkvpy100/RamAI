import { describe, expect, it } from "vitest";

import { dermAcne } from "@/engine/cases/derm-acne";
import { medPad } from "@/engine/cases/med-pad";
import { surgAppendicitis } from "@/engine/cases/surg-appendicitis";
import { resolveIntents } from "@/engine/intent";

const ctx = (def = surgAppendicitis, setting = def.setting) => ({ def, setting, weightKg: 64 });

describe("intent resolution — the spec's example phrases", () => {
  it("“Any comorbidities?” → past history", () => {
    const [i] = resolveIntents("Any comorbidities?", ctx(medPad));
    expect(i).toMatchObject({ kind: "history", targetId: "past" });
  });

  it("“How long has the pain been there?” → history of the pain", () => {
    const [i] = resolveIntents("How long has the pain been there?", ctx());
    expect(i).toMatchObject({ kind: "history", targetId: "site" });
  });

  it("“Check BP and RBS.” → two vitals", () => {
    const out = resolveIntents("Check BP and RBS.", ctx(medPad));
    expect(out.map((i) => i.targetId)).toEqual(["bp", "rbs"]);
    expect(out.every((i) => i.kind === "vitals")).toBe(true);
  });

  it("“Examine McBurney's point.” → case-specific sign", () => {
    const [i] = resolveIntents("Examine McBurney's point.", ctx());
    expect(i).toMatchObject({ kind: "exam", targetId: "mcburney" });
  });

  it("“Order CBC.” → investigation", () => {
    const [i] = resolveIntents("Order CBC.", ctx());
    expect(i).toMatchObject({ kind: "investigation", targetId: "cbc" });
  });

  it("“Give paracetamol 650 mg PO.” → drug with parsed dose and route", () => {
    const [i] = resolveIntents("Give paracetamol 650 mg PO.", ctx());
    expect(i).toMatchObject({ kind: "drug", targetId: "paracetamol" });
    expect(i?.payload).toMatchObject({ amount: 650, unit: "mg", route: "PO", mode: "given" });
  });

  it("“Do laparoscopic appendicectomy.” → procedure rule", () => {
    const [i] = resolveIntents("Do laparoscopic appendicectomy.", ctx());
    expect(i).toMatchObject({ kind: "action", targetId: "appendicectomy" });
  });

  it("“Follow up after 2 weeks.” → 14 days", () => {
    const [i] = resolveIntents("Follow up after 2 weeks.", ctx(dermAcne));
    expect(i).toMatchObject({ kind: "followup", payload: { days: 14 } });
  });

  it("“Case close.” → close", () => {
    expect(resolveIntents("Case close.", ctx())).toEqual([expect.objectContaining({ kind: "close" })]);
  });

  it("“Give 2 litres IV NS” → 2000 mL crystalloid, given now", () => {
    const [i] = resolveIntents("Give 2 litres IV NS", ctx());
    expect(i).toMatchObject({ kind: "drug", targetId: "ns" });
    expect(i?.payload).toMatchObject({ volumeMl: 2000, route: "IV", mode: "given" });
  });
});

describe("intent resolution — Indian clinical English", () => {
  it("“Do you have sugar?” is history, “check sugar” is a measurement", () => {
    expect(resolveIntents("Do you have sugar?", ctx(medPad))[0]).toMatchObject({ kind: "history", targetId: "past" });
    expect(resolveIntents("check sugar", ctx(medPad))[0]).toMatchObject({ kind: "vitals", targetId: "rbs" });
  });

  it("multi-topic questions answer each topic", () => {
    const out = resolveIntents("Any fever or vomiting?", ctx());
    expect(out.map((i) => i.targetId).sort()).toEqual(["fever", "vomiting"]);
  });

  it("orders several investigations in one breath", () => {
    const out = resolveIntents("Send CBC, CRP, urine routine and USG abdomen", ctx());
    expect(out.map((i) => i.targetId)).toEqual(["cbc", "crp", "urine-rm", "usg-abdomen"]);
  });

  it("“k/c/o” and “h/o” are expanded", () => {
    expect(resolveIntents("Any h/o diabetes or BP?", ctx(medPad))[0]).toMatchObject({ kind: "history", targetId: "past" });
  });

  it("diagnosis and closure in one message", () => {
    const out = resolveIntents("Final diagnosis: acute appendicitis. Case close.", ctx());
    expect(out[0]).toMatchObject({ kind: "diagnosis", payload: { text: "acute appendicitis" } });
    expect(out[out.length - 1]).toMatchObject({ kind: "close" });
  });

  it("stopping a drug is not prescribing it", () => {
    const [i] = resolveIntents("Stop the Betnovate cream", ctx(dermAcne));
    expect(i).toMatchObject({ kind: "action", targetId: "stop-steroid" });
  });

  it("OPD prescriptions default to take-home", () => {
    const [i] = resolveIntents("Tab doxycycline 100 mg OD for 8 weeks", ctx(dermAcne));
    expect(i?.payload).toMatchObject({ mode: "prescribed", frequency: "OD", duration: "8 weeks" });
  });

  it("counselling that mentions a body region is not an examination", () => {
    const out = resolveIntents("Sunscreen every morning. Don't pick the pimples.", ctx(dermAcne));
    expect(out.some((i) => i.kind === "exam")).toBe(false);
    expect(out.some((i) => i.targetId === "no-picking")).toBe(true);
  });

  it("a prescription duration does not trigger unrelated counselling", () => {
    const out = resolveIntents("Tab doxycycline 100 mg OD after food for 8 weeks", ctx(dermAcne));
    expect(out.map((i) => i.targetId)).toEqual(["doxycycline"]);
  });

  it("a bare sign name is still an examination", () => {
    expect(resolveIntents("McBurney's point", ctx())[0]).toMatchObject({ kind: "exam", targetId: "mcburney" });
  });
});

