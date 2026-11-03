import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ALL_CASES } from "@/engine/cases";
import { orderReplies, PERIOD_PROMPT } from "@/engine/orders";
import { substituteFor } from "@/engine/therapeutic-classes";
import { formularyDrug } from "@/engine/formulary";
import { createHiddenState } from "@/engine/simulator";
import { instantAnswer } from "@/engine/spoken-history";

import { converse } from "./helpers";

const C = (id: string) => ALL_CASES.find((c) => c.id.startsWith(id))!;
const said = (messages: { role: string; text: string }[]) => messages.map((m) => `${m.role}: ${m.text}`).join("\n");

describe("every medicine asks for its time period", () => {
  beforeAll(() => { PERIOD_PROMPT.on = true; });
  afterAll(() => { PERIOD_PROMPT.on = false; });

  it("asks before the clock moves, with chips, then jumps by what was chosen", async () => {
    const first = await converse(C("gp-uti"), ["amoxicillin 500 mg tds"]);
    expect(said(first.state.messages)).toMatch(/For what time period would you like to give Amoxicillin/);
    const waiting = first.hidden.pendingOrders.find((o) => o.needs.includes("period"))!;
    expect(orderReplies(waiting).map((r) => r.text)).toEqual(["Single stat dose", "3 days", "5 days", "7 days", "2 weeks", "4 weeks", "8 weeks"]);
    const clock = first.hidden.clock;
    const done = await converse(C("gp-uti"), ["amoxicillin 500 mg tds", "5 days"]);
    expect(done.hidden.pendingOrders.filter((o) => o.needs.includes("period"))).toHaveLength(0);
    expect(done.hidden.clock - clock).toBeGreaterThanOrEqual(5 * 1440);
    expect(said(done.state.messages)).toMatch(/5 days/);
  });

  it("IV drugs get acute chips; saying 'stat' doesn't ask", async () => {
    const asked = await converse(C("em-adhf"), ["furosemide 40 mg iv"]);
    expect(orderReplies(asked.hidden.pendingOrders.find((o) => o.needs.includes("period"))!).map((r) => r.text)).toEqual(["Stat", "Over 30 min", "1 hour", "4 hours", "12 hours", "24 hours"]);
    const stat = await converse(C("em-adhf"), ["furosemide 40 mg iv stat"]);
    expect(stat.hidden.drugs.some((d) => d.drugId === "furosemide")).toBe(true);
  });

  it("one tap answers every drug in the same message", async () => {
    const { hidden } = await converse(C("em-adhf"), ["furosemide 40 mg iv and pantoprazole 40 mg iv", "Stat"]);
    expect(hidden.drugs.map((d) => d.drugId)).toEqual(expect.arrayContaining(["furosemide", "pantoprazole"]));
    expect(hidden.pendingOrders.filter((o) => o.needs.includes("period"))).toHaveLength(0);
  });
});

describe("the last 5 hours' reports", () => {
  it("cefuroxime for cystitis counts, second-line, in a case that only named nitrofurantoin", () => {
    const def = { ...C("gp-uti"), therapeutics: C("gp-uti").therapeutics.filter((r) => r.id !== "cephalosporin") };
    expect(substituteFor(def, formularyDrug("cefuroxime")!, "PO")?.substitute.tier).toBe("second-line");
  });

  it("'100 tabs of it' means the last medicine, and is queried", async () => {
    const { state } = await converse(C("gp-uti"), ["cefuroxime 500 mg bd for 5 days", "Take 100 tabs of it"]);
    expect(said(state.messages)).not.toMatch(/Which medicine, dose and route/);
    expect(said(state.messages)).toMatch(/50000|50 g|cefuroxime/i);
  });

  it("a fixed combination stays one order when its frequency changes", async () => {
    const { hidden } = await converse(C("derm-acne"), ["use epiduo gel at night for 1 month", "use it thrice daily for 1 month"]);
    expect(new Set(hidden.drugs.map((d) => d.generic)).size).toBe(1);
  });

  it("a drawing is never called a photograph", () => {
    for (const id of ["derm-acne", "derm-tinea", "derm-psoriasis", "derm-melasma"]) expect(JSON.stringify(C(id))).not.toMatch(/Clinical photograph/);
  });
});

describe("instant patient answers", () => {
  const hidden = (id: string) => createHiddenState(C(id));
  it("says no only when the case can't contradict it", () => {
    expect(instantAnswer("any palpitations?", C("gi-ulcer"), hidden("gi-ulcer"))).toMatch(/^No\b/);
    // Fever is what enteric fever is: never a table's "no".
    expect(instantAnswer("any fever?", { ...C("gi-ulcer"), truth: { ...C("gi-ulcer").truth, diagnosis: "Enteric fever" } }, hidden("gi-ulcer"))).toBeNull();
    // Two topics at once may need different answers.
    expect(instantAnswer("any fever or rash?", C("gi-ulcer"), hidden("gi-ulcer"))).toBeNull();
  });
  it("answers a check-in from how the patient really is", () => {
    const h = hidden("em-adhf");
    h.status = "improving";
    expect(instantAnswer("how are you feeling now?", C("em-adhf"), h)).toMatch(/better|easing/i);
    h.status = "deteriorating";
    expect(instantAnswer("how are you feeling now?", C("em-adhf"), h)).toMatch(/worse|harder/i);
  });
});
