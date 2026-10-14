import { describe, expect, it } from "vitest";

import { defaultVitals, saneBody } from "@/engine/catalog";
import { cleanVitals } from "@/engine/providers/openai";

describe("height and weight a person could really have", () => {
  it("a 40-year-old man is never 102 cm; a child gets a child's size", () => {
    const man = { age: 40, sex: "Male" as const, city: "Pune" };
    const v = defaultVitals(man);
    v.height = { key: "height", value: "102" };
    saneBody(man, v);
    expect(Number(v.height.value)).toBe(170);
    const kid = defaultVitals({ age: 8, sex: "Male", city: "Nashik" });
    expect(Number(kid.height.value)).toBeGreaterThan(115);
    expect(Number(kid.height.value)).toBeLessThan(135);
    expect(Number(kid.weight.value)).toBeLessThan(30);
  });

  it("heights written in feet and inches or metres become centimetres", () => {
    expect(cleanVitals({ height: "5'7\"" }).height).toBe("170");
    expect(cleanVitals({ height: "5 ft 10 in" }).height).toBe("178");
    expect(cleanVitals({ height: "1.72 m" }).height).toBe("172");
    expect(cleanVitals({ height: "168 cm" }).height).toBe("168");
  });
});
