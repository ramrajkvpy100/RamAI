/**
 * Practice — image-recognition drills: ECG, X-ray, CT, ultrasound and peripheral smear. Isomorphic:
 * the page shows the bank, the server finds the pictures. Each picture is a real, freely licensed
 * image (Wikimedia Commons) checked against its diagnosis by AI; when none can be found, an AI-made
 * image checked the same way — and for ECGs, RamAI's own drawn tracing, which is exact.
 * Scores here are their own: they don't touch XP, rank or the leaderboards.
 */
import type { EcgSpec } from "@/engine/types";

import { CLINICAL_ITEMS } from "./banks/clinical";
import { MORE_CT, MORE_ECG, MORE_SMEAR, MORE_USG, MORE_XRAY } from "./banks/imaging";

export { CLINICAL_SUBJECTS, type ClinicalSubject } from "./banks/clinical";

export type Modality = "ecg" | "xray" | "ct" | "usg" | "smear" | "clinical";

export interface PracticeItem {
  id: string;
  label: string;
  /** The one thing to recognise it by — shown after each answer. */
  key: string;
  /** Words to find a real image of it. */
  search: string[];
  /** What an AI picture must show (when no real one is found). */
  describe: string;
  /** For ECGs RamAI can draw exactly. */
  ecg?: EcgSpec;
  /** Clinical images: the subject it belongs to. */
  subject?: string;
}

export interface ModalityInfo {
  id: Modality;
  label: string;
  short: string;
  /** How the picture is named in a search, and what the image model is asked for. */
  kind: string;
  items: PracticeItem[];
}

const ecg = (rate: number, rhythm: EcgSpec["rhythm"], morphology?: EcgSpec["morphology"]): EcgSpec => ({ kind: "ecg", rate, rhythm, ...(morphology ? { morphology } : {}) });

export const MODALITIES: Record<Modality, ModalityInfo> = {
  ecg: {
    id: "ecg",
    label: "ECG",
    short: "ECG",
    kind: "12-lead ECG",
    items: [
      { id: "nsr", label: "Normal sinus rhythm", key: "Rate 60–100, a P wave before every QRS, PR 120–200 ms, narrow QRS.", search: ["normal sinus rhythm 12 lead ECG"], describe: "normal 12-lead ECG in sinus rhythm", ecg: ecg(76, "sinus") },
      { id: "sinus-tachy", label: "Sinus tachycardia", key: "Sinus P waves before every QRS at a rate above 100.", search: ["sinus tachycardia ECG"], describe: "sinus tachycardia at 125/min", ecg: ecg(125, "sinus") },
      { id: "sinus-brady", label: "Sinus bradycardia", key: "Sinus P waves before every QRS at a rate below 60.", search: ["sinus bradycardia ECG"], describe: "sinus bradycardia at 45/min", ecg: ecg(45, "sinus") },
      { id: "af", label: "Atrial fibrillation", key: "Irregularly irregular narrow-complex rhythm with no P waves — a fibrillating baseline.", search: ["atrial fibrillation ECG 12 lead"], describe: "atrial fibrillation with a fast ventricular rate", ecg: ecg(118, "afib", { pWaves: false }) },
      { id: "flutter", label: "Atrial flutter", key: "Saw-tooth flutter waves at ~300/min, best in II, III, aVF; often 2:1 block giving a rate of ~150.", search: ["atrial flutter ECG sawtooth"], describe: "atrial flutter with 2:1 block, saw-tooth flutter waves in the inferior leads", ecg: ecg(150, "aflutter") },
      { id: "svt", label: "Supraventricular tachycardia (AVNRT)", key: "Regular narrow-complex tachycardia at 150–250 with no visible P waves.", search: ["supraventricular tachycardia ECG AVNRT"], describe: "regular narrow complex tachycardia at 180/min", ecg: ecg(180, "svt", { pWaves: false }) },
      { id: "vt", label: "Ventricular tachycardia", key: "Regular broad-complex tachycardia (QRS > 120 ms), often with AV dissociation, fusion or capture beats.", search: ["ventricular tachycardia ECG monomorphic"], describe: "monomorphic ventricular tachycardia at 170/min", ecg: ecg(170, "vt") },
      { id: "vf", label: "Ventricular fibrillation", key: "Chaotic, irregular deflections with no identifiable QRS complexes — cardiac arrest.", search: ["ventricular fibrillation ECG"], describe: "coarse ventricular fibrillation rhythm strip" },
      { id: "chb", label: "Complete (third-degree) heart block", key: "P waves and QRS complexes march independently (AV dissociation); slow escape rhythm.", search: ["third degree AV block ECG", "complete heart block ECG"], describe: "complete heart block with AV dissociation and a slow ventricular escape rhythm" },
      { id: "first-degree", label: "First-degree AV block", key: "PR interval longer than 200 ms, every P conducted.", search: ["first degree AV block ECG"], describe: "first-degree AV block with PR 280 ms", ecg: ecg(70, "sinus", { pr: 290 }) },
      { id: "inferior-stemi", label: "Inferior STEMI", key: "ST elevation in II, III and aVF with reciprocal ST depression in I and aVL — usually the right coronary artery.", search: ["inferior STEMI ECG", "inferior myocardial infarction ECG"], describe: "acute inferior ST-elevation myocardial infarction", ecg: ecg(68, "sinus", { st: { II: 2.5, III: 3, aVF: 2.5, I: -1, aVL: -1.5 } }) },
      { id: "anterior-stemi", label: "Anterior STEMI", key: "ST elevation in V1–V4 — the left anterior descending artery.", search: ["anterior STEMI ECG", "anterior myocardial infarction ECG"], describe: "acute anterior ST-elevation myocardial infarction", ecg: ecg(88, "sinus", { st: { V1: 2, V2: 4, V3: 4, V4: 3, II: -0.5, III: -1, aVF: -0.5 } }) },
      { id: "hyperk", label: "Hyperkalaemia", key: "Tall, narrow, peaked T waves; then flattened P waves, a broad QRS and finally a sine wave.", search: ["hyperkalemia ECG peaked T waves"], describe: "hyperkalaemia with tall peaked T waves", ecg: ecg(64, "sinus", { peakedT: true }) },
      { id: "lvh", label: "Left ventricular hypertrophy", key: "Tall voltages — S in V1 plus R in V5 or V6 over 35 mm — often with a lateral strain pattern.", search: ["left ventricular hypertrophy ECG"], describe: "left ventricular hypertrophy by voltage criteria with lateral strain", ecg: ecg(74, "sinus", { qrsScale: { V1: 1.8, V2: 1.8, V5: 2, V6: 1.8, I: 1.4, aVL: 1.6 }, t: { V5: -0.6, V6: -0.6, I: -0.4, aVL: -0.5 } }) },
      { id: "long-qt", label: "Prolonged QT", key: "QTc over 450 ms in men or 460 ms in women; over 500 ms carries a high risk of torsades de pointes.", search: ["long QT syndrome ECG"], describe: "markedly prolonged QT interval", ecg: ecg(62, "sinus", { qt: 560 }) },
      { id: "lbbb", label: "Left bundle branch block", key: "Broad QRS (≥ 120 ms) with a deep S in V1 and a broad, notched R ('M') in V6, I and aVL.", search: ["left bundle branch block ECG"], describe: "left bundle branch block" },
      { id: "rbbb", label: "Right bundle branch block", key: "Broad QRS with RSR′ ('M') in V1–V2 and a wide slurred S in I and V6.", search: ["right bundle branch block ECG"], describe: "right bundle branch block" },
      { id: "wpw", label: "Wolff–Parkinson–White pattern", key: "Short PR (< 120 ms) and a slurred delta-wave upstroke to a broad QRS.", search: ["Wolff Parkinson White ECG delta wave"], describe: "Wolff–Parkinson–White pattern with delta waves" },
      { id: "pericarditis", label: "Acute pericarditis", key: "Widespread concave ST elevation with PR depression (and PR elevation in aVR).", search: ["pericarditis ECG"], describe: "acute pericarditis with diffuse saddle-shaped ST elevation and PR depression" },
      { id: "paced", label: "Paced rhythm", key: "Pacing spikes before broad QRS complexes.", search: ["ventricular paced rhythm ECG"], describe: "ventricular paced rhythm", ecg: ecg(70, "paced") },
      ...MORE_ECG,
    ],
  },
  xray: {
    id: "xray",
    label: "X-ray",
    short: "X-ray",
    kind: "radiograph",
    items: [
      { id: "normal-cxr", label: "Normal chest X-ray", key: "Clear lungs, sharp costophrenic angles, cardiothoracic ratio under 0.5 on a PA film.", search: ["normal chest radiograph PA"], describe: "normal PA chest X-ray of an adult" },
      { id: "pneumothorax", label: "Pneumothorax", key: "A visible visceral pleural line with no lung markings beyond it.", search: ["pneumothorax chest radiograph"], describe: "large right-sided pneumothorax on a PA chest X-ray" },
      { id: "tension", label: "Tension pneumothorax", key: "Pneumothorax with mediastinal shift away and a flattened hemidiaphragm — decompress, don't wait for the film.", search: ["tension pneumothorax radiograph"], describe: "left tension pneumothorax with mediastinal shift to the right" },
      { id: "consolidation", label: "Lobar pneumonia (consolidation)", key: "Lobar opacity with air bronchograms, the fissure sharply bounding it.", search: ["lobar pneumonia chest radiograph", "right upper lobe consolidation chest x-ray"], describe: "right upper lobe consolidation with air bronchograms" },
      { id: "effusion", label: "Pleural effusion", key: "Blunted costophrenic angle with a meniscus sign rising laterally.", search: ["pleural effusion chest radiograph"], describe: "moderate left pleural effusion with a meniscus" },
      { id: "oedema", label: "Pulmonary oedema", key: "Bat-wing perihilar shadowing, upper-lobe diversion, Kerley B lines, effusions and cardiomegaly.", search: ["pulmonary edema chest radiograph"], describe: "acute pulmonary oedema with bat-wing shadowing and cardiomegaly" },
      { id: "cardiomegaly", label: "Cardiomegaly", key: "Cardiothoracic ratio above 0.5 on a PA film.", search: ["cardiomegaly chest radiograph"], describe: "marked cardiomegaly on a PA chest X-ray" },
      { id: "miliary", label: "Miliary tuberculosis", key: "Innumerable tiny (1–3 mm) nodules evenly throughout both lungs.", search: ["miliary tuberculosis chest radiograph"], describe: "miliary tuberculosis with diffuse tiny nodules" },
      { id: "cavity", label: "Cavitating lesion (post-primary TB)", key: "A thick-walled cavity in an upper lobe, often with surrounding fibrosis.", search: ["cavitary tuberculosis chest radiograph"], describe: "right upper lobe cavity of pulmonary tuberculosis" },
      { id: "pneumoperitoneum", label: "Pneumoperitoneum", key: "Free air under the hemidiaphragm on an erect chest film — a perforated viscus until proven otherwise.", search: ["pneumoperitoneum air under diaphragm radiograph"], describe: "free air under both hemidiaphragms on an erect chest X-ray" },
      { id: "collapse", label: "Lobar collapse", key: "Volume loss: displaced fissure, raised hemidiaphragm and mediastinal shift towards the opacity.", search: ["left lower lobe collapse radiograph", "lobar collapse chest x-ray"], describe: "left lower lobe collapse with the sail sign behind the heart" },
      { id: "copd", label: "Hyperinflation (COPD)", key: "More than 6 anterior ribs above the diaphragm, flattened hemidiaphragms, a narrow heart.", search: ["COPD hyperinflation chest radiograph", "emphysema chest radiograph"], describe: "hyperinflated lungs with flat diaphragms in emphysema" },
      { id: "sbo", label: "Small bowel obstruction", key: "Dilated central loops over 3 cm with valvulae conniventes crossing the whole width.", search: ["small bowel obstruction abdominal radiograph"], describe: "small bowel obstruction on a supine abdominal X-ray" },
      { id: "colles", label: "Colles' fracture", key: "Distal radius fracture with dorsal angulation of the fragment — the dinner-fork deformity.", search: ["Colles fracture radiograph"], describe: "Colles fracture of the distal radius, lateral and AP views" },
      { id: "nof", label: "Fractured neck of femur", key: "A break in Shenton's line and the femoral neck cortex, often with the leg shortened.", search: ["femoral neck fracture radiograph"], describe: "displaced intracapsular neck of femur fracture" },
      ...MORE_XRAY,
    ],
  },
  ct: {
    id: "ct",
    label: "CT",
    short: "CT",
    kind: "CT",
    items: [
      { id: "edh", label: "Extradural haematoma", key: "Biconvex (lens-shaped) hyperdensity that doesn't cross sutures — middle meningeal artery.", search: ["extradural hematoma CT", "epidural hematoma CT"], describe: "acute extradural haematoma on non-contrast CT head" },
      { id: "sdh", label: "Subdural haematoma", key: "Crescent-shaped collection that crosses sutures — bridging veins.", search: ["subdural hematoma CT"], describe: "acute subdural haematoma on non-contrast CT head" },
      { id: "sah", label: "Subarachnoid haemorrhage", key: "Hyperdense blood in the basal cisterns and sulci — a star in the suprasellar cistern.", search: ["subarachnoid hemorrhage CT"], describe: "subarachnoid haemorrhage in the basal cisterns on non-contrast CT head" },
      { id: "ich", label: "Intracerebral haemorrhage", key: "A rounded intraparenchymal hyperdensity, classically in the basal ganglia in hypertension.", search: ["intracerebral hemorrhage CT basal ganglia"], describe: "hypertensive basal ganglia haemorrhage on CT head" },
      { id: "infarct", label: "Ischaemic stroke (MCA infarct)", key: "A wedge-shaped hypodensity in a vascular territory with loss of grey–white differentiation.", search: ["middle cerebral artery infarct CT"], describe: "established left MCA territory infarct on CT head" },
      { id: "appendicitis", label: "Acute appendicitis", key: "A dilated (> 6 mm), thick-walled appendix with surrounding fat stranding, ± appendicolith.", search: ["acute appendicitis CT"], describe: "acute appendicitis on contrast CT abdomen" },
      { id: "pancreatitis", label: "Acute pancreatitis", key: "An enlarged, oedematous pancreas with peripancreatic fat stranding and fluid.", search: ["acute pancreatitis CT"], describe: "acute interstitial pancreatitis on contrast CT" },
      { id: "renal-stone", label: "Ureteric calculus", key: "A hyperdense stone in the ureter on non-contrast CT KUB, with hydronephrosis above it.", search: ["ureteric calculus CT", "kidney stone CT"], describe: "obstructing left ureteric stone on CT KUB" },
      { id: "dissection", label: "Aortic dissection", key: "An intimal flap dividing the aorta into a true and a false lumen.", search: ["aortic dissection CT angiography"], describe: "Stanford type A aortic dissection on CT angiogram" },
      { id: "pe", label: "Pulmonary embolism", key: "A filling defect within the pulmonary arteries on CT pulmonary angiography.", search: ["pulmonary embolism CT angiography"], describe: "bilateral pulmonary emboli on CTPA" },
      { id: "liver-abscess", label: "Liver abscess", key: "A hypodense, rim-enhancing collection in the liver, often in the right lobe.", search: ["liver abscess CT"], describe: "amoebic liver abscess in the right lobe on contrast CT" },
      ...MORE_CT,
    ],
  },
  usg: {
    id: "usg",
    label: "Ultrasound",
    short: "USG",
    kind: "ultrasound",
    items: [
      { id: "gallstones", label: "Gallstones", key: "Echogenic foci in the gallbladder casting a clean posterior acoustic shadow, moving with position.", search: ["gallstones ultrasound"], describe: "gallbladder with multiple echogenic gallstones and posterior acoustic shadowing" },
      { id: "cholecystitis", label: "Acute cholecystitis", key: "Gallstones with a thickened (> 3 mm) gallbladder wall, pericholecystic fluid and a sonographic Murphy's sign.", search: ["acute cholecystitis ultrasound"], describe: "acute calculous cholecystitis with wall thickening and pericholecystic fluid" },
      { id: "hydronephrosis", label: "Hydronephrosis", key: "A dilated, fluid-filled renal pelvis and calyces.", search: ["hydronephrosis ultrasound"], describe: "moderate hydronephrosis of the right kidney" },
      { id: "fatty-liver", label: "Fatty liver", key: "A bright (hyperechoic) liver compared with the kidney, with poor penetration.", search: ["fatty liver ultrasound"], describe: "diffuse fatty liver brighter than the adjacent right kidney" },
      { id: "liver-abscess-usg", label: "Liver abscess", key: "A hypoechoic, thick-walled lesion in the liver with internal debris.", search: ["liver abscess ultrasound"], describe: "hypoechoic liver abscess with internal echoes" },
      { id: "ectopic", label: "Ectopic pregnancy", key: "An empty uterus with an adnexal mass (a tubal ring) and free fluid in a woman with a positive β-hCG.", search: ["ectopic pregnancy ultrasound"], describe: "tubal ectopic pregnancy with an adnexal ring and empty uterus on transvaginal ultrasound" },
      { id: "iup", label: "Intrauterine pregnancy", key: "A gestational sac with a yolk sac (± fetal pole) inside the uterine cavity.", search: ["early intrauterine pregnancy ultrasound yolk sac"], describe: "early intrauterine pregnancy with gestational sac and yolk sac" },
      { id: "free-fluid", label: "Free fluid (positive FAST)", key: "Anechoic fluid in Morison's pouch (hepatorenal space) in trauma — haemoperitoneum.", search: ["FAST scan free fluid Morison pouch"], describe: "free fluid in Morison's pouch on a FAST scan" },
      { id: "ovarian-cyst", label: "Simple ovarian cyst", key: "A thin-walled anechoic adnexal cyst with posterior acoustic enhancement.", search: ["simple ovarian cyst ultrasound"], describe: "simple anechoic ovarian cyst" },
      { id: "dvt", label: "Deep vein thrombosis", key: "A non-compressible vein with echogenic thrombus inside.", search: ["deep vein thrombosis ultrasound"], describe: "femoral vein thrombosis on compression ultrasound" },
      { id: "renal-calculus-usg", label: "Renal calculus", key: "An echogenic focus in the kidney with posterior acoustic shadowing.", search: ["renal calculus ultrasound"], describe: "renal calculus with posterior acoustic shadowing" },
      ...MORE_USG,
    ],
  },
  smear: {
    id: "smear",
    label: "Peripheral smear",
    short: "Smear",
    kind: "peripheral blood smear",
    items: [
      { id: "falciparum", label: "Plasmodium falciparum", key: "Delicate ring forms, often several per cell and at the edge (appliqué), with crescent-shaped gametocytes.", search: ["Plasmodium falciparum ring forms blood smear", "Plasmodium falciparum gametocyte"], describe: "thin blood smear with multiple delicate Plasmodium falciparum ring forms, some red cells with two rings" },
      { id: "vivax", label: "Plasmodium vivax", key: "Enlarged red cells with Schüffner's dots and amoeboid trophozoites.", search: ["Plasmodium vivax blood smear"], describe: "thin blood smear with enlarged red cells containing Plasmodium vivax trophozoites and Schüffner dots" },
      { id: "sickle", label: "Sickle cell anaemia", key: "Sickle-shaped red cells, with target cells and Howell–Jolly bodies.", search: ["sickle cell anemia blood smear"], describe: "peripheral smear of sickle cell anaemia with many sickled red cells" },
      { id: "ida", label: "Iron deficiency anaemia", key: "Microcytic, hypochromic red cells with pencil cells.", search: ["iron deficiency anemia blood smear"], describe: "microcytic hypochromic red cells with pencil cells in iron deficiency" },
      { id: "megaloblastic", label: "Megaloblastic anaemia", key: "Macro-ovalocytes and hypersegmented neutrophils (6 or more lobes).", search: ["hypersegmented neutrophil blood smear"], describe: "hypersegmented neutrophil among macro-ovalocytes in megaloblastic anaemia" },
      { id: "spherocytes", label: "Hereditary spherocytosis", key: "Small, dense red cells with no central pallor.", search: ["spherocytes blood smear"], describe: "many spherocytes without central pallor" },
      { id: "schistocytes", label: "Schistocytes (MAHA)", key: "Fragmented red cells — helmet cells — in microangiopathic haemolysis (TTP, HUS, DIC).", search: ["schistocytes blood smear"], describe: "red cell fragments and helmet cells (schistocytes)" },
      { id: "target", label: "Target cells", key: "Red cells with a central dot of haemoglobin — thalassaemia, liver disease, HbC.", search: ["target cells blood smear"], describe: "numerous target cells (codocytes)" },
      { id: "aml", label: "Acute myeloid leukaemia (Auer rods)", key: "Large myeloblasts with fine chromatin, nucleoli and needle-like Auer rods.", search: ["Auer rods myeloblast blood smear"], describe: "myeloblasts containing Auer rods" },
      { id: "cll", label: "Chronic lymphocytic leukaemia", key: "Many small mature lymphocytes and smudge cells.", search: ["chronic lymphocytic leukemia smudge cells"], describe: "many small mature lymphocytes with smudge cells in CLL" },
      { id: "microfilaria", label: "Microfilaria (Wuchereria bancrofti)", key: "A sheathed microfilaria lying among the red cells on a night smear.", search: ["Wuchereria bancrofti microfilaria blood smear"], describe: "sheathed Wuchereria bancrofti microfilaria on a blood smear" },
      ...MORE_SMEAR,
    ],
  },
  clinical: {
    id: "clinical",
    label: "Clinical images",
    short: "Clinical",
    kind: "clinical photograph",
    items: CLINICAL_ITEMS,
  },
};

export const MODALITY_IDS = Object.keys(MODALITIES) as Modality[];
export const isModality = (x: unknown): x is Modality => typeof x === "string" && x in MODALITIES;

export type PracticeMode = "spot" | "rapid";

/** One picture to name. `image` is a real or AI picture; `ecg` a drawn tracing. */
export interface DrillItem {
  item: string;
  image: string | null;
  ecg: EcgSpec | null;
  options: string[];
  answer: number;
  key: string;
  /** Each option's own classic features, in order — "why not" the wrong pick. */
  keys?: string[];
  credit: { author: string; license: string; source: string } | null;
  source: "commons" | "ai" | "drawn";
}

export const RAPID_SECONDS = 60;
export const SPOT_COUNT = 10;

/** Subcategories within each image drill (clinical images carry their own subject). */
const GROUPS: Partial<Record<Modality, [string, RegExp][]>> = {
  ecg: [["Rhythms", /sinus|af|flutter|svt|vt|vf|torsades|ectopic|bigeminy|junctional|mat|asystole|pea|paced/], ["Blocks & conduction", /block|degree|mobitz|chb|bbb|lafb|wpw|brugada|long-qt|qt/], ["Heart attack & ischaemia", /stemi|mi\b|nstemi|wellens|winter|pericard|early-repol|lvh|rvh/], ["Electrolytes, drugs & other", /k\b|kal|cal|digoxin|tca|pe-ecg|hypotherm|low-voltage|dextro/]],
  xray: [["Chest", /cxr|pneumo(?!peritoneum)|tension|consolidation|effusion|oedema|cardiomegaly|miliary|cavity|collapse|copd|rib|haemo|lung|hilar|ild|bronch|abscess|hydro|mediastin|emphysema|ngt|ett|dextro|aortic/], ["Abdomen", /pneumoperitoneum|sbo|lbo|volvulus|kub|coin/], ["Bones & joints", /colles|nof|fracture|disloc|clavicle|supracondylar|scaphoid|boxer|ankle|tibia|oa-|ra-|gout|ankylos|potts|osteo|rickets|skull/], ["Neck & children", /epiglott|croup/]],
  ct: [["Head & spine", /edh|sdh|sah|ich|infarct|hydroceph|brain|ncc|tubercul|tumour|oedema|ivh|depressed|normal-head|c-spine|orbital|sinus/], ["Chest", /pe\b|pe$|dissection|pneumothorax|effusion|empyema|consolidation|glass|lung|emphysema|bronch/], ["Abdomen", /append|pancrea|renal|stone|liver|abscess|aaa|perforat|sbo|divertic|intussus|hcc|hydatid|cirrhosis|pyelo|chole|pseudocyst|mesenteric/], ["Trauma", /splenic|injury|pelvic|fracture/]],
  usg: [["Liver, gallbladder & abdomen", /gall|chole|gb-|cbd|liver|fatty|cirrhosis|hydatid|mets|spleno|ascites|append|intussus|pyloric|free-fluid|aaa/], ["Kidney & bladder", /hydroneph|renal|kidney|ckd|pkd|bladder|bph/], ["Women & pregnancy", /ectopic|iup|ovar|fibroid|pcos|dermoid|endometrioma|torsion-ovary|molar|miscarriage|twins|placenta|breech|anenceph|breast|fibroadenoma/], ["Other", /.*/]],
  smear: [["Malaria & parasites", /falciparum|vivax|malariae|ovale|microfilaria|loa|leishmania|trypano|borrelia|babesia/], ["Red cells & anaemia", /sickle|ida|megaloblastic|sphero|schisto|target|thalass|howell|stippling|teardrop|burr|acantho|ellipto|bite|rouleaux|agglutin|nrbc|reticulo|dimorphic|aiha|normal/], ["White cells & leukaemia", /aml|cll|all|cml|apml|hairy|myeloma|neutroph|eosin|atypical|pelger|monocyt|basophil|leukoeryth|toxoplasma/], ["Platelets", /platelet|thrombocyt/]],
};
/** Which subcategory an item belongs to within its drill. */
export function groupOf(modality: Modality, item: PracticeItem): string {
  if (item.subject) return item.subject;
  return GROUPS[modality]?.find(([, re]) => re.test(item.id))?.[0] ?? "Other";
}
export function groupsOf(modality: Modality): string[] {
  return [...new Set(MODALITIES[modality].items.map((i) => groupOf(modality, i)))];
}
