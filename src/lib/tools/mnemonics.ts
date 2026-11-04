/**
 * The Visual Mnemonics gallery. Curated by hand, in code. Each card: a phrase whose initial letters are the list,
 * a letter-by-letter breakdown, and one exam question to test recall.
 */

import type { MedicalIconName } from "@/components/ui/medical-icons";

export type MnemonicDiagram = "carpal" | "cuff" | "plexus" | "tof" | "horner";

export interface MnemonicCard {
  id: string;
  title: string;
  /** The phrase. Each letter in `letters` lights up red, in order. */
  phrase: string;
  /** [letter, what it stands for], in phrase order. */
  letters: [string, string][];
  recallQ: string;
  recallA: string;
  icon: MedicalIconName;
  /** A drawn diagram, where a list has a real picture; otherwise the card shows the subject's icon. */
  diagram?: MnemonicDiagram;
  /** A caution for lists practice has moved on from. */
  note?: string;
}

export const MNEMONICS: MnemonicCard[] = [
  { id: "carpal", title: "Carpal Bones", phrase: "Some Lovers Try Positions That They Can't Handle", icon: "orthopedics", diagram: "carpal",
    letters: [["S", "Scaphoid"], ["L", "Lunate"], ["T", "Triquetrum"], ["P", "Pisiform"], ["T", "Trapezium"], ["T", "Trapezoid"], ["C", "Capitate"], ["H", "Hamate"]],
    recallQ: "Which carpal bone is most often fractured, and which most often dislocates?", recallA: "Scaphoid fractures (risk of avascular necrosis); the lunate dislocates." },
  { id: "cn-names", title: "Cranial Nerves: Names", phrase: "Oh Oh Oh To Touch And Feel Very Good Velvet, Ah Heaven", icon: "neurology",
    letters: [["O", "Olfactory"], ["O", "Optic"], ["O", "Oculomotor"], ["T", "Trochlear"], ["T", "Trigeminal"], ["A", "Abducens"], ["F", "Facial"], ["V", "Vestibulocochlear"], ["G", "Glossopharyngeal"], ["V", "Vagus"], ["A", "Accessory"], ["H", "Hypoglossal"]],
    recallQ: "Which cranial nerve has the longest intracranial course?", recallA: "The abducens (VI), so it's a false localising sign in raised ICP." },
  { id: "cn-type", title: "Cranial Nerves: Sensory or Motor", phrase: "Some Say Marry Money But My Brother Says Big Brains Matter More", icon: "neurology",
    letters: [["S", "I Sensory"], ["S", "II Sensory"], ["M", "III Motor"], ["M", "IV Motor"], ["B", "V Both"], ["M", "VI Motor"], ["B", "VII Both"], ["S", "VIII Sensory"], ["B", "IX Both"], ["B", "X Both"], ["M", "XI Motor"], ["M", "XII Motor"]],
    recallQ: "Which four cranial nerves carry parasympathetic fibres?", recallA: "III, VII, IX and X." },
  { id: "plexus", title: "Brachial Plexus", phrase: "Randy Travis Drinks Cold Beer", icon: "neurology", diagram: "plexus",
    letters: [["R", "Roots (C5 to T1)"], ["T", "Trunks"], ["D", "Divisions"], ["C", "Cords"], ["B", "Branches"]],
    recallQ: "Erb's palsy injures which roots, and what's the posture?", recallA: "C5 and C6: waiter's tip." },
  { id: "cuff", title: "Rotator Cuff", phrase: "SITS", icon: "orthopedics", diagram: "cuff",
    letters: [["S", "Supraspinatus"], ["I", "Infraspinatus"], ["T", "Teres minor"], ["S", "Subscapularis"]],
    recallQ: "Which rotator cuff tendon tears most often?", recallA: "Supraspinatus: it starts abduction." },
  { id: "mudpiles", title: "High Anion Gap Acidosis", phrase: "MUDPILES", icon: "medicine",
    letters: [["M", "Methanol"], ["U", "Uraemia"], ["D", "Diabetic ketoacidosis"], ["P", "Paraldehyde, propylene glycol"], ["I", "Isoniazid, iron"], ["L", "Lactic acidosis"], ["E", "Ethylene glycol"], ["S", "Salicylates"]],
    recallQ: "What is the normal anion gap formula?", recallA: "Na − (Cl + HCO₃); normal about 8 to 12 mmol/L." },
  { id: "hardups", title: "Normal Anion Gap Acidosis", phrase: "HARDUPS", icon: "nephrology",
    letters: [["H", "Hyperalimentation"], ["A", "Addison's, acetazolamide"], ["R", "Renal tubular acidosis"], ["D", "Diarrhoea"], ["U", "Ureteroenteric fistula"], ["P", "Pancreatic fistula"], ["S", "Saline excess, spironolactone"]],
    recallQ: "Type 1 and type 2 RTA: what potassium do they share, and which forms stones?", recallA: "Both low potassium; type 1 forms stones." },
  { id: "pancreatitis", title: "Causes of Pancreatitis", phrase: "I GET SMASHED", icon: "gastro",
    letters: [["I", "Idiopathic"], ["G", "Gallstones"], ["E", "Ethanol"], ["T", "Trauma"], ["S", "Steroids"], ["M", "Mumps, malignancy"], ["A", "Autoimmune"], ["S", "Scorpion sting"], ["H", "Hypercalcaemia, hypertriglyceridaemia"], ["E", "ERCP"], ["D", "Drugs"]],
    recallQ: "Which enzyme is more specific and stays raised longer than amylase?", recallA: "Lipase." },
  { id: "aeiou", title: "Indications for Urgent Dialysis", phrase: "AEIOU", icon: "nephrology",
    letters: [["A", "Acidosis, refractory"], ["E", "Electrolytes: refractory hyperkalaemia"], ["I", "Intoxication: lithium, methanol, salicylate"], ["O", "Overload, refractory"], ["U", "Uraemia: pericarditis, encephalopathy"]],
    recallQ: "Name two dialysable toxins beginning with S and L.", recallA: "Salicylate and lithium." },
  { id: "curb", title: "Severity of Pneumonia", phrase: "CURB-65", icon: "respiratory",
    letters: [["C", "Confusion"], ["U", "Urea above 7 mmol/L"], ["R", "RR 30 or more"], ["B", "BP under 90 systolic or 60 diastolic or less"], ["6", "65 years or older"]],
    recallQ: "What score generally means hospital admission?", recallA: "2 or more; 3 or more is severe." },
  { id: "chadsvasc", title: "Stroke Risk in AF", phrase: "CHA₂DS₂-VASc", icon: "cardiology",
    letters: [["C", "CHF"], ["H", "Hypertension"], ["A", "Age 75 or more (2 points)"], ["D", "Diabetes"], ["S", "Stroke, TIA (2 points)"], ["V", "Vascular disease"], ["A", "Age 65 to 74"], ["S", "Sex: female"]],
    recallQ: "Which item scores 2 points besides age 75 or more?", recallA: "Prior stroke or TIA." },
  { id: "sludge", title: "Cholinergic Toxidrome", phrase: "SLUDGE", icon: "emergency",
    letters: [["S", "Salivation"], ["L", "Lacrimation"], ["U", "Urination"], ["D", "Defecation"], ["G", "GI cramps"], ["E", "Emesis"]],
    recallQ: "What's the end point of atropine in organophosphate poisoning?", recallA: "A clear chest, pulse above 80, systolic above 80, not the pupils." },
  { id: "torch", title: "Congenital Infections", phrase: "TORCH", icon: "pediatrics",
    letters: [["T", "Toxoplasmosis"], ["O", "Other: syphilis, varicella, parvovirus"], ["R", "Rubella"], ["C", "Cytomegalovirus"], ["H", "Herpes simplex"]],
    recallQ: "Which gives periventricular calcification, and which gives diffuse?", recallA: "CMV is periventricular; toxoplasmosis is diffuse." },
  { id: "lame", title: "What Cephalosporins Miss", phrase: "LAME", icon: "infectious",
    letters: [["L", "Listeria"], ["A", "Atypicals: Mycoplasma, Chlamydia"], ["M", "MRSA (except ceftaroline)"], ["E", "Enterococci"]],
    recallQ: "Why add ampicillin to ceftriaxone in meningitis in the elderly?", recallA: "To cover Listeria." },
  { id: "jones", title: "Rheumatic Fever Major Criteria", phrase: "JONES", icon: "cardiology",
    letters: [["J", "Joints: migratory polyarthritis"], ["O", "Heart (the O looks like a heart): carditis"], ["N", "Nodules, subcutaneous"], ["E", "Erythema marginatum"], ["S", "Sydenham's chorea"]],
    recallQ: "What evidence must accompany the criteria?", recallA: "A recent group A streptococcal infection (raised ASO or positive culture)." },
  { id: "crash", title: "Kawasaki Disease", phrase: "CRASH and burn", icon: "pediatrics",
    letters: [["C", "Conjunctivitis, non-purulent"], ["R", "Rash"], ["A", "Adenopathy, cervical"], ["S", "Strawberry tongue"], ["H", "Hands and feet: swelling, peeling"], ["B", "Burn: fever for 5 days or more"]],
    recallQ: "What complication does IVIg aim to prevent?", recallA: "Coronary artery aneurysm." },
  { id: "soap", title: "SLE Features", phrase: "SOAP BRAIN MD", icon: "dermatology",
    letters: [["S", "Serositis"], ["O", "Oral ulcers"], ["A", "Arthritis"], ["P", "Photosensitivity"], ["B", "Blood disorders"], ["R", "Renal involvement"], ["A", "ANA"], ["I", "Immunology: dsDNA, Smith"], ["N", "Neurological"], ["M", "Malar rash"], ["D", "Discoid rash"]],
    recallQ: "Which antibody tracks with lupus nephritis activity?", recallA: "Anti-dsDNA." },
  { id: "crab", title: "Multiple Myeloma", phrase: "CRAB", icon: "orthopedics",
    letters: [["C", "Calcium raised"], ["R", "Renal failure"], ["A", "Anaemia"], ["B", "Bone lesions, lytic"]],
    recallQ: "Why is ALP typically normal despite bone lesions?", recallA: "Lesions are lytic, with little osteoblast activity." },
  { id: "four-t", title: "Anterior Mediastinal Mass", phrase: "Thymoma, Teratoma, Thyroid, Terrible lymphoma", icon: "radiology",
    letters: [["T", "Thymoma"], ["T", "Teratoma"], ["T", "Thyroid"], ["T", "Terrible lymphoma"]],
    recallQ: "Thymoma is linked with which neuromuscular disease?", recallA: "Myasthenia gravis." },
  { id: "pph", title: "Causes of PPH", phrase: "Tone, Trauma, Tissue, Thrombin", icon: "obgyn",
    letters: [["T", "Tone: atony, the commonest"], ["T", "Trauma: tears, rupture"], ["T", "Tissue: retained placenta"], ["T", "Thrombin: coagulopathy"]],
    recallQ: "Which drug given within 3 hours of birth reduces death from bleeding?", recallA: "Tranexamic acid 1 g IV." },
  { id: "apgar", title: "APGAR Score", phrase: "APGAR", icon: "pediatrics",
    letters: [["A", "Appearance"], ["P", "Pulse"], ["G", "Grimace"], ["A", "Activity"], ["R", "Respiration"]],
    recallQ: "When is it measured?", recallA: "At 1 and 5 minutes; it doesn't guide the start of resuscitation." },
  { id: "tof", title: "Tetralogy of Fallot", phrase: "PROV", icon: "cardiology", diagram: "tof",
    letters: [["P", "Pulmonary stenosis"], ["R", "Right ventricular hypertrophy"], ["O", "Overriding aorta"], ["V", "VSD"]],
    recallQ: "What is the chest X-ray sign?", recallA: "Boot-shaped heart (coeur en sabot)." },
  { id: "horner", title: "Horner's Syndrome", phrase: "PAM", icon: "ophthalmology", diagram: "horner",
    letters: [["P", "Ptosis"], ["A", "Anhidrosis"], ["M", "Miosis"]],
    recallQ: "Which lung tumour classically causes it?", recallA: "Pancoast tumour, at the lung apex." },
  { id: "coat", title: "Wernicke's Encephalopathy", phrase: "COAT", icon: "neurology",
    letters: [["C", "Confusion"], ["O", "Ophthalmoplegia"], ["A", "Ataxia"], ["T", "Thiamine (the treatment)"]],
    recallQ: "Why give thiamine before glucose?", recallA: "Glucose without thiamine can precipitate or worsen it." },
  { id: "trap", title: "Parkinson's Disease", phrase: "TRAP", icon: "neurology",
    letters: [["T", "Tremor at rest"], ["R", "Rigidity"], ["A", "Akinesia, bradykinesia"], ["P", "Postural instability"]],
    recallQ: "What pathway degenerates?", recallA: "The nigrostriatal dopaminergic pathway." },
  { id: "sigecaps", title: "Symptoms of Depression", phrase: "SIG E CAPS", icon: "psychiatry",
    letters: [["S", "Sleep change"], ["I", "Interest lost"], ["G", "Guilt"], ["E", "Energy low"], ["C", "Concentration poor"], ["A", "Appetite change"], ["P", "Psychomotor change"], ["S", "Suicidal thoughts"]],
    recallQ: "How long must symptoms last for major depression?", recallA: "At least 2 weeks." },
  { id: "charts", title: "Upper Zone Lung Fibrosis", phrase: "CHARTS", icon: "respiratory",
    letters: [["C", "Coal worker's pneumoconiosis"], ["H", "Histiocytosis"], ["A", "Ankylosing spondylitis, ABPA"], ["R", "Radiation"], ["T", "Tuberculosis"], ["S", "Silicosis, sarcoidosis"]],
    recallQ: "Name a lower zone cause linked with a mineral.", recallA: "Asbestosis." },
  { id: "gprs", title: "Liver Enzyme Inducers", phrase: "GPRS Cell Phone", icon: "gastro",
    letters: [["G", "Griseofulvin"], ["P", "Phenytoin"], ["R", "Rifampicin"], ["S", "Smoking"], ["C", "Carbamazepine"], ["P", "Phenobarbitone"]],
    recallQ: "What happens to warfarin's INR when rifampicin starts?", recallA: "The INR falls: warfarin is broken down faster." },
  { id: "tics", title: "Microcytic Anaemia", phrase: "TICS", icon: "medicine",
    letters: [["T", "Thalassaemia"], ["I", "Iron deficiency"], ["C", "Chronic disease"], ["S", "Sideroblastic anaemia"]],
    recallQ: "What ferritin and TIBC mean iron deficiency?", recallA: "Low ferritin with high TIBC." },
  { id: "lmnop", title: "Acute Pulmonary Oedema", phrase: "LMNOP", icon: "cardiology", note: "An old list: oxygen only if hypoxic, and morphine is no longer routine. NIV has an early role.",
    letters: [["L", "Lasix (furosemide)"], ["M", "Morphine, selectively"], ["N", "Nitrates"], ["O", "Oxygen, if hypoxic"], ["P", "Position: sit up"]],
    recallQ: "Which early support reduces the need for intubation?", recallA: "Non-invasive ventilation." },
  { id: "mona", title: "Acute Coronary Syndrome", phrase: "MONA", icon: "cardiology", note: "An old list: aspirin first. Oxygen only if SpO₂ is under 90%. Avoid nitrates with low BP, right ventricular infarct or recent sildenafil.",
    letters: [["M", "Morphine, if pain persists"], ["O", "Oxygen, if SpO₂ under 90%"], ["N", "Nitrates"], ["A", "Aspirin"]],
    recallQ: "What aspirin dose do you give, and how?", recallA: "300 to 325 mg, chewed." },
  { id: "stones", title: "Hypercalcaemia", phrase: "Stones, Bones, Groans, Moans", icon: "endocrine",
    letters: [["S", "Stones: renal colic"], ["B", "Bones: pain, fractures"], ["G", "Groans: constipation, pancreatitis"], ["M", "Moans: depression, confusion"]],
    recallQ: "What's the first treatment for severe hypercalcaemia?", recallA: "IV normal saline, then a bisphosphonate." },
];

/** The phrase in pieces: each mnemonic letter marked, in order, so it can be shown red. */
export function phraseParts(card: Pick<MnemonicCard, "phrase" | "letters">): { text: string; hit: boolean }[] {
  const parts: { text: string; hit: boolean }[] = [];
  let next = 0;
  let wordStart = true;
  for (const ch of card.phrase) {
    const isLetter = /[\p{L}\p{N}]/u.test(ch);
    const want = card.letters[next]?.[0];
    // Capitals and digits count anywhere ("MUDPILES", "CURB-65"); small letters only at the start of a word.
    const hit = !!want && isLetter && (wordStart || ch !== ch.toLowerCase() || /\d/.test(ch)) && ch.toLowerCase() === want.toLowerCase();
    if (hit) next++;
    const last = parts[parts.length - 1];
    if (last && last.hit === hit && !hit) last.text += ch;
    else parts.push({ text: ch, hit });
    wordStart = !isLetter && ch !== "'" && ch !== "’" ? true : isLetter ? false : wordStart;
  }
  return parts;
}
