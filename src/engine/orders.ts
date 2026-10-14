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
  kind: "drug" | "investigation" | "oxygen";
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
  const name = (drug.generic.split(/\s[(]/)[0] ?? drug.generic).trim();
  const known = [typeof p.dose === "string" ? p.dose : undefined, typeof p.route === "string" ? ROUTE_WORDS[p.route as DrugRoute] : undefined].filter(Boolean).join(" ");
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
export function usualOrder(drug: FormularyDrug, p: Payload, mode: "given" | "prescribed"): Payload {
  const out: Payload = { ...p };
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
    const d = parseImaging(clause);
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
  return { kind: pending.kind, targetId: pending.targetId, phrase, matched: true, payload: { ...payload, completes: true } };
}

/** The question an order is waiting on, asked again (the doctor said "ok" without answering it). */
export function pendingQuestion(p: PendingOrder, polite: boolean): string {
  if (p.kind === "drug") {
    const drug = formularyDrug(p.targetId);
    return drug ? drugQuestion(drug, p.needs, p.payload, polite) : "Which medicine, dose and route?";
  }
  if (p.kind === "oxygen") return oxygenQuestion(parseOxygen(p.phrase), p.needs, polite);
  if (p.targetId === "blood") return `Which blood tests${polite ? ", doctor" : ""}?`;
  const kind = (["xray", "ct", "usg", "mri"].includes(p.targetId) ? p.targetId : imagingKind(p.targetId)) as ImagingKind | null;
  return kind ? imagingQuestion(kind, p.needs, p.payload, polite) : `Which test${polite ? ", doctor" : ""}?`;
}
