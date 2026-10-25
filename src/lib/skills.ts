/**
 * Skills Lab drills that need no AI and no pictures: antidotes, emergency algorithms and clinical
 * calculations. Answers follow standard references (BNF / Toxbase, AHA ACLS 2020–2025, NICE, WHO,
 * Harrison's); calculations are worked out here, with fresh numbers each time.
 */
import { MORE_ALGORITHMS, MORE_ANTIDOTES } from "./banks/quiz";

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
  "calc-ag", "calc-crcl", "calc-hs", "calc-ca", "calc-na",
]);

/** Which specialty each question belongs to — a doctor's own come first. */
const OWNER: Record<string, string[]> = {
  "algo-vf": ["Cardiology", "Emergency", "Medicine"], "algo-asystole": ["Cardiology", "Emergency"], "algo-anaphylaxis": ["Emergency", "Medicine", "General Practice"],
  "algo-dka": ["Endocrinology", "Medicine", "Emergency"], "algo-status": ["Neurology", "Emergency", "Pediatrics"], "algo-hyperk": ["Nephrology", "Medicine"],
  "algo-pph": ["OBGYN"], "algo-tension": ["Surgery", "Emergency", "Respiratory"], "algo-sepsis": ["Infectious Disease", "Medicine", "Emergency", "Urology", "General Practice"],
  "algo-stroke": ["Neurology", "Emergency"],
  "antidote-snake": ["Emergency", "Medicine"], "antidote-organophosphate": ["Emergency", "Medicine"], "antidote-paracetamol": ["Emergency", "Gastroenterology"],
  "antidote-iron": ["Pediatrics"], "antidote-warfarin": ["Cardiology", "Medicine"], "antidote-heparin": ["Cardiology", "Surgery"], "antidote-isoniazid": ["Infectious Disease", "Respiratory"],
  "calc-pcm": ["Pediatrics", "General Practice"], "calc-curb": ["Respiratory", "Medicine", "General Practice"], "calc-gcs": ["Neurology", "Emergency", "Surgery"], "calc-crcl": ["Nephrology"], "calc-ag": ["Nephrology", "Endocrinology"],
  "calc-na": ["Endocrinology"], "calc-hs": ["Gastroenterology"],
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
  ["paracetamol", "A 19-year-old took 40 tablets of paracetamol 500 mg 6 hours ago. The level is above the treatment line.", "IV N-acetylcysteine", "NAC replenishes glutathione; give it when the 4-hour-or-later level is on or above the treatment line (or if unsure of timing).", [["Naloxone", "Reverses opioids, not paracetamol."], ["Activated charcoal alone", "Useful only within 1 hour; it doesn't treat established toxicity."], ["Fomepizole", "For toxic alcohols (methanol, ethylene glycol)."]]],
  ["organophosphate", "A farmer is brought in with pinpoint pupils, drooling, bronchorrhoea, bradycardia and fasciculations after spraying his field.", "Atropine (doubling doses until the chest is dry) ± pralidoxime", "Atropine blocks the muscarinic excess; titrate to drying of secretions, not to the heart rate.", [["Flumazenil", "Reverses benzodiazepines."], ["Physostigmine", "Worsens cholinergic toxicity — it's a cholinesterase inhibitor."], ["Naloxone", "For opioids; pupils are small in both, but bronchorrhoea and fasciculations point to organophosphates."]]],
  ["opioid", "A 25-year-old is found unresponsive with RR 6/min and pinpoint pupils; needle marks on the arms.", "Naloxone", "A pure opioid antagonist; repeat or infuse, as its action is shorter than most opioids'.", [["Flumazenil", "For benzodiazepines, and risky in mixed overdoses."], ["Atropine", "For cholinergic poisoning or bradycardia."], ["N-acetylcysteine", "For paracetamol."]]],
  ["benzo", "A patient became over-sedated after IV midazolam for a procedure, with RR 8/min.", "Flumazenil (with caution)", "Reverses benzodiazepines; avoid in chronic users or mixed overdoses because of seizure risk.", [["Naloxone", "Doesn't reverse benzodiazepines."], ["Physostigmine", "For anticholinergic toxicity."], ["Glucagon", "For beta-blocker overdose."]]],
  ["warfarin", "A patient on warfarin has an INR of 9 with a large intracranial bleed.", "IV vitamin K plus prothrombin complex concentrate (PCC)", "PCC replaces the factors at once; vitamin K makes the reversal last.", [["Protamine", "Reverses heparin, not warfarin."], ["Oral vitamin K alone", "Too slow for a life-threatening bleed."], ["Idarucizumab", "Reverses dabigatran."]]],
  ["heparin", "Bleeding after a large dose of unfractionated heparin during a procedure.", "Protamine sulfate", "Binds heparin; 1 mg neutralises about 100 units given in the last few hours.", [["Vitamin K", "For warfarin."], ["Tranexamic acid alone", "Doesn't neutralise heparin."], ["Andexanet alfa", "For factor Xa inhibitors."]]],
  ["digoxin", "An elderly patient on digoxin has nausea, yellow vision, bradycardia and potassium 6.4.", "Digoxin-specific antibody (Fab) fragments", "They bind digoxin; indicated for life-threatening arrhythmias or hyperkalaemia in toxicity.", [["IV calcium gluconate", "Avoided traditionally in digoxin toxicity, and doesn't remove digoxin."], ["Atropine alone", "May help bradycardia but doesn't treat the toxicity."], ["Lidocaine", "Not the antidote."]]],
  ["methanol", "After drinking illicit liquor, a man has blurred vision, a severe high anion-gap acidosis and a raised osmolar gap.", "Fomepizole (or ethanol) and haemodialysis", "Blocks alcohol dehydrogenase so methanol isn't turned into formic acid; dialysis removes both.", [["N-acetylcysteine", "For paracetamol."], ["Naloxone", "For opioids."], ["Thiamine alone", "Supportive in alcohol use, not the antidote."]]],
  ["iron", "A toddler swallowed a bottle of iron tablets; vomiting, abdominal pain and a high serum iron.", "IV desferrioxamine", "Chelates free iron in serious toxicity.", [["Activated charcoal", "Doesn't bind iron."], ["EDTA", "For lead."], ["Penicillamine", "For copper (and lead)."]]],
  ["betablocker", "After an overdose of propranolol: HR 38, BP 70/40, not responding to atropine.", "IV glucagon (and high-dose insulin)", "Glucagon raises cAMP by a route that bypasses beta-receptors.", [["Flumazenil", "For benzodiazepines."], ["Naloxone", "For opioids."], ["Digoxin Fab", "For digoxin."]]],
  ["ccb", "An overdose of amlodipine: severe hypotension and bradycardia.", "IV calcium and high-dose insulin–euglycaemia therapy", "Calcium counters the channel block; high-dose insulin supports the heart's metabolism.", [["Protamine", "For heparin."], ["Physostigmine", "For anticholinergic toxicity."], ["Fomepizole", "For toxic alcohols."]]],
  ["cyanide", "A smoke-inhalation victim with a severe lactic acidosis and shock.", "Hydroxocobalamin", "Binds cyanide to form cyanocobalamin, excreted in the urine.", [["100% oxygen alone", "Needed for carbon monoxide, but doesn't bind cyanide."], ["Methylene blue", "For methaemoglobinaemia."], ["Atropine", "For cholinergic poisoning."]]],
  ["snake", "A farmer bitten by a snake has non-clotting blood on the 20-minute whole-blood clotting test.", "Anti-snake venom (polyvalent ASV)", "Venom-induced coagulopathy is an indication for ASV (national snakebite protocol).", [["Neostigmine alone", "Used with atropine for neurotoxic bites, not coagulopathy."], ["Vitamin K", "Doesn't reverse venom coagulopathy."], ["Tourniquet", "Not recommended."]]],
  ["tca", "After an amitriptyline overdose: QRS 140 ms, a wide-complex tachycardia and seizures.", "IV sodium bicarbonate", "Sodium loading and alkalinisation reverse the sodium-channel block and narrow the QRS.", [["Physostigmine", "Can cause asystole in TCA overdose."], ["Flumazenil", "Can precipitate seizures."], ["Amiodarone", "Prolongs QT; not first line."]]],
  ["sulfonylurea", "Recurrent hypoglycaemia after a glimepiride overdose, despite dextrose.", "Octreotide (with dextrose)", "Octreotide stops the sulfonylurea-driven insulin release that keeps the sugar low.", [["Glucagon alone", "Short-acting and can trigger more insulin release."], ["Insulin", "Makes it worse."], ["Naloxone", "For opioids."]]],
  ["dabigatran", "A patient on dabigatran needs emergency surgery and is bleeding.", "Idarucizumab", "A monoclonal antibody fragment that binds dabigatran within minutes.", [["Vitamin K", "For warfarin."], ["Protamine", "For heparin."], ["Andexanet alfa", "For factor Xa inhibitors (apixaban, rivaroxaban)."]]],
  ["methotrexate", "Mouth ulcers and pancytopenia after a methotrexate dosing error.", "Folinic acid (leucovorin)", "Bypasses the blocked dihydrofolate reductase step.", [["Folic acid", "Can't bypass the block."], ["Vitamin B12", "Not the antidote."], ["Desferrioxamine", "For iron."]]],
  ["isoniazid", "Seizures that won't stop after an isoniazid overdose.", "IV pyridoxine (vitamin B6)", "Isoniazid depletes pyridoxine, which GABA synthesis needs.", [["Phenytoin alone", "Often fails in isoniazid seizures."], ["Thiamine", "For Wernicke's."], ["Naloxone", "For opioids."]]],
  ["lignocaine", "Seizures then cardiac arrest during a nerve block with bupivacaine.", "IV 20% lipid emulsion", "Lipid binds the local anaesthetic (the 'lipid sink').", [["Naloxone", "For opioids."], ["Flumazenil", "For benzodiazepines."], ["Atropine", "Not the antidote."]]],
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
];

export const antidoteQuestions = (level: SkillLevel = "full", specialty?: string | null): QuizQuestion[] =>
  forDoctor(ALL_ANTIDOTES.map((a) => ({ id: `antidote-${a[0]}`, a })), level, specialty, 10).map(({ a }) => a).map(([id, stem, right, explain, wrong, src]) => q(`antidote-${id}`, `${stem} The specific treatment?`, right, explain, wrong, src));

/* Emergency algorithms ------------------------------------------------------ */

const ALGORITHMS: [string, string, string, string, [string, string][], string][] = [
  ["vf", "Cardiac arrest; the monitor shows ventricular fibrillation. CPR is under way.", "Defibrillate now, then resume CPR at once for 2 minutes", "In a shockable rhythm the shock comes first; every second without CPR around it matters.", [["Give adrenaline first", "Adrenaline goes after the 2nd shock in VF."], ["Check a pulse for 30 seconds", "Pulse checks are under 10 seconds, at the 2-minute rhythm check."], ["Give amiodarone first", "After the 3rd shock."]], "AHA ACLS 2020"],
  ["asystole", "Cardiac arrest in asystole; CPR is going.", "Give adrenaline 1 mg IV as soon as possible, repeat every 3–5 minutes", "Non-shockable: adrenaline early, good CPR, and the reversible causes (4 Hs and 4 Ts).", [["Defibrillate", "Asystole isn't shockable."], ["Atropine 3 mg", "No longer recommended in arrest."], ["Amiodarone", "Only for shockable rhythms."]], "AHA ACLS 2020"],
  ["anaphylaxis", "Minutes after IV ceftriaxone: wheeze, stridor, urticaria and BP 70/40.", "IM adrenaline 0.5 mg (1:1000) into the outer thigh, repeat after 5 minutes if needed", "IM adrenaline is the first and most important drug in anaphylaxis.", [["IV hydrocortisone first", "Steroids are slow and not first line."], ["Antihistamine first", "Treats only the skin; doesn't save life."], ["IV adrenaline 1 mg bolus", "The arrest dose — dangerous in a patient with a pulse."]], "Resuscitation Council UK 2021; WAO"],
  ["dka", "A diabetic with glucose 480 mg/dL, pH 7.1, ketones 5 mmol/L and potassium 3.1.", "IV fluids, and replace potassium before starting insulin", "Insulin drives potassium into cells; starting it with potassium under 3.3 risks arrhythmia.", [["Start the insulin infusion at once", "Not with potassium under 3.3 mmol/L."], ["Bicarbonate", "Only if pH is below 6.9."], ["Subcutaneous insulin and discharge", "DKA needs IV fluids and an insulin infusion."]], "ADA / JBDS DKA guidelines"],
  ["status", "A patient has been fitting for 6 minutes with no IV access.", "Buccal/intranasal midazolam (or rectal diazepam)", "First-line benzodiazepine by whatever route is available; repeat once after 5–10 minutes.", [["IV phenytoin", "Second line, after two doses of benzodiazepine."], ["Wait for 10 minutes", "Treat status from 5 minutes."], ["General anaesthesia first", "Third line (refractory status)."]], "NICE / AES status epilepticus guideline"],
  ["hyperk", "Potassium 7.2 mmol/L with peaked T waves and a broad QRS.", "IV calcium gluconate 10% 30 mL at once", "Calcium protects the heart within minutes; then insulin–dextrose and salbutamol shift potassium.", [["Calcium resonium first", "Takes hours."], ["Furosemide first", "Slow and unreliable."], ["Repeat the potassium first", "With ECG changes, treat now."]], "UK Kidney Association hyperkalaemia guideline"],
  ["pph", "Ten minutes after delivery, heavy bleeding; the uterus is soft and boggy.", "Uterine massage and IV/IM oxytocin, with bimanual compression", "Atony causes most PPH: rub up the uterus and give uterotonics first.", [["Hysterectomy", "Last resort."], ["Wait and watch", "PPH kills within hours."], ["Ergometrine in a woman with pre-eclampsia", "Contraindicated with hypertension."]], "WHO PPH recommendations; FOGSI"],
  ["tension", "After chest trauma: severe breathlessness, tracheal deviation, absent breath sounds on one side and BP 80/50.", "Immediate needle (or finger) decompression, then a chest drain", "Tension pneumothorax is a clinical diagnosis — treat before any X-ray.", [["Chest X-ray first", "Never delay decompression for imaging."], ["Intubate first", "Positive pressure worsens tension."], ["IV fluids and observe", "Doesn't relieve the tension."]], "ATLS 10th edition"],
  ["sepsis", "Fever, confusion, BP 85/50 and lactate 4.5 in a patient with a urinary infection.", "Blood cultures, broad-spectrum IV antibiotics within an hour, and 30 mL/kg crystalloid", "The sepsis hour-1 bundle; vasopressors if hypotension persists after fluids.", [["Wait for the culture result", "Antibiotics within the first hour."], ["Steroids first", "Only for refractory shock."], ["Oral antibiotics and review", "This is septic shock."]], "Surviving Sepsis Campaign 2021"],
  ["stroke", "Sudden right-sided weakness and aphasia 90 minutes ago; glucose normal.", "Urgent non-contrast CT head, then thrombolysis if no bleed and no contraindication", "Time is brain: imaging to exclude haemorrhage, then alteplase/tenecteplase within 4.5 hours.", [["Aspirin straight away", "Not before a bleed is excluded and the thrombolysis decision is made."], ["MRI tomorrow", "Too late for thrombolysis."], ["Lower BP to 120/80 at once", "Aggressive lowering harms the penumbra."]], "AHA/ASA acute stroke guideline 2019"],
];

export const algorithmQuestions = (level: SkillLevel = "full", specialty?: string | null): QuizQuestion[] =>
  forDoctor([...ALGORITHMS, ...MORE_ALGORITHMS].map((a) => ({ id: `algo-${a[0]}`, a })), level, specialty, 10).map(({ a }) => a).map(([id, stem, right, explain, wrong, src]) => q(`algo-${id}`, `${stem} What comes next?`, right, explain, wrong, src));

/* Clinical calculations ------------------------------------------------------ */

const rint = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));

/** Wrong answers near the right one, never equal to it. */
function near(right: number, spread: number, step = 1): string[] {
  const out = new Set<number>();
  while (out.size < 3) {
    const v = Math.round((right + (rint(-3, 3) || 1) * spread) / step) * step;
    if (v !== right && v > 0) out.add(v);
  }
  return [...out].map(String);
}

function num(id: string, stem: string, right: number, explain: string, spread: number, source: string, unit = "", step = 1): QuizQuestion {
  const opts = shuffle([String(right), ...near(right, spread, step)]);
  return { id, stem, options: opts.map((o) => `${o}${unit}`), answer: opts.indexOf(String(right)), explain, source };
}

/** A worked answer, line by line: the formula, each step with this patient's numbers, what it means, and the trap. */
const steps = (...lines: (string | false)[]) => lines.filter(Boolean).join("\n");

const CALCS: (() => QuizQuestion)[] = [
  () => {
    const e = rint(1, 4), v = rint(1, 5), m = rint(1, 6);
    const gcs = e + v + m;
    const E = ["", "no eye opening", "opens to pain", "opens to voice", "opens spontaneously"][e];
    const V = ["", "no speech", "incomprehensible sounds", "inappropriate words", "confused", "oriented"][v];
    const M = ["", "no movement", "extension (decerebrate)", "abnormal flexion (decorticate)", "withdraws from pain", "localises pain", "obeys commands"][m];
    return num("gcs", `Eyes open ${["", "not at all", "to pain", "to voice", "spontaneously"][e]}, speech is ${["", "absent", "incomprehensible sounds", "inappropriate words", "confused", "oriented"][v]}, and to pain he ${["", "doesn't move", "extends", "flexes abnormally", "withdraws", "localises", "obeys commands"][m]}. GCS?`, gcs, steps(
      `GCS = Eyes (1–4) + Verbal (1–5) + Motor (1–6); 3 to 15.`,
      `• Eyes: ${E} → E${e}`,
      `• Verbal: ${V} → V${v}`,
      `• Motor: ${M} → M${m}`,
      `Total: E${e} V${v} M${m} = ${gcs}/15.`,
      `What it means: ${gcs <= 8 ? "severe brain injury (≤ 8) — he may not protect his airway; call for help to secure it." : gcs <= 12 ? "moderate (9–12) — close neurological observation and imaging if trauma." : "mild (13–15) — keep reassessing; a fall of 2 or more points is a red flag."}`,
      `Trap: always write the components (E${e}V${v}M${m}), not just the total — and score the best motor response; if intubated, record verbal as "T".`,
    ), 2, "Teasdale & Jennett; ATLS");
  },
  () => {
    const na = rint(126, 146), cl = rint(92, 110), hco3 = rint(8, 26);
    const ag = na - (cl + hco3);
    return num("ag", `Sodium ${na}, chloride ${cl}, bicarbonate ${hco3} mmol/L. The anion gap?`, ag, steps(
      `Anion gap = Na − (Cl + HCO₃).`,
      `= ${na} − (${cl} + ${hco3}) = ${na} − ${cl + hco3} = ${ag} mmol/L.`,
      `Normal is about 8–12 mmol/L.`,
      ag > 12 ? `What it means: a raised gap — unmeasured acids. Think DKA, lactic acidosis, renal failure, or toxins (methanol, ethylene glycol, salicylates).` : hco3 < 22 ? `What it means: a normal gap with a low bicarbonate — a hyperchloraemic acidosis: diarrhoea, renal tubular acidosis, or large volumes of saline.` : `What it means: a normal gap, and the bicarbonate isn't low — no metabolic acidosis on these numbers.`,
      `Trap: a low albumin hides a raised gap. Correct it: add 2.5 for every 1 g/dL that albumin is below 4.`,
    ), 4, "Harrison's Principles of Internal Medicine");
  },
  () => {
    const age = rint(40, 85), wt = rint(45, 90), cr = rint(9, 30) / 10, female = Math.random() < 0.5;
    const top = (140 - age) * wt * (female ? 0.85 : 1);
    const crcl = Math.round(top / (72 * cr));
    return num("crcl", `A ${age}-year-old ${female ? "woman" : "man"}, ${wt} kg, serum creatinine ${cr.toFixed(1)} mg/dL. Creatinine clearance (Cockcroft–Gault)?`, crcl, steps(
      `Cockcroft–Gault: CrCl = (140 − age) × weight (kg)${female ? " × 0.85 (female)" : ""} ÷ (72 × creatinine in mg/dL).`,
      `Top: (140 − ${age}) × ${wt}${female ? " × 0.85" : ""} = ${Math.round(top)}.`,
      `Bottom: 72 × ${cr.toFixed(1)} = ${(72 * cr).toFixed(1)}.`,
      `${Math.round(top)} ÷ ${(72 * cr).toFixed(1)} ≈ ${crcl} mL/min.`,
      `What it means: ${crcl >= 60 ? "60 or more — most drugs at normal doses." : crcl >= 30 ? "30–59 — many drugs need a lower dose or longer interval (e.g. some antibiotics, DOACs); check the BNF." : crcl >= 15 ? "15–29 — severe impairment: reduce or avoid renally cleared drugs (metformin, nitrofurantoin, some DOACs)." : "below 15 — kidney failure: specialist dosing, many drugs contraindicated."}`,
      `Trap: it's only valid when creatinine is stable (not in AKI), and it overestimates in the very obese and in frail elderly people with little muscle.`,
    ), 10, "Cockcroft & Gault 1976; BNF", " mL/min");
  },
  () => {
    const wt = rint(4, 40);
    const a = Math.min(wt, 10) * 100, b = Math.max(0, Math.min(wt, 20) - 10) * 50, c = Math.max(0, wt - 20) * 20;
    const ml = a + b + c;
    return num("hs", `${/^(8|11|18)$/.test(String(wt)) ? "An" : "A"} ${wt} kg child needs maintenance fluids. Daily volume (Holliday–Segar)?`, ml, steps(
      `Holliday–Segar: 100 mL/kg/day for the first 10 kg, 50 mL/kg/day for the next 10 kg, 20 mL/kg/day for every kg above 20.`,
      `• First ${Math.min(wt, 10)} kg × 100 = ${a} mL`,
      wt > 10 && `• Next ${Math.min(wt, 20) - 10} kg × 50 = ${b} mL`,
      wt > 20 && `• Remaining ${wt - 20} kg × 20 = ${c} mL`,
      `Total: ${ml} mL/day ≈ ${Math.round(ml / 24)} mL/hour.`,
      `Fluid: an isotonic solution (e.g. 0.9% saline with 5% dextrose), checking sodium and glucose at least daily.`,
      `Trap: this is maintenance only — add any deficit and ongoing losses separately, and restrict to about two-thirds in meningitis, pneumonia or after surgery (risk of low sodium).`,
    ), 100, "Holliday & Segar; NICE NG29; IAP", " mL/day", 10);
  },
  () => {
    const wt = rint(6, 30);
    const dose = Math.round((15 * wt) / 10) * 10;
    return num("pcm", `${/^(8|11|18)$/.test(String(wt)) ? "An" : "A"} ${wt} kg child with fever. One dose of paracetamol at 15 mg/kg?`, dose, steps(
      `Dose = 15 mg/kg × weight.`,
      15 * wt === dose ? `15 × ${wt} kg = ${dose} mg.` : `15 × ${wt} kg = ${15 * wt} mg → rounded to a measurable ${dose} mg.`,
      `As syrup: 120 mg/5 mL → ${(dose / 24).toFixed(1)} mL; 250 mg/5 mL → ${(dose / 50).toFixed(1)} mL.`,
      `How often: every 4–6 hours, no more than 4 doses in 24 hours (at most 60 mg/kg/day).`,
      `Trap: check the strength on the bottle (drops, 120 and 250 mg/5 mL syrups differ), and ask what was already given at home — overdose is usually from double-dosing.`,
    ), 30, "IAP; BNF for Children", " mg", 10);
  },
  () => {
    const ca = rint(70, 90) / 10, alb = rint(18, 34) / 10;
    const corr = Math.round((ca + 0.8 * (4 - alb)) * 10) / 10;
    const opts = shuffle([corr, Math.round((corr + 0.6) * 10) / 10, Math.round((corr - 0.6) * 10) / 10, [corr, Math.round((corr + 0.6) * 10) / 10, Math.round((corr - 0.6) * 10) / 10].some((x) => x.toFixed(1) === ca.toFixed(1)) ? Math.round((corr + 1.2) * 10) / 10 : Math.round(ca * 10) / 10].map((x) => x.toFixed(1)));
    return { id: "ca", stem: `Calcium ${ca.toFixed(1)} mg/dL with albumin ${alb.toFixed(1)} g/dL. The corrected calcium?`, options: opts.map((o) => `${o} mg/dL`), answer: opts.indexOf(corr.toFixed(1)), explain: steps(
      `Corrected Ca = measured Ca + 0.8 × (4 − albumin in g/dL).`,
      `= ${ca.toFixed(1)} + 0.8 × (4 − ${alb.toFixed(1)}) = ${ca.toFixed(1)} + 0.8 × ${(4 - alb).toFixed(1)} = ${ca.toFixed(1)} + ${(0.8 * (4 - alb)).toFixed(1)} = ${corr.toFixed(1)} mg/dL.`,
      `Normal is about 8.5–10.5 mg/dL.`,
      `What it means: ${corr < 8.5 ? "true hypocalcaemia even after correction — look for tetany and a long QT, and check magnesium, phosphate and PTH." : corr > 10.5 ? "hypercalcaemia once corrected — think of hyperparathyroidism or malignancy." : "normal once corrected — the low total calcium was mostly from the low albumin."}`,
      `Trap: in the critically ill, and with acid–base disturbance, the formula is unreliable — measure ionised calcium.`,
    ), source: "Harrison's Principles of Internal Medicine" };
  },
  () => {
    const c = Math.random() < 0.5, u = Math.random() < 0.5, r = Math.random() < 0.5, b = Math.random() < 0.5, a = Math.random() < 0.6;
    const score = [c, u, r, b, a].filter(Boolean).length;
    const mark = (on: boolean) => (on ? "1" : "0");
    return num("curb", `Pneumonia: ${c ? "confused" : "alert"}, urea ${u ? "52" : "30"} mg/dL (BUN ${u ? "24" : "14"}), RR ${r ? "32" : "22"}, BP ${b ? "85/55" : "130/80"}, aged ${a ? "72" : "48"}. CURB-65?`, score, steps(
      `CURB-65: one point each.`,
      `• Confusion — ${c ? "confused" : "alert"} → ${mark(c)}`,
      `• Urea > 7 mmol/L (> 42 mg/dL; BUN > 19 mg/dL) — urea ${u ? "52" : "30"} → ${mark(u)}`,
      `• Respiratory rate ≥ 30 — ${r ? "32" : "22"} → ${mark(r)}`,
      `• BP: systolic < 90 or diastolic ≤ 60 — ${b ? "85/55" : "130/80"} → ${mark(b)}`,
      `• Age ≥ 65 — ${a ? "72" : "48"} → ${mark(a)}`,
      `Total: ${score}/5.`,
      `What it means: ${score <= 1 ? "low risk (30-day mortality under 3%) — usually treat at home with oral antibiotics." : score === 2 ? "moderate risk (about 9%) — consider admission or close follow-up." : "high risk (15–40%) — admit; with 4–5, assess for ICU."}`,
      `Trap: the score supports, not replaces, judgement — low oxygen saturation, a frail patient or poor home support can still mean admission.`,
    ), 1, "BTS community-acquired pneumonia guideline");
  },
  () => {
    const na = rint(126, 136), glu = rint(300, 900);
    const add = 1.6 * ((glu - 100) / 100);
    const corr = Math.round(na + add);
    return num("na", `Sodium ${na} mmol/L with glucose ${glu} mg/dL. The corrected sodium?`, corr, steps(
      `Corrected Na = measured Na + 1.6 × (glucose − 100) ÷ 100 (glucose in mg/dL).`,
      `= ${na} + 1.6 × (${glu} − 100) ÷ 100 = ${na} + 1.6 × ${((glu - 100) / 100).toFixed(1)} = ${na} + ${add.toFixed(1)} ≈ ${corr} mmol/L.`,
      `Why: high glucose pulls water out of cells and dilutes the sodium — the low reading isn't a true sodium deficit.`,
      `What it means: ${corr > 145 ? "the true sodium is high — there's a large water deficit; correct slowly." : corr >= 135 ? "the true sodium is normal — the low reading was dilution from the glucose." : "the true sodium is still low — a real hyponatraemia on top of the hyperglycaemia."}`,
      `Trap: when glucose is above about 400 mg/dL, a factor of 2.4 (Hillier) fits better; and the corrected sodium should not fall during treatment — a fall raises the risk of cerebral oedema.`,
    ), 3, "Katz correction; JBDS DKA guideline");
  },
  () => {
    const wt = rint(50, 100), ht = rint(150, 190);
    const m = ht / 100;
    const bmi = Math.round((wt / m ** 2) * 10) / 10;
    const opts = shuffle([bmi, bmi + 2.5, bmi - 2.5, bmi + 5].map((x) => x.toFixed(1)));
    const asian = bmi < 18.5 ? "underweight" : bmi < 23 ? "normal" : bmi < 25 ? "overweight" : "obese";
    const who = bmi < 18.5 ? "underweight" : bmi < 25 ? "normal" : bmi < 30 ? "overweight" : "obese";
    return { id: "bmi", stem: `${wt} kg, ${ht} cm. BMI?`, options: opts.map((o) => `${o} kg/m²`), answer: opts.indexOf(bmi.toFixed(1)), explain: steps(
      `BMI = weight (kg) ÷ height (m)².`,
      `Height ${ht} cm = ${m.toFixed(2)} m; squared = ${(m ** 2).toFixed(2)}.`,
      `${wt} ÷ ${(m ** 2).toFixed(2)} = ${bmi.toFixed(1)} kg/m².`,
      `What it means: ${asian} by the Asian cut-offs (normal 18.5–22.9, overweight 23–24.9, obese ≥ 25)${asian !== who ? ` — but ${who} by the WHO global ones (overweight 25–29.9, obese ≥ 30)` : ""}.`,
      `Trap: South Asians carry more risk at a lower BMI, so use the Asian cut-offs in India — and BMI misjudges muscular people; waist circumference adds to it.`,
    ), source: "WHO; ICMR Asian BMI cut-offs" };
  },
  () => {
    const sbp = rint(80, 180), dbp = rint(45, 110);
    const d = Math.min(dbp, sbp - 20), map = Math.round((sbp + 2 * d) / 3);
    return num("map", `BP ${sbp}/${d} mmHg. Mean arterial pressure?`, map, steps(
      `MAP = (systolic + 2 × diastolic) ÷ 3.`,
      `= (${sbp} + 2 × ${d}) ÷ 3 = ${sbp + 2 * d} ÷ 3 ≈ **${map} mmHg**.`,
      `What it means: ${map < 65 ? "**below 65** — organs are under-perfused; in sepsis, start a vasopressor if fluids haven't fixed it." : "**65 or more** — the usual target in shock."}`,
      `Trap: diastole lasts twice as long as systole, so it counts twice.`,
    ), 6, "Surviving Sepsis Campaign 2021", " mmHg");
  },
  () => {
    const wt = rint(4, 40);
    const rate = wt <= 10 ? 4 * wt : wt <= 20 ? 40 + 2 * (wt - 10) : 60 + (wt - 20);
    return num("maint", `A ${wt} kg child is nil by mouth. Maintenance fluid rate (Holliday–Segar, 4-2-1)?`, rate, steps(
      `4-2-1 rule: **4 mL/kg/h** for the first 10 kg, **2 mL/kg/h** for the next 10 kg, **1 mL/kg/h** for each kg above 20.`,
      wt <= 10 ? `${wt} × 4 = **${rate} mL/h**.` : wt <= 20 ? `40 + (${wt} − 10) × 2 = **${rate} mL/h**.` : `40 + 20 + (${wt} − 20) × 1 = **${rate} mL/h**.`,
      `Fluid: an isotonic one (0.9% saline with 5% dextrose).`,
      `Trap: many sick children (meningitis, pneumonia, post-op) need **less** — they hold water (ADH).`,
    ), 6, "NICE NG29 IV fluids in children", " mL/h");
  },
  () => {
    const wt = rint(50, 90), tbsa = rint(15, 50);
    const total = 4 * wt * tbsa, first = total / 2;
    return num("parkland", `A ${wt} kg adult with ${tbsa}% burns. Parkland fluid in the first 8 hours from the burn?`, first, steps(
      `Parkland = **4 mL × kg × %TBSA** in 24 h; **half in the first 8 h** from the time of the burn.`,
      `4 × ${wt} × ${tbsa} = ${total} mL; half = **${first} mL**.`,
      `Trap: count from the time of injury, not arrival — and titrate to urine output (0.5 mL/kg/h).`,
    ), 400, "ATLS; ANZBA EMSB", " mL", 50);
  },
  () => {
    const na = rint(130, 150), glu = rint(80, 600), urea = rint(15, 120);
    const osm = Math.round(2 * na + glu / 18 + urea / 6);
    return num("osm", `Na ${na}, glucose ${glu} mg/dL, urea ${urea} mg/dL. Calculated serum osmolality?`, osm, steps(
      `Osmolality = **2 × Na + glucose ÷ 18 + urea ÷ 6** (glucose and urea in mg/dL).`,
      `= ${2 * na} + ${(glu / 18).toFixed(0)} + ${(urea / 6).toFixed(0)} ≈ **${osm} mOsm/kg**.`,
      `What it means: ${osm > 320 ? "**above 320** — think HHS; correct slowly." : osm < 275 ? "**low** — true hypotonic state." : "normal range 275–295."}`,
      `Trap: if measured osmolality is more than 10 above this, think **toxic alcohols** (osmolar gap).`,
    ), 6, "JBDS HHS guideline", " mOsm/kg");
  },
  () => {
    const qt = rint(36, 52) * 10, hr = rint(50, 120);
    const rr = 60 / hr, qtc = Math.round(qt / Math.sqrt(rr));
    return num("qtc", `QT ${qt} ms at a heart rate of ${hr}. QTc (Bazett)?`, qtc, steps(
      `QTc = **QT ÷ √RR**, RR in seconds = 60 ÷ HR.`,
      `RR = 60 ÷ ${hr} = ${rr.toFixed(2)} s; √RR = ${Math.sqrt(rr).toFixed(2)}.`,
      `${qt} ÷ ${Math.sqrt(rr).toFixed(2)} ≈ **${qtc} ms**.`,
      `What it means: ${qtc > 500 ? "**over 500** — high risk of torsades; stop QT-prolonging drugs, check K and Mg." : qtc > 450 ? "**prolonged** (over 450 men / 460 women)." : "normal."}`,
      `Trap: Bazett over-corrects at fast heart rates — use Fridericia above about 100/min.`,
    ), 15, "AHA/ACCF QT guidance", " ms", 5);
  },
  () => {
    const wt = rint(8, 30);
    const dose = Math.round(wt * 0.01 * 100) / 100;
    const opts = shuffle([dose, dose * 10, dose / 2, dose * 2].map((x) => x.toFixed(2)));
    return { id: "adr-paed", stem: `A ${wt} kg child in anaphylaxis. IM adrenaline dose (1 mg/mL)?`, options: opts.map((o) => `${o} mg`), answer: opts.indexOf(dose.toFixed(2)), explain: steps(
      `IM adrenaline = **0.01 mg/kg** of 1 mg/mL (1:1000), max **0.5 mg**.`,
      `${wt} × 0.01 = **${dose.toFixed(2)} mg** = ${dose.toFixed(2)} mL of 1:1000.`,
      `Trap: the **ten-times error** — 1:10,000 is the IV arrest strength, never for IM use.`,
    ), source: "Resuscitation Council UK 2021" };
  },
  () => {
    const pao2 = rint(55, 100), fio2 = [21, 28, 35, 40, 50, 60][rint(0, 5)]!;
    const pf = Math.round(pao2 / (fio2 / 100));
    return num("pf", `PaO₂ ${pao2} mmHg on FiO₂ ${fio2}%. P/F ratio?`, pf, steps(
      `P/F = **PaO₂ ÷ FiO₂** (as a fraction).`,
      `${pao2} ÷ ${(fio2 / 100).toFixed(2)} ≈ **${pf}**.`,
      `What it means: ${pf <= 100 ? "**severe ARDS** (≤ 100)." : pf <= 200 ? "**moderate ARDS** range (100–200)." : pf <= 300 ? "**mild ARDS** range (200–300)." : "above 300 — not in the ARDS range."}`,
      `Trap: ARDS needs PEEP ≥ 5, bilateral opacities and no heart-failure cause too (Berlin definition).`,
    ), 25, "Berlin ARDS definition 2012");
  },
  () => {
    const ua = rint(100, 300), cr = rint(1, 4), una = rint(10, 80), pna = rint(130, 145);
    const fena = Math.round(((una * cr) / (pna * ua / 100)) * 10) / 10;
    const opts = shuffle([fena, fena + 1.5, fena + 0.7, fena + 3].map((x) => x.toFixed(1)));
    return { id: "fena", stem: `Plasma Na ${pna}, creatinine ${cr} mg/dL; urine Na ${una}, urine creatinine ${ua} mg/dL. FENa?`, options: opts.map((o) => `${o}%`), answer: opts.indexOf(fena.toFixed(1)), explain: steps(
      `FENa = **(urine Na × plasma Cr) ÷ (plasma Na × urine Cr) × 100**.`,
      `(${una} × ${cr}) ÷ (${pna} × ${ua}) × 100 ≈ **${fena.toFixed(1)}%**.`,
      `What it means: ${fena < 1 ? "**under 1%** — prerenal (the kidney is holding salt)." : fena > 2 ? "**over 2%** — intrinsic renal injury (ATN)." : "**1–2%** — indeterminate."}`,
      `Trap: diuretics raise FENa — use **FEUrea** (< 35% prerenal) instead.`,
    ), source: "KDIGO AKI guideline" };
  },
];

export const calculationQuestions = (level: SkillLevel = "full", specialty?: string | null): QuizQuestion[] =>
  forDoctor(CALCS.map((make) => make()).map((x) => ({ ...x, id: `calc-${x.id}` })), level, specialty, 8);

export const ANTIDOTE_COUNT = ALL_ANTIDOTES.length;
export const ALGORITHM_COUNT = ALGORITHMS.length + MORE_ALGORITHMS.length;
export const CALCULATION_COUNT = CALCS.length;
