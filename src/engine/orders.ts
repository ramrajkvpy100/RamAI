/**
 * Orders as the nurse, the radiographer and the pharmacist take them.
 *
 * An order that leaves out what's needed to carry it out is asked about, not
 * guessed: a drug with no dose or route, a drip with no volume or rate, a
 * slow-infusion drug with no rate, a prescription with no frequency or
 * duration, an X-ray with no part or view, a CT with no word on contrast,
 * oxygen with no device or flow. The doctor's next words complete it.
 *
 * Pure functions, shared by the rule-based reader (which turns the doctor's
 * answer into the completed order) and the simulator (which asks).
 */

import { formularyDrug, parseOrderDetails, routesFor, type FormularyDrug } from "./formulary";
import type { DrugRoute } from "./types";

export type OrderNeed = "dose" | "volume" | "route" | "rate" | "frequency" | "duration" | "region" | "view" | "contrast" | "device" | "flow" | "tests";

type Payload = Record<string, string | number | boolean>;

/** An order waiting for its missing details. */
export interface PendingOrder {
  /** "confirm": a complete order the nurse queried because it could kill — it waits for the doctor to say so again. */
  kind: "drug" | "investigation" | "oxygen" | "confirm";
  /** Formulary drug id, investigation id (or a generic kind: "xray", "ct", "usg", "mri", "blood"), or "oxygen". */
  targetId: string;
  payload: Payload;
  /** The doctor's words, as first said. */
  phrase: string;
  needs: OrderNeed[];
}

export const ROUTE_WORDS: Partial<Record<DrugRoute, string>> = { PO: "oral", IV: "IV", IM: "IM", SC: "SC", SL: "sublingual", PR: "rectal", TOP: "topical", INH: "inhaled", NEB: "nebulised", IN: "intranasal", "OD-eye": "eye drops" };

/** "a, b or c" */
const listOr = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} or ${xs[xs.length - 1]}`);
/** "a, b, and c" — what's asked for, in one breath. */
const listAnd = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")}, and ${xs[xs.length - 1]}`);

/** "Give the usual dose", "standard bolus", "as per protocol": the formulary's usual order. */
export const USUAL_RE = /\b(?:usual|standard|normal|routine|regular|default|recommended)\s+(?:adult\s+)?(?:dose|dosing|dosage|bolus|rate|regimen)\b|\bas usual\b|\b(?:as )?per protocol\b|\bprotocol dose\b/i;

/* -------------------------------------------------------------------------- */
/* Drugs                                                                       */
/* -------------------------------------------------------------------------- */

/** Drugs that are never pushed: a rate has to be said. */
const RATE_DRUGS = new Set(["potassium-chloride", "magnesium-sulphate", "calcium-gluconate", "amiodarone", "phenytoin", "phenobarbitone", "vancomycin", "asv", "acetylcysteine", "fcm", "haem-arginate", "cyclophosphamide"]);
/** Applied or given as a standard amount — no dose to ask for. */
const NO_DOSE = ["sunscreen", "emollient", "cleanser", "vaccine"];

const said = (p: Payload, k: string) => p[k] !== undefined && p[k] !== "";

/** What a drug order is missing before it can be carried out. */
export function drugNeeds(drug: FormularyDrug, p: Payload, mode: "given" | "prescribed"): OrderNeed[] {
  if (p.usual === true) return [];
  const needs: OrderNeed[] = [];
  const routes = routesFor(drug);
  if (drug.fluid) {
    // A drip set at a rate ("100 mL/h") is a bag run at that rate.
    if (said(p, "rateMlH")) return needs;
    if (!said(p, "volumeMl") && !said(p, "amount")) needs.push("volume");
    if (mode === "given" && !said(p, "overMin")) needs.push("rate");
    if (mode === "prescribed" && !said(p, "frequency") && !said(p, "overMin")) needs.push("rate");
    return needs;
  }
  const appliedAsIs = (drug.route === "TOP" && routes.length === 1) || drug.classes.some((c) => NO_DOSE.includes(c));
  if (!appliedAsIs && !said(p, "amount") && !said(p, "dose") && !said(p, "volumeMl")) needs.push("dose");
  if (!said(p, "route")) {
    // A take-home prescription is by mouth when the drug can be; otherwise the route has to be said.
    const choices = mode === "prescribed" ? routes.filter((r) => !["IV", "IM", "SC"].includes(r)) : routes;
    if (choices.length > 1 && !(mode === "prescribed" && choices.includes("PO"))) needs.push("route");
  }
  if (mode === "given" && RATE_DRUGS.has(drug.id) && !said(p, "overMin") && (said(p, "route") ? p.route === "IV" : drug.route === "IV")) needs.push("rate");
  if (mode === "prescribed" && !drug.classes.some((c) => NO_DOSE.includes(c))) {
    if (!said(p, "frequency")) needs.push("frequency");
    // A course has a length — though not a cream applied till review, nor a tablet kept for when it's needed.
    const asNeeded = typeof p.frequency === "string" && /^(SOS|stat)$/i.test(p.frequency);
    if (!said(p, "duration") && !asNeeded && drug.route !== "TOP") needs.push("duration");
  }
  return needs;
}

/** The question, as whoever takes the order would put it: "Paracetamol — what dose, and oral, IV or rectal, doctor?" */
export function drugQuestion(drug: FormularyDrug, needs: OrderNeed[], p: Payload, polite: boolean): string {
  let name = (drug.generic.split(/\s[(]/)[0] ?? drug.generic).trim();
  // A strength the doctor said ("hydroquinone 4%") replaces the stock one in the name — never "Hydroquinone 2% cream 4 %".
  let dose = typeof p.dose === "string" ? p.dose : undefined;
  if (p.unit === "%" && typeof p.amount === "number" && /\d[\d.]*\s*%/.test(name)) {
    name = name.replace(/\d[\d.]*\s*%/, `${p.amount}%`);
    dose = undefined;
  }
  const known = [dose, typeof p.route === "string" ? ROUTE_WORDS[p.route as DrugRoute] : undefined].filter(Boolean).join(" ");
  const routes = routesFor(drug).map((r) => ROUTE_WORDS[r] ?? r);
  const asks: string[] = [];
  if (needs.includes("volume")) asks.push("how much");
  if (needs.includes("dose")) asks.push("what dose");
  if (needs.includes("route")) asks.push(listOr(routes));
  if (needs.includes("rate")) asks.push("over how long");
  if (needs.includes("frequency")) asks.push("how often");
  if (needs.includes("duration")) asks.push("for how long");
  return `${name}${known ? ` ${known}` : ""} — ${listAnd(asks)}${polite ? ", doctor" : ""}?`;
}

/** How a relative at home says a route. */
const LAY_ROUTE: Partial<Record<DrugRoute, string>> = { PO: "by mouth", SL: "under the tongue", PR: "in the back passage", INH: "by inhaler", NEB: "by nebuliser", TOP: "on the skin", IN: "in the nose" };

/** On the phone, the relative asks: "Doctor, how much paracetamol should we give, and how often?" */
export function phoneDrugQuestion(drug: FormularyDrug, needs: OrderNeed[]): string {
  const name = (drug.generic.split(/\s[(]/)[0] ?? drug.generic).trim().toLowerCase();
  const more = `${needs.includes("frequency") ? ", and how often" : ""}${needs.includes("duration") ? ", and for how many days" : ""}`;
  if (!needs.includes("dose") && needs.includes("route")) {
    const ways = routesFor(drug).map((r) => LAY_ROUTE[r]).filter((w): w is string => !!w);
    if (ways.length > 1) return `Doctor, should we give the ${name} ${listOr(ways)}${more}?`;
  }
  if (!needs.includes("dose") && needs.includes("frequency")) return `Doctor, how often should we give the ${name}${needs.includes("duration") ? ", and for how many days" : ""}?`;
  if (!needs.includes("dose") && needs.includes("duration")) return `Doctor, for how many days should we give the ${name}?`;
  return `Doctor, how much ${name} should we give${more}?`;
}

/** The usual order, from the formulary, for whatever the doctor left to it ("give the usual dose"). */
/**
 * Children's doses by weight (standard paediatric references): per kg, capped at the adult dose.
 * `round`: to a practical amount.
 */
const PER_KG: Record<string, { perKg: number; unit: string; max: number; round: number }> = {
  paracetamol: { perKg: 15, unit: "mg", max: 1000, round: 10 },
  ibuprofen: { perKg: 10, unit: "mg", max: 400, round: 10 },
  amoxicillin: { perKg: 25, unit: "mg", max: 1000, round: 25 },
  "amoxicillin-clavulanate": { perKg: 25, unit: "mg", max: 875, round: 25 },
  ceftriaxone: { perKg: 50, unit: "mg", max: 2000, round: 50 },
  cefixime: { perKg: 4, unit: "mg", max: 200, round: 5 },
  azithromycin: { perKg: 10, unit: "mg", max: 500, round: 10 },
  ampicillin: { perKg: 50, unit: "mg", max: 2000, round: 50 },
  gentamicin: { perKg: 5, unit: "mg", max: 400, round: 5 },
  metronidazole: { perKg: 7.5, unit: "mg", max: 500, round: 5 },
  ondansetron: { perKg: 0.15, unit: "mg", max: 4, round: 0.5 },
  dexamethasone: { perKg: 0.15, unit: "mg", max: 8, round: 0.5 },
  prednisolone: { perKg: 1, unit: "mg", max: 40, round: 5 },
  adrenaline: { perKg: 0.01, unit: "mg", max: 0.5, round: 0.05 },
  diazepam: { perKg: 0.3, unit: "mg", max: 10, round: 0.5 },
  midazolam: { perKg: 0.2, unit: "mg", max: 10, round: 0.5 },
  phenytoin: { perKg: 20, unit: "mg", max: 1000, round: 10 },
  furosemide: { perKg: 1, unit: "mg", max: 40, round: 1 },
  morphine: { perKg: 0.1, unit: "mg", max: 5, round: 0.1 },
  artesunate: { perKg: 3, unit: "mg", max: 240, round: 5 },
  pantoprazole: { perKg: 1, unit: "mg", max: 40, round: 5 },
  omeprazole: { perKg: 1, unit: "mg", max: 20, round: 5 },
  ranitidine: { perKg: 2, unit: "mg", max: 150, round: 5 },
  cetirizine: { perKg: 0.25, unit: "mg", max: 10, round: 0.5 },
  "chlorpheniramine": { perKg: 0.1, unit: "mg", max: 4, round: 0.5 },
  salbutamol: { perKg: 0.15, unit: "mg", max: 5, round: 0.5 },
  hydrocortisone: { perKg: 4, unit: "mg", max: 200, round: 5 },
  "cefotaxime": { perKg: 50, unit: "mg", max: 2000, round: 50 },
  "vancomycin": { perKg: 15, unit: "mg", max: 1000, round: 10 },
  "acyclovir": { perKg: 10, unit: "mg", max: 800, round: 10 },
  "domperidone": { perKg: 0.25, unit: "mg", max: 10, round: 0.5 },
  "promethazine": { perKg: 0.25, unit: "mg", max: 25, round: 1 },
  "tramadol": { perKg: 1, unit: "mg", max: 50, round: 5 },
  "ketorolac": { perKg: 0.5, unit: "mg", max: 15, round: 1 },
  "diclofenac": { perKg: 1, unit: "mg", max: 50, round: 5 },
  "insulin-regular": { perKg: 0.1, unit: "units", max: 10, round: 0.5 },
  "mannitol": { perKg: 500, unit: "mg", max: 50000, round: 500 },
  "calcium-gluconate": { perKg: 100, unit: "mg", max: 2000, round: 50 },
  "doxycycline": { perKg: 2.2, unit: "mg", max: 100, round: 5 },
};

/**
 * A child's dose far above the usual for their weight — what the nurse says, or null.
 * (Above twice the usual per-kg dose, or above the adult maximum: the nurse checks.)
 */
export function childDoseConcern(drugId: string, amount: number | undefined, unit: string | undefined, weightKg: number): string | null {
  const r = PER_KG[drugId];
  if (!r || amount === undefined || !unit || !(weightKg > 0)) return null;
  const inUnit = unit === r.unit ? amount : unit === "g" && r.unit === "mg" ? amount * 1000 : unit === "mcg" && r.unit === "mg" ? amount / 1000 : unit === "mg" && r.unit === "units" ? null : null;
  if (inUnit === null) return null;
  const usual = Math.min(r.max, r.perKg * weightKg);
  if (inUnit <= usual * 2 && inUnit <= r.max * 1.1) return null;
  const perKg = inUnit / weightKg;
  const round = (n: number) => (n >= 10 ? Math.round(n) : Math.round(n * 10) / 10);
  return `For a ${round(weightKg)}-kg child that's ${round(perKg)} ${r.unit}/kg — the usual is about ${r.perKg} ${r.unit}/kg (${round(usual)} ${r.unit}).`;
}

/** Whether a standard per-kg dose is known for this drug. */
export const hasChildDose = (drugId: string) => PER_KG[drugId] !== undefined;

/** A child's weight-based dose of this drug, if there's a standard one: { amount, unit, dose text }. */
export function childDose(drugId: string, weightKg: number): { amount: number; unit: string; dose: string } | null {
  const r = PER_KG[drugId];
  if (!r || !(weightKg > 0)) return null;
  const raw = Math.min(r.max, r.perKg * weightKg);
  const amount = Math.max(r.round, Math.round(raw / r.round) * r.round);
  const nice = Number(amount.toFixed(2));
  return { amount: nice, unit: r.unit, dose: `${nice} ${r.unit} (${r.perKg} ${r.unit}/kg)` };
}

export function usualOrder(drug: FormularyDrug, p: Payload, mode: "given" | "prescribed", child?: { weightKg: number }): Payload {
  const out: Payload = { ...p };
  if (drug.fluid && child) {
    // A child's bolus: 20 mL/kg over 15–20 minutes.
    if (!said(out, "volumeMl")) out.volumeMl = Math.round((20 * child.weightKg) / 10) * 10;
    if (!said(out, "overMin")) out.overMin = 20;
    out.dose = `${out.volumeMl} mL (20 mL/kg)`;
    return out;
  }
  if (child && !said(out, "amount") && !said(out, "dose")) {
    const c = childDose(drug.id, child.weightKg);
    if (c) {
      out.amount = c.amount;
      out.unit = c.unit;
      out.dose = c.dose;
    }
  }
  if (drug.fluid) {
    if (!said(out, "volumeMl")) out.volumeMl = drug.id === "prbc" ? 350 : 500;
    if (!said(out, "overMin")) out.overMin = drug.id === "prbc" ? 180 : 30;
    out.dose = out.volumeMl === 350 && drug.id === "prbc" ? "1 unit" : `${out.volumeMl} mL`;
    return out;
  }
  if (!said(out, "amount") && !said(out, "dose") && drug.dose) {
    const d = parseOrderDetails(drug.dose);
    out.dose = drug.dose;
    if (d.amount !== undefined) out.amount = d.amount;
    if (d.unit) out.unit = d.unit;
  }
  if (!said(out, "route")) out.route = drug.route;
  if (!said(out, "overMin") && drug.frequency) {
    const rate = parseOrderDetails(drug.frequency).overMin;
    if (rate) out.overMin = rate;
  }
  if (mode === "prescribed") {
    if (!said(out, "frequency")) out.frequency = drug.frequency ?? "OD";
    if (!said(out, "duration")) out.duration = "as advised";
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Imaging and tests                                                           */
/* -------------------------------------------------------------------------- */

export type ImagingKind = "xray" | "ct" | "usg" | "mri";

interface Region {
  id: string;
  label: string;
  words: RegExp;
  /** The catalogue's own study of this region, by kind. */
  catalog?: Partial<Record<ImagingKind, string>>;
  /** Normal reports, by kind. */
  normal: Partial<Record<ImagingKind, string>>;
}

const BONE = "No fracture or dislocation. Alignment and joint spaces preserved. Bone density normal. Soft tissues unremarkable.";
const SPINE = "Normal alignment. Vertebral body heights and disc spaces preserved. No fracture. Pedicles intact. Prevertebral soft tissues normal.";
const SOFT_USG = "No collection, mass or abnormal vascularity. Soft tissue planes preserved.";
const MRI_JOINT = "No bone marrow oedema. Ligaments, tendons and menisci/labrum intact. No effusion.";

/** Body parts a study can be of, the words that name them, and what a normal study of each reports. */
export const REGIONS: Region[] = [
  { id: "chest", label: "chest", words: /\b(chest|thorax|thoracic cage|lungs?|cxr|pleura\w*)\b/, catalog: { xray: "cxr", ct: "hrct" }, normal: { ct: "No pulmonary embolism, mass, consolidation or effusion. Mediastinum and great vessels normal.", usg: "No pleural effusion. Lung sliding present bilaterally; A-lines.", mri: "No abnormality in the chest." } },
  { id: "kub", label: "KUB", words: /\bkub\b/, catalog: { usg: "usg-abdomen", ct: "ct-abdomen" }, normal: { xray: "No radio-opaque calculus along the renal outlines, ureters or bladder. Psoas shadows and bowel gas pattern normal." } },
  { id: "abdomen", label: "abdomen", words: /\b(abdomen|abdominal|belly|axr|whole abdomen)\b/, catalog: { xray: "xray-abdomen", usg: "usg-abdomen", ct: "ct-abdomen" }, normal: { mri: "No abnormality in the abdomen." } },
  { id: "pelvis", label: "pelvis", words: /\b(pelvis|pelvic)\b/, catalog: { usg: "usg-abdomen", ct: "ct-abdomen" }, normal: { xray: "No fracture. Hip and sacroiliac joints normal. Pelvic ring intact.", mri: "No abnormality in the pelvis." } },
  { id: "head", label: "head", words: /\b(head|brain|skull|cranium|cranial)\b/, catalog: { ct: "ct-head", mri: "mri-brain" }, normal: { xray: "No fracture. Vault and sutures normal." } },
  { id: "pns", label: "paranasal sinuses", words: /\b(pns|paranasal|sinus(?:es)?|waters view|water s view)\b/, normal: { xray: "Paranasal sinuses clear. No mucosal thickening or air–fluid level.", ct: "Paranasal sinuses clear. Ostiomeatal units patent." } },
  { id: "c-spine", label: "cervical spine", words: /\b(c spine|cervical spine|cervical|neck spine)\b/, catalog: { mri: "mri-spine" }, normal: { xray: SPINE, ct: SPINE } },
  { id: "t-spine", label: "thoracic spine", words: /\b(t spine|d spine|thoracic spine|dorsal spine|dorsal)\b/, catalog: { mri: "mri-spine" }, normal: { xray: SPINE, ct: SPINE } },
  { id: "l-spine", label: "lumbosacral spine", words: /\b(l spine|ls spine|lumbar|lumbosacral|lower back|lumbar spine)\b/, catalog: { mri: "mri-spine" }, normal: { xray: SPINE, ct: SPINE } },
  { id: "spine", label: "whole spine", words: /\b(whole spine|spine|back)\b/, catalog: { mri: "mri-spine" }, normal: { xray: SPINE, ct: SPINE } },
  { id: "hip", label: "hip", words: /\b(hips?|neck of femur)\b/, normal: { xray: BONE, mri: MRI_JOINT } },
  { id: "neck", label: "neck", words: /\b(neck|soft tissue neck|stnl)\b/, normal: { xray: "Prevertebral soft tissues normal. Airway central and patent.", ct: "No mass, collection or lymphadenopathy. Airway patent.", usg: "No lymphadenopathy, mass or collection. Thyroid normal.", mri: "No mass or lymphadenopathy." } },
  { id: "thyroid", label: "thyroid", words: /\b(thyroid)\b/, normal: { usg: "Both thyroid lobes normal in size and echotexture. No nodule. Normal vascularity." } },
  { id: "scrotum", label: "scrotum", words: /\b(scrotum|scrotal|testis|testes|testicular)\b/, normal: { usg: "Both testes normal in size and echotexture with normal flow on Doppler. Epididymes normal. No hydrocele." } },
  { id: "breast", label: "breast", words: /\b(breasts?)\b/, normal: { usg: "No focal lesion. Normal fibroglandular tissue. No axillary lymphadenopathy." } },
  { id: "shoulder", label: "shoulder", words: /\b(shoulders?)\b/, normal: { xray: BONE, mri: MRI_JOINT, usg: "Rotator cuff tendons intact. No effusion." } },
  { id: "arm", label: "arm (humerus)", words: /\b(arm|humerus)\b/, normal: { xray: BONE } },
  { id: "elbow", label: "elbow", words: /\b(elbows?)\b/, normal: { xray: BONE, mri: MRI_JOINT } },
  { id: "forearm", label: "forearm", words: /\b(forearms?|radius|ulna)\b/, normal: { xray: BONE } },
  { id: "wrist", label: "wrist", words: /\b(wrists?|scaphoid)\b/, normal: { xray: BONE, mri: MRI_JOINT } },
  { id: "hand", label: "hand", words: /\b(hands?|fingers?|thumb|metacarpals?)\b/, normal: { xray: BONE } },
  { id: "thigh", label: "thigh (femur)", words: /\b(thighs?|femur|femoral shaft)\b/, normal: { xray: BONE } },
  { id: "knee", label: "knee", words: /\b(knees?|patella)\b/, normal: { xray: BONE, mri: MRI_JOINT, usg: "No effusion or Baker cyst." } },
  { id: "leg", label: "leg (tibia and fibula)", words: /\b(legs?|tibia|fibula|shin)\b/, normal: { xray: BONE, usg: SOFT_USG } },
  { id: "ankle", label: "ankle", words: /\b(ankles?)\b/, normal: { xray: BONE, mri: MRI_JOINT } },
  { id: "foot", label: "foot", words: /\b(foot|feet|toes?|heel|calcaneum|calcaneus)\b/, normal: { xray: BONE } },
  { id: "soft-tissue", label: "the swelling", words: /\b(swelling|lump|mass|soft tissue|abscess|local)\b/, normal: { usg: SOFT_USG } },
];

export interface ImagingDetails {
  region?: string;
  side?: "right" | "left" | "both";
  view?: string;
  contrast?: "plain" | "contrast";
}

const norm = (t: string) => ` ${t.toLowerCase().replace(/[^a-z0-9%]+/g, " ").replace(/\s+/g, " ").trim()} `;

/** The part, side, view and contrast named in an order or an answer. */
export function parseImaging(text: string): ImagingDetails {
  const t = norm(text);
  const out: ImagingDetails = {};
  // Most specific first: "c spine" before "spine", "kub" before "abdomen".
  const region = REGIONS.find((r) => r.words.test(t));
  if (region) out.region = region.id;
  if (/\b(both|bilateral|b l)\b/.test(t)) out.side = "both";
  else if (/\b(right|rt)\b/.test(t)) out.side = "right";
  else if (/\b(left|lt)\b/.test(t)) out.side = "left";
  const views: string[] = [];
  if (/\b(pa|postero ?anterior)\b/.test(t)) views.push("PA");
  if (/\b(ap|antero ?posterior|portable|bedside)\b/.test(t)) views.push("AP");
  if (/\b(lateral|lat)\b/.test(t)) views.push("lateral");
  if (/\boblique\b/.test(t)) views.push("oblique");
  if (/\b(erect|upright|standing)\b/.test(t)) views.push("erect");
  if (/\b(supine|lying)\b/.test(t)) views.push("supine");
  if (/\b(water s view|waters view|occipito ?mental|om view)\b/.test(t)) views.push("OM (Waters)");
  if (/\b(two views|2 views|both views|standard views)\b/.test(t) && views.length === 0) views.push("AP", "lateral");
  if (views.length) out.view = [...new Set(views)].join(" & ");
  if (/\b(ncct|plain|non contrast|noncontrast|without contrast|unenhanced|hrct|kub)\b/.test(t)) out.contrast = "plain";
  if (/\b(cect|contrast|with contrast|enhanced|iv contrast|angio\w*|cta|ctpa|triple phase|portal venous|cect\w*)\b/.test(t) && !/\b(non contrast|without contrast)\b/.test(t)) out.contrast = "contrast";
  return out;
}

export const regionById = (id: string | undefined) => REGIONS.find((r) => r.id === id);

/** Which kind of study an investigation is (from its id or name), when it's imaging that needs a part, a view or contrast settled. */
export function imagingKind(id: string, name = ""): ImagingKind | null {
  const s = ` ${id} ${name} `.toLowerCase();
  if (/\b(usg|ultrasound|sonograph\w*)\b/.test(s)) return "usg";
  if (/\bmri\b/.test(s)) return "mri";
  if (/\b(pet|pet-ct|petct)\b/.test(s)) return null; // a PET-CT is its own study, not "a CT of which part"
  if (/\b(ct|cect|ncct|hrct|ctpa|cta)\b/.test(s)) return "ct";
  if (/\b(x ?-?ray|xray|cxr|axr|radiograph\w*)\b/.test(s)) return "xray";
  return null;
}

/**
 * What a study order is missing: the part (generic orders), the view (X-rays), contrast or not (CT).
 * `caseName`: the case's own name for the study, when it wrote one ("X-ray right knee AP and lateral").
 */
export function imagingNeeds(kind: ImagingKind, id: string, caseName: string, phrase: string, p: Payload): OrderNeed[] {
  const name = caseName;
  const said = parseImaging(`${phrase} ${name} ${typeof p.view === "string" ? p.view : ""} ${typeof p.contrast === "string" ? p.contrast : ""}`);
  const region = (typeof p.region === "string" ? p.region : undefined) ?? said.region ?? catalogRegion(id);
  const needs: OrderNeed[] = [];
  if (!region) needs.push("region");
  if (kind === "xray" && !said.view && !/\b(view|views|pa|ap)\b/i.test(name)) needs.push("view");
  if (kind === "ct" && !said.contrast) needs.push("contrast");
  return needs;
}

/** The part a catalogue study is of. */
function catalogRegion(id: string): string | undefined {
  for (const r of REGIONS) if (Object.values(r.catalog ?? {}).includes(id) && (r.id === "chest" || r.id === "abdomen" || r.id === "head")) return r.id;
  if (id === "mri-spine") return "spine";
  if (id === "usg-abdomen" || id === "ct-abdomen" || id === "xray-abdomen") return "abdomen";
  return undefined;
}

const KIND_WORD: Record<ImagingKind, string> = { xray: "X-ray", ct: "CT", usg: "Ultrasound", mri: "MRI" };

/** "Chest X-ray — PA, or AP portable, doctor?" */
export function imagingQuestion(kind: ImagingKind, needs: OrderNeed[], p: Payload, polite: boolean): string {
  const tail = polite ? ", doctor" : "";
  const region = regionById(typeof p.region === "string" ? p.region : undefined);
  if (needs.includes("region")) {
    const extra = kind === "xray" ? " — and which view" : kind === "ct" ? " — plain or with contrast" : "";
    return `${KIND_WORD[kind]} of which part${tail}${extra}?`;
  }
  const what = kind === "xray" ? (region?.id === "chest" ? "Chest X-ray" : `X-ray ${region?.label ?? ""}`.trim()) : `${KIND_WORD[kind]} ${region?.label ?? ""}`.trim();
  if (needs.includes("view")) {
    if (region?.id === "chest") return `${what} — PA, or AP portable${tail}?`;
    if (region?.id === "abdomen") return `${what} — erect or supine${tail}?`;
    return `${what} — which views${tail}?`;
  }
  if (needs.includes("contrast")) return `${what} — plain or with contrast${tail}?`;
  return `${what}${tail}?`;
}

/* -------------------------------------------------------------------------- */
/* Oxygen                                                                      */
/* -------------------------------------------------------------------------- */

export type OxygenDevice = "nasal" | "mask" | "nrbm" | "venturi" | "hfnc";

export interface OxygenOrder {
  device?: OxygenDevice;
  flowL?: number;
  /** Venturi or high-flow FiO₂, percent. */
  fio2?: number;
}

export function parseOxygen(text: string): OxygenOrder {
  const t = norm(text);
  const out: OxygenOrder = {};
  if (/\b(nasal prongs?|nasal cannula|nasal canula|prongs|nc)\b/.test(t)) out.device = "nasal";
  else if (/\b(nrbm|non rebreath\w*|nrb|reservoir mask)\b/.test(t)) out.device = "nrbm";
  else if (/\b(venturi|venti mask|ventimask)\b/.test(t)) out.device = "venturi";
  else if (/\b(hfnc|high flow nasal|high flow)\b/.test(t)) out.device = "hfnc";
  else if (/\b(face mask|simple mask|mask|hudson)\b/.test(t)) out.device = "mask";
  const flow = t.match(/\b(\d+(?:\.\d+)?)\s*(?:l|lpm|litres?|liters?|l min|l per min)\b/);
  if (flow?.[1]) out.flowL = parseFloat(flow[1]);
  const pct = t.match(/\b(\d{2})\s*%/);
  if (pct?.[1]) out.fio2 = parseFloat(pct[1]);
  return out;
}

export function oxygenNeeds(o: OxygenOrder): OrderNeed[] {
  if (o.device === "nrbm") return [];
  if (o.device === "venturi") return o.fio2 ? [] : ["flow"];
  if (o.device === "hfnc") return o.flowL || o.fio2 ? [] : ["flow"];
  if (o.device) return o.flowL ? [] : ["flow"];
  return o.flowL ? [] : ["device"];
}

export function oxygenQuestion(o: OxygenOrder, needs: OrderNeed[], polite: boolean): string {
  const tail = polite ? ", doctor" : "";
  if (needs.includes("device")) return `Oxygen — by nasal prongs, face mask or non-rebreather, and how many litres${tail}?`;
  if (o.device === "venturi") return `Venturi mask — which percentage${tail}?`;
  return `Oxygen by ${o.device === "nasal" ? "nasal prongs" : o.device === "hfnc" ? "high-flow nasal cannula" : "face mask"} — how many litres${tail}?`;
}

/** The oxygen delivered, as a fraction of inspired air (FiO₂, %), with the device inferred from the flow when not said. */
export function oxygenDelivered(o: OxygenOrder): { device: OxygenDevice; flowL?: number; fio2: number; label: string } {
  const device: OxygenDevice = o.device ?? (o.flowL === undefined ? "mask" : o.flowL <= 4 ? "nasal" : o.flowL <= 10 ? "mask" : "nrbm");
  switch (device) {
    case "nasal": {
      const flow = Math.min(6, o.flowL ?? 2);
      return { device, flowL: flow, fio2: 21 + 4 * flow, label: `nasal prongs at ${flow} L/min` };
    }
    case "mask": {
      const flow = Math.min(10, Math.max(5, o.flowL ?? 6));
      return { device, flowL: flow, fio2: Math.min(60, 20 + 4 * flow), label: `face mask at ${flow} L/min` };
    }
    case "nrbm":
      return { device, flowL: o.flowL ?? 15, fio2: 85, label: `non-rebreather mask at ${o.flowL ?? 15} L/min` };
    case "venturi":
      return { device, fio2: o.fio2 ?? 28, label: `venturi mask, ${o.fio2 ?? 28}%` };
    case "hfnc":
      return { device, flowL: o.flowL ?? 40, fio2: o.fio2 ?? 60, label: `high-flow nasal cannula, ${o.flowL ?? 40} L/min at ${o.fio2 ?? 60}%` };
  }
}

/* -------------------------------------------------------------------------- */
/* The answer                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The doctor's answer to a question about an order, merged into it — or null
 * when these words don't answer it (another order, a question, a remark).
 */
export function completeOrder(pending: PendingOrder, clause: string, weightKg: number): Payload | null {
  if (pending.kind === "confirm") return isConfirmation(clause) ? { ...pending.payload, confirmed: true } : null;
  const usual = USUAL_RE.test(clause);
  if (pending.kind === "drug") {
    const d = parseOrderDetails(clause, { weightKg });
    const found: Payload = {};
    if (d.amount !== undefined) found.amount = d.amount;
    if (d.unit) found.unit = d.unit;
    if (d.text) found.dose = d.text;
    if (d.volumeMl !== undefined) found.volumeMl = d.volumeMl;
    if (d.route) found.route = d.route;
    if (d.frequency && d.frequency !== "stat") found.frequency = d.frequency;
    if (d.duration) found.duration = d.duration;
    if (d.overMin !== undefined) found.overMin = d.overMin;
    if (d.rapid) found.rapid = true;
    if (d.rateMlH !== undefined) found.rateMlH = d.rateMlH;
    if (Object.keys(found).length === 0 && !usual) return null;
    return { ...pending.payload, ...found, ...(usual ? { usual: true } : {}) };
  }
  if (pending.kind === "investigation") {
    // An examination ("chest auscultation") or another part than the one asked about is a new request, not the answer.
    if (/\b(auscultat\w*|examin\w*|palpat\w*|listen|percuss\w*|inspect\w*|look at|feel)\b/i.test(clause)) return null;
    const d = parseImaging(clause);
    if (d.region && typeof pending.payload.region === "string" && d.region !== pending.payload.region && !pending.needs.includes("region")) return null;
    const found: Payload = {};
    if (d.region) found.region = d.region;
    if (d.side) found.side = d.side;
    if (d.view) found.view = d.view;
    if (d.contrast) found.contrast = d.contrast;
    if (Object.keys(found).length === 0) return null;
    return { ...pending.payload, ...found };
  }
  const o = parseOxygen(clause);
  if (!o.device && o.flowL === undefined && o.fio2 === undefined) return null;
  return { ...pending.payload, ...(o.device ? { device: o.device } : {}), ...(o.flowL !== undefined ? { flowL: o.flowL } : {}), ...(o.fio2 !== undefined ? { fio2: o.fio2 } : {}) };
}

/** The completed order as an intent, for the turn to carry out. */
export function completedIntent(pending: PendingOrder, payload: Payload, words: string): { kind: "drug" | "investigation" | "action"; targetId: string; phrase: string; matched: true; payload: Payload } {
  const phrase = `${pending.phrase} — ${words}`.slice(0, 400);
  if (pending.kind === "oxygen") return { kind: "action", targetId: "measure:oxygen", phrase, matched: true, payload: { ...payload, completes: true } };
  if (pending.kind === "confirm") return { kind: pending.targetId.startsWith("measure:") ? "action" : "drug", targetId: pending.targetId, phrase, matched: true, payload: { ...payload, completes: true } };
  return { kind: pending.kind, targetId: pending.targetId, phrase, matched: true, payload: { ...payload, completes: true } };
}

/** The question an order is waiting on, asked again (the doctor said "ok" without answering it). */
export function pendingQuestion(p: PendingOrder, polite: boolean): string {
  if (p.kind === "confirm") return String(p.payload.question ?? "Are you sure, doctor?");
  if (p.kind === "drug") {
    const drug = formularyDrug(p.targetId);
    return drug ? drugQuestion(drug, p.needs, p.payload, polite) : "Which medicine, dose and route?";
  }
  if (p.kind === "oxygen") return oxygenQuestion(parseOxygen(p.phrase), p.needs, polite);
  if (p.targetId === "blood") return `Which blood tests${polite ? ", doctor" : ""}?`;
  const kind = (["xray", "ct", "usg", "mri"].includes(p.targetId) ? p.targetId : imagingKind(p.targetId)) as ImagingKind | null;
  return kind ? imagingQuestion(kind, p.needs, p.payload, polite) : `Which test${polite ? ", doctor" : ""}?`;
}

/* -------------------------------------------------------------------------- */
/* The nurse's challenge                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Orders that could kill, and what the nurse says about them. Only these are
 * queried — and only once: said again, or "yes", and it's given.
 */
const GRAVE: Record<string, (them: string) => string> = {
  "fluid-flood": (them) => `That much fluid that fast could flood ${them} lungs.`,
  "fluid-catastrophe": (them) => `That much fluid that fast could flood ${them} lungs.`,
  "potassium-bolus": () => "Potassium that fast into a vein can stop the heart.",
  "adrenaline-bolus": () => "That much adrenaline into a vein can set off a dangerous rhythm.",
  "insulin-overdose-iv": (them) => `That's a very big insulin dose — it could drop ${them} sugar dangerously.`,
  "insulin-overdose-sc": (them) => `That's a very big insulin dose — it could drop ${them} sugar dangerously.`,
  "sedative-overdose": () => "That dose could stop the breathing.",
  "opioid-respiratory-depression": () => "That much opioid could stop the breathing.",
  "cardiodepressant-overdose": () => "That dose could drop the heart rate and pressure dangerously.",
  "drug-toxicity": () => "That's far above the usual dose.",
  "drug-toxicity-severe": () => "That's many times the usual dose.",
  "salt-poisoning": () => "That much salt could be poisonous.",
};

/** Whether any of these hazards is one the nurse would query before carrying the order out. */
export const graveHazards = (ids: readonly string[]) => ids.filter((id) => id in GRAVE);

/** The words for a patient's lungs, sugar…: "her", "his", "their". */
const possessive = (sex?: string) => (sex === "Female" ? "her" : sex === "Male" ? "his" : "their");

/** "Doctor, potassium chloride 40 mEq IV over 2 min? Potassium that fast … Do you still want it given?" */
export function confirmQuestion(label: string, hazards: readonly string[], sex?: string): string {
  const why = GRAVE[hazards[0]!]?.(possessive(sex)) ?? "That could be dangerous.";
  return `Doctor — ${label}? ${why} Do you still want it given?`;
}

/** Words that, said instead of an answer, only confirm ("yes, give it", "I'm sure", "go ahead"). */
const CONFIRM_WORDS = /\b(?:yes|yeah|yep|yup|ya|yah|ok|okay|sure|haan|han|ha|ji|confirm(?:ed)?|proceed|go ahead|go on|do it|give it|give|carry on|continue|i'?m sure|im sure|i am sure|i know|absolutely|definitely|as ordered|i said(?: so)?|just|please|now|stat|still|anyway|sister|nurse|doctor|it|so|that's right|thats right|correct|right|fine|dena hai|de do|do)\b/gi;

/** The whole of these words is a confirmation — nothing else in them (a dose, a different drug, "not"). */
export function isConfirmation(text: string): boolean {
  const t = text.toLowerCase().replace(/[’]/g, "'").trim();
  return /[a-z]/.test(t) && t.replace(CONFIRM_WORDS, " ").replace(/[\s.,!—–-]+/g, "") === "";
}

/** "No", "cancel", "hold it": the queried order isn't given. */
// ("Wait" alone declines; "wait 30 min" is a wait. "Stop" alone declines; "stop all medicines" is an order of its own.)
export const DECLINE_RE = /^\s*(?:(?:no+|nope|nahi|na|cancel(?: it| that)?|hold(?: it| on| off)?|don'?t|do not|leave it|skip it|scrap that|actually no|my mistake|sorry)\b|(?:stop|wait)(?: it)?\s*[.!]*\s*$)/i;

/* -------------------------------------------------------------------------- */
/* Ready-made answers                                                          */
/* -------------------------------------------------------------------------- */

/** A tap-to-answer button under the question: added to the message box, or (send) sent at once. */
export interface QuickReply {
  text: string;
  send?: boolean;
}

/** Buttons for what an order is waiting on — the usual dose, the routes it can go by, how often, how long. */
export function orderReplies(p: PendingOrder): QuickReply[] {
  if (p.kind === "confirm" && p.targetId === "measure:discharge") return [{ text: "Yes, discharge", send: true }, { text: "No, keep them here", send: true }];
  if (p.kind === "confirm") return [{ text: "Yes, give it", send: true }, { text: "No, hold it", send: true }];
  if (p.kind === "oxygen") return ["Nasal prongs 2 L/min", "Face mask 6 L/min", "Non-rebreather mask 15 L/min"].map((text) => ({ text, send: true }));
  if (p.kind === "investigation") {
    // A scan's missing part, view or contrast — or which bloods.
    const out: QuickReply[] = [];
    const one = p.needs.length === 1;
    if (p.needs.includes("region")) out.push(...["Chest", "Abdomen", "Head", "Pelvis", "Spine", "KUB"].map((text) => ({ text, send: one })));
    if (p.needs.includes("view")) out.push(...["PA view", "AP view", "Lateral view"].map((text) => ({ text, send: one })));
    if (p.needs.includes("contrast")) out.push({ text: "Plain (non-contrast)", send: one }, { text: "With contrast", send: one });
    if (p.needs.includes("tests")) out.push(...["CBC", "RFT", "LFT", "Electrolytes", "RBS", "CRP"].map((text) => ({ text })));
    return out;
  }
  if (p.kind !== "drug") return [];
  const drug = formularyDrug(p.targetId);
  if (!drug) return [];
  const out: QuickReply[] = [{ text: "Usual dose", send: true }];
  if (p.needs.includes("volume")) out.push(...["250 mL", "500 mL", "1 L"].map((text) => ({ text })));
  if (p.needs.includes("dose") && drug.dose && /^\d/.test(drug.dose)) out.push({ text: drug.dose.replace(/\s*\(.*\)$/, "") });
  if (p.needs.includes("route")) out.push(...routesFor(drug).map((r) => ({ text: ROUTE_WORDS[r] ?? r })));
  if (p.needs.includes("rate")) out.push(...["over 15 min", "over 30 min", "over 1 hour"].map((text) => ({ text })));
  if (p.needs.includes("frequency")) out.push(...["OD", "BD", "TDS", "SOS"].map((text) => ({ text })));
  if (p.needs.includes("duration")) out.push(...["for 3 days", "for 5 days", "for 7 days"].map((text) => ({ text })));
  return out.slice(0, 12);
}
