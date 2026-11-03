/**
 * Which sub-group each picture in Spot the diagnosis belongs to — by id, by hand, so nothing lands somewhere by
 * accident of a pattern. Each group holds 8–35 (tests/skills-see-hear.test.ts). Clinical images use their subject.
 */
export const SPOT_GROUPS: Record<"ecg" | "xray" | "ct" | "usg" | "smear", Record<string, readonly string[]>> = {
  ecg: {
    "Arrhythmias & Conduction Blocks": ["nsr", "sinus-tachy", "sinus-brady", "sinus-arrhythmia", "af", "af-slow", "flutter", "svt", "mat", "atrial-ectopics", "junctional", "vt", "vf", "torsades", "ectopics-vent", "bigeminy", "asystole", "pea-ecg", "first-degree", "second-mobitz1", "second-mobitz2", "chb", "lbbb", "rbbb", "lafb", "wpw", "paced", "brugada", "long-qt"],
    "Ischaemia & Chamber Hypertrophy": ["inferior-stemi", "anterior-stemi", "lateral-stemi", "posterior-mi", "nstemi", "wellens", "de-winter", "pericarditis", "early-repol", "lvh", "rvh"],
    "Electrolyte, Drug & Systemic": ["hyperk", "hypok", "hypercal", "hypocal", "digoxin-effect", "tca-ecg", "pe-ecg", "hypothermia-ecg", "low-voltage", "dextrocardia"],
  },
  xray: {
    "Emergency & ICU Chest": ["pneumothorax", "tension", "haemothorax", "hydropneumothorax", "pneumomediastinum", "surgical-emphysema", "rib-fracture", "oedema", "aortic-unfold", "ngt-misplaced", "ett-low"],
    "OPD & Chronic Chest": ["normal-cxr", "consolidation", "effusion", "cardiomegaly", "miliary", "cavity", "collapse", "copd", "lung-mass", "hilar-lymph", "ild", "bronchiectasis", "lung-abscess", "dextrocardia-cxr", "hiatus-hernia"],
    "Fractures & Trauma": ["colles", "distal-radius", "scaphoid", "forearm-shaft", "elbow-fracture", "supracondylar", "humerus-fracture", "shoulder-disloc", "clavicle-fracture", "boxer", "metacarpal-fracture", "phalanx-fracture", "normal-hand-xr", "nof", "hip-fracture", "femur-fracture", "patella-fracture", "tibia-shaft", "ankle-fracture", "metatarsal-fracture", "normal-leg-xr", "normal-hip-xr", "skull-fracture"],
    "Implants, Joints & Bone Disease": ["plate-screws", "im-nail", "dhs", "cannulated-screws", "ex-fix", "k-wires", "tension-band", "hip-arthroplasty", "oa-knee", "ra-hands", "gout-xray", "ankylosing", "potts", "osteomyelitis", "osteosarcoma"],
    "Abdominal & Paediatric": ["pneumoperitoneum", "sbo", "lbo", "sigmoid-volvulus", "kub-stone", "foreign-body-coin", "paed-pneumonia", "paed-normal-cxr", "epiglottitis", "croup", "rickets"],
  },
  ct: {
    "Neuro & Head/Neck": ["ct-normal-head", "edh", "sdh", "chronic-sdh", "sah", "ich", "ivh", "infarct", "cerebral-oedema", "hydrocephalus", "brain-tumour", "brain-abscess", "ncc", "tuberculoma", "depressed-fracture", "orbital-fracture", "sinusitis-ct", "c-spine-fracture"],
    "Thoraco-Abdominal & Vascular": ["dissection", "pe", "aaa", "ct-pneumothorax", "ct-effusion", "empyema", "ct-consolidation", "ground-glass", "ct-lung-cancer", "emphysema-ct", "ct-bronchiectasis", "appendicitis", "pancreatitis", "necrotising-panc", "pseudocyst", "renal-stone", "liver-abscess", "perforation-ct", "ct-sbo", "diverticulitis", "intussusception-ct", "hcc", "hydatid", "cirrhosis-ct", "splenic-injury", "liver-injury", "renal-mass", "pyelonephritis-ct", "emphysematous-pyelo", "cholecystitis-ct", "mesenteric-ischaemia", "pelvic-fracture"],
  },
  usg: {
    "POCUS, Cardiac & Vascular": ["free-fluid", "pericardial-effusion", "pleural-effusion-usg", "lung-sliding", "b-lines", "aaa-usg", "dvt", "ascites-usg"],
    "Abdominal & Urinary": ["normal-gb", "gallstones", "cholecystitis", "gb-polyp", "cbd-dilated", "fatty-liver", "liver-abscess-usg", "cirrhosis-usg", "hydatid-usg", "liver-mets", "splenomegaly", "appendicitis-usg", "intussusception-usg", "pyloric-stenosis", "normal-kidney", "hydronephrosis", "renal-calculus-usg", "ckd-kidney", "renal-cyst", "pkd", "bladder-stone", "bph"],
    "OB/GYN": ["ectopic", "iup", "missed-miscarriage", "molar", "twins", "placenta-praevia", "breech", "anencephaly", "ovarian-cyst", "dermoid", "endometrioma", "pcos", "torsion-ovary", "fibroid"],
    "Neck, Breast & Scrotum": ["thyroid-nodule", "lymph-node", "breast-cyst", "breast-benign-usg", "fibroadenoma", "breast-ca-usg", "testicular-torsion", "varicocele"],
  },
  smear: {
    "Red Cell Disorders": ["normal-smear", "sickle", "sickle-hbsc", "ida", "megaloblastic", "dimorphic", "thalassaemia", "target", "spherocytes", "spherocyte-aiha", "schistocytes", "bite-cells", "burr-cells", "acanthocytes", "elliptocytes", "teardrop", "howell-jolly", "basophilic-stippling", "nrbc", "reticulocytes", "rouleaux", "agglutination"],
    "White Cells, Platelets & Malignancy": ["aml", "apml", "all", "cml", "cll", "hairy-cell", "myeloma-plasma", "leukoerythroblastic", "pelger", "toxoplasma-lymph", "eosinophilia", "basophilia", "thrombocytopenia", "giant-platelets", "platelet-clumps"],
    "Infectious & Parasitic": ["falciparum", "falciparum-gameto", "vivax", "malariae", "ovale", "babesia", "leishmania", "trypanosome", "borrelia", "microfilaria", "loa-loa", "atypical-lymph", "neutrophilia"],
  },
};
