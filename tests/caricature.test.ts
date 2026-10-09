import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DoctorFigure, FamilyFigure, NurseFigure, PatientFigure } from "@/components/game/caricature";
import type { PatientIdentity, PatientStatus } from "@/engine/types";

const STATUSES: PatientStatus[] = ["recovered", "improving", "stable", "guarded", "deteriorating", "critical", "deceased"];

function patient(i: number): PatientIdentity {
  return { name: "Test", age: 18 + (i % 70), sex: i % 2 ? "Female" : "Male", city: "Delhi", occupation: "Teacher", context: "Emergency" };
}

describe("caricatures", () => {
  it("draw a complete figure for every seed, mood and speaker", () => {
    for (let i = 0; i < 400; i++) {
      const seed = `session-${i}-${(i * 2654435761) >>> 0}`;
      const status = STATUSES[i % STATUSES.length]!;
      const markup = [
        renderToStaticMarkup(createElement(PatientFigure, { patient: patient(i), status, seed, fever: i % 3 === 0, breathless: i % 4 === 0 })),
        renderToStaticMarkup(createElement(FamilyFigure, { seed, patientStatus: status, onPhone: i % 2 === 0 })),
      ].join("");
      expect(markup).not.toMatch(/undefined|NaN/);
    }
  });

  it("dresses the doctor for every rank tier", () => {
    for (let tier = 1; tier <= 10; tier++) {
      expect(renderToStaticMarkup(createElement(DoctorFigure, { tier }))).not.toMatch(/undefined|NaN/);
    }
    expect(renderToStaticMarkup(createElement(NurseFigure, { alert: true }))).toContain("<svg");
  });
});
