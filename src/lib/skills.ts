/**
 * Skills Lab drills that need no AI and no pictures: antidotes, emergency algorithms and clinical
 * calculations. Answers follow standard references (BNF / Toxbase, AHA ACLS 2020–2025, NICE, WHO,
 * Harrison's); calculations are worked out here, with fresh numbers each time.
 */

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

export const antidoteQuestions = (): QuizQuestion[] =>
  shuffle(ANTIDOTES).slice(0, 10).map(([id, stem, right, explain, wrong]) => q(`antidote-${id}`, `${stem} The specific treatment?`, right, explain, wrong, "BNF / Toxbase; National Snakebite Management Protocol (India)"));

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

export const algorithmQuestions = (): QuizQuestion[] =>
  shuffle(ALGORITHMS).slice(0, 10).map(([id, stem, right, explain, wrong, src]) => q(`algo-${id}`, `${stem} What comes next?`, right, explain, wrong, src));

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

const CALCS: (() => QuizQuestion)[] = [
  () => {
    const e = rint(1, 4), v = rint(1, 5), m = rint(1, 6);
    return num("gcs", `Eyes open ${["", "not at all", "to pain", "to voice", "spontaneously"][e]}, speech is ${["", "absent", "incomprehensible sounds", "inappropriate words", "confused", "oriented"][v]}, and to pain he ${["", "doesn't move", "extends", "flexes abnormally", "withdraws", "localises", "obeys commands"][m]}. GCS?`, e + v + m, `E${e} V${v} M${m} = ${e + v + m}.`, 2, "Teasdale & Jennett; ATLS");
  },
  () => {
    const na = rint(126, 146), cl = rint(92, 110), hco3 = rint(8, 26);
    const ag = na - (cl + hco3);
    return num("ag", `Sodium ${na}, chloride ${cl}, bicarbonate ${hco3} mmol/L. The anion gap?`, ag, `Na − (Cl + HCO₃) = ${na} − (${cl} + ${hco3}) = ${ag} (normal about 8–12).`, 4, "Harrison's Principles of Internal Medicine");
  },
  () => {
    const age = rint(40, 85), wt = rint(45, 90), cr = rint(9, 30) / 10, female = Math.random() < 0.5;
    const crcl = Math.round(((140 - age) * wt * (female ? 0.85 : 1)) / (72 * cr));
    return num("crcl", `A ${age}-year-old ${female ? "woman" : "man"}, ${wt} kg, serum creatinine ${cr.toFixed(1)} mg/dL. Creatinine clearance (Cockcroft–Gault)?`, crcl, `(140 − ${age}) × ${wt}${female ? " × 0.85" : ""} ÷ (72 × ${cr.toFixed(1)}) ≈ ${crcl} mL/min.`, 10, "Cockcroft & Gault 1976; BNF", " mL/min");
  },
  () => {
    const wt = rint(4, 40);
    const ml = wt <= 10 ? wt * 100 : wt <= 20 ? 1000 + (wt - 10) * 50 : 1500 + (wt - 20) * 20;
    return num("hs", `A ${wt} kg child needs maintenance fluids. Daily volume (Holliday–Segar)?`, ml, `100 mL/kg for the first 10 kg, 50 for the next 10, 20 for each kg above 20 → ${ml} mL/day.`, 100, "Holliday & Segar; IAP", " mL/day", 10);
  },
  () => {
    const wt = rint(6, 30);
    const dose = Math.round((15 * wt) / 10) * 10;
    return num("pcm", `A ${wt} kg child with fever. One dose of paracetamol at 15 mg/kg?`, dose, `15 × ${wt} = ${15 * wt} mg → about ${dose} mg.`, 30, "IAP; BNF for Children", " mg", 10);
  },
  () => {
    const ca = rint(70, 90) / 10, alb = rint(18, 34) / 10;
    const corr = Math.round((ca + 0.8 * (4 - alb)) * 10) / 10;
    const opts = shuffle([corr, Math.round((corr + 0.6) * 10) / 10, Math.round((corr - 0.6) * 10) / 10, Math.round((ca) * 10) / 10].map((x) => x.toFixed(1)));
    return { id: "ca", stem: `Calcium ${ca.toFixed(1)} mg/dL with albumin ${alb.toFixed(1)} g/dL. The corrected calcium?`, options: opts.map((o) => `${o} mg/dL`), answer: opts.indexOf(corr.toFixed(1)), explain: `Ca + 0.8 × (4 − albumin) = ${ca.toFixed(1)} + 0.8 × ${(4 - alb).toFixed(1)} = ${corr.toFixed(1)} mg/dL.`, source: "Harrison's Principles of Internal Medicine" };
  },
  () => {
    const c = Math.random() < 0.5, u = Math.random() < 0.5, r = Math.random() < 0.5, b = Math.random() < 0.5, a = Math.random() < 0.6;
    const score = [c, u, r, b, a].filter(Boolean).length;
    return num("curb", `Pneumonia: ${c ? "confused" : "alert"}, urea ${u ? "52" : "30"} mg/dL (BUN ${u ? "24" : "14"}), RR ${r ? "32" : "22"}, BP ${b ? "85/55" : "130/80"}, aged ${a ? "72" : "48"}. CURB-65?`, score, `One point each for confusion, urea > 7 mmol/L (BUN > 19 mg/dL), RR ≥ 30, SBP < 90 or DBP ≤ 60, age ≥ 65 → ${score}.`, 1, "BTS community-acquired pneumonia guideline");
  },
  () => {
    const na = rint(126, 136), glu = rint(300, 900);
    const corr = Math.round(na + 1.6 * ((glu - 100) / 100));
    return num("na", `Sodium ${na} mmol/L with glucose ${glu} mg/dL. The corrected sodium?`, corr, `Na + 1.6 × (glucose − 100)/100 = ${corr} mmol/L.`, 3, "Katz correction; JBDS");
  },
  () => {
    const wt = rint(50, 100), ht = rint(150, 190);
    const bmi = Math.round((wt / (ht / 100) ** 2) * 10) / 10;
    const opts = shuffle([bmi, bmi + 2.5, bmi - 2.5, bmi + 5].map((x) => x.toFixed(1)));
    return { id: "bmi", stem: `${wt} kg, ${ht} cm. BMI?`, options: opts.map((o) => `${o} kg/m²`), answer: opts.indexOf(bmi.toFixed(1)), explain: `${wt} ÷ ${(ht / 100).toFixed(2)}² = ${bmi.toFixed(1)} kg/m² (Asian cut-offs: overweight ≥ 23, obese ≥ 25).`, source: "WHO; ICMR Asian BMI cut-offs" };
  },
];

export const calculationQuestions = (): QuizQuestion[] => shuffle(CALCS).slice(0, 8).map((make, i) => ({ ...make(), id: `calc-${i}` }));
