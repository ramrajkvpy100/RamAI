# RamAI Skills Lab: full inventory

Counted from the code. **871 distinct skills** (1087 including each sound at its different rates).

| Macro | Micro | Before | After |
|---|---|---:|---:|
| See it | Spot the diagnosis | 366 | 387 |
| See it | Radiology reporting | 194 | 210 |
| Hear it | Sounds | 33 | 47 |
| Know it | Antidotes | 50 | 85 |
| Know it | Emergency algorithms | 59 | 92 |
| Know it | Calculations | 17 | 50 |
| **Total** | | **719** | **871** |

## See it: Spot the diagnosis
The doctor looks at an image and picks the diagnosis from four close look-alikes.

### ECG (50)
**Arrhythmias & Conduction Blocks (29):** Normal sinus rhythm; Sinus tachycardia; Sinus bradycardia; Atrial fibrillation; Atrial flutter; Supraventricular tachycardia (AVNRT); Ventricular tachycardia; Ventricular fibrillation; Complete (third-degree) heart block; First-degree AV block; Prolonged QT; Left bundle branch block; Right bundle branch block; Wolff–Parkinson–White pattern; Paced rhythm; Second-degree AV block, Mobitz I (Wenckebach); Second-degree AV block, Mobitz II; Torsades de pointes; Brugada pattern; Left anterior fascicular block; Ventricular ectopics; Ventricular bigeminy; Atrial ectopics; Junctional rhythm; Atrial fibrillation with a slow rate; Asystole; Sinus rhythm with no pulse (PEA); Sinus arrhythmia; Multifocal atrial tachycardia

**Ischaemia & Chamber Hypertrophy (11):** Inferior STEMI; Anterior STEMI; Left ventricular hypertrophy; Acute pericarditis; Lateral STEMI; Posterior MI; NSTEMI / ischaemic ST depression; Wellens' syndrome; De Winter T waves; Right ventricular hypertrophy; Benign early repolarisation

**Electrolyte, Drug & Systemic (10):** Hyperkalaemia; Hypokalaemia; Hypercalcaemia; Hypocalcaemia; Pulmonary embolism (S1Q3T3); Digoxin effect; Tricyclic overdose; Low voltage (pericardial effusion); Dextrocardia / limb-lead reversal; Hypothermia (Osborn waves)

### X-ray (75)
**OPD & Chronic Chest (15):** Normal chest X-ray; Lobar pneumonia (consolidation); Pleural effusion; Cardiomegaly; Miliary tuberculosis; Cavitating lesion (post-primary TB); Lobar collapse; Hyperinflation (COPD); Lung mass (carcinoma); Bilateral hilar lymphadenopathy; Interstitial lung disease; Bronchiectasis; Lung abscess; Dextrocardia; Hiatus hernia (chest X-ray)

**Emergency & ICU Chest (11):** Pneumothorax; Tension pneumothorax; Pulmonary oedema; Rib fracture; Haemothorax; Hydropneumothorax; Pneumomediastinum; Surgical emphysema; Misplaced nasogastric tube; Endotracheal tube in the right main bronchus; Widened mediastinum

**Abdominal & Paediatric (11):** Pneumoperitoneum; Small bowel obstruction; Swallowed coin (oesophagus); Sigmoid volvulus; Large bowel obstruction; Renal / ureteric stone (KUB); Pneumonia in a child; Normal chest X-ray in a child; Rickets; Epiglottitis (thumb sign); Croup (steeple sign)

**Fractures & Trauma (23):** Colles' fracture; Fractured neck of femur; Anterior shoulder dislocation; Clavicle fracture; Supracondylar fracture of the humerus; Scaphoid fracture; Boxer's fracture; Ankle (lateral malleolus) fracture; Tibial shaft fracture; Normal upper-limb X-ray (no fracture); Normal lower-limb X-ray (no fracture); Normal pelvis X-ray (no fracture); Skull fracture; Distal radius fracture; Forearm shaft fracture (radius/ulna); Elbow fracture; Humerus fracture; Metacarpal fracture; Phalanx fracture (finger); Femoral shaft / distal femur fracture; Proximal femur (hip) fracture; Patella fracture; Metatarsal fracture

**Implants, Joints & Bone Disease (15):** Knee osteoarthritis; Rheumatoid arthritis (hands); Gout (punched-out erosions); Ankylosing spondylitis (bamboo spine); Pott's spine (spinal TB); Osteomyelitis; Osteosarcoma; Fracture fixed with a plate and screws; Intramedullary nail; Dynamic hip screw / proximal femoral plate; Cannulated screws (femoral neck); External fixator; Kirschner wire fixation; Tension-band wiring; Hip replacement (arthroplasty)

### CT (50)
**Neuro & Head/Neck (18):** Extradural haematoma; Subdural haematoma; Subarachnoid haemorrhage; Intracerebral haemorrhage; Ischaemic stroke (MCA infarct); Normal CT head; Hydrocephalus; Brain abscess; Neurocysticercosis; Tuberculoma; Brain tumour with mass effect; Diffuse cerebral oedema; Intraventricular haemorrhage; Depressed skull fracture; Chronic subdural haematoma; Cervical spine fracture; Orbital blow-out fracture; Sinusitis

**Thoraco-Abdominal & Vascular (32):** Acute appendicitis; Acute pancreatitis; Ureteric calculus; Aortic dissection; Pulmonary embolism; Liver abscess; Pneumothorax (CT); Pleural effusion (CT); Empyema; Consolidation (CT); Ground-glass opacities (viral pneumonia); Lung cancer (CT); Emphysema; Bronchiectasis (CT); Abdominal aortic aneurysm; Pneumoperitoneum (CT); Small bowel obstruction (CT); Diverticulitis; Intussusception; Hepatocellular carcinoma; Hydatid cyst of the liver; Cirrhosis with ascites; Splenic laceration; Liver laceration; Renal cell carcinoma; Acute pyelonephritis; Emphysematous pyelonephritis; Acute cholecystitis (CT); Necrotising pancreatitis; Pancreatic pseudocyst; Mesenteric ischaemia; Pelvic ring fracture

### Ultrasound (52)
**Abdominal & Urinary (22):** Gallstones; Acute cholecystitis; Hydronephrosis; Fatty liver; Liver abscess; Renal calculus; Normal gallbladder; Gallbladder polyp; Dilated common bile duct; Cirrhosis; Hydatid cyst; Liver metastases; Splenomegaly; Acute appendicitis (USG); Intussusception (target sign); Hypertrophic pyloric stenosis; Normal kidney; Chronic kidney disease (small kidneys); Simple renal cyst; Polycystic kidney disease; Bladder stone; Enlarged prostate

**OB/GYN (14):** Ectopic pregnancy; Intrauterine pregnancy; Simple ovarian cyst; Uterine fibroid; Polycystic ovaries; Dermoid cyst (ovary); Endometrioma; Ovarian torsion; Molar pregnancy; Missed miscarriage; Twin pregnancy; Placenta praevia; Breech presentation; Anencephaly

**POCUS, Cardiac & Vascular (8):** Free fluid (positive FAST); Deep vein thrombosis; Ascites; Pericardial effusion; Pleural effusion (USG); Pneumothorax (lung ultrasound); B-lines (pulmonary oedema); Abdominal aortic aneurysm (USG)

**Neck, Breast & Scrotum (8):** Testicular torsion; Varicocele; Thyroid nodule; Enlarged lymph node; Breast cyst; Benign breast lump; Fibroadenoma; Breast carcinoma

### Blood smear (50)
**Infectious & Parasitic (13):** Plasmodium falciparum; Plasmodium vivax; Microfilaria (Wuchereria bancrofti); Plasmodium malariae; Plasmodium ovale; P. falciparum gametocyte; Neutrophilia with toxic granulation; Atypical lymphocytes (infectious mononucleosis); Leishmania (LD bodies); Trypanosomes; Borrelia (relapsing fever); Babesia; Loa loa microfilaria

**Red Cell Disorders (22):** Sickle cell anaemia; Iron deficiency anaemia; Megaloblastic anaemia; Hereditary spherocytosis; Schistocytes (MAHA); Target cells; Normal peripheral smear; Thalassaemia (major); Howell–Jolly bodies (hyposplenism); Basophilic stippling; Teardrop cells (myelofibrosis); Burr cells (echinocytes); Acanthocytes (spur cells); Elliptocytes; Bite cells (G6PD deficiency); Rouleaux (myeloma); Red cell agglutination (cold agglutinins); Nucleated red blood cells; Reticulocytosis (polychromasia); Positive sickling test; Autoimmune haemolytic anaemia; Dimorphic anaemia

**White Cells, Platelets & Malignancy (15):** Acute myeloid leukaemia (Auer rods); Chronic lymphocytic leukaemia; Eosinophilia; Acute lymphoblastic leukaemia; Chronic myeloid leukaemia; Acute promyelocytic leukaemia; Hairy cell leukaemia; Plasma cells (myeloma); Thrombocytopenia (few platelets); Giant platelets; Platelet clumping (pseudo-thrombocytopenia); Leukoerythroblastic picture; Pelger–Huët neutrophils; Monocytosis; Basophilia

### Clinical images (110)
**Dermatology (31):** Plaque psoriasis; Vitiligo; Herpes zoster (shingles); Tinea corporis (ringworm); Scabies; Impetigo; Urticaria; Cellulitis; Acne vulgaris; Leprosy (hypopigmented patch); Molluscum contagiosum; Pityriasis versicolor; Pityriasis rosea; Lichen planus; Atopic eczema; Allergic contact dermatitis; Melasma; Alopecia areata; Viral warts; Herpes labialis (cold sore); Stevens–Johnson syndrome; Fixed drug eruption; Candidal intertrigo; Pemphigus vulgaris; Bullous pemphigoid; Erythema nodosum; Keloid; Seborrhoeic dermatitis; Head lice (pediculosis capitis); Malignant melanoma; Basal cell carcinoma

**General medicine (19):** Jaundice (scleral icterus); Finger clubbing; Koilonychia; Goitre; Central cyanosis; Pitting oedema; Pallor of anaemia; Graves' eye disease (exophthalmos); Cushing's syndrome; Xanthelasma; Gouty tophi; Rheumatoid hands; Malar (butterfly) rash of SLE; Spider naevi; Caput medusae; Ascites; Purpura / petechiae; Diabetic foot ulcer; Acanthosis nigricans

**Eye (15):** Conjunctivitis; Subconjunctival haemorrhage; Cataract; Pterygium; Stye (hordeolum); Chalazion; Ptosis; Corneal ulcer; Bitot's spots (vitamin A deficiency); Central retinal artery occlusion; Central retinal vein occlusion; Proliferative diabetic retinopathy; Kayser–Fleischer ring; Hypopyon; Acute angle-closure glaucoma

**ENT & mouth (17):** Oral thrush (candidiasis); Acute tonsillitis; Aphthous ulcer; Oral leukoplakia; Oral submucous fibrosis; Angular cheilitis; Geographic tongue; Otitis externa; Perforated eardrum; Quinsy (peritonsillar abscess); Faucial diphtheria; Attic cholesteatoma; Central tympanic membrane perforation; Marginal tympanic membrane perforation; Nasal polyps; Inferior turbinate hypertrophy; Oral erythroplakia

**Paediatrics (16):** Chickenpox (varicella); Measles; Severe acute malnutrition; Hand, foot and mouth disease; Nappy (napkin) rash; Neonatal jaundice; Mumps; Cleft lip; Kawasaki disease; Koplik spots; Meningococcal purpura; Rickets; Cephalohaematoma; Caput succedaneum; Scarlet fever; Erythema toxicum neonatorum

**Surgery & ortho (12):** Inguinal hernia; Varicose veins; Lipoma; Epidermoid (sebaceous) cyst; Skin abscess; Dry gangrene; Partial-thickness burn; Acute paronychia; Ingrown toenail; Hydrocele; Clubfoot (CTEV); Ganglion cyst

## See it: Radiology reporting (210)
The doctor reads the history, looks at a real study and reports the diagnosis.

Briefed studies: 177, in 13 clinical decks.

Other modalities: mammo 5, mri 15, fluoro 8, nuclear 5

Studies: Breast mass; Suspicious microcalcifications; Spiculated mass (BI-RADS 5); Normal mammogram; Architectural distortion; Acute ischaemic stroke; Vestibular schwannoma; Herpes simplex encephalitis; Brain abscess; Cauda equina compression; Pott's spine with cord compression; Malignant spinal cord compression; Bucket-handle meniscal tear; Rotator cuff tear; Lumbar disc herniation; Multiple sclerosis; ACL tear; Pituitary macroadenoma; Glioma; Meningioma; Achalasia; Colorectal carcinoma (apple-core lesion); Crohn's disease (string sign); Hiatus hernia; Zenker's diverticulum; Intussusception; Bicornuate uterus; Bilateral tubal block; Acute cholecystitis (HIDA); Pulmonary embolism (V/Q mismatch); Bone metastases; Graves' disease; Toxic adenoma

## Hear it (47 findings; 263 variants)
The doctor listens and names the finding.

### Heart (20)
Aortic stenosis (ejection systolic murmur); Mitral regurgitation (pansystolic murmur); Aortic regurgitation (early diastolic murmur); Mitral stenosis (mid-diastolic rumble); Mitral valve prolapse (click + late systolic murmur); Ventricular septal defect (harsh pansystolic); Patent ductus arteriosus (continuous machinery murmur); Opening snap with mid-diastolic rumble; Pulmonary stenosis (ejection click + ejection systolic); Tricuspid regurgitation (pansystolic, louder breathing in); Hypertrophic cardiomyopathy (late-peaking systolic + S4); Still's innocent murmur (musical, soft systolic); Normal heart sounds; S3 gallop; S4 gallop; Pericardial friction rub; Atrial fibrillation (irregularly irregular); Muffled heart sounds; Fixed splitting of S2 (atrial septal defect); Mechanical aortic valve (metallic closing click)

### Lungs & airway (14)
Normal vesicular breathing; Fine late-inspiratory crackles; Coarse early-inspiratory crackles; Polyphonic expiratory wheeze; Monophonic wheeze; Rhonchi; Inspiratory stridor; Biphasic stridor; Bronchial breathing; Bronchial breathing with crackles; Pleural rub; Diminished breath sounds; Absent breath sounds; Silent chest

### Abdomen & vessels (13)
Normal bowel sounds; Hyperactive bowel sounds; Reduced (sluggish) bowel sounds; Absent bowel sounds; Tinkling bowel sounds (obstruction); Succussion splash; Perihepatic friction rub; Abdominal aortic bruit; Renal artery bruit; Carotid bruit; AV fistula (continuous bruit); Venous hum; No bruit (normal)

## Know it: Antidotes (85)
The doctor reads a poisoning or reversal scenario and picks the antidote.

**Painkillers & psychiatric drugs (9):** paracetamol, opioid, tca, salicylate, lithium, valproate, serotonin, nms, dystonia

**Poisons & chemicals (24):** organophosphate, methanol, iron, cyanide, methotrexate, isoniazid, lead, arsenic, mercury, co, methb, ethylene-glycol, anticholinergic, paraquat, aluminium-phosphide, mushroom, botulism, theophylline, kerosene, corrosive, dapsone-hb, organochlorine, pyrethroid, oleander

**Anaesthesia, Perioperative & ICU Reversal (13):** benzo, lignocaine, mh, local-methemoglobin, rocuronium, atracurium, sux-apnoea, pris, postop-opioid, dexmedetomidine, icu-nms, methb-g6pd, sux-hyperk

**Heart & blood drugs (13):** warfarin, heparin, digoxin, betablocker, ccb, dabigatran, rivaroxaban, clonidine, heparin-hit, cyanide-nitroprusside, lysis-bleed, lmwh-protamine, drug-torsades

**Bites, Stings & Envenomations (15):** snake, scorpion, krait, russell-viper, asv-repeat, cobra, asv-reaction, bee-sting, rabies-cat3, centipede, jellyfish, stingray, snake-firstaid, tick, spider

**Diabetes & metabolic (11):** sulfonylurea, insulin, oral-hypo-metformin, ethanol, tumour-lysis, hyperammonaemia, hypercalcaemia, porphyria, wilson, refeeding, hypocalcaemia-thyroid

## Know it: Emergency algorithms (92)
The doctor picks the next step.

**Cardiac arrest & rhythms (10):** vf, asystole, rosc, brady-unstable, svt-stable, vt-pulse-unstable, vt-pulse-stable, af-fast-unstable, hypothermia, drowning

**Shock, sepsis & bleeding (10):** anaphylaxis, sepsis, burns-fluid, haemorrhage, anaphylaxis-refractory, upper-gi-bleed, septic-vasopressor, neurogenic-shock, massive-transfusion, cardiogenic-shock

**Hormones & salts (8):** dka, hyperk, hypoglycaemia, hhs, adrenal-crisis, thyroid-storm, myxoedema, hyponatraemia

**Brain & nerves (10):** status, stroke, head-injury, meningitis, sah, gbs, myasthenic-crisis, encephalitis, cord-compression, lvo

**Women & babies (11):** pph, eclampsia, shoulder-dystocia, cord-prolapse, ectopic-ruptured, pph-second, maternal-arrest, mag-toxicity, severe-htn-pregnancy, uterine-inversion, abruption

**Surgery & trauma (11):** tension, tamponade, trauma-primary, c-spine, acute-abdomen, testicular-torsion, compartment, hyperthermia, massive-haemothorax, fast-positive, open-fracture

**Chest pain & heart (8):** stemi, stemi-lysis, acs-nstemi, apo, massive-pe, aortic-dissection, hypertensive-emergency, rv-infarct

**Airway & breathing (9):** asthma-severe, asthma-lifethreat, copd-exac, airway-obstruction, cico, massive-haemoptysis, ards-vent, blocked-trach, pneumothorax-spont

**Children (15):** choking-infant, paeds-arrest, neonatal-resus, dehydration-child, febrile-seizure, sam-child, sepsis-child, nrp-hr, pals-brady, pals-svt, paeds-status, croup, epiglottitis, bronchiolitis, tet-spell

## Know it: Clinical calculations (50)
The doctor works a bedside sum; numbers change each time.

**Kidney, Acid-Base & Salts (11):** ag, delta, winters, na, fwd, fena, crcl, osm, osm-gap, k-deficit, ca

**Fluids, Burns & Dosing (12):** parkland, parkland-rate, hs, maint, pcm, adr-paed, drug-dose, defib, drip, ganzoni, abl, ors

**Heart, Lungs & ICU (9):** map, qtc, pf, aa, ardsnet-vt, rsbi, wells-pe, curb, shock-index

**Brain, Liver & GI (8):** gcs, maddrey, saag, child-pugh, meld-na, phenytoin, bisap, cpp

**Biostatistics, OB & Body Indices (10):** bmi, bsa, sens-spec, ppv-npv, nnt, odds-ratio, rel-risk, lr, naegele, gest-age
