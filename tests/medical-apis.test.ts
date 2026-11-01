import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearMedicalCache, cypEnzymes, drugForms, drugReference, isicImages, nearestFormularyDrug, openIImages, resolveDrugName } from "@/engine/providers/medical-apis";

const reply = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;
const route = (table: [RegExp, unknown][]) =>
  vi.fn(async (url: string) => {
    const hit = table.find(([re]) => re.test(String(url)));
    return hit ? reply(hit[1]) : reply({}, false);
  });

beforeEach(clearMedicalCache);
afterEach(() => vi.unstubAllGlobals());

describe("drug names", () => {
  it("corrects a misspelling only to a drug it's nearly sure of", () => {
    expect(nearestFormularyDrug("Azithromicin")?.id).toBe("azithromycin");
    expect(nearestFormularyDrug("Isotroine")?.id).toBe("isotretinoin");
    expect(nearestFormularyDrug("banana")).toBeNull();
  });

  it("never takes RxNorm's far-off guess", async () => {
    vi.stubGlobal("fetch", route([[/approximateTerm/, { approximateGroup: { candidate: [{ rxcui: "223034", score: "4.1", name: "ISOTEIN HN" }] } }]]));
    expect(await resolveDrugName("Isotreen")).toBeNull();
  });

  it("takes a close, high-scoring RxNorm match to its generic", async () => {
    vi.stubGlobal("fetch", route([
      [/approximateTerm/, { approximateGroup: { candidate: [{ rxcui: "999", score: "9.5", name: "Zzzdrug" }] } }],
      [/related\.json/, { relatedGroup: { conceptGroup: [{ tty: "IN", conceptProperties: [{ name: "zzzgeneric" }] }] } }],
    ]));
    expect(await resolveDrugName("Zzzdrugg")).toMatchObject({ generic: "zzzgeneric", source: "rxnorm" });
  });

  it("carries on when a service is down", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    expect(await resolveDrugName("Qqqqqqq")).toBeNull();
    expect(await drugForms("x")).toBeNull();
    expect(await cypEnzymes("x")).toBeNull();
    expect(await drugReference("x")).toBe("");
  });
});

describe("references", () => {
  it("reads routes and strengths", async () => {
    vi.stubGlobal("fetch", route([[/rxterms/, [1, ["ISOtretinoin (Oral Pill)"], { STRENGTHS_AND_FORMS: [["10 mg Cap", "20 mg Cap"]] }]]]));
    expect(await drugForms("isotretinoin")).toEqual({ routes: ["Oral Pill"], strengths: ["10 mg Cap", "20 mg Cap"] });
  });

  it("frames reference data as facts, not instructions", async () => {
    vi.stubGlobal("fetch", route([[/rxterms/, [1, ["Foo (Oral Pill)"], {}]]]));
    expect(await drugReference("foo")).toMatch(/not instructions/);
  });
});

describe("pictures keep to clearly free licences", () => {
  it("Open-i: leaves out non-commercial papers", async () => {
    const list = [
      { ccLicense: "by", imgLarge: "/a.png", authors: "A", pmc_url: "http://x/1", image: { caption: "chest x-ray" } },
      { ccLicense: "by-nc", imgLarge: "/b.png" },
      { imgLarge: "/c.png" },
    ];
    vi.stubGlobal("fetch", route([[/openi/, { list }]]));
    const found = await openIImages("pneumothorax");
    expect(found.map((f) => f.url)).toEqual(["https://openi.nlm.nih.gov/a.png"]);
    expect(found[0]!.credit.license).toBe("CC BY");
  });

  it("ISIC: only CC0 and CC BY, and only what it covers", async () => {
    const results = [
      { isic_id: "1", copyright_license: "CC-0", files: { full: { url: "u1" } } },
      { isic_id: "2", copyright_license: "CC-BY-NC", files: { full: { url: "u2" } } },
    ];
    vi.stubGlobal("fetch", route([[/isic-archive/, { results }]]));
    expect((await isicImages("melanoma of the back")).map((f) => f.url)).toEqual(["u1"]);
    expect(await isicImages("psoriasis")).toEqual([]);
  });
});
