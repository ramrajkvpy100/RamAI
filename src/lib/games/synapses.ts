/**
 * Synapses: 16 tiles hiding 4 groups of 4. Curated by hand, in code, never written by the model at runtime.
 * Each board's groups run Easy → Medium → Hard → Master. A tile appears once per board (tests/games-content.test.ts checks).
 */

export type Tier = "Easy" | "Medium" | "Hard" | "Master";
export const TIERS: readonly Tier[] = ["Easy", "Medium", "Hard", "Master"];
export const TIER_POINTS: Record<Tier, number> = { Easy: 100, Medium: 200, Hard: 300, Master: 400 };

export interface SynapseGroup {
  name: string;
  tiles: [string, string, string, string];
}

export interface SynapseBoard {
  id: string;
  title: string;
  specialty: string;
  /** Easy, Medium, Hard, Master, in that order. */
  groups: [SynapseGroup, SynapseGroup, SynapseGroup, SynapseGroup];
}

const g = (name: string, a: string, b: string, c: string, d: string): SynapseGroup => ({ name, tiles: [a, b, c, d] });

export const SYNAPSE_BOARDS: SynapseBoard[] = [
  { id: "acid-base", title: "Acid and base", specialty: "Medicine", groups: [
    g("High anion gap metabolic acidosis", "Methanol", "Uraemia", "Diabetic ketoacidosis", "Lactic acidosis"),
    g("Normal anion gap metabolic acidosis", "Diarrhoea", "Renal tubular acidosis", "Acetazolamide", "Ureterosigmoidostomy"),
    g("Metabolic alkalosis", "Persistent vomiting", "Loop diuretics", "Conn's syndrome", "Bartter syndrome"),
    g("Respiratory alkalosis", "Pulmonary embolism", "High altitude", "Panic attack", "Hepatic failure"),
  ] },
  { id: "drug-effects", title: "Blame the drug", specialty: "Pharmacology", groups: [
    g("Gynaecomastia", "Spironolactone", "Cimetidine", "Digoxin", "Finasteride"),
    g("Gingival hyperplasia", "Phenytoin", "Ciclosporin", "Nifedipine", "Verapamil"),
    g("Pulmonary fibrosis", "Amiodarone", "Bleomycin", "Busulfan", "Nitrofurantoin"),
    g("Drug-induced lupus", "Hydralazine", "Procainamide", "Isoniazid", "Minocycline"),
  ] },
  { id: "bedside-clusters", title: "Bedside clusters", specialty: "Emergency", groups: [
    g("Cardiac tamponade", "Hypotension", "Raised JVP", "Muffled heart sounds", "Pulsus paradoxus"),
    g("Acute cholangitis (Charcot, Reynolds)", "Rigors", "Right upper quadrant pain", "Jaundice", "Altered sensorium"),
    g("Raised intracranial pressure (Cushing)", "Hypertension", "Bradycardia", "Irregular breathing", "Papilloedema"),
    g("Meningococcal meningitis", "Neck stiffness", "Photophobia", "Kernig's sign", "Non-blanching rash"),
  ] },
  { id: "toxicology", title: "Poisons and pupils", specialty: "Emergency", groups: [
    g("First-line antidotes", "Naloxone", "Flumazenil", "N-acetylcysteine", "Fomepizole"),
    g("Chelating agents", "Desferrioxamine", "Calcium EDTA", "Dimercaprol", "Penicillamine"),
    g("Pinpoint pupils", "Organophosphates", "Morphine", "Clonidine", "Pontine haemorrhage"),
    g("Dilated pupils", "Datura", "Amphetamine", "Cocaine", "Tricyclic overdose"),
  ] },
  { id: "glomerular", title: "Nephritic or nephrotic", specialty: "Nephrology", groups: [
    g("Nephrotic syndrome causes", "Minimal change disease", "FSGS", "Membranous nephropathy", "Amyloidosis"),
    g("Nephritic syndrome causes", "IgA nephropathy", "Post-streptococcal GN", "Anti-GBM disease", "Lupus class IV"),
    g("Nephrotic findings", "Oval fat bodies", "Hypoalbuminaemia", "Hyperlipidaemia", "Protein above 3.5 g/day"),
    g("Nephritic findings", "RBC casts", "Cola-coloured urine", "Oliguria", "Periorbital oedema with raised BP"),
  ] },
  { id: "vectors", title: "Who carries it", specialty: "Infectious Disease", groups: [
    g("Aedes mosquito", "Dengue", "Chikungunya", "Zika", "Yellow fever"),
    g("Culex mosquito", "Japanese encephalitis", "West Nile fever", "Bancroftian filariasis", "St Louis encephalitis"),
    g("Sandfly", "Kala-azar", "Oriental sore", "Oroya fever", "Pappataci fever"),
    g("Hard tick", "Lyme disease", "Kyasanur Forest disease", "Rocky Mountain spotted fever", "Babesiosis"),
  ] },
  { id: "ecg-patterns", title: "Read the ECG", specialty: "Cardiology", groups: [
    g("Hyperkalaemia", "Tented T waves", "Wide QRS", "Flattened P waves", "Sine wave"),
    g("Hypokalaemia", "U waves", "Flat T waves", "ST depression", "Long QU interval"),
    g("Pericarditis", "Diffuse concave ST elevation", "PR depression", "PR elevation in aVR", "Spodick's sign"),
    g("Pulmonary embolism", "S1Q3T3", "Sinus tachycardia", "New RBBB", "T inversion V1 to V4"),
  ] },
  { id: "skull-foramina", title: "Holes in the skull", specialty: "Neurology", groups: [
    g("Superior orbital fissure", "Oculomotor nerve", "Trochlear nerve", "Abducens nerve", "Ophthalmic division"),
    g("Internal acoustic meatus", "Facial nerve", "Vestibulocochlear nerve", "Labyrinthine artery", "Nervus intermedius"),
    g("Jugular foramen", "Glossopharyngeal nerve", "Vagus nerve", "Accessory nerve", "Inferior petrosal sinus"),
    g("Foramen ovale", "Mandibular division", "Lesser petrosal nerve", "Accessory meningeal artery", "Emissary vein"),
  ] },
  { id: "endocrine-syndromes", title: "Syndromes in sets", specialty: "Endocrinology", groups: [
    g("MEN 1", "Parathyroid adenoma", "Pituitary adenoma", "Gastrinoma", "Insulinoma"),
    g("MEN 2A", "Medullary thyroid carcinoma", "Phaeochromocytoma", "Parathyroid hyperplasia", "Cutaneous lichen amyloidosis"),
    g("MEN 2B", "Mucosal neuromas", "Marfanoid habitus", "Intestinal ganglioneuromatosis", "Medullated corneal nerves"),
    g("Autoimmune polyglandular type 1", "Addison's disease", "Hypoparathyroidism", "Mucocutaneous candidiasis", "AIRE mutation"),
  ] },
  { id: "blood-film", title: "On the blood film", specialty: "Medicine", groups: [
    g("Macrocytosis", "B12 deficiency", "Folate deficiency", "Hydroxyurea", "Alcohol use"),
    g("Schistocytes", "TTP", "Haemolytic uraemic syndrome", "DIC", "Mechanical heart valve"),
    g("Target cells", "Thalassaemia", "Obstructive liver disease", "Haemoglobin C", "Post-splenectomy"),
    g("Basophilic stippling", "Lead poisoning", "Arsenic poisoning", "Sideroblastic anaemia", "P5N deficiency"),
  ] },
  { id: "psych-drugs", title: "Side effects in psychiatry", specialty: "Psychiatry", groups: [
    g("Clozapine", "Agranulocytosis", "Sialorrhoea", "Myocarditis", "Seizures"),
    g("Lithium", "Nephrogenic diabetes insipidus", "Hypothyroidism", "Fine tremor", "Ebstein's anomaly"),
    g("Sodium valproate", "Neural tube defects", "Hepatotoxicity", "Pancreatitis", "Polycystic ovaries"),
    g("Typical antipsychotics", "Acute dystonia", "Akathisia", "Tardive dyskinesia", "Neuroleptic malignant syndrome"),
  ] },
  { id: "labour-ward", title: "Labour ward lists", specialty: "OBGYN", groups: [
    g("Causes of primary PPH (4 Ts)", "Tone", "Trauma", "Tissue", "Thrombin"),
    g("APGAR score", "Appearance", "Pulse", "Grimace", "Respiration"),
    g("Antepartum haemorrhage", "Placenta praevia", "Abruption", "Vasa praevia", "Uterine rupture"),
    g("Bishop score", "Dilatation", "Effacement", "Station", "Consistency"),
  ] },
  { id: "murmurs", title: "Listen to the murmur", specialty: "Cardiology", groups: [
    g("Diastolic", "Aortic regurgitation", "Mitral stenosis", "Pulmonary regurgitation", "Tricuspid stenosis"),
    g("Ejection systolic", "Aortic stenosis", "Pulmonary stenosis", "HOCM", "Atrial septal defect"),
    g("Pansystolic", "Mitral regurgitation", "Tricuspid regurgitation", "Ventricular septal defect", "Gerbode defect"),
    g("Continuous", "Patent ductus arteriosus", "AV fistula", "Venous hum", "Ruptured sinus of Valsalva"),
  ] },
  { id: "lungs", title: "Fluid and fibrosis", specialty: "Respiratory", groups: [
    g("Transudative effusion", "Heart failure", "Cirrhosis", "Nephrotic syndrome", "Peritoneal dialysis"),
    g("Exudative effusion", "Pneumonia", "Tuberculosis", "Malignancy", "Pancreatitis"),
    g("Upper zone fibrosis", "Silicosis", "Ankylosing spondylitis", "ABPA", "Coal worker's pneumoconiosis"),
    g("Lower zone fibrosis", "Idiopathic pulmonary fibrosis", "Asbestosis", "Scleroderma", "Rheumatoid lung"),
  ] },
  { id: "gut", title: "Which gut disease", specialty: "Gastroenterology", groups: [
    g("Crohn's disease", "Skip lesions", "Transmural inflammation", "Cobblestone mucosa", "Non-caseating granulomas"),
    g("Ulcerative colitis", "Continuous from the rectum", "Crypt abscesses", "Pseudopolyps", "Lead-pipe colon"),
    g("Coeliac disease", "Villous atrophy", "Anti-tTG antibody", "Dermatitis herpetiformis", "HLA-DQ2"),
    g("Whipple's disease", "PAS-positive macrophages", "Tropheryma", "Migratory arthralgia", "Oculomasticatory myorhythmia"),
  ] },
  { id: "antibodies", title: "Name the antibody's home", specialty: "Medicine", groups: [
    g("Connective tissue disease", "Anti-dsDNA", "Anti-Scl-70", "Anti-Jo-1", "Anti-centromere"),
    g("Autoimmune liver disease", "Anti-mitochondrial", "Anti-smooth muscle", "Anti-LKM1", "p-ANCA in PSC"),
    g("Neurological disease", "Anti-AChR", "Anti-VGCC", "Anti-NMDA receptor", "Anti-aquaporin-4"),
    g("Endocrine disease", "Anti-TPO", "Anti-GAD", "TSH receptor antibody", "Anti-21-hydroxylase"),
  ] },
  { id: "abdomen-signs", title: "Signs in the abdomen", specialty: "Surgery", groups: [
    g("Acute appendicitis", "McBurney's point", "Rovsing's sign", "Psoas sign", "Obturator sign"),
    g("Gallbladder and biliary", "Murphy's sign", "Boas' sign", "Courvoisier's law", "Mirizzi syndrome"),
    g("Severe acute pancreatitis", "Cullen's sign", "Grey Turner's sign", "Fox's sign", "Colon cut-off sign"),
    g("Sigmoid volvulus", "Coffee bean sign", "Bird's beak sign", "Whirl sign", "Frimann-Dahl sign"),
  ] },
  { id: "nerve-palsies", title: "Which nerve is it", specialty: "Orthopedics", groups: [
    g("Radial nerve", "Wrist drop", "Saturday night palsy", "Holstein-Lewis fracture", "Crutch palsy"),
    g("Ulnar nerve", "Claw hand", "Froment's sign", "Guyon's canal", "Cubital tunnel"),
    g("Median nerve", "Ape thumb", "Carpal tunnel", "Hand of benediction", "Pronator syndrome"),
    g("Common peroneal nerve", "Foot drop", "Fibular neck fracture", "Steppage gait", "Loss of eversion"),
  ] },
  { id: "torch", title: "Born with it", specialty: "Pediatrics", groups: [
    g("Congenital syphilis", "Snuffles", "Hutchinson's teeth", "Saddle nose", "Mulberry molars"),
    g("Congenital rubella", "Patent ductus", "Cataract", "Salt-and-pepper retinopathy", "Blueberry muffin rash"),
    g("Congenital CMV", "Periventricular calcification", "Microcephaly", "Sensorineural deafness", "Commonest congenital infection"),
    g("Congenital toxoplasmosis", "Chorioretinitis", "Hydrocephalus", "Diffuse brain calcification", "Sabin-Feldman dye test"),
  ] },
  { id: "skin-signs", title: "What the skin says", specialty: "Dermatology", groups: [
    g("Psoriasis", "Auspitz sign", "Koebner phenomenon", "Nail pitting", "Woronoff ring"),
    g("Lichen planus", "Wickham's striae", "Pterygium of the nail", "Saw-tooth rete ridges", "Hepatitis C link"),
    g("Pemphigus vulgaris", "Positive Nikolsky", "Intraepidermal split", "Acantholysis", "Flaccid bullae"),
    g("Bullous pemphigoid", "Tense bullae", "Subepidermal split", "Anti-BP180", "Linear IgG at the basement membrane"),
  ] },
  { id: "fundus", title: "Look in the eye", specialty: "Ophthalmology", groups: [
    g("Diabetic retinopathy", "Microaneurysms", "Dot-blot haemorrhages", "Hard exudates", "Neovascularisation"),
    g("Hypertensive retinopathy", "AV nipping", "Silver wiring", "Flame haemorrhages", "Macular star"),
    g("Cherry-red spot", "Central retinal artery occlusion", "Tay-Sachs disease", "Niemann-Pick disease", "Commotio retinae"),
    g("Anterior uveitis", "Keratic precipitates", "Hypopyon", "Koeppe nodules", "Posterior synechiae"),
  ] },
  { id: "ent", title: "Ear and airway", specialty: "ENT", groups: [
    g("Conductive hearing loss", "Otosclerosis", "Glue ear", "Impacted wax", "Ossicular discontinuity"),
    g("Sensorineural hearing loss", "Presbycusis", "Noise trauma", "Acoustic neuroma", "Gentamicin ototoxicity"),
    g("Peripheral vertigo", "BPPV", "Meniere's disease", "Vestibular neuritis", "Labyrinthitis"),
    g("Stridor in a child", "Croup", "Epiglottitis", "Laryngomalacia", "Inhaled foreign body"),
  ] },
  { id: "biostat", title: "Study designs", specialty: "Community Medicine", groups: [
    g("Case-control study", "Odds ratio", "Starts from the outcome", "Good for rare disease", "Recall bias"),
    g("Cohort study", "Relative risk", "Measures incidence", "Attributable risk", "Loss to follow-up"),
    g("Randomised trial", "Random allocation", "Blinding", "Intention to treat", "CONSORT"),
    g("Evaluating a screening test", "Sensitivity", "Specificity", "Predictive value", "Likelihood ratio"),
  ] },
  { id: "arrest-anaesthesia", title: "Arrest and anaesthesia", specialty: "Emergency", groups: [
    g("Reversible causes: the 4 Hs", "Hypoxia", "Hypovolaemia", "Hypothermia", "Hyperkalaemia"),
    g("Reversible causes: the 4 Ts", "Tamponade", "Tension pneumothorax", "Thrombosis", "Toxins"),
    g("IV induction agents", "Propofol", "Ketamine", "Etomidate", "Thiopentone"),
    g("Non-depolarising muscle relaxants", "Rocuronium", "Vecuronium", "Atracurium", "Pancuronium"),
  ] },
  { id: "antibiotics", title: "How they kill", specialty: "Pharmacology", groups: [
    g("Cell wall synthesis", "Benzylpenicillin", "Vancomycin", "Cefazolin", "Meropenem"),
    g("30S ribosome", "Gentamicin", "Doxycycline", "Amikacin", "Tigecycline"),
    g("50S ribosome", "Azithromycin", "Clindamycin", "Linezolid", "Chloramphenicol"),
    g("DNA or RNA", "Ciprofloxacin", "Metronidazole", "Rifampicin", "Levofloxacin"),
  ] },
  { id: "vitamins", title: "Short of a vitamin", specialty: "Medicine", groups: [
    g("Vitamin C", "Scurvy", "Perifollicular haemorrhage", "Corkscrew hairs", "Bleeding gums"),
    g("Vitamin D", "Rickets", "Osteomalacia", "Harrison's sulcus", "Looser's zones"),
    g("Vitamin A", "Bitot's spots", "Night blindness", "Keratomalacia", "Follicular hyperkeratosis"),
    g("Vitamin B1", "Wet beriberi", "Wernicke's encephalopathy", "Korsakoff psychosis", "Low RBC transketolase"),
  ] },
];

/** Same tiles in a new order for every game: a seeded shuffle, so a board can be replayed the same way in a test. */
export function shuffledTiles(board: SynapseBoard, seed: number): string[] {
  const tiles = board.groups.flatMap((x) => x.tiles);
  let s = seed >>> 0 || 1;
  for (let i = tiles.length - 1; i > 0; i--) {
    s = Math.imul(s ^ (s >>> 15), 2246822519) >>> 0;
    const j = s % (i + 1);
    [tiles[i], tiles[j]] = [tiles[j]!, tiles[i]!];
  }
  return tiles;
}

/** Which group these four tiles are, if they are one. How many of the four share a group, for "one away". */
export function checkTiles(board: SynapseBoard, picked: readonly string[]): { group: SynapseGroup | null; tier: Tier | null; closest: number } {
  let closest = 0;
  for (const [i, group] of board.groups.entries()) {
    const hits = picked.filter((t) => (group.tiles as readonly string[]).includes(t)).length;
    closest = Math.max(closest, hits);
    if (hits === 4 && picked.length === 4) return { group, tier: TIERS[i]!, closest };
  }
  return { group: null, tier: null, closest };
}
