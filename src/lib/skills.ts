/**
 * Skills Lab drills that need no AI and no pictures: antidotes, emergency algorithms and clinical
 * calculations. Answers follow standard references (BNF / Toxbase, AHA ACLS 2020–2025, NICE, WHO,
 * Harrison's); calculations are worked out here, with fresh numbers each time.
 */
import { ADVANCED_CALCS, CALC_BANK, CALC_CATEGORY_PATTERNS, CALC_OWNER } from "./banks/calcs";
import { MORE_ALGORITHMS, MORE_ANTIDOTES } from "./banks/quiz";
import EXTRA from "./banks/quiz-more.json";

export interface QuizQuestion {
  id: string;
  stem: string;
  options: string[];
  answer: number;
  /** Why the answer is right. */
  explain: string;
  /** Why each wrong option isn't (same order as options; the answer's own is unused). */
  whyNot?: string[];
  source: string;
}

const shuffle = <T,>(xs: T[], rnd = Math.random): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};

/**
 * How hard a drill is: "basic" (students and interns) keeps to the classic, high-yield
 * questions; "full" (residents, specialists) adds the rest.
 */
export type SkillLevel = "basic" | "full";

/** The harder questions — left out at the basic level. */
const ADVANCED = new Set([
  "antidote-tca", "antidote-ccb", "antidote-betablocker", "antidote-sulfonylurea", "antidote-cyanide", "antidote-digoxin",
  "antidote-dabigatran", "antidote-methotrexate", "antidote-isoniazid", "antidote-lignocaine", "antidote-methanol",
  "antidote-atracurium", "antidote-sux-apnoea", "antidote-pris", "antidote-dexmedetomidine", "antidote-icu-nms", "antidote-methb-g6pd", "antidote-sux-hyperk",
  "antidote-asv-repeat", "antidote-tick", "antidote-spider", "antidote-jellyfish", "antidote-stingray", "antidote-lmwh-protamine", "antidote-lysis-bleed", "antidote-drug-torsades",
  "antidote-tumour-lysis", "antidote-porphyria", "antidote-refeeding", "antidote-wilson", "antidote-pyrethroid", "antidote-oleander",
  "algo-pals-brady", "algo-nrp-hr", "algo-paeds-status", "algo-cico", "algo-ards-vent", "algo-blocked-trach", "algo-massive-haemoptysis", "algo-massive-transfusion", "algo-neurogenic-shock",
  "algo-cardiogenic-shock", "algo-myasthenic-crisis", "algo-lvo", "algo-maternal-arrest", "algo-uterine-inversion", "algo-rv-infarct", "algo-massive-haemothorax",
  ...ADVANCED_CALCS,
]);

/** Which specialty each question belongs to — a doctor's own come first. */
const OWNER: Record<string, string[]> = {
  "algo-vf": ["Cardiology", "Emergency", "Medicine"], "algo-asystole": ["Cardiology", "Emergency"], "algo-anaphylaxis": ["Emergency", "Medicine", "General Practice"],
  "algo-dka": ["Endocrinology", "Medicine", "Emergency"], "algo-status": ["Neurology", "Emergency", "Pediatrics"], "algo-hyperk": ["Nephrology", "Medicine"],
  "algo-pph": ["OBGYN"], "algo-tension": ["Surgery", "Emergency", "Respiratory"], "algo-sepsis": ["Infectious Disease", "Medicine", "Emergency", "Urology", "General Practice"],
  "algo-stroke": ["Neurology", "Emergency"],
  "antidote-snake": ["Emergency", "Medicine"], "antidote-organophosphate": ["Emergency", "Medicine"], "antidote-paracetamol": ["Emergency", "Gastroenterology"],
  "algo-nrp-hr": ["Pediatrics", "OBGYN"], "algo-neonatal-resus": ["Pediatrics", "OBGYN"], "algo-pals-brady": ["Pediatrics", "Emergency"], "algo-pals-svt": ["Pediatrics", "Cardiology"], "algo-paeds-status": ["Pediatrics", "Neurology"], "algo-paeds-arrest": ["Pediatrics", "Emergency"],
  "algo-croup": ["Pediatrics", "ENT"], "algo-epiglottitis": ["Pediatrics", "ENT"], "algo-bronchiolitis": ["Pediatrics", "Respiratory"], "algo-tet-spell": ["Pediatrics", "Cardiology"], "algo-sepsis-child": ["Pediatrics", "Infectious Disease"], "algo-choking-infant": ["Pediatrics", "General Practice"],
  "algo-dehydration-child": ["Pediatrics", "General Practice"], "algo-febrile-seizure": ["Pediatrics", "Neurology"], "algo-sam-child": ["Pediatrics"],
  "algo-pph-second": ["OBGYN"], "algo-maternal-arrest": ["OBGYN", "Emergency"], "algo-mag-toxicity": ["OBGYN"], "algo-severe-htn-pregnancy": ["OBGYN"], "algo-uterine-inversion": ["OBGYN"], "algo-abruption": ["OBGYN"], "algo-eclampsia": ["OBGYN"], "algo-shoulder-dystocia": ["OBGYN"], "algo-cord-prolapse": ["OBGYN"], "algo-ectopic-ruptured": ["OBGYN", "Emergency"],
  "algo-sah": ["Neurology", "Emergency"], "algo-gbs": ["Neurology", "Medicine"], "algo-myasthenic-crisis": ["Neurology", "Medicine"], "algo-encephalitis": ["Neurology", "Infectious Disease"], "algo-cord-compression": ["Neurology", "Orthopedics"], "algo-lvo": ["Neurology", "Emergency"], "algo-meningitis": ["Neurology", "Infectious Disease"],
  "algo-septic-vasopressor": ["Infectious Disease", "Medicine", "Emergency"], "algo-neurogenic-shock": ["Emergency", "Surgery", "Orthopedics"], "algo-massive-transfusion": ["Surgery", "Emergency"], "algo-cardiogenic-shock": ["Cardiology", "Emergency"], "algo-rv-infarct": ["Cardiology", "Emergency"],
  "algo-massive-haemothorax": ["Surgery", "Emergency"], "algo-fast-positive": ["Surgery", "Emergency"], "algo-open-fracture": ["Orthopedics", "Surgery"], "algo-compartment": ["Orthopedics", "Surgery"], "algo-c-spine": ["Orthopedics", "Emergency"], "algo-trauma-primary": ["Surgery", "Emergency"], "algo-testicular-torsion": ["Urology", "Surgery"],
  "algo-cico": ["Emergency", "ENT"], "algo-massive-haemoptysis": ["Respiratory", "Emergency"], "algo-ards-vent": ["Respiratory", "Medicine"], "algo-blocked-trach": ["ENT", "Surgery"], "algo-pneumothorax-spont": ["Respiratory", "Emergency"],
  "antidote-russell-viper": ["Emergency", "Medicine"], "antidote-asv-repeat": ["Emergency", "Medicine"], "antidote-cobra": ["Emergency", "Medicine"], "antidote-krait": ["Emergency", "Medicine"], "antidote-asv-reaction": ["Emergency", "Medicine"], "antidote-snake-firstaid": ["General Practice", "Emergency"], "antidote-scorpion": ["Pediatrics", "Emergency"],
  "antidote-bee-sting": ["Emergency", "General Practice"], "antidote-rabies-cat3": ["General Practice", "Emergency", "Infectious Disease"], "antidote-tick": ["Pediatrics", "Neurology"],
  "antidote-rocuronium": ["Surgery", "Emergency"], "antidote-atracurium": ["Surgery"], "antidote-sux-apnoea": ["Surgery"], "antidote-sux-hyperk": ["Surgery", "Emergency"], "antidote-mh": ["Surgery"], "antidote-lignocaine": ["Surgery", "Emergency"], "antidote-postop-opioid": ["Surgery", "Medicine"], "antidote-pris": ["Medicine", "Emergency"], "antidote-dexmedetomidine": ["Cardiology", "Surgery"], "antidote-icu-nms": ["Psychiatry", "Medicine"],
  "antidote-nms": ["Psychiatry", "Medicine"], "antidote-serotonin": ["Psychiatry", "Medicine"], "antidote-lithium": ["Psychiatry", "Nephrology"], "antidote-dystonia": ["Psychiatry", "Emergency"],
  "antidote-lysis-bleed": ["Neurology", "Cardiology"], "antidote-lmwh-protamine": ["Cardiology", "Medicine"], "antidote-drug-torsades": ["Cardiology", "Psychiatry"],
  "antidote-tumour-lysis": ["Nephrology", "Medicine"], "antidote-hyperammonaemia": ["Gastroenterology", "Medicine"], "antidote-hypercalcaemia": ["Endocrinology", "Medicine"], "antidote-porphyria": ["Medicine", "Neurology"], "antidote-wilson": ["Gastroenterology", "Neurology"], "antidote-refeeding": ["Medicine", "Psychiatry"], "antidote-hypocalcaemia-thyroid": ["Endocrinology", "Surgery"],
  "antidote-organochlorine": ["Emergency", "Medicine"], "antidote-pyrethroid": ["Emergency", "Medicine"], "antidote-oleander": ["Emergency", "Cardiology"],
  "antidote-iron": ["Pediatrics"], "antidote-warfarin": ["Cardiology", "Medicine"], "antidote-heparin": ["Cardiology", "Surgery"], "antidote-isoniazid": ["Infectious Disease", "Respiratory"],
  "calc-pcm": ["Pediatrics", "General Practice"], "calc-curb": ["Respiratory", "Medicine", "General Practice"], "calc-gcs": ["Neurology", "Emergency", "Surgery"], "calc-crcl": ["Nephrology"], "calc-ag": ["Nephrology", "Endocrinology"],
  "calc-na": ["Endocrinology"], "calc-hs": ["Gastroenterology"],
  ...CALC_OWNER,
};

/** Keeps the questions for this level, the doctor's own specialty's first, then a few more for variety. */
export function forDoctor<T extends { id: string }>(items: T[], level: SkillLevel, specialty: string | null | undefined, count: number): T[] {
  const kept = level === "basic" ? items.filter((i) => !ADVANCED.has(i.id)) : items;
  const own = specialty ? kept.filter((i) => OWNER[i.id]?.includes(specialty)) : [];
  const rest = kept.filter((i) => !own.includes(i));
  return [...shuffle(own), ...shuffle(rest)].slice(0, count);
}

/** A question from a right answer and distractors (each with why it's wrong), shuffled. */
function q(id: string, stem: string, right: string, explain: string, wrong: [string, string][], source: string): QuizQuestion {
  const opts = shuffle([{ t: right, why: "" }, ...wrong.map(([t, why]) => ({ t, why }))]);
  return { id, stem, options: opts.map((o) => o.t), answer: opts.findIndex((o) => o.t === right), explain, whyNot: opts.map((o) => o.why), source };
}

/* Antidotes ---------------------------------------------------------------- */

const ANTIDOTES: [string, string, string, string, [string, string][]][] = [
  ["paracetamol", "A 19-year-old took 40 tablets of paracetamol 500 mg 6 hours ago. The level is above the treatment line.", "IV N-acetylcysteine", "NAC replenishes glutathione; give it when the 4-hour-or-later level is on or above the treatment line (or if unsure of timing).", [["Oral methionine", "An older oral alternative, unreliable when the patient vomits; IV NAC is the standard."], ["Activated charcoal alone", "Useful only within about an hour; it doesn't treat a level already above the line."], ["IV silibinin", "For amatoxin (death-cap) mushroom poisoning."]]],
  ["organophosphate", "A farmer is brought in with pinpoint pupils, drooling, bronchorrhoea, bradycardia and fasciculations after spraying his field.", "Atropine in doubling doses ± pralidoxime", "Atropine blocks the muscarinic excess; titrate to drying of secretions, not to the heart rate.", [["Naloxone, repeated until breathing improves", "For opioids; pupils are small in both, but bronchorrhoea and fasciculations point to organophosphates."], ["Physostigmine, repeated until secretions dry", "A cholinesterase inhibitor: it adds to the cholinergic excess."], ["Neostigmine with glycopyrrolate cover", "Neostigmine also inhibits cholinesterase, so it deepens the crisis."]]],
  ["opioid", "A 25-year-old is found unresponsive with RR 6/min and pinpoint pupils; needle marks on the arms.", "IV naloxone, titrated to breathing", "A pure opioid antagonist; repeat or infuse, as its action is shorter than most opioids'.", [["IV flumazenil, titrated to breathing", "For benzodiazepines, which don't cause pinpoint pupils; risky in mixed overdoses."], ["IV atropine, titrated to a dry chest", "For cholinergic poisoning; there are no secretions or fasciculations here."], ["IV physostigmine, titrated to waking", "For anticholinergic delirium, which has big pupils."]]],
  ["benzo", "A patient became over-sedated after IV midazolam for a procedure, with RR 8/min.", "IV flumazenil, in small titrated doses", "Reverses benzodiazepines; avoid in chronic users or mixed overdoses (especially tricyclics) because of seizure risk.", [["IV naloxone, in small titrated doses", "Reverses opioids; it doesn't reverse benzodiazepines."], ["IV physostigmine, in small titrated doses", "For anticholinergic toxicity."], ["IV doxapram, by infusion", "A non-specific respiratory stimulant; it doesn't reverse midazolam."]]],
  ["warfarin", "A patient on warfarin has an INR of 9 with a large intracranial bleed.", "IV vitamin K plus 4-factor PCC", "PCC replaces the factors at once; vitamin K makes the reversal last.", [["IV vitamin K plus fresh frozen plasma", "Plasma is slower, needs a large volume and corrects the INR incompletely; PCC is preferred."], ["Oral vitamin K plus tranexamic acid", "Oral vitamin K is too slow for a life-threatening bleed, and tranexamic acid doesn't replace factors."], ["IV protamine plus vitamin K", "Protamine reverses heparin, not warfarin."]]],
  ["heparin", "Bleeding after a large dose of unfractionated heparin during a procedure.", "IV protamine sulfate", "Binds heparin; 1 mg neutralises about 100 units given in the last few hours.", [["IV vitamin K", "For warfarin."], ["IV recombinant factor VIIa", "Doesn't neutralise heparin, and it risks clotting."], ["IV andexanet alfa", "For factor Xa inhibitors."]]],
  ["digoxin", "An elderly patient on digoxin has nausea, yellow vision, bradycardia and potassium 6.4.", "Digoxin-specific Fab fragments", "They bind digoxin; indicated for life-threatening arrhythmias or hyperkalaemia in toxicity.", [["IV calcium gluconate, repeated", "Traditionally avoided in digoxin toxicity, and it doesn't remove digoxin."], ["Atropine and temporary pacing", "Atropine may help for a time, but the irritable heart makes pacing hazardous and the toxin stays."], ["Insulin–dextrose for the potassium", "Lowers the potassium for a while but leaves digoxin bound to the heart."]]],
  ["methanol", "After drinking illicit liquor, a man has blurred vision, a severe high anion-gap acidosis and a raised osmolar gap.", "Fomepizole (or ethanol) with haemodialysis", "Blocks alcohol dehydrogenase so methanol isn't turned into formic acid; dialysis removes both.", [["N-acetylcysteine with haemodialysis", "NAC is for paracetamol; without a blocker, methanol keeps turning into formic acid."], ["Thiamine with folinic acid alone", "Folinate is only an adjunct; neither stops formic acid being made."], ["IV bicarbonate with forced urine alkalinisation", "Bicarbonate buffers the acidosis, but alkaline urine is for salicylates and doesn't remove methanol."]]],
  ["iron", "A toddler swallowed a bottle of iron tablets; vomiting, abdominal pain and a high serum iron.", "IV desferrioxamine", "Chelates free iron in serious toxicity.", [["Activated charcoal, repeated", "Doesn't bind iron."], ["IV sodium calcium edetate", "For lead."], ["Oral penicillamine", "For copper (and lead)."]]],
  ["betablocker", "After an overdose of propranolol: HR 38, BP 70/40, not responding to atropine.", "IV glucagon with high-dose insulin", "Glucagon raises cAMP by a route that bypasses beta-receptors; high-dose insulin supports the failing heart.", [["More atropine, to 6 mg in total", "The block isn't vagal; he has already failed atropine."], ["Digoxin-specific Fab fragments", "For digoxin and cardiac glycosides, not beta-blockers."], ["IV magnesium sulfate infusion", "Lowers BP and heart rate further."]]],
  ["ccb", "An overdose of amlodipine: severe hypotension and bradycardia.", "IV calcium with high-dose insulin", "Calcium counters the channel block; high-dose insulin supports the heart's metabolism.", [["IV magnesium with fluids", "Magnesium itself blocks calcium channels and lowers BP."], ["Digoxin-specific Fab fragments", "For digoxin and cardiac glycosides."], ["Haemodialysis with fluids", "Amlodipine is highly protein-bound and isn't dialysed."]]],
  ["cyanide", "A smoke-inhalation victim with a severe lactic acidosis and shock.", "IV hydroxocobalamin", "Binds cyanide to form cyanocobalamin, excreted in the urine.", [["100% oxygen alone", "Needed for carbon monoxide, but doesn't bind cyanide."], ["IV methylene blue", "For methaemoglobinaemia."], ["IV N-acetylcysteine", "For paracetamol."]]],
  ["snake", "A farmer bitten by a snake has non-clotting blood on the 20-minute whole-blood clotting test.", "Polyvalent anti-snake venom", "Venom-induced coagulopathy is an indication for ASV (national snakebite protocol).", [["Fresh frozen plasma alone", "Doesn't neutralise venom; the factors keep being consumed without ASV."], ["IV vitamin K with platelets", "Doesn't reverse venom coagulopathy."], ["Neostigmine with atropine cover", "Used for cobra neurotoxicity, not coagulopathy."]]],
  ["tca", "After an amitriptyline overdose: QRS 140 ms, a wide-complex tachycardia and seizures.", "IV sodium bicarbonate", "Sodium loading and alkalinisation reverse the sodium-channel block and narrow the QRS.", [["IV physostigmine", "Can cause asystole in TCA overdose."], ["IV flumazenil", "Can precipitate seizures."], ["IV amiodarone", "Prolongs QT; not first line."]]],
  ["sulfonylurea", "Recurrent hypoglycaemia after a glimepiride overdose, despite dextrose.", "Octreotide with dextrose", "Octreotide stops the sulfonylurea-driven insulin release that keeps the sugar low.", [["Glucagon with dextrose", "Short-acting, and it can trigger more insulin release."], ["Hydrocortisone with dextrose", "Doesn't stop sulfonylurea-driven insulin release."], ["Naloxone with dextrose", "For opioids."]]],
  ["dabigatran", "A patient on dabigatran needs emergency surgery and is bleeding.", "Idarucizumab", "A monoclonal antibody fragment that binds dabigatran within minutes.", [["Phytomenadione (vitamin K)", "For warfarin."], ["Protamine sulfate", "For heparin."], ["Andexanet alfa", "For factor Xa inhibitors (apixaban, rivaroxaban)."]]],
  ["methotrexate", "Mouth ulcers and pancytopenia after a methotrexate dosing error.", "Folinic acid (leucovorin)", "Bypasses the blocked dihydrofolate reductase step.", [["Folic acid (high dose)", "Needs the blocked enzyme, so it can't bypass the block."], ["Vitamin B12 (hydroxocobalamin)", "Not the antidote; the deficit is reduced folate."], ["Pyridoxine (vitamin B6)", "For isoniazid."]]],
  ["isoniazid", "Seizures that won't stop after an isoniazid overdose.", "IV pyridoxine (vitamin B6)", "Isoniazid depletes pyridoxine, which GABA synthesis needs.", [["IV phenytoin loading dose", "Often fails in isoniazid seizures."], ["IV thiamine (vitamin B1)", "For Wernicke's."], ["IV folinic acid", "For methotrexate."]]],
  ["lignocaine", "Seizures then cardiac arrest during a nerve block with bupivacaine.", "IV 20% lipid emulsion", "Lipid binds the local anaesthetic (the 'lipid sink').", [["IV sodium bicarbonate", "For tricyclic sodium-channel block; it isn't the antidote to bupivacaine."], ["IV lidocaine 1 mg/kg", "Another local anaesthetic: it adds to the toxicity."], ["IV methylene blue", "For methaemoglobinaemia."]]],
];

/** Each antidote's own authority — never one line for all. */
const ANTIDOTE_SOURCE: Record<string, string> = {
  snake: "National Snakebite Management Protocol (MoHFW, India, 2017); WHO Guidelines for the Management of Snakebites (2016)",
  organophosphate: "WHO / IPCS Poisons Information; AIIMS Poison Control Centre protocols",
  paracetamol: "BNF; TOXBASE; RCEM/NPIS paracetamol overdose guideline",
  methanol: "BNF; TOXBASE; EXTRIP recommendations for toxic alcohols",
  iron: "BNF; TOXBASE",
  digoxin: "BNF (digoxin-specific antibody fragments); TOXBASE",
  warfarin: "BNF; British Society for Haematology guideline on warfarin reversal",
  heparin: "BNF (protamine sulfate)",
  dabigatran: "BNF (idarucizumab); European Heart Rhythm Association practical guide on DOACs",
  opioid: "BNF (naloxone); Resuscitation Council UK",
  benzo: "BNF (flumazenil — cautions); TOXBASE",
  cyanide: "BNF (hydroxocobalamin); TOXBASE",
  tca: "TOXBASE (sodium bicarbonate for QRS widening)",
  betablocker: "TOXBASE (glucagon, high-dose insulin)",
  ccb: "TOXBASE; EXTRIP / expert consensus on calcium channel blocker poisoning (2017)",
  sulfonylurea: "TOXBASE (octreotide with glucose)",
  methotrexate: "BNF (folinic acid / glucarpidase)",
  isoniazid: "TOXBASE (pyridoxine)",
  lignocaine: "Association of Anaesthetists — local anaesthetic systemic toxicity guideline (lipid emulsion)",
};

const ALL_ANTIDOTES: [string, string, string, string, [string, string][], string][] = [
  ...ANTIDOTES.map(([id, stem, right, explain, wrong]): [string, string, string, string, [string, string][], string] => [id, stem, right, explain, wrong, ANTIDOTE_SOURCE[id] ?? "BNF; TOXBASE (UK National Poisons Information Service)"]),
  ...MORE_ANTIDOTES,
  // Written by AI and checked by an AI examiner, filling each subcategory towards 50 (scripts/gen-quiz.mjs).
  ...(EXTRA.antidotes as ExtraQ[]).map((q): [string, string, string, string, [string, string][], string] => [`x-${q.id}`, q.stem, q.right, q.explain, q.wrong as [string, string][], q.source]),
];
interface ExtraQ { id: string; cat: string; stem: string; right: string; explain: string; wrong: string[][]; source: string }
/** The subcategory each AI-written question was written for. */
const EXTRA_CAT = new Map<string, string>([...(EXTRA.antidotes as ExtraQ[]).map((q) => [`antidote-x-${q.id}`, q.cat] as const), ...(EXTRA.algorithms as ExtraQ[]).map((q) => [`algo-x-${q.id}`, q.cat] as const)]);
const EXTRA_ALGOS = (EXTRA.algorithms as ExtraQ[]).map((q): [string, string, string, string, [string, string][], string] => [`x-${q.id}`, q.stem, q.right, q.explain, q.wrong as [string, string][], q.source]);

export const antidoteQuestions = (level: SkillLevel = "full", specialty?: string | null, cat?: string): QuizQuestion[] =>
  forDoctor(ALL_ANTIDOTES.map((a) => ({ id: `antidote-${a[0]}`, a })).filter((x) => !cat || catOf(ANTIDOTE_CATS, x.id) === cat), level, specialty, 10).map(({ a }) => a).map(([id, stem, right, explain, wrong, src]) => q(`antidote-${id}`, `${stem} The specific treatment?`, right, explain, wrong, src));

/* Emergency algorithms ------------------------------------------------------ */

const ALGORITHMS: [string, string, string, string, [string, string][], string][] = [
  ["vf", "Cardiac arrest; the monitor shows ventricular fibrillation. CPR is under way.", "Defibrillate, then CPR for 2 minutes", "In a shockable rhythm the shock comes first; every second without CPR around it matters.", [["Adrenaline 1 mg, then CPR for 2 minutes", "Adrenaline goes after the 2nd shock in VF."], ["Amiodarone 300 mg, then CPR for 2 minutes", "After the 3rd shock."], ["Pulse check, then CPR for 2 minutes", "Pulse checks are under 10 seconds, at the 2-minute rhythm check; don't delay the shock."]], "AHA ACLS 2020"],
  ["asystole", "Cardiac arrest in asystole; CPR is going.", "Adrenaline 1 mg IV now, every 3–5 minutes", "Non-shockable: adrenaline early, good CPR, and the reversible causes (4 Hs and 4 Ts).", [["Defibrillate at 200 J, and again every 2 minutes", "Asystole isn't shockable."], ["Atropine 3 mg IV now, once only", "No longer recommended in arrest."], ["Amiodarone 300 mg IV now, once only", "Only for shockable rhythms."]], "AHA ACLS 2020"],
  ["anaphylaxis", "Minutes after IV ceftriaxone: wheeze, stridor, urticaria and BP 70/40.", "IM adrenaline 0.5 mg, outer thigh", "IM adrenaline (1:1000) is the first and most important drug in anaphylaxis; repeat after 5 minutes if needed.", [["IV hydrocortisone 200 mg, slowly", "Steroids are slow and not first line."], ["IV chlorphenamine 10 mg, slowly", "Treats only the skin; doesn't save life."], ["IV adrenaline 1 mg, as a bolus", "The arrest dose — dangerous in a patient with a pulse."]], "Resuscitation Council UK 2021; WAO"],
  ["dka", "A diabetic with glucose 480 mg/dL, pH 7.1, ketones 5 mmol/L and potassium 3.1.", "Fluids and potassium; hold insulin for now", "Insulin drives potassium into cells; starting it with potassium this low (under about 3.3–3.5) risks arrhythmia.", [["Fluids and insulin infusion straight away", "Not with potassium this low: replace it first."], ["Fluids and bicarbonate; hold insulin for now", "Bicarbonate only if pH is below 6.9, and it lowers potassium further."], ["Subcutaneous insulin; discharge with review", "DKA needs IV fluids and an insulin infusion in hospital."]], "ADA / JBDS DKA guidelines"],
  ["status", "A patient has been fitting for 6 minutes with no IV access.", "Buccal or intranasal midazolam", "First-line benzodiazepine by whatever route is available; repeat once after 5–10 minutes.", [["Phenytoin loading dose via IO", "Second line, after two doses of benzodiazepine."], ["Observe for 10 minutes more", "Treat status from 5 minutes."], ["General anaesthesia with intubation", "Third line (refractory status)."]], "NICE / AES status epilepticus guideline"],
  ["hyperk", "Potassium 7.2 mmol/L with peaked T waves and a broad QRS.", "IV calcium gluconate 10%, 30 mL", "Calcium protects the heart within minutes; then insulin–dextrose and salbutamol shift potassium.", [["Oral calcium resonium, 15 g", "Takes hours."], ["IV furosemide, 80 mg", "Slow and unreliable."], ["Repeat the potassium, in 1 hour", "With ECG changes, treat now."]], "UK Kidney Association hyperkalaemia guideline"],
  ["pph", "Ten minutes after delivery, heavy bleeding; the uterus is soft and boggy.", "Uterine massage with oxytocin", "Atony causes most PPH: rub up the uterus (bimanual compression if needed) and give uterotonics first.", [["Balloon tamponade straight away", "Second line, if massage and uterotonics fail."], ["Immediate peripartum hysterectomy", "Last resort."], ["Observe, with a repeat check in 1 hour", "PPH kills within hours."]], "WHO PPH recommendations; FOGSI"],
  ["tension", "After chest trauma: severe breathlessness, tracheal deviation, absent breath sounds on one side and BP 80/50.", "Needle or finger decompression now", "Tension pneumothorax is a clinical diagnosis — treat before any X-ray, then place a chest drain.", [["Chest X-ray, then chest drain", "Never delay decompression for imaging."], ["Intubation, then chest X-ray", "Positive pressure worsens tension."], ["IV fluids, then CT chest", "Doesn't relieve the tension, and CT delays it."]], "ATLS 10th edition"],
  ["sepsis", "Fever, confusion, BP 85/50 and lactate 4.5 in a patient with a urinary infection.", "Cultures, IV antibiotics, 30 mL/kg crystalloid", "The sepsis hour-1 bundle; vasopressors if hypotension persists after fluids.", [["Cultures, oral antibiotics, review at 24 hours", "This is septic shock: IV antibiotics within the hour."], ["Cultures, await results, maintenance fluids", "Antibiotics within the first hour, not after results."], ["Cultures, IV steroids, maintenance fluids", "Steroids only for refractory shock; antibiotics and a bolus come first."]], "Surviving Sepsis Campaign 2021"],
  ["stroke", "Sudden right-sided weakness and aphasia 90 minutes ago; glucose normal.", "Urgent non-contrast CT, then thrombolysis", "Time is brain: imaging to exclude haemorrhage, then alteplase/tenecteplase within 4.5 hours if no contraindication.", [["Aspirin 300 mg now, then CT in the morning", "Not before a bleed is excluded and the thrombolysis decision is made."], ["MRI the next day, then decide on treatment", "Too late for thrombolysis."], ["IV labetalol to 120/80, then urgent CT head", "Aggressive lowering harms the penumbra."]], "AHA/ASA acute stroke guideline 2019"],
];

export const algorithmQuestions = (level: SkillLevel = "full", specialty?: string | null, cat?: string): QuizQuestion[] =>
  forDoctor([...ALGORITHMS, ...MORE_ALGORITHMS, ...EXTRA_ALGOS].map((a) => ({ id: `algo-${a[0]}`, a })).filter((x) => !cat || catOf(ALGORITHM_CATS, x.id) === cat), level, specialty, 10).map(({ a }) => a).map(([id, stem, right, explain, wrong, src]) => q(`algo-${id}`, `${stem} What comes next?`, right, explain, wrong, src));

/** Every antidote and algorithm question with its options, for checks that need the whole bank (the drills deal out 10 at a time). */
export const allQuizQuestions = (): { kind: "antidote" | "algorithm"; cat: string; question: QuizQuestion }[] => [
  ...ALL_ANTIDOTES.map(([id, stem, right, explain, wrong, src]) => ({ kind: "antidote" as const, cat: catOf(ANTIDOTE_CATS, `antidote-${id}`), question: q(`antidote-${id}`, stem, right, explain, wrong, src) })),
  ...[...ALGORITHMS, ...MORE_ALGORITHMS, ...EXTRA_ALGOS].map(([id, stem, right, explain, wrong, src]) => ({ kind: "algorithm" as const, cat: catOf(ALGORITHM_CATS, `algo-${id}`), question: q(`algo-${id}`, stem, right, explain, wrong, src) })),
];

/* Clinical calculations ------------------------------------------------------ */

/** The calculators and their categories live in ./banks/calcs. */
const CALCS = CALC_BANK;

export const CALC_CATS: [string, RegExp][] = CALC_CATEGORY_PATTERNS;
/** Calculations come with fresh numbers every time: each subcategory gives endless cases. */
export const calculationQuestions = (level: SkillLevel = "full", specialty?: string | null, cat?: string): QuizQuestion[] => {
  if (!cat) return forDoctor(CALCS.map((make) => make()).map((x) => ({ ...x, id: `calc-${x.id}` })), level, specialty, 8);
  // One subcategory: its kinds of sum, each with fresh numbers, until there's a full set of 8.
  const makers = shuffle(CALCS.filter((make) => { const id = make().id; return catOf(CALC_CATS, id) === cat && (level !== "basic" || !ADVANCED.has(`calc-${id}`)); }));
  const out: QuizQuestion[] = [];
  for (let n = 0; out.length < 8 && n < 60; n++) {
    const q = makers[n % makers.length]!();
    if (!out.some((x) => x.stem === q.stem)) out.push({ ...q, id: `calc-${q.id}` });
  }
  return out;
};
export const CALC_IDS = (): { id: string; cat: string }[] => CALCS.map((make) => make()).map((x) => ({ id: `calc-${x.id}`, cat: catOf(CALC_CATS, x.id) }));

export const ANTIDOTE_COUNT = ALL_ANTIDOTES.length;
export const ALGORITHM_COUNT = ALGORITHMS.length + MORE_ALGORITHMS.length + EXTRA_ALGOS.length;
export const CALCULATION_COUNT = CALCS.length;

/** Subcategories, so a doctor can practise one area at a time and see progress in each. */
/* Each pattern is anchored to whole ids, so a question sits in the area it clinically belongs to and not wherever a substring happens to land it. */
export const ANTIDOTE_CATS: [string, RegExp][] = [
  ["Painkillers & psychiatric drugs", /^(paracetamol|salicylate|opioid|tca|lithium|valproate|serotonin|nms|dystonia)$/],
  ["Heart & blood drugs", /^(digoxin|betablocker|ccb|warfarin|heparin|heparin-hit|dabigatran|rivaroxaban|clonidine|cyanide-nitroprusside|lysis-bleed|lmwh-protamine|drug-torsades)$/],
  ["Diabetes & metabolic", /^(sulfonylurea|insulin|oral-hypo-metformin|ethanol|tumour-lysis|hyperammonaemia|hypercalcaemia|porphyria|wilson|refeeding|hypocalcaemia-thyroid)$/],
  ["Poisons & chemicals", /^(organophosphate|organochlorine|pyrethroid|oleander|anticholinergic|methanol|ethylene-glycol|cyanide|co|methb|lead|arsenic|mercury|iron|isoniazid|methotrexate|theophylline|paraquat|aluminium-phosphide|kerosene|corrosive|dapsone-hb|mushroom|botulism)$/],
  ["Bites, Stings & Envenomations", /^(snake|russell-viper|asv-repeat|asv-reaction|krait|cobra|snake-firstaid|scorpion|bee-sting|rabies-cat3|centipede|jellyfish|stingray|tick|spider)$/],
  ["Anaesthesia, Perioperative & ICU Reversal", /^(mh|lignocaine|benzo|local-methemoglobin|methb-g6pd|rocuronium|atracurium|sux-apnoea|sux-hyperk|pris|postop-opioid|dexmedetomidine|icu-nms)$/],
];
export const ALGORITHM_CATS: [string, RegExp][] = [
  ["Cardiac arrest & rhythms", /^(vf|asystole|rosc|brady-unstable|svt-stable|vt-pulse-unstable|vt-pulse-stable|af-fast-unstable|hypothermia|drowning)$/],
  ["Chest pain & heart", /^(stemi|stemi-lysis|rv-infarct|acs-nstemi|apo|massive-pe|aortic-dissection|hypertensive-emergency)$/],
  ["Airway & breathing", /^(asthma-severe|asthma-lifethreat|copd-exac|airway-obstruction|cico|massive-haemoptysis|ards-vent|blocked-trach|pneumothorax-spont)$/],
  ["Shock, sepsis & bleeding", /^(sepsis|septic-vasopressor|anaphylaxis|anaphylaxis-refractory|haemorrhage|massive-transfusion|upper-gi-bleed|burns-fluid|neurogenic-shock|cardiogenic-shock)$/],
  ["Brain & nerves", /^(status|stroke|lvo|sah|head-injury|meningitis|encephalitis|gbs|myasthenic-crisis|cord-compression)$/],
  ["Hormones & salts", /^(dka|hhs|hypoglycaemia|adrenal-crisis|thyroid-storm|myxoedema|hyponatraemia|hyperk)$/],
  ["Women & babies", /^(pph|pph-second|eclampsia|severe-htn-pregnancy|mag-toxicity|shoulder-dystocia|cord-prolapse|ectopic-ruptured|maternal-arrest|uterine-inversion|abruption)$/],
  ["Children", /^(paeds-arrest|neonatal-resus|nrp-hr|pals-brady|pals-svt|paeds-status|croup|epiglottitis|bronchiolitis|tet-spell|choking-infant|sepsis-child|dehydration-child|febrile-seizure|sam-child)$/],
  ["Surgery & trauma", /^(trauma-primary|tension|tamponade|massive-haemothorax|fast-positive|c-spine|open-fracture|compartment|acute-abdomen|testicular-torsion|hyperthermia)$/],
];
export const catOf = (cats: [string, RegExp][], id: string) => EXTRA_CAT.get(id) ?? cats.find(([, re]) => re.test(id.replace(/^(antidote|algo)-/, "")))?.[0] ?? "Other";

/** Every question id in a drill, with its subcategory — for the subcategory chips and their progress. */
export const ANTIDOTE_IDS = (): { id: string; cat: string }[] => ALL_ANTIDOTES.map((a) => ({ id: `antidote-${a[0]}`, cat: catOf(ANTIDOTE_CATS, `antidote-${a[0]}`) }));
export const ALGORITHM_IDS = (): { id: string; cat: string }[] => [...ALGORITHMS, ...MORE_ALGORITHMS, ...EXTRA_ALGOS].map((a) => ({ id: `algo-${a[0]}`, cat: catOf(ALGORITHM_CATS, `algo-${a[0]}`) }));

/** Every antidote and algorithm stem, by subcategory — for tools that add questions without repeating any. */
export const QUIZ_STEMS = () => ({
  antidotes: ALL_ANTIDOTES.map((a) => ({ cat: catOf(ANTIDOTE_CATS, `antidote-${a[0]}`), stem: a[1] })),
  algorithms: [...ALGORITHMS, ...MORE_ALGORITHMS, ...EXTRA_ALGOS].map((a) => ({ cat: catOf(ALGORITHM_CATS, `algo-${a[0]}`), stem: a[1] })),
});

/**
 * The whole drill as a study sheet, for its Learn module: every scenario with its answer and why, grouped by
 * subcategory — reading it covers everything the drill asks.
 */
export function quizReference(kind: "antidotes" | "algorithms" | "calculations"): { group: string; items: { title: string; text: string }[] }[] {
  const groups = new Map<string, { title: string; text: string }[]>();
  const put = (g: string, item: { title: string; text: string }) => groups.set(g, [...(groups.get(g) ?? []), item]);
  if (kind === "antidotes") for (const [id, stem, right, explain] of ALL_ANTIDOTES) put(catOf(ANTIDOTE_CATS, `antidote-${id}`), { title: stem, text: `**${right}** — ${explain}` });
  if (kind === "algorithms") for (const [id, stem, right, explain] of [...ALGORITHMS, ...MORE_ALGORITHMS, ...EXTRA_ALGOS]) put(catOf(ALGORITHM_CATS, `algo-${id}`), { title: stem, text: `**${right}** — ${explain}` });
  if (kind === "calculations")
    for (const make of CALCS) {
      const q = make();
      put(catOf(CALC_CATS, q.id), { title: q.stem, text: `**${q.options[q.answer]}** — ${q.explain}` });
    }
  return [...groups].map(([group, items]) => ({ group, items }));
}
