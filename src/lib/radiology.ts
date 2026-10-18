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
};

/** The modalities radiologists report (not ECGs or blood smears). */
export const RADIOLOGY_MODALITIES: Modality[] = ["xray", "ct", "usg"];
