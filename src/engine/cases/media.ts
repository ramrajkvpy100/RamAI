/**
 * Media presets for case authoring.
 *
 * Clinical images are parameterised specs rendered as vector graphics in the
 * client. Captions carry acquisition metadata only — never an interpretation.
 * To use licensed photography instead, set `src` on the MediaAsset.
 */

import type { DermLesionLayer, DermSpec, EcgSpec, MediaAsset, RadiographFeature, RadiographSpec } from "../types";

export function photo(spec: Omit<DermSpec, "kind">, alt: string, caption: string): MediaAsset {
  return { spec: { kind: "derm", ...spec }, alt, caption };
}

export function ecg(spec: Omit<EcgSpec, "kind">, alt: string, caption = "12-lead · 25 mm/s · 10 mm/mV"): MediaAsset {
  return { spec: { kind: "ecg", ...spec }, alt, caption };
}

export function radiograph(kind: RadiographSpec["kind"], view: string, features: RadiographFeature[], seed: number, alt: string, caption: string): MediaAsset {
  return { spec: { kind, view, features, seed }, alt, caption };
}

/* -------------------------------------------------------------------------- */
/* Acne severity — counts follow standard global-assessment definitions        */
/* -------------------------------------------------------------------------- */

export type AcneBand = "mild" | "moderate" | "moderately-severe" | "severe" | "scarring";

export function acneLesions(band: AcneBand): DermLesionLayer[] {
  switch (band) {
    case "mild":
      return [
        { morphology: "comedone-closed", count: 18, size: 1.1 },
        { morphology: "comedone-open", count: 9, size: 1 },
        { morphology: "papule", count: 4, size: 2.2 },
        { morphology: "pustule", count: 1, size: 2 },
      ];
    case "moderate":
      return [
        { morphology: "comedone-closed", count: 20, size: 1.1 },
        { morphology: "comedone-open", count: 13, size: 1 },
        { morphology: "papule", count: 18, size: 2.6 },
        { morphology: "pustule", count: 9, size: 2.3 },
        { morphology: "hyperpigment", count: 9, size: 2.4 },
      ];
    case "moderately-severe":
      return [
        { morphology: "erythema", count: 3, size: 16, confluence: 0.25 },
        { morphology: "comedone-closed", count: 14, size: 1.1 },
        { morphology: "comedone-open", count: 9, size: 1 },
        { morphology: "papule", count: 30, size: 2.8 },
        { morphology: "pustule", count: 16, size: 2.5 },
        { morphology: "nodule", count: 3, size: 5 },
        { morphology: "hyperpigment", count: 10, size: 2.6 },
      ];
    case "severe":
      return [
        { morphology: "erythema", count: 5, size: 20, confluence: 0.4 },
        { morphology: "papule", count: 24, size: 3 },
        { morphology: "pustule", count: 14, size: 2.6 },
        { morphology: "nodule", count: 9, size: 5.5 },
        { morphology: "cyst", count: 4, size: 6.5 },
        { morphology: "scar-atrophic", count: 7, size: 2.4 },
        { morphology: "hyperpigment", count: 12, size: 2.8 },
      ];
    case "scarring":
      return [
        { morphology: "scar-atrophic", count: 26, size: 2.6 },
        { morphology: "hyperpigment", count: 14, size: 2.6 },
        { morphology: "papule", count: 3, size: 2.2 },
      ];
  }
}

export function acnePhoto(band: AcneBand, seed: number, caption = "Left cheek · close-up"): MediaAsset {
  return photo({ site: "cheek", phototype: 4, lesions: acneLesions(band), seed }, "Close-up clinical photograph of facial skin on the left cheek.", caption);
}
