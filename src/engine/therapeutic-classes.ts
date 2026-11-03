/**
 * Therapeutic equivalence — what counts as the same treatment when a case names another drug.
 *
 * A case's own rules always come first: a drug it names (ideal, acceptable or harmful) keeps that judgement. Only a drug the
 * case says nothing about is looked up here. Two tiers:
 *  - "equivalent": same class at an equipotent dose — full recovery and full credit;
 *  - "second-line": a guideline alternative — the patient still recovers, a little more slowly, with most of the credit and a note.
 *
 * A swap is clinically true only in some illnesses, so a group can say where it holds (dexamethasone doesn't replace
 * hydrocortisone in adrenal crisis; nifedipine by mouth is for pre-eclampsia, not any hypertensive emergency). Every other
 * safety check (allergy, interaction, pregnancy, low pressure) still runs on the drug actually ordered.
 * Pure data and pure functions, so a case replays exactly.
 */
import type { ClinicalCaseDefinition, TherapeuticRule } from "./case-definition";
import { FORMULARY, formularyDrug, type FormularyDrug } from "./formulary";

export type SubstituteTier = "equivalent" | "second-line";

export interface Substitute {
  tier: SubstituteTier;
  group: string;
  /** The drug the case names (generic), for the debrief. */
  preferred: string;
  /** Why it's preferred. Second-line only. */
  why?: string;
}

interface Member {
  id: string;
  /** Milligrams equal in effect to the group's other members (for scaling a dose range). */
  mg?: number;
}

interface Group {
  id: string;
  label: string;
  equivalent: Member[];
  second?: Member[];
  /** Why the equivalent drugs come first. */
  why?: string;
  /** Holds only in these illnesses. */
  onlyIn?: RegExp;
  /** Never in these illnesses. */
  notIn?: RegExp;
  /** A second-line drug is unsuitable here. */
  secondNotIn?: RegExp;
  /** Given by mouth, it still counts in an emergency. */
  oralInEmergency?: boolean;
  /** Who it isn't for, by drug. */
  unsuitable?: (id: string, def: ClinicalCaseDefinition) => boolean;
}

/** What a case says is so: "non-pregnant" and "no shock, no fever" aren't pregnancy or shock. */
const affirmed = (text: string) => text.replace(/\bnon-?\w+/gi, " ").replace(/\b(?:no|not|without|nil|denies|absent)\b[^;.]*/gi, " ");
const pregnant = (def: ClinicalCaseDefinition) => /\bpregnan|eclampsia|gravid|antenatal|obstetric|\bpih\b/i.test(affirmed(`${def.truth.diagnosis} ${def.truth.qualifier ?? ""} ${def.briefing}`));
const febrile = (def: ClinicalCaseDefinition) => {
  const t = parseFloat(def.baselineVitals.temp?.value ?? "");
  return (t > 50 ? ((t - 32) * 5) / 9 : t) >= 38;
};
const NSAIDS = new Set(["ibuprofen", "diclofenac", "ketorolac"]);

export const THERAPEUTIC_GROUPS: Group[] = [
  { id: "loop-diuretic", label: "Loop diuretics", equivalent: [{ id: "furosemide", mg: 40 }, { id: "torsemide", mg: 20 }, { id: "bumetanide", mg: 1 }] },
  { id: "ppi", label: "Proton-pump inhibitors", equivalent: [{ id: "pantoprazole", mg: 40 }, { id: "omeprazole", mg: 20 }, { id: "rabeprazole", mg: 20 }, { id: "esomeprazole", mg: 40 }] },
  {
    id: "antiemetic", label: "Antiemetics",
    equivalent: [{ id: "ondansetron" }, { id: "granisetron" }, { id: "palonosetron" }],
    second: [{ id: "metoclopramide" }, { id: "domperidone" }],
    why: "a 5-HT3 blocker works without the movement side effects of the prokinetics",
    // A prokinetic drives the gut against a blockage.
    secondNotIn: /obstruct|perforat|parkinson|ileus/i,
  },
  // Essential hypertension in clinic: any first-line class controls it. A compelling indication isn't interchangeable.
  { id: "ccb", label: "Calcium-channel blockers", equivalent: [{ id: "amlodipine" }, { id: "cilnidipine" }], onlyIn: /hypertension/i, notIn: /emergency|crisis|urgency|eclampsia|pregnan|dissection|heart failure/i },
  { id: "arb", label: "ARBs", equivalent: [{ id: "telmisartan" }, { id: "losartan" }, { id: "olmesartan" }], notIn: /pregnan|eclampsia|hyperkal|bilateral renal/i },
  { id: "acei", label: "ACE inhibitors", equivalent: [{ id: "enalapril" }, { id: "ramipril" }], notIn: /pregnan|eclampsia|hyperkal|angioedema|bilateral renal/i },
  { id: "thiazide", label: "Thiazide-like diuretics", equivalent: [{ id: "chlorthalidone" }, { id: "hydrochlorothiazide" }, { id: "indapamide" }], notIn: /pregnan|eclampsia|gout|hyponatr/i },
  {
    id: "first-line-bp", label: "First-line antihypertensives (clinic)",
    equivalent: [],
    second: [{ id: "amlodipine" }, { id: "cilnidipine" }, { id: "telmisartan" }, { id: "losartan" }, { id: "olmesartan" }, { id: "enalapril" }, { id: "ramipril" }, { id: "chlorthalidone" }, { id: "hydrochlorothiazide" }, { id: "indapamide" }],
    why: "it suits this patient's age and other conditions best",
    onlyIn: /hypertension/i,
    notIn: /emergency|crisis|urgency|eclampsia|pregnan|dissection|heart failure|nephro|kidney|renal|hyperkal|gout|stroke|myocardial|angina/i,
  },
  {
    id: "severe-preeclampsia", label: "Antihypertensives in severe pre-eclampsia",
    equivalent: [{ id: "labetalol" }, { id: "hydralazine" }],
    second: [{ id: "nifedipine" }],
    why: "the IV agents can be titrated minute by minute and work if she is vomiting or fitting",
    // Short-acting nifedipine is safe here (ACOG, FOGSI) but can drop the pressure dangerously in a non-pregnant emergency.
    onlyIn: /eclampsia|gestational hypertension|\bpih\b/i,
    oralInEmergency: true,
  },
  {
    id: "third-gen-ceph", label: "Third-generation cephalosporins",
    equivalent: [{ id: "ceftriaxone" }, { id: "cefotaxime" }],
    second: [{ id: "pip-taz" }, { id: "cefoperazone-sulbactam" }, { id: "meropenem" }],
    why: "the narrower agent treats this infection and keeps the broad-spectrum drugs in reserve",
    // A single-dose ceftriaxone regimen isn't interchangeable.
    notIn: /gonorrh|syphilis|chancroid/i,
    // Poor CSF penetration (pip-taz, cefoperazone).
    secondNotIn: /mening|encephal|typhoid|enteric/i,
  },
  {
    id: "atypical-cover", label: "Atypical cover",
    equivalent: [{ id: "azithromycin" }, { id: "clarithromycin" }],
    second: [{ id: "doxycycline" }],
    why: "a macrolide is the guideline's first choice for this infection",
    // Typhoid and pertussis are specific indications; doxycycline isn't for children or pregnancy.
    notIn: /typhoid|enteric|gonorrh|chlamydia|trachoma/i,
    unsuitable: (id, def) => id === "doxycycline" && (def.patient.age < 8 || pregnant(def)),
  },
  { id: "act", label: "Artemisinin combinations", equivalent: [{ id: "artesunate-sp" }, { id: "artemether-lumefantrine" }], onlyIn: /malaria/i, notIn: /severe|cerebral|complicated/i, oralInEmergency: true },
  {
    id: "cystitis", label: "Uncomplicated cystitis",
    equivalent: [{ id: "nitrofurantoin" }, { id: "fosfomycin" }],
    second: [{ id: "cefuroxime" }, { id: "cefixime" }, { id: "amox-clav" }],
    why: "first-line agents treat a bladder infection and keep the cephalosporins in reserve (ICMR)",
    onlyIn: /cystitis|lower urinary|uncomplicated (?:uti|urinary)|urinary tract infection|\buti\b/i,
    notIn: /pyelo|pregnan|sepsis|complicated uti|prostat|catheter/i,
    oralInEmergency: true,
  },
  { id: "statin", label: "High-intensity statins", equivalent: [{ id: "atorvastatin", mg: 40 }, { id: "rosuvastatin", mg: 20 }] },
  { id: "saba", label: "Short-acting bronchodilators", equivalent: [{ id: "salbutamol" }, { id: "levosalbutamol" }, { id: "levosalbutamol-ipratropium" }] },
  {
    id: "systemic-steroid", label: "Systemic corticosteroids",
    equivalent: [{ id: "hydrocortisone", mg: 200 }, { id: "methylprednisolone", mg: 40 }, { id: "dexamethasone", mg: 8 }, { id: "prednisolone", mg: 50 }],
    // Equal only as anti-inflammatories: adrenal crisis needs hydrocortisone's mineralocorticoid action; meningitis, antenatal lung maturity and croup have trial-specific drugs.
    notIn: /adrenal|addison|mening|preterm|antenatal|croup|cerebral oedema|cerebral edema|shock/i,
  },
  {
    id: "analgesic", label: "Simple analgesics",
    equivalent: [{ id: "paracetamol" }],
    second: [{ id: "ibuprofen" }, { id: "diclofenac" }, { id: "ketorolac" }, { id: "tramadol" }],
    why: "paracetamol is the safest first step when it's enough",
    secondNotIn: /dengue|haemorrhag|hemorrhag|bleed|ulcer|kidney|renal|\baki\b|\bckd\b|heart failure|pregnan|eclampsia|head injury|asthma|platelet/i,
    unsuitable: (id, def) => {
      // Tramadol doesn't bring a fever down; children have only ibuprofen among these.
      if (id === "tramadol") return febrile(def) || def.patient.age < 12;
      if (NSAIDS.has(id) && def.patient.age < 12) return id !== "ibuprofen" || def.patient.age < 1;
      return false;
    },
  },
];

/** Every drug in one line: the group it can be swapped within, or null when nothing replaces it (an antidote, insulin, adrenaline…). */
export function therapeuticGroupOf(drugId: string): string | null {
  return THERAPEUTIC_GROUPS.find((g) => g.equivalent.some((m) => m.id === drugId))?.id ?? THERAPEUTIC_GROUPS.find((g) => g.second?.some((m) => m.id === drugId))?.id ?? null;
}

export const substitutableDrugs = () => FORMULARY.filter((d) => therapeuticGroupOf(d.id));

const covers = (rule: TherapeuticRule, id: string) => {
  const d = formularyDrug(id);
  return !!rule.drugIds?.includes(id) || (!!d && !!rule.drugClasses?.some((c) => d.classes.includes(c as never)));
};

/** The case's own step this drug can stand in for, and how well; undefined when it can't. */
export function substituteFor(def: ClinicalCaseDefinition, drug: FormularyDrug, route?: string): { rule: TherapeuticRule; substitute: Substitute } | undefined {
  const text = affirmed(`${def.truth.diagnosis} ${def.truth.qualifier ?? ""}`);
  const rules = def.therapeutics.filter((r) => r.kind === "drug" && (r.appropriateness === "ideal" || r.appropriateness === "acceptable"));
  let best: { rule: TherapeuticRule; substitute: Substitute; scale?: number } | undefined;
  for (const g of THERAPEUTIC_GROUPS) {
    const isFirst = g.equivalent.find((m) => m.id === drug.id);
    const isSecond = g.second?.find((m) => m.id === drug.id);
    if ((!isFirst && !isSecond) || (g.onlyIn && !g.onlyIn.test(text)) || g.notIn?.test(text)) continue;
    if (isSecond && g.secondNotIn?.test(text)) continue;
    if (g.unsuitable?.(drug.id, def)) continue;
    for (const rule of rules) {
      const named = g.equivalent.find((m) => covers(rule, m.id));
      const namedSecond = g.second?.find((m) => covers(rule, m.id));
      if (!named && !namedSecond) continue;
      // Tablets aren't the same treatment as the vein in an emergency.
      if (route === "PO" && def.track === "emergency" && !g.oralInEmergency && formularyDrug((named ?? namedSecond)!.id)?.route !== "PO") continue;
      const tier: SubstituteTier = (isFirst && named) || (isSecond && !named) ? "equivalent" : "second-line";
      if (best && (best.substitute.tier === "equivalent" || tier === "second-line")) continue;
      const reference = (named ?? namedSecond)!;
      const own = isFirst ?? isSecond!;
      const preferred = formularyDrug(reference.id)?.generic ?? reference.id;
      best = { rule, substitute: { tier, group: g.id, preferred, ...(tier === "second-line" && g.why ? { why: g.why } : {}) }, scale: own.mg && reference.mg ? own.mg / reference.mg : undefined };
    }
  }
  if (!best) return undefined;
  const { rule, substitute, scale } = best;
  // The case's words and dose window were written for its own drug: said of this one, and scaled to its potency.
  const said = (t: string) => t.replace(new RegExp(`\\b${substitute.preferred}\\b`, "gi"), drug.generic.toLowerCase());
  const doseRange = rule.doseRange && scale && (rule.doseRange.unit === "mg" || rule.doseRange.unit === "g") ? { ...rule.doseRange, min: rule.doseRange.min * scale, max: rule.doseRange.max * scale } : undefined;
  const { doseRange: _written, ...rest } = rule;
  return {
    substitute,
    rule: {
      ...rest,
      ...(doseRange ? { doseRange } : {}),
      ...(rule.response ? { response: rule.response.map((r) => ({ ...r, text: said(r.text) })) } : {}),
      ...(rule.note ? { note: said(rule.note) } : {}),
      ...(rule.praise ? { praise: said(rule.praise) } : {}),
      substitute,
    },
  };
}

/** The debrief's words for a second-line choice. */
export const substituteNote = (generic: string, s: Substitute) =>
  `Good clinical improvement with ${generic}; ${s.preferred} is preferred first-line${s.why ? ` because ${s.why}` : ""}.`;
