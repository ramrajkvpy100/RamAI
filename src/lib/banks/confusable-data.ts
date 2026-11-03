/**
 * Classic look-alikes, for the wrong options (see ../confusable.ts). Each list is a set of ids within one drill
 * that a doctor could really mistake for one another. `ALSO_TRUE` pairs are never offered together, because both
 * would be right for the same picture (one is a kind of the other).
 */
type Clusters = readonly (readonly string[])[];
type Pairs = readonly (readonly [string, string])[];

export const SPOT_CLUSTERS: Record<"ecg" | "xray" | "ct" | "usg" | "smear" | "clinical", Clusters> = {
  ecg: [
    ["vt", "svt", "torsades", "vf"], ["af", "flutter", "mat", "svt"], ["svt", "sinus-tachy", "flutter"], ["nsr", "sinus-arrhythmia", "sinus-tachy", "sinus-brady"],
    ["sinus-brady", "junctional", "af-slow", "chb"], ["first-degree", "second-mobitz1", "second-mobitz2", "chb"], ["lbbb", "rbbb", "lafb", "paced", "wpw"], ["ectopics-vent", "atrial-ectopics", "sinus-arrhythmia"], ["bigeminy", "atrial-ectopics", "mat"],
    ["asystole", "vf", "pea-ecg"], ["long-qt", "torsades", "brugada"], ["brugada", "rbbb", "wpw"],
    ["inferior-stemi", "lateral-stemi", "anterior-stemi", "pericarditis", "early-repol"], ["posterior-mi", "nstemi", "rvh", "de-winter"], ["wellens", "de-winter", "nstemi"], ["lvh", "rvh", "early-repol"],
    ["hyperk", "hypok", "hypercal", "hypocal"], ["digoxin-effect", "hypok", "hypocal"], ["tca-ecg", "hyperk", "pe-ecg"], ["pe-ecg", "low-voltage", "dextrocardia"], ["hypothermia-ecg", "hypercal", "low-voltage"],
  ],
  xray: [
    ["pneumothorax", "tension", "hydropneumothorax", "pneumomediastinum"], ["haemothorax", "hydropneumothorax", "surgical-emphysema"], ["pneumomediastinum", "surgical-emphysema", "aortic-unfold"], ["ngt-misplaced", "ett-low", "rib-fracture"], ["oedema", "aortic-unfold", "haemothorax"],
    ["effusion", "collapse", "consolidation"], ["consolidation", "lung-mass", "collapse"], ["miliary", "ild", "hilar-lymph"], ["cavity", "lung-abscess", "lung-mass", "bronchiectasis"], ["cardiomegaly", "dextrocardia-cxr", "hiatus-hernia"], ["copd", "normal-cxr", "bronchiectasis"],
    ["colles", "scaphoid", "forearm-shaft", "normal-hand-xr"], ["distal-radius", "scaphoid", "forearm-shaft"], ["boxer", "phalanx-fracture", "normal-hand-xr"], ["metacarpal-fracture", "phalanx-fracture", "scaphoid"], ["supracondylar", "forearm-shaft", "humerus-fracture"], ["elbow-fracture", "humerus-fracture", "forearm-shaft"], ["clavicle-fracture", "shoulder-disloc", "humerus-fracture"],
    ["nof", "femur-fracture", "normal-hip-xr"], ["hip-fracture", "femur-fracture", "normal-hip-xr"], ["ankle-fracture", "metatarsal-fracture", "tibia-shaft", "normal-leg-xr"], ["patella-fracture", "tibia-shaft", "femur-fracture"],
    ["plate-screws", "im-nail", "ex-fix"], ["dhs", "cannulated-screws", "hip-arthroplasty"], ["k-wires", "tension-band", "plate-screws"], ["oa-knee", "ra-hands", "gout-xray"], ["ankylosing", "potts"], ["osteomyelitis", "osteosarcoma", "potts"],
    ["pneumoperitoneum", "sbo", "lbo", "sigmoid-volvulus"], ["epiglottitis", "croup", "foreign-body-coin"], ["paed-pneumonia", "paed-normal-cxr", "croup"], ["kub-stone", "foreign-body-coin"], ["rickets", "paed-normal-cxr"],
  ],
  ct: [
    ["edh", "sdh", "sah", "ich"], ["chronic-sdh", "edh", "cerebral-oedema"], ["ivh", "sah", "ich", "hydrocephalus"], ["infarct", "cerebral-oedema", "ct-normal-head", "brain-tumour"], ["brain-abscess", "ncc", "tuberculoma", "brain-tumour"], ["hydrocephalus", "cerebral-oedema"], ["depressed-fracture", "orbital-fracture", "c-spine-fracture"], ["sinusitis-ct", "orbital-fracture"],
    ["ct-pneumothorax", "emphysema-ct", "ct-bronchiectasis"], ["ct-effusion", "empyema", "ct-consolidation"], ["ground-glass", "ct-consolidation", "pe", "ct-lung-cancer"], ["dissection", "pe", "aaa"],
    ["appendicitis", "diverticulitis", "intussusception-ct", "ct-sbo"], ["perforation-ct", "mesenteric-ischaemia", "ct-sbo"], ["pancreatitis", "necrotising-panc", "pseudocyst", "cholecystitis-ct"], ["liver-abscess", "hydatid", "hcc", "cirrhosis-ct"], ["splenic-injury", "liver-injury", "pelvic-fracture"], ["renal-stone", "pyelonephritis-ct", "emphysematous-pyelo", "renal-mass"],
  ],
  usg: [
    ["free-fluid", "ascites-usg", "pericardial-effusion", "pleural-effusion-usg"], ["lung-sliding", "b-lines", "pleural-effusion-usg"], ["aaa-usg", "dvt", "free-fluid"],
    ["gallstones", "cholecystitis", "gb-polyp", "normal-gb"], ["cbd-dilated", "cholecystitis", "gallstones"], ["fatty-liver", "cirrhosis-usg", "liver-mets"], ["liver-abscess-usg", "hydatid-usg", "liver-mets"], ["splenomegaly", "cirrhosis-usg"], ["appendicitis-usg", "intussusception-usg", "pyloric-stenosis"],
    ["hydronephrosis", "renal-cyst", "pkd", "normal-kidney"], ["ckd-kidney", "normal-kidney", "pkd"], ["renal-calculus-usg", "bladder-stone", "hydronephrosis"], ["bph", "bladder-stone"],
    ["ectopic", "iup", "missed-miscarriage", "molar"], ["twins", "iup", "breech"], ["placenta-praevia", "breech", "anencephaly"], ["ovarian-cyst", "dermoid", "endometrioma", "torsion-ovary"], ["pcos", "ovarian-cyst", "fibroid"],
    ["breast-cyst", "fibroadenoma", "breast-ca-usg"], ["breast-benign-usg", "breast-ca-usg"], ["thyroid-nodule", "lymph-node"], ["testicular-torsion", "varicocele"],
  ],
  smear: [
    ["sickle", "target", "thalassaemia"], ["ida", "thalassaemia", "dimorphic", "target"], ["megaloblastic", "dimorphic", "normal-smear"], ["spherocytes", "schistocytes", "bite-cells"], ["spherocyte-aiha", "schistocytes", "agglutination", "reticulocytes"], ["burr-cells", "acanthocytes", "elliptocytes", "teardrop"], ["howell-jolly", "basophilic-stippling", "nrbc", "reticulocytes"], ["rouleaux", "agglutination", "normal-smear"],
    ["aml", "apml", "all", "hairy-cell"], ["cll", "all", "myeloma-plasma", "hairy-cell"], ["cml", "leukoerythroblastic", "basophilia", "eosinophilia"], ["thrombocytopenia", "giant-platelets", "platelet-clumps"], ["pelger", "toxoplasma-lymph", "eosinophilia"],
    ["falciparum", "vivax", "malariae", "ovale", "babesia"], ["falciparum-gameto", "vivax", "malariae"], ["microfilaria", "loa-loa", "trypanosome", "borrelia"], ["leishmania", "babesia", "trypanosome"], ["atypical-lymph", "neutrophilia"],
  ],
  clinical: [
    ["psoriasis", "atopic-eczema", "lichen-planus", "seb-derm", "pityriasis-rosea"], ["tinea", "pityriasis-versicolor", "pityriasis-rosea", "candida-intertrigo"], ["vitiligo", "leprosy", "pityriasis-versicolor"], ["zoster", "herpes-labialis", "impetigo", "contact-dermatitis"], ["sjs", "pemphigus", "bullous-pemphigoid", "fixed-drug"], ["melanoma", "bcc", "warts"], ["molluscum", "warts", "acne"], ["urticaria", "cellulitis", "erythema-nodosum"], ["scabies", "pediculosis", "atopic-eczema"], ["melasma", "acanthosis"], ["keloid", "bcc"],
    ["clubbing", "koilonychia", "rheumatoid-hands"], ["jaundice", "pallor", "cyanosis"], ["exophthalmos", "xanthelasma"], ["gouty-tophi", "rheumatoid-hands", "xanthelasma"], ["spider-naevi", "caput-medusae", "ascites"], ["purpura", "malar-rash", "spider-naevi"], ["cushingoid", "acanthosis", "goitre"], ["pitting-oedema", "ascites", "diabetic-foot"],
    ["conjunctivitis", "subconj", "corneal-ulcer", "acute-glaucoma", "hypopyon"], ["crao", "crvo", "pdr"], ["stye", "chalazion", "ptosis"], ["cataract", "pterygium", "kf-ring", "bitot"],
    ["tonsillitis", "quinsy", "diphtheria", "oral-candida"], ["leukoplakia", "erythroplakia", "oral-candida", "osmf"], ["aphthous", "angular-cheilitis", "geographic-tongue"], ["otitis-externa", "tm-central", "tm-marginal", "cholesteatoma"], ["perforated-tm", "cholesteatoma", "otitis-externa"], ["nasal-polyps", "turbinate-hypertrophy"],
    ["varicella", "measles", "hfmd", "meningococcaemia"], ["kawasaki", "scarlet-fever", "measles"], ["koplik", "hfmd", "kawasaki"], ["cephalohaematoma", "caput", "neonatal-jaundice"], ["erythema-toxicum", "napkin-dermatitis", "neonatal-jaundice"], ["kwashiorkor", "rickets-child"], ["mumps", "cleft-lip"],
    ["lipoma", "sebaceous-cyst", "ganglion"], ["abscess", "paronychia", "ingrown-toenail"], ["gangrene", "burn"], ["inguinal-hernia", "hydrocele"], ["varicose", "clubfoot"],
  ],
};

export const SPOT_ALSO_TRUE: Pairs = [
  // ECG
  ["af", "af-slow"], ["ectopics-vent", "bigeminy"],
  // X-ray
  ["colles", "distal-radius"], ["boxer", "metacarpal-fracture"], ["nof", "hip-fracture"], ["supracondylar", "elbow-fracture"], ["consolidation", "paed-pneumonia"], ["normal-cxr", "paed-normal-cxr"],
  // CT
  ["sdh", "chronic-sdh"], ["pancreatitis", "necrotising-panc"],
  // Ultrasound
  ["breast-benign-usg", "fibroadenoma"], ["breast-benign-usg", "breast-cyst"], ["free-fluid", "ascites-usg"],
  // Smear
  ["falciparum", "falciparum-gameto"], ["spherocytes", "spherocyte-aiha"], ["sickle", "sickle-hbsc"], ["target", "thalassaemia"],
  // Clinical
  ["perforated-tm", "tm-central"], ["perforated-tm", "tm-marginal"], ["measles", "koplik"], ["purpura", "meningococcaemia"], ["corneal-ulcer", "hypopyon"],
];

export const RADIOLOGY_CLUSTERS: Clusters = [
  ["mri-glioma", "mri-abscess", "mri-meningioma"], ["mri-stroke", "mri-hse", "mri-ms"], ["mri-schwannoma", "mri-meningioma", "mri-pituitary"], ["mri-disc", "mri-cauda", "mri-potts", "mri-cord-mets"], ["mri-acl", "mri-bucket", "mri-rotator"],
  ["mammo-mass", "mammo-calc", "mammo-distortion"], ["mammo-spiculated", "mammo-distortion", "mammo-calc"],
  ["fluoro-achalasia", "fluoro-zenker", "fluoro-hiatus"], ["fluoro-applecore", "fluoro-intussusception", "fluoro-crohns"], ["fluoro-hsg-bicornuate", "fluoro-hsg-blocked"],
  ["nm-graves", "nm-toxic-adenoma"], ["nm-hida", "nm-vq", "nm-bonemets"],
];
export const RADIOLOGY_ALSO_TRUE: Pairs = [["mammo-mass", "mammo-spiculated"]];

export const SOUND_CLUSTERS: Clusters = [
  ["as", "hocm", "ps"], ["mr", "tr", "vsd"], ["ar", "ms", "os"], ["mvp", "ps", "hocm"], ["pda", "vsd", "mr"], ["still", "as", "ps"],
  ["s3", "s4", "split-s2"], ["normal-heart", "muffled", "split-s2"], ["rub", "mechanical", "af"],
  ["fine", "coarse", "pleural-rub", "bronchial-crackles"], ["wheeze", "wheeze-mono", "rhonchi", "stridor"], ["stridor", "stridor-biphasic", "wheeze-mono"], ["bronchial", "vesicular", "bronchial-crackles"], ["absent", "diminished", "silent-chest", "vesicular"],
  ["bowel-normal", "bowel-hyper", "bowel-tinkling", "succussion"], ["bowel-sluggish", "bowel-absent", "bowel-normal"], ["aortic-bruit", "renal-bruit", "carotid-bruit", "vessel-normal"], ["av-fistula", "venous-hum", "renal-bruit"], ["hepatic-rub", "bowel-sluggish", "aortic-bruit"],
];
// A snap with a rumble IS mitral stenosis; crackles over bronchial breathing are still bronchial breathing; a silent chest is diminished too.
export const SOUND_ALSO_TRUE: Pairs = [["ms", "os"], ["bronchial", "bronchial-crackles"], ["diminished", "silent-chest"]];
