/**
 * Radiology reporting: the history and the clinical question a radiologist is given with each
 * study. From history to diagnosis only — no treatment. The images are the practice bank's real,
 * freely licensed pictures (never AI-made); each item's own key findings are the model answer.
 */
import type { Modality } from "./practice";

export interface RadiologyBrief {
  /** The request form: age, sex, what's going on. */
  history: string;
  /** What the referrer wants answered. */
  question: string;
}

/** Keyed by practice item id. Histories are illustrative and fit each diagnosis's classic picture. */
export const RADIOLOGY_BRIEFS: Record<string, RadiologyBrief> = {
  // Chest and abdominal X-rays, and fractures
  "normal-cxr": { history: "26-year-old man, pre-employment medical. No symptoms.", question: "Chest X-ray PA: any abnormality?" },
  pneumothorax: { history: "22-year-old tall, thin man with sudden right-sided pleuritic chest pain and breathlessness at rest.", question: "Chest X-ray PA: cause of the pain?" },
  tension: { history: "30-year-old man after a motorbike crash: severe breathlessness, BP 80/50, distended neck veins, absent breath sounds on one side.", question: "Chest X-ray: what's the immediate threat?" },
  consolidation: { history: "58-year-old man with 4 days of fever, productive cough with rusty sputum and pleuritic chest pain; crackles at the right base.", question: "Chest X-ray PA: pneumonia?" },
  effusion: { history: "64-year-old woman with gradually increasing breathlessness over 3 weeks; stony dullness at the left base.", question: "Chest X-ray PA: findings?" },
  oedema: { history: "70-year-old man with known ischaemic heart disease, acute breathlessness at night, frothy sputum and bilateral basal crackles.", question: "Chest X-ray AP: findings?" },
  cardiomegaly: { history: "55-year-old woman with exertional breathlessness and ankle swelling for months.", question: "Chest X-ray PA: heart size?" },
  miliary: { history: "32-year-old man with 6 weeks of evening fever, weight loss and night sweats; HIV positive.", question: "Chest X-ray PA: findings?" },
  cavity: { history: "40-year-old man with 2 months of cough, haemoptysis, fever and weight loss; contact with a TB patient at home.", question: "Chest X-ray PA: findings?" },
  pneumoperitoneum: { history: "48-year-old man with sudden severe epigastric pain spreading over the abdomen; long-term NSAID use; board-like rigid abdomen.", question: "Erect chest X-ray: cause?" },
  collapse: { history: "62-year-old smoker with haemoptysis and breathlessness; reduced breath sounds over one upper zone.", question: "Chest X-ray PA: findings?" },
  copd: { history: "68-year-old man, 45 pack-years, with chronic cough and progressive breathlessness; barrel-shaped chest.", question: "Chest X-ray PA: findings?" },
  sbo: { history: "60-year-old woman with a previous hysterectomy: colicky central abdominal pain, bilious vomiting and absolute constipation for 2 days.", question: "Abdominal X-ray supine: findings?" },
  colles: { history: "67-year-old woman who fell on her outstretched hand; painful, swollen wrist with a 'dinner fork' deformity.", question: "X-ray wrist: fracture?" },
  nof: { history: "79-year-old woman who fell at home; unable to bear weight, the right leg shortened and externally rotated.", question: "X-ray pelvis and hip: fracture?" },
  // CT
  edh: { history: "19-year-old hit on the side of the head by a cricket ball: brief loss of consciousness, a lucid interval, then increasing drowsiness.", question: "Non-contrast CT head: findings?" },
  sdh: { history: "76-year-old man on warfarin, increasingly confused over a week after a minor fall.", question: "Non-contrast CT head: findings?" },
  sah: { history: "45-year-old woman with a sudden, worst-ever 'thunderclap' headache while lifting, with vomiting and neck stiffness.", question: "Non-contrast CT head: findings?" },
  ich: { history: "62-year-old man with poorly controlled hypertension: sudden left-sided weakness and headache; BP 210/120.", question: "Non-contrast CT head: findings?" },
  infarct: { history: "70-year-old woman with atrial fibrillation: right-sided weakness and loss of speech, onset 10 hours ago.", question: "Non-contrast CT head: findings?" },
  appendicitis: { history: "24-year-old man with central abdominal pain moving to the right iliac fossa over a day, fever and anorexia; rebound tenderness.", question: "CT abdomen with contrast: findings?" },
  pancreatitis: { history: "45-year-old man after a heavy drinking weekend: severe epigastric pain going through to the back, vomiting; lipase 4× normal.", question: "CT abdomen with contrast: findings?" },
  "renal-stone": { history: "35-year-old man with sudden severe left loin-to-groin colicky pain, writhing, with microscopic haematuria.", question: "Non-contrast CT KUB: findings?" },
  dissection: { history: "58-year-old hypertensive man with sudden tearing chest pain going through to the back; arm BPs differ by 30 mmHg.", question: "CT aortic angiogram: findings?" },
  pe: { history: "34-year-old woman, 3 weeks after a caesarean section: sudden pleuritic chest pain, breathlessness, HR 118, SpO₂ 90%.", question: "CT pulmonary angiogram: findings?" },
  "liver-abscess": { history: "38-year-old man with 10 days of high fever, right upper quadrant pain and tender hepatomegaly.", question: "CT abdomen with contrast: findings?" },
  // Ultrasound
  gallstones: { history: "42-year-old woman with episodes of right upper quadrant pain after fatty meals, each settling within hours.", question: "Ultrasound abdomen: findings?" },
  cholecystitis: { history: "50-year-old woman with 2 days of constant right upper quadrant pain, fever and a positive Murphy's sign.", question: "Ultrasound abdomen: findings?" },
  hydronephrosis: { history: "65-year-old man with poor urinary stream, nocturia and a rising creatinine.", question: "Ultrasound KUB: findings?" },
  "fatty-liver": { history: "46-year-old man with obesity and type 2 diabetes; mildly raised ALT on routine bloods.", question: "Ultrasound abdomen: findings?" },
  "liver-abscess-usg": { history: "35-year-old man with 2 weeks of fever and right upper quadrant pain after an episode of bloody diarrhoea.", question: "Ultrasound abdomen: findings?" },
  ectopic: { history: "27-year-old woman, 7 weeks since her last period, with lower abdominal pain and spotting; urine pregnancy test positive.", question: "Transvaginal ultrasound: findings?" },
  iup: { history: "29-year-old woman, 7 weeks since her last period, with mild spotting; urine pregnancy test positive.", question: "Transvaginal ultrasound: where is the pregnancy?" },
  "free-fluid": { history: "25-year-old man after a road traffic accident with left upper quadrant pain; HR 124, BP 90/60.", question: "FAST scan: findings?" },
  "ovarian-cyst": { history: "24-year-old woman with mild intermittent right pelvic discomfort; pregnancy test negative.", question: "Pelvic ultrasound: findings?" },
  dvt: { history: "56-year-old woman 10 days after knee surgery with a swollen, painful left calf.", question: "Venous Doppler of the leg: findings?" },
  "renal-calculus-usg": { history: "38-year-old man with recurrent dull right loin ache and microscopic haematuria.", question: "Ultrasound KUB: findings?" },

  // More X-rays: chest, lines and tubes, abdomen, bones and joints, children
  "rib-fracture": { history: "72-year-old woman who fell against the edge of a table; sharp left chest pain on breathing and point tenderness over the ribs.", question: "Chest X-ray PA: findings?" },
  haemothorax: { history: "34-year-old man stabbed in the right chest an hour ago; HR 118, dull percussion note at the right base.", question: "Chest X-ray: findings?" },
  "lung-mass": { history: "66-year-old man, 50 pack-years, with 3 months of cough, weight loss and one episode of haemoptysis.", question: "Chest X-ray PA: findings?" },
  "hilar-lymph": { history: "29-year-old woman with tender red shins (erythema nodosum), ankle pains and a dry cough.", question: "Chest X-ray PA: findings?" },
  ild: { history: "61-year-old man with 18 months of progressive breathlessness, a dry cough, clubbing and fine 'velcro' crackles at both bases.", question: "Chest X-ray PA: findings?" },
  bronchiectasis: { history: "38-year-old woman with years of daily cough producing cupfuls of purulent sputum; childhood whooping cough.", question: "Chest X-ray PA: findings?" },
  "lung-abscess": { history: "50-year-old man with alcohol dependence, a seizure a fortnight ago, now spiking fevers and foul-smelling sputum.", question: "Chest X-ray PA: findings?" },
  hydropneumothorax: { history: "45-year-old man with known pulmonary TB, sudden breathlessness; a succussion splash is heard over the chest.", question: "Erect chest X-ray: findings?" },
  pneumomediastinum: { history: "19-year-old with an asthma attack, now with central chest pain and a crunching sound with each heartbeat.", question: "Chest X-ray PA: findings?" },
  "surgical-emphysema": { history: "40-year-old man after a chest drain was inserted; the face and neck are swollen and crackle under the fingers.", question: "Chest X-ray: findings?" },
  "ngt-misplaced": { history: "78-year-old woman after a stroke; a fine-bore nasogastric tube has just been passed for feeding.", question: "Chest X-ray: is the tube safe to use?" },
  "ett-low": { history: "55-year-old man intubated in the emergency department; the left side of the chest moves less than the right.", question: "Chest X-ray after intubation: check the lines and tubes." },
  "dextrocardia-cxr": { history: "24-year-old man at a pre-employment medical; the apex beat could not be felt in the usual place.", question: "Chest X-ray PA: findings?" },
  "aortic-unfold": { history: "52-year-old man with severe tearing chest pain going through to the back; BP 180/100 in the right arm, 140/90 in the left.", question: "Chest X-ray: findings?" },
  "foreign-body-coin": { history: "3-year-old boy who was playing with coins, now drooling and refusing to eat.", question: "Neck and chest X-ray: findings?" },
  "sigmoid-volvulus": { history: "80-year-old man in a nursing home with chronic constipation; massive abdominal distension and no flatus for 3 days.", question: "Abdominal X-ray: findings?" },
  lbo: { history: "74-year-old man with weeks of change in bowel habit and weight loss, now distended with absolute constipation.", question: "Abdominal X-ray: findings?" },
  "kub-stone": { history: "35-year-old man with sudden colicky right loin pain radiating to the groin; blood in the urine.", question: "X-ray KUB: findings?" },
  "shoulder-disloc": { history: "23-year-old rugby player who fell on an outstretched abducted arm; squared-off shoulder, arm held away from the body.", question: "X-ray shoulder: findings?" },
  "clavicle-fracture": { history: "16-year-old cyclist who fell onto the point of his shoulder; tender bony lump over the collarbone.", question: "X-ray clavicle: findings?" },
  supracondylar: { history: "6-year-old girl who fell from the monkey bars onto an outstretched hand; swollen elbow, will not move it.", question: "X-ray elbow: findings?" },
  scaphoid: { history: "21-year-old man who fell on an outstretched hand; tender in the anatomical snuffbox.", question: "X-ray wrist (scaphoid views): findings?" },
  boxer: { history: "19-year-old man who punched a wall; swollen little-finger knuckle that has 'dropped'.", question: "X-ray hand: findings?" },
  "ankle-fracture": { history: "34-year-old woman who twisted her ankle stepping off a kerb; bony tenderness at the tip of the lateral malleolus, cannot bear weight.", question: "X-ray ankle: fracture?" },
  "tibia-shaft": { history: "28-year-old motorcyclist hit by a car; deformed, swollen lower leg.", question: "X-ray tibia and fibula: findings?" },
  "oa-knee": { history: "66-year-old woman with years of knee pain worse on walking, morning stiffness under 30 minutes and crepitus.", question: "X-ray knees (standing): findings?" },
  "ra-hands": { history: "45-year-old woman with 2 years of painful, swollen hand joints and morning stiffness lasting 2 hours.", question: "X-ray hands: findings?" },
  "gout-xray": { history: "58-year-old man with recurrent attacks of an exquisitely painful red big toe; chalky lumps over the joints.", question: "X-ray feet: findings?" },
  ankylosing: { history: "35-year-old man with years of low back pain and stiffness, worse in the morning and better with exercise.", question: "X-ray spine: findings?" },
  potts: { history: "30-year-old woman with 4 months of back pain, evening fever, weight loss and a new bump on her spine.", question: "X-ray spine: findings?" },
  osteomyelitis: { history: "8-year-old boy with a week of fever and a painful, swollen leg after a scraped knee.", question: "X-ray of the leg: findings?" },
  rickets: { history: "2-year-old girl with bowed legs, delayed walking and thickened wrists; little time in the sun.", question: "X-ray wrists and knees: findings?" },
  osteosarcoma: { history: "15-year-old boy with 3 months of knee pain at night and a growing hard swelling above the knee.", question: "X-ray knee: findings?" },
  "skull-fracture": { history: "25-year-old man hit on the head with a stick; scalp swelling, brief loss of consciousness.", question: "X-ray skull: findings?" },
  epiglottitis: { history: "5-year-old unvaccinated boy with high fever, drooling and stridor, sitting forward and refusing to lie down.", question: "Lateral neck X-ray: findings?" },
  croup: { history: "2-year-old with a barking cough, hoarse voice and inspiratory stridor after a cold; mild fever.", question: "Neck X-ray AP: findings?" },
  "distal-radius": { history: "9-year-old who fell off a bicycle onto an outstretched hand; tender, swollen wrist.", question: "X-ray wrist / forearm: findings?" },
  "forearm-shaft": { history: "11-year-old who fell from a tree; the forearm is painful, swollen and looks bent.", question: "X-ray forearm: findings?" },
  "elbow-fracture": { history: "7-year-old who fell onto the elbow at school; swollen elbow, will not bend or straighten it.", question: "X-ray elbow: findings?" },
  "humerus-fracture": { history: "Patient who fell onto the shoulder and arm; painful upper arm, can't lift it, bruising spreading down the arm.", question: "X-ray humerus / shoulder: findings?" },
  "metacarpal-fracture": { history: "24-year-old who punched a door; swollen back of the hand, knuckle tender.", question: "X-ray hand: findings?" },
  "phalanx-fracture": { history: "30-year-old whose finger was crushed in a door; swollen, tender finger.", question: "X-ray hand / finger: findings?" },
  "femur-fracture": { history: "Patient after a road traffic accident with a deformed, swollen thigh; HR 118.", question: "X-ray femur: findings?" },
  "hip-fracture": { history: "Patient who fell and can't stand; the leg is shortened and externally rotated, pain in the groin.", question: "X-ray pelvis and hip: findings?" },
  "hiatus-hernia": { history: "70-year-old woman with years of heartburn and regurgitation, worse lying down.", question: "Chest X-ray PA: findings?" },
  "plate-screws": { history: "Patient seen in clinic weeks after an operation for a fracture; now pain-free.", question: "Follow-up X-ray: describe what you see." },
  "im-nail": { history: "Patient after surgery for a long-bone shaft fracture from a road accident.", question: "Post-operative X-ray: findings?" },
  dhs: { history: "Elderly patient a day after surgery for a fall onto the hip.", question: "Post-operative X-ray hip: findings?" },
  "cannulated-screws": { history: "Patient after surgery for a hip fracture found after a fall.", question: "Post-operative X-ray hip: findings?" },
  "ex-fix": { history: "Patient with an open fracture of the leg after a motorbike crash, now after emergency surgery.", question: "X-ray of the leg: findings?" },
  "k-wires": { history: "Child after surgery for an elbow or wrist fracture.", question: "Post-operative X-ray: findings?" },
  "tension-band": { history: "Patient after surgery for a fall onto the elbow or knee.", question: "Post-operative X-ray: findings?" },
  "hip-arthroplasty": { history: "Patient with a previous hip operation, now with new hip pain after a fall.", question: "X-ray pelvis and hip: findings?" },
  "patella-fracture": { history: "Patient who fell directly onto the knee; cannot straighten it against gravity.", question: "X-ray knee: findings?" },
  "metatarsal-fracture": { history: "Patient who twisted the foot or dropped something heavy on it; tender over the forefoot, painful to walk.", question: "X-ray foot: findings?" },

  // More CT
  "ct-normal-head": { history: "32-year-old woman with a 'worst-ever' sudden headache, now settled; fully alert, no focal signs.", question: "CT head (non-contrast): any abnormality?" },
  hydrocephalus: { history: "60-year-old man with weeks of morning headaches and vomiting, now drowsy; papilloedema on fundoscopy.", question: "CT head: findings?" },
  "brain-abscess": { history: "32-year-old man with chronic ear discharge, now fever, headache and a first seizure.", question: "CT head with contrast: findings?" },
  ncc: { history: "24-year-old man from a pig-farming village with a first-ever generalised seizure; otherwise well.", question: "CT head: findings?" },
  tuberculoma: { history: "28-year-old woman with 2 months of low-grade fever and headaches, now a focal seizure; mother treated for TB.", question: "CT head with contrast: findings?" },
  "brain-tumour": { history: "56-year-old man with 6 weeks of worsening headache, personality change and new weakness of one side.", question: "CT head: findings?" },
  "cerebral-oedema": { history: "17-year-old after a near-drowning, GCS 6, pupils sluggish.", question: "CT head: findings?" },
  ivh: { history: "65-year-old hypertensive man with sudden headache, vomiting and falling consciousness.", question: "CT head: findings?" },
  "depressed-fracture": { history: "30-year-old man struck on the head with a hammer; boggy scalp wound.", question: "CT head (bone windows): findings?" },
  "chronic-sdh": { history: "82-year-old man on warfarin with 3 weeks of increasing confusion and unsteadiness; a minor fall a month ago.", question: "CT head: findings?" },
  "ct-pneumothorax": { history: "26-year-old man with sudden pleuritic chest pain and breathlessness after a coughing fit.", question: "CT chest (lung windows): findings?" },
  "ct-effusion": { history: "68-year-old woman with heart failure, increasing breathlessness and dullness at both bases.", question: "CT chest: findings?" },
  empyema: { history: "52-year-old diabetic with pneumonia treated 2 weeks ago, still spiking fevers with pleuritic pain.", question: "CT chest with contrast: findings?" },
  "ct-consolidation": { history: "71-year-old man with fever, productive cough, raised CRP and crackles at the right base.", question: "CT chest: findings?" },
  "ground-glass": { history: "48-year-old man with a week of fever, dry cough and breathlessness during a viral outbreak; SpO₂ 90% on air.", question: "CT chest (lung windows): findings?" },
  "ct-lung-cancer": { history: "69-year-old ex-smoker with weight loss, cough and haemoptysis.", question: "CT chest: findings?" },
  "emphysema-ct": { history: "64-year-old man, 60 pack-years, with progressive breathlessness and a barrel chest.", question: "CT chest (lung windows): findings?" },
  "ct-bronchiectasis": { history: "42-year-old woman with years of daily purulent sputum and recurrent chest infections.", question: "HRCT chest: findings?" },
  aaa: { history: "72-year-old male smoker with a pulsatile mass felt above the umbilicus.", question: "CT abdomen with contrast: findings?" },
  "perforation-ct": { history: "58-year-old man on NSAIDs with sudden severe abdominal pain and a rigid abdomen.", question: "CT abdomen: findings?" },
  "ct-sbo": { history: "64-year-old woman with previous abdominal surgery: colicky pain, vomiting and distension for 2 days.", question: "CT abdomen: findings?" },
  diverticulitis: { history: "67-year-old woman with 3 days of left iliac fossa pain, fever and tenderness.", question: "CT abdomen with contrast: findings?" },
  "intussusception-ct": { history: "35-year-old man with intermittent colicky abdominal pain and vomiting.", question: "CT abdomen: findings?" },
  hcc: { history: "62-year-old man with hepatitis B cirrhosis, weight loss and a rising alpha-fetoprotein.", question: "CT liver (multiphase): findings?" },
  hydatid: { history: "40-year-old shepherd with a dull right upper abdominal ache and an enlarged liver.", question: "CT abdomen: findings?" },
  "cirrhosis-ct": { history: "55-year-old man with long-standing heavy alcohol use, jaundice and a distended abdomen.", question: "CT abdomen: findings?" },
  "splenic-injury": { history: "22-year-old man kicked in the left upper abdomen during a fight; left shoulder-tip pain, HR 115.", question: "CT abdomen with contrast: findings?" },
  "liver-injury": { history: "30-year-old driver in a head-on collision with right upper quadrant pain and bruising from the seat belt.", question: "CT abdomen with contrast: findings?" },
  "renal-mass": { history: "60-year-old man with painless visible haematuria and a dull loin ache.", question: "CT abdomen with contrast: findings?" },
  "pyelonephritis-ct": { history: "28-year-old woman with fever, rigors, loin pain and pyuria.", question: "CT abdomen with contrast: findings?" },
  "emphysematous-pyelo": { history: "58-year-old woman with poorly controlled diabetes, fever, loin pain and septic shock.", question: "CT abdomen: findings?" },
  "cholecystitis-ct": { history: "48-year-old woman with a day of constant right upper quadrant pain, fever and Murphy's sign.", question: "CT abdomen with contrast: findings?" },
  "necrotising-panc": { history: "45-year-old man 5 days into a bout of acute pancreatitis, now worsening with fever and organ failure.", question: "CT abdomen with contrast: findings?" },
  pseudocyst: { history: "42-year-old man 6 weeks after acute alcoholic pancreatitis, with early fullness and an epigastric mass.", question: "CT abdomen: findings?" },
  "mesenteric-ischaemia": { history: "76-year-old woman in atrial fibrillation with severe abdominal pain out of proportion to a soft abdomen; raised lactate.", question: "CT abdomen with contrast: findings?" },
  "c-spine-fracture": { history: "45-year-old man thrown from a motorbike; neck pain and tenderness over the cervical spine.", question: "CT cervical spine: findings?" },
  "pelvic-fracture": { history: "35-year-old pedestrian hit by a lorry; hypotensive, pelvis unstable to gentle pressure.", question: "CT pelvis: findings?" },
  "orbital-fracture": { history: "24-year-old hit in the eye by a cricket ball; double vision on looking up and numbness of the cheek.", question: "CT orbits: findings?" },
  "sinusitis-ct": { history: "35-year-old woman with 3 months of nasal blockage, purulent discharge and facial pressure.", question: "CT paranasal sinuses: findings?" },

  // More ultrasound
  "normal-gb": { history: "30-year-old woman with vague upper abdominal discomfort after meals; liver tests normal.", question: "Ultrasound gallbladder: any abnormality?" },
  "gb-polyp": { history: "45-year-old man having an ultrasound for fatty-liver follow-up; no biliary symptoms.", question: "Ultrasound gallbladder: findings?" },
  "cbd-dilated": { history: "58-year-old woman with jaundice, dark urine and pale stools.", question: "Ultrasound abdomen: findings?" },
  "cirrhosis-usg": { history: "52-year-old man with heavy alcohol use, spider naevi and a large spleen.", question: "Ultrasound liver: findings?" },
  "hydatid-usg": { history: "38-year-old farmer who keeps dogs, with a dull right upper quadrant ache.", question: "Ultrasound liver: findings?" },
  "liver-mets": { history: "65-year-old woman a year after colon cancer surgery, with weight loss and a rising CEA.", question: "Ultrasound liver: findings?" },
  splenomegaly: { history: "18-year-old with recurrent fevers from a malaria area and a heavy left upper abdomen.", question: "Ultrasound abdomen: findings?" },
  "ascites-usg": { history: "50-year-old man with cirrhosis and a tensely distended abdomen with shifting dullness.", question: "Ultrasound abdomen: findings?" },
  "appendicitis-usg": { history: "12-year-old boy with 24 hours of pain moving from the umbilicus to the right iliac fossa, vomiting and low fever.", question: "Ultrasound right iliac fossa: findings?" },
  "intussusception-usg": { history: "9-month-old with episodes of inconsolable screaming and drawing up the legs, and 'redcurrant jelly' stool.", question: "Ultrasound abdomen: findings?" },
  "pyloric-stenosis": { history: "5-week-old boy with projectile non-bilious vomiting after every feed; hungry straight after.", question: "Ultrasound of the pylorus: findings?" },
  "normal-kidney": { history: "28-year-old man having a kidney-donor work-up. No symptoms.", question: "Ultrasound kidneys: any abnormality?" },
  "ckd-kidney": { history: "55-year-old man with long-standing diabetes and hypertension; creatinine 5.8 mg/dL, anaemia.", question: "Ultrasound kidneys: findings?" },
  "renal-cyst": { history: "60-year-old man having an ultrasound for unrelated back pain.", question: "Ultrasound kidney: findings?" },
  pkd: { history: "40-year-old man with hypertension, flank pain and a father who needed dialysis; both kidneys palpable.", question: "Ultrasound kidneys: findings?" },
  "bladder-stone": { history: "8-year-old boy with painful, interrupted urination and blood at the end of the stream.", question: "Ultrasound bladder: findings?" },
  bph: { history: "70-year-old man with poor stream, hesitancy, dribbling and getting up four times a night to pass urine.", question: "Ultrasound bladder and prostate: findings?" },
  fibroid: { history: "40-year-old woman with heavy periods, anaemia and a bulky uterus on examination.", question: "Pelvic ultrasound: findings?" },
  pcos: { history: "22-year-old woman with irregular periods, acne and excess facial hair.", question: "Pelvic ultrasound: findings?" },
  dermoid: { history: "25-year-old woman with a pelvic mass found on examination; mild intermittent discomfort.", question: "Pelvic ultrasound: findings?" },
  endometrioma: { history: "30-year-old woman with painful periods, pain on intercourse and difficulty conceiving.", question: "Pelvic ultrasound: findings?" },
  "torsion-ovary": { history: "19-year-old woman with sudden severe right lower abdominal pain and vomiting; pregnancy test negative.", question: "Pelvic ultrasound with Doppler: findings?" },
  molar: { history: "26-year-old woman, 11 weeks pregnant, with vaginal bleeding, severe vomiting and a uterus larger than dates; very high β-hCG.", question: "Pelvic ultrasound: findings?" },
  "missed-miscarriage": { history: "31-year-old woman, 10 weeks by dates, with brown spotting; pregnancy symptoms have faded.", question: "Transvaginal ultrasound: findings?" },
  twins: { history: "28-year-old woman at her booking scan; uterus larger than dates and marked morning sickness.", question: "Obstetric ultrasound: findings?" },
  "placenta-praevia": { history: "32-year-old woman at 32 weeks with painless bright red vaginal bleeding; soft, non-tender uterus.", question: "Obstetric ultrasound: findings?" },
  breech: { history: "27-year-old woman at 37 weeks; a hard round mass is felt under the ribs.", question: "Obstetric ultrasound: presentation?" },
  anencephaly: { history: "24-year-old woman with no antenatal folic acid, having her anomaly scan; raised maternal AFP.", question: "Obstetric ultrasound: findings?" },
  "testicular-torsion": { history: "15-year-old boy woken by sudden severe left testicular pain and vomiting; high-riding testis, absent cremasteric reflex.", question: "Ultrasound scrotum with Doppler: findings?" },
  varicocele: { history: "22-year-old man with a dragging ache in the left scrotum; a 'bag of worms' that is more obvious on standing.", question: "Ultrasound scrotum: findings?" },
  "thyroid-nodule": { history: "38-year-old woman who noticed a lump in the front of her neck that moves on swallowing; thyroid function normal.", question: "Ultrasound neck: findings?" },
  "lymph-node": { history: "26-year-old man with 6 weeks of a painless neck lump, evening fever and weight loss.", question: "Ultrasound neck: findings?" },
  "breast-cyst": { history: "44-year-old woman with a smooth, tender breast lump that varies with her cycle.", question: "Breast ultrasound: findings?" },
  fibroadenoma: { history: "19-year-old woman with a firm, smooth, very mobile breast lump.", question: "Breast ultrasound: findings?" },
  "breast-ca-usg": { history: "56-year-old woman with a hard, fixed breast lump and skin dimpling.", question: "Breast ultrasound: findings?" },
  "pericardial-effusion": { history: "45-year-old woman with breathlessness, a raised JVP, muffled heart sounds and BP 85/60.", question: "Bedside echo: findings?" },
  "pleural-effusion-usg": { history: "62-year-old man with breathlessness and stony dullness at the right base; a tap is planned.", question: "Chest ultrasound: findings?" },
  "lung-sliding": { history: "24-year-old man stabbed in the chest, breathless with reduced breath sounds on one side.", question: "Lung ultrasound (eFAST): findings?" },
  "b-lines": { history: "74-year-old woman with acute breathlessness, orthopnoea and bibasal crackles.", question: "Lung ultrasound: findings?" },
  "aaa-usg": { history: "68-year-old male smoker having abdominal aortic aneurysm screening.", question: "Ultrasound abdominal aorta: findings?" },
};

/** The modalities radiologists report (not ECGs or blood smears). */
export const RADIOLOGY_MODALITIES: Modality[] = ["xray", "ct", "usg"];

/** Modalities beyond the practice bank: their cases live here, their images in radiology-singles.json. */
export type ExtraModality = "mammo" | "mri" | "fluoro" | "nuclear";

export interface ExtraItem {
  id: string;
  modality: ExtraModality;
  label: string;
  /** The model report: key findings. */
  key: string;
  history: string;
  question: string;
  /** Searches for real, freely licensed images (Wikimedia Commons). */
  search: string[];
}

export const EXTRA_ITEMS: ExtraItem[] = [
  // Mammography (CBIS-DDSM, TCIA)
  { id: "mammo-mass", modality: "mammo", label: "Breast mass", key: "A new focal mass — a dense, rounded opacity that doesn't fade into the surrounding fibroglandular tissue — in a woman recalled from screening. Irregular, indistinct or spiculated margins make it suspicious for carcinoma; it needs further views, targeted ultrasound and, if suspicious, biopsy (BI-RADS 0 until worked up, then 4–5).", history: "54-year-old woman recalled from screening; no symptoms.", question: "Screening mammogram: findings?", search: [] },
  { id: "mammo-calc", modality: "mammo", label: "Suspicious microcalcifications", key: "Clustered, fine pleomorphic or linear branching calcifications — suspicious for ductal carcinoma in situ; stereotactic biopsy (BI-RADS 4).", history: "51-year-old woman recalled from screening; no lump felt.", question: "Screening mammogram: findings?", search: [] },
  // Mammography distractors (answer choices with their own findings, no pictures)
  { id: "mammo-normal", modality: "mammo", label: "Normal mammogram", key: "Symmetric fibroglandular tissue with no mass, architectural distortion or suspicious calcification (BI-RADS 1).", history: "", question: "", search: [] },
  { id: "mammo-distortion", modality: "mammo", label: "Architectural distortion", key: "Spiculation radiating from a point without a definite central mass.", history: "", question: "", search: [] },
  // MRI
  { id: "mri-disc", modality: "mri", label: "Lumbar disc herniation", key: "A disc extrusion or protrusion at a lumbar level, narrowing the canal or exit foramen and compressing a nerve root.", history: "38-year-old man with low back pain and shooting pain down the back of one leg after lifting; positive straight-leg raise.", question: "MRI lumbar spine (T2): findings?", search: ["lumbar disc herniation MRI", "disc prolapse MRI lumbar", "herniated disc sagittal T2"] },
  { id: "mri-ms", modality: "mri", label: "Multiple sclerosis", key: "Multiple ovoid T2/FLAIR-bright white-matter lesions, periventricular and perpendicular to the ventricles (Dawson's fingers), juxtacortical or infratentorial.", history: "29-year-old woman with blurred vision in one eye last year, now tingling and weakness of both legs.", question: "MRI brain (FLAIR): findings?", search: ["multiple sclerosis MRI FLAIR", "multiple sclerosis lesions MRI brain", "Dawson fingers MRI"] },
  { id: "mri-acl", modality: "mri", label: "ACL tear", key: "The anterior cruciate ligament is discontinuous or not seen, with bone bruising and a joint effusion.", history: "24-year-old footballer who twisted his knee, heard a pop and had immediate swelling; positive Lachman test.", question: "MRI knee: findings?", search: ["anterior cruciate ligament tear MRI", "ACL rupture MRI knee", "torn ACL MRI"] },
  { id: "mri-pituitary", modality: "mri", label: "Pituitary macroadenoma", key: "A sellar mass larger than 10 mm extending upwards (a 'snowman' shape), which may compress the optic chiasm.", history: "45-year-old man with headaches and bumping into things on both sides; bitemporal hemianopia on confrontation.", question: "MRI pituitary (coronal T1 + contrast): findings?", search: ["pituitary macroadenoma MRI", "pituitary adenoma MRI coronal", "pituitary tumor MRI"] },
  { id: "mri-meningioma", modality: "mri", label: "Meningioma", key: "A well-circumscribed, extra-axial, dural-based mass enhancing homogeneously, often with a dural tail.", history: "58-year-old woman with a year of headaches and a recent seizure.", question: "MRI brain with contrast: findings?", search: ["meningioma MRI", "meningioma contrast MRI dural tail", "convexity meningioma MRI"] },
  // Contrast studies (fluoroscopy)
  { id: "fluoro-achalasia", modality: "fluoro", label: "Achalasia", key: "A dilated oesophagus tapering smoothly to a narrow lower end — the 'bird's beak' — with retained barium.", history: "42-year-old woman with slowly worsening difficulty swallowing both solids and liquids, and regurgitation at night.", question: "Barium swallow: findings?", search: ["achalasia barium swallow", "bird's beak achalasia", "achalasia esophagogram"] },
  { id: "fluoro-applecore", modality: "fluoro", label: "Colorectal carcinoma (apple-core lesion)", key: "A short, circumferential narrowing of the colon with shouldered, overhanging edges — the 'apple-core' sign of carcinoma.", history: "67-year-old man with change in bowel habit, rectal bleeding and iron-deficiency anaemia.", question: "Barium enema: findings?", search: ["apple core lesion barium enema", "colon cancer barium enema", "apple core sign colon"] },
  { id: "fluoro-crohns", modality: "fluoro", label: "Crohn's disease (string sign)", key: "A long, narrowed segment of terminal ileum (the 'string sign'), with ulceration and separated loops.", history: "23-year-old man with months of right iliac fossa pain, diarrhoea and weight loss.", question: "Small bowel follow-through: findings?", search: ["Crohn's string sign", "Crohn disease small bowel follow through", "terminal ileum stricture barium"] },
  { id: "fluoro-hiatus", modality: "fluoro", label: "Hiatus hernia", key: "Part of the stomach lies above the diaphragm, through the oesophageal hiatus.", history: "60-year-old woman with heartburn worse lying flat and after meals.", question: "Barium meal: findings?", search: ["hiatus hernia barium swallow", "hiatal hernia barium", "sliding hiatus hernia barium meal"] },
  // Nuclear medicine
  { id: "nm-bonemets", modality: "nuclear", label: "Bone metastases", key: "Multiple, randomly scattered foci of increased uptake in the axial skeleton (spine, ribs, pelvis) — metastases.", history: "70-year-old man with prostate cancer, PSA 85, and new back and hip pain.", question: "Whole-body bone scan (Tc-99m MDP): findings?", search: ["bone scan metastases", "bone scintigraphy metastases prostate", "technetium bone scan metastatic"] },
  { id: "nm-graves", modality: "nuclear", label: "Graves' disease", key: "Diffusely increased, uniform tracer uptake throughout an enlarged thyroid.", history: "32-year-old woman with weight loss, palpitations, tremor, a diffuse goitre and protruding eyes; TSH suppressed.", question: "Thyroid scintigraphy (Tc-99m pertechnetate): findings?", search: ["Graves disease thyroid scintigraphy", "thyroid scan diffuse uptake Graves", "Graves thyroid scan"] },
  { id: "nm-toxic-adenoma", modality: "nuclear", label: "Toxic adenoma", key: "A single 'hot' nodule taking up tracer, with the rest of the gland suppressed.", history: "55-year-old woman with hyperthyroid symptoms and a single palpable thyroid nodule; TSH suppressed.", question: "Thyroid scintigraphy: findings?", search: ["toxic adenoma thyroid scan", "hot thyroid nodule scintigraphy", "autonomous thyroid nodule scintigraphy"] },
];
