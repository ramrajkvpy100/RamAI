/**
 * What a drug must not be given in, as a code check rather than the model's memory. Taken by hand from the FDA labels'
 * Contraindications and Boxed Warning sections (fetched in the Knowledge Pack) and read for this list; source-checked, not
 * doctor-reviewed. Each rule looks only at what's known in the room (the patient's age, the story as told, results that are
 * back), never at the hidden diagnosis, so the query gives nothing away.
 */
import type { ClinicalCaseDefinition } from "./case-definition";
import type { FormularyDrug } from "./formulary";
import packData from "@/lib/knowledge-pack.json";

export interface RoomFacts {
  age: number;
  /** The briefing, what's been said at arrival, and the patient's story: what the doctor can know. */
  story: string;
  ckd: boolean;
  pulse?: number;
  plateletsLow: boolean;
  /** Creatinine clearance (mL/min), once a creatinine is back; adults only. */
  crcl?: number;
}

interface Rule {
  drugs?: string[];
  classes?: string[];
  when: (f: RoomFacts) => boolean;
  say: string;
}

const GI_OR_BRAIN_BLEED = /vomit\w* (?:fresh |dark )?blood|ha?ematemesis|mal?ena|black,? (?:tarry )?stools?|intracranial bleed|brain bleed|subarachnoid/i;
const QUINOLONE = ["ciprofloxacin", "levofloxacin", "ofloxacin", "moxifloxacin", "norfloxacin"];

const failingKidneys = (f: RoomFacts) => f.ckd || (f.crcl !== undefined && f.crcl < 30);

const RULES: Rule[] = [
  { classes: ["nsaid", "salicylate", "anticoagulant", "heparin", "antiplatelet", "doac", "p2y12"], when: (f) => GI_OR_BRAIN_BLEED.test(f.story), say: "With bleeding like this, it could make the bleeding much worse." },
  { classes: ["anticoagulant", "heparin", "doac"], when: (f) => f.plateletsLow, say: "With the platelets low, it could cause serious bleeding." },
  { drugs: ["aspirin"], when: (f) => f.age < 12 && /fever|chick?enpox|flu\b|influenza|viral/i.test(f.story) && !/kawasaki/i.test(f.story), say: "Aspirin in a feverish child can cause Reye syndrome." },
  { drugs: ["doxycycline", "tetracycline", "minocycline"], when: (f) => f.age < 8, say: "Under 8, it stains the teeth and affects bone growth." },
  { drugs: ["tramadol", "codeine"], when: (f) => f.age < 12, say: "Under 12, it can stop the breathing." },
  { drugs: ["metformin"], when: failingKidneys, say: "With kidneys this poor, metformin can cause lactic acidosis." },
  { drugs: ["nitrofurantoin"], when: failingKidneys, say: "With kidneys this poor, it doesn't work and it's toxic." },
  { classes: ["nsaid"], when: failingKidneys, say: "With kidneys this poor, an NSAID can finish them off." },
  { drugs: ["gentamicin", "amikacin", "vancomycin"], when: failingKidneys, say: "With kidneys this poor, the dose has to be reduced and levels checked." },
  { drugs: ["enoxaparin"], when: failingKidneys, say: "With kidneys this poor, it accumulates: once daily at a reduced dose, or heparin." },
  { drugs: ["morphine"], when: failingKidneys, say: "With kidneys this poor, its active metabolites accumulate." },
  { drugs: ["gabapentin", "pregabalin", "digoxin", "allopurinol"], when: failingKidneys, say: "With kidneys this poor, the dose has to be reduced." },
  { drugs: ["spironolactone"], when: failingKidneys, say: "With kidneys this poor, it can push the potassium dangerously high." },
  { drugs: ["diazepam", "clonazepam", "lorazepam", "alprazolam"], when: (f) => f.age >= 65 && !/seiz|fits?\b|convuls|withdrawal|status epilepticus/i.test(f.story), say: "At this age it means falls, confusion and over-sedation." },
  { drugs: ["chlorpheniramine", "hydroxyzine", "promethazine"], when: (f) => f.age >= 65 && !/anaphyla/i.test(f.story), say: "At this age it can cause confusion, falls and urinary retention." },
  { drugs: ["amitriptyline"], when: (f) => f.age >= 65, say: "At this age it can cause confusion, falls and a slow, irregular heart." },
  { drugs: ["glimepiride"], when: (f) => f.age >= 65, say: "At this age its long action can cause prolonged low sugars." },
  { drugs: ["metoclopramide"], when: (f) => /bowel obstruction|intestinal obstruction|perforat/i.test(f.story), say: "It can make an obstructed or perforated bowel worse." },
  { drugs: [...QUINOLONE, "gentamicin", "amikacin", "magnesium-sulphate"], when: (f) => /myasthenia/i.test(f.story), say: "It can worsen myasthenia and stop the breathing." },
  { classes: ["beta-blocker"], when: (f) => f.pulse !== undefined && f.pulse > 0 && f.pulse < 50, say: "The pulse is already under 50." },
];

/** What the nurse says if this drug shouldn't go in, from what's known in the room. */
export function contraindication(drug: FormularyDrug, facts: RoomFacts): string | null {
  const hit = RULES.find((r) => (r.drugs?.includes(drug.id) || r.classes?.some((c) => drug.classes.includes(c as never))) && r.when(facts));
  return hit?.say ?? null;
}

/** What's known in the room from the case itself. */
export const storyOf = (def: ClinicalCaseDefinition) => `${def.briefing} ${def.opening.map((o) => o.text).join(" ")} ${def.history.map((h) => h.reply).join(" ")}`;

/* -------------------------------------------------------------------------- */
/* Strengths                                                                   */
/* -------------------------------------------------------------------------- */

const PACK = packData as { drugs: Record<string, { strengths?: string[] }> };

/** The plain tablet and capsule strengths (mg) on record, single-ingredient only. */
export function tabletStrengths(drugId: string): number[] {
  const out = (PACK.drugs[drugId]?.strengths ?? []).flatMap((s) => {
    const m = s.replace(/,/g, "").match(/^([\d.]+)\s*mg\b(.*)$/i);
    return m && /\b(?:tab|cap)/i.test(m[2]!) && !m[2]!.includes("/") ? [Number(m[1])] : [];
  });
  return [...new Set(out)].sort((a, b) => a - b);
}

/**
 * A dose by mouth that can't be made from what the tablet comes in. The list is the US one (RxTerms), so the formulary's own
 * usual dose counts as a strength too (aspirin 75 mg). Halves, quarters and several tablets are allowed.
 */
export function strengthProblem(drug: FormularyDrug, amount: number | undefined, unit: string | undefined, route: string | undefined): string | null {
  if (route !== "PO" || unit !== "mg" || amount === undefined || amount <= 0) return null;
  const listed = tabletStrengths(drug.id);
  if (listed.length === 0) return null;
  const usual = drug.dose?.match(/^([\d.]+)\s*mg\b/i)?.[1];
  const strengths = [...new Set([...listed, ...(usual ? [Number(usual)] : [])])];
  const pieces = strengths.flatMap((s) => [0.25, 0.5, 1, 1.5, 2, 3, 4].map((k) => s * k));
  const close = (x: number) => Math.abs(amount - x) <= Math.max(0.02 * amount, 0.01);
  if (pieces.some(close) || pieces.some((a) => strengths.some((b) => close(a + b)))) return null;
  return `It comes as ${listed.slice(0, 5).map((s) => `${s} mg`).join(", ")}${listed.length > 5 ? " and more" : ""} — that dose can't be made up.`;
}

/* -------------------------------------------------------------------------- */
/* Pregnancy                                                                   */
/* -------------------------------------------------------------------------- */

interface PregnancyRisk {
  drugs?: string[];
  classes?: string[];
  /** Weeks of gestation this applies from and to; any time if left out. */
  from?: number;
  to?: number;
  say: string;
}

/**
 * Risk in pregnancy, by gestation, as code. The FDA retired its A–X letters for new labels in 2015 (the PLLR), so these are
 * short rules read from the labels' pregnancy sections; source-checked, not doctor-reviewed.
 */
const PREGNANCY: PregnancyRisk[] = [
  { classes: ["teratogen"], say: "This drug can harm the baby." },
  { classes: ["acei", "arb", "arni"], say: "It can cause fetal kidney failure and death." },
  { drugs: ["warfarin"], say: "It crosses the placenta: birth defects in early pregnancy, fetal bleeding later." },
  { classes: ["statin"], say: "It's stopped in pregnancy unless the benefit clearly outweighs the risk." },
  { classes: ["tetracycline"], from: 14, say: "From the second trimester it stains the baby's teeth and affects bone." },
  { classes: ["nsaid"], from: 20, to: 29, say: "From 20 weeks NSAIDs can cause fetal kidney problems and low amniotic fluid." },
  { classes: ["nsaid"], from: 30, say: "After 30 weeks NSAIDs can close the baby's ductus arteriosus." },
  { classes: ["fluoroquinolone"], say: "It's avoided in pregnancy while a safer antibiotic is available." },
  { classes: ["aminoglycoside"], say: "It can damage the baby's hearing." },
  { drugs: ["phenytoin", "carbamazepine", "lithium"], to: 13, say: "In the first trimester it raises the risk of birth defects." },
  { drugs: ["fluconazole"], to: 13, say: "Repeated or high doses early in pregnancy raise the risk of birth defects and miscarriage." },
  { classes: ["sulfonamide"], from: 36, say: "Near term it can cause jaundice in the newborn." },
  { drugs: ["cotrimoxazole"], to: 13, say: "As an antifolate in the first trimester it raises the risk of neural tube defects." },
];

/** What the nurse says about this drug in a pregnancy known to be at this gestation (unknown: any rule that isn't tied to a stage, or that may apply). */
export function pregnancyRisk(drug: FormularyDrug, weeks: number | undefined): string | null {
  const hit = PREGNANCY.find((r) => (r.drugs?.includes(drug.id) || r.classes?.some((c) => drug.classes.includes(c as never)))
    && (weeks === undefined || ((r.from === undefined || weeks >= r.from) && (r.to === undefined || weeks <= r.to))));
  return hit?.say ?? null;
}

/** The gestation the story gives: "32 weeks pregnant", "POG 28 wks", "at 10 weeks' gestation". */
export function gestationFrom(story: string): number | undefined {
  const m = story.match(/\b(\d{1,2})\s*(?:\+\s*\d\s*)?(?:weeks?|wks?)['’]?\s*(?:pregnant|gestation|of gestation|of pregnancy|along)\b/i)
    ?? story.match(/\b(?:pog|gestation(?:al age)?(?: of)?|ga)\s*:?\s*(\d{1,2})\s*(?:weeks?|wks?)?\b/i);
  const weeks = m ? Number(m[1]) : NaN;
  return weeks >= 4 && weeks <= 42 ? weeks : undefined;
}
