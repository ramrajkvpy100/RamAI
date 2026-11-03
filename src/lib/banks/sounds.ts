/**
 * Hear it: every sound in the drill, made by RamAI's stethoscope engine (src/engine/stethoscope-audio.ts).
 * Each has its own acoustic parameters, so a label never shares a sound with another (tests/skills-see-hear.test.ts).
 */
import type { Auscultation } from "@/engine/types";

export interface SoundItem {
  id: string;
  label: string;
  sound: Auscultation;
  key: string;
  group: string;
}
type Row = Omit<SoundItem, "group">;

export const MURMURS = "Valvular & Structural Murmurs";
export const EXTRA_SOUNDS = "Heart Sounds, Extras & Rubs";
export const LUNGS_AIRWAY = "Lungs & Airway";
export const BRUITS_BOWEL = "Bruits & Bowel Sounds";

const inGroup = (group: string, rows: Row[]): SoundItem[] => rows.map((r) => ({ ...r, group }));

export const HEART: SoundItem[] = [
  ...inGroup(MURMURS, [
    { id: "as", label: "Aortic stenosis (ejection systolic murmur)", sound: { kind: "heart", rate: 76, murmur: { phase: "systolic", shape: "diamond" } }, key: "A crescendo–decrescendo (diamond) murmur between S1 and S2, loudest at the right upper sternal edge, radiating to the carotids." },
    { id: "mr", label: "Mitral regurgitation (pansystolic murmur)", sound: { kind: "heart", rate: 84, murmur: { phase: "systolic", shape: "plateau" } }, key: "A plateau murmur filling all of systole, loudest at the apex, radiating to the axilla." },
    { id: "ar", label: "Aortic regurgitation (early diastolic murmur)", sound: { kind: "heart", rate: 78, murmur: { phase: "diastolic", shape: "decrescendo" } }, key: "A soft, high-pitched decrescendo murmur starting just after S2, best heard sitting forward in expiration." },
    { id: "ms", label: "Mitral stenosis (mid-diastolic rumble)", sound: { kind: "heart", rate: 88, murmur: { phase: "diastolic", shape: "rumble" } }, key: "A low-pitched rumble in mid-diastole at the apex, best with the bell, patient on the left side." },
    { id: "mvp", label: "Mitral valve prolapse (click + late systolic murmur)", sound: { kind: "heart", rate: 76, click: true, murmur: { phase: "systolic", shape: "late" } }, key: "A sharp mid-systolic click followed by a short late systolic murmur at the apex — mitral valve prolapse." },
    { id: "vsd", label: "Ventricular septal defect (harsh pansystolic)", sound: { kind: "heart", rate: 96, murmur: { phase: "systolic", shape: "harsh" } }, key: "A loud, harsh pansystolic murmur at the left lower sternal edge, often with a thrill — VSD." },
    { id: "pda", label: "Patent ductus arteriosus (continuous machinery murmur)", sound: { kind: "heart", rate: 110, murmur: { phase: "continuous", shape: "machinery" } }, key: "A continuous 'machinery' murmur rising to a peak at S2 and running through it — PDA, best below the left clavicle." },
    { id: "os", label: "Opening snap with mid-diastolic rumble", sound: { kind: "heart", rate: 84, snap: true, murmur: { phase: "diastolic", shape: "rumble" } }, key: "A high-pitched snap just after S2 then a low rumble — mitral stenosis (the shorter the S2–OS gap, the tighter the valve)." },
    { id: "ps", label: "Pulmonary stenosis (ejection click + ejection systolic)", sound: { kind: "heart", rate: 80, ejectionClick: true, splitS2: "wide", murmur: { phase: "systolic", shape: "diamond" } }, key: "An early ejection click, then a diamond murmur at the left upper sternal edge, with a widely split S2 — pulmonary stenosis." },
    { id: "tr", label: "Tricuspid regurgitation (pansystolic, louder breathing in)", sound: { kind: "heart", rate: 90, murmur: { phase: "systolic", shape: "respiratory" } }, key: "A pansystolic murmur at the left lower sternal edge that swells with each breath in (Carvallo's sign), with giant v waves in the JVP." },
    { id: "hocm", label: "Hypertrophic cardiomyopathy (late-peaking systolic + S4)", sound: { kind: "heart", rate: 80, s4: true, murmur: { phase: "systolic", shape: "late-peak" } }, key: "A harsh ejection murmur peaking late in systole, with an S4, no click; louder on standing or Valsalva, softer on squatting." },
    { id: "still", label: "Still's innocent murmur (musical, soft systolic)", sound: { kind: "heart", rate: 100, murmur: { phase: "systolic", shape: "musical" } }, key: "A soft, low, vibratory ('twanging string') early-systolic murmur at the left lower sternal edge in a well child; S2 normal, no thrill — innocent." },
  ]),
  ...inGroup(EXTRA_SOUNDS, [
    { id: "normal-heart", label: "Normal heart sounds", sound: { kind: "heart", rate: 72 }, key: "Crisp S1 and S2 with silent systole and diastole." },
    { id: "s3", label: "S3 gallop", sound: { kind: "heart", rate: 104, s3: true }, key: "An extra low sound just after S2 ('Ken-tuc-ky') — volume overload, heart failure." },
    { id: "s4", label: "S4 gallop", sound: { kind: "heart", rate: 80, s4: true }, key: "An extra sound just before S1 ('Ten-nes-see') — a stiff ventricle (hypertension, LVH)." },
    { id: "rub", label: "Pericardial friction rub", sound: { kind: "heart", rate: 96, rub: true }, key: "A scratchy, leathery sound with the heartbeat — pericarditis." },
    { id: "af", label: "Atrial fibrillation (irregularly irregular)", sound: { kind: "heart", rate: 118, irregular: true }, key: "Beats at completely irregular intervals with varying loudness of S1." },
    { id: "muffled", label: "Muffled heart sounds", sound: { kind: "heart", rate: 120, soft: true }, key: "Faint, distant heart sounds — pericardial effusion or tamponade (with hypotension and raised JVP: Beck's triad)." },
    { id: "split-s2", label: "Fixed splitting of S2 (atrial septal defect)", sound: { kind: "heart", rate: 78, splitS2: "fixed", murmur: { phase: "systolic", shape: "flow" } }, key: "S2 clearly in two parts, the gap the same in and out, with a soft pulmonary flow murmur — atrial septal defect." },
    { id: "mechanical", label: "Mechanical aortic valve (metallic closing click)", sound: { kind: "heart", rate: 72, mechanical: true }, key: "A crisp, high, metallic click at S2 as the prosthetic valve shuts, with a softer opening click just after S1. A muffled click is a warning of thrombosis." },
  ]),
];

export const LUNGS: SoundItem[] = inGroup(LUNGS_AIRWAY, [
  { id: "vesicular", label: "Normal vesicular breathing", sound: { kind: "lungs", rate: 14, breath: "vesicular" }, key: "Soft, rustling inspiration fading early in expiration, with no gap." },
  { id: "fine", label: "Fine late-inspiratory crackles", sound: { kind: "lungs", rate: 20, breath: "vesicular", crackles: "fine" }, key: "Fine, high-pitched crackles at the end of inspiration, like Velcro — interstitial lung disease, pulmonary fibrosis or early pulmonary oedema." },
  { id: "coarse", label: "Coarse early-inspiratory crackles", sound: { kind: "lungs", rate: 22, breath: "vesicular", crackles: "coarse" }, key: "Low-pitched, bubbling crackles early in inspiration that may change with coughing — secretions: bronchiectasis, chronic bronchitis or frank pulmonary oedema." },
  { id: "wheeze", label: "Polyphonic expiratory wheeze", sound: { kind: "lungs", rate: 24, breath: "vesicular", wheeze: true, wheezeKind: "polyphonic" }, key: "Many musical pitches together through a prolonged expiration — widespread airway narrowing: asthma or COPD." },
  { id: "wheeze-mono", label: "Monophonic wheeze", sound: { kind: "lungs", rate: 20, breath: "vesicular", wheeze: true, wheezeKind: "monophonic" }, key: "One fixed musical pitch, the same every breath and over one area — a single narrowed airway: an inhaled foreign body or a tumour." },
  { id: "rhonchi", label: "Rhonchi", sound: { kind: "lungs", rate: 22, breath: "vesicular", rhonchi: true }, key: "Low-pitched, snoring sounds that clear or shift after a cough — secretions in the larger airways." },
  { id: "stridor", label: "Inspiratory stridor", sound: { kind: "lungs", rate: 28, breath: "vesicular", stridor: true }, key: "A harsh, high-pitched sound in inspiration, loudest over the neck — obstruction above the vocal cords (an emergency)." },
  { id: "stridor-biphasic", label: "Biphasic stridor", sound: { kind: "lungs", rate: 28, breath: "vesicular", stridor: true, stridorBiphasic: true }, key: "Harsh in both inspiration and expiration — a fixed narrowing at or below the cords: subglottic stenosis, tracheal disease." },
  { id: "bronchial", label: "Bronchial breathing", sound: { kind: "lungs", rate: 24, breath: "bronchial" }, key: "Loud, hollow breath sounds with a gap between inspiration and expiration — consolidation." },
  { id: "bronchial-crackles", label: "Bronchial breathing with crackles", sound: { kind: "lungs", rate: 26, breath: "bronchial", crackles: "coarse" }, key: "Hollow, tubular breathing with coarse crackles over it — pneumonia, the consolidated lobe with secretions." },
  { id: "pleural-rub", label: "Pleural rub", sound: { kind: "lungs", rate: 20, breath: "vesicular", rub: true }, key: "A creaking sound at the end of inspiration and the start of expiration — pleurisy." },
  { id: "diminished", label: "Diminished breath sounds", sound: { kind: "lungs", rate: 22, breath: "reduced" }, key: "Breath sounds present but faint — effusion, emphysema, obesity or partial collapse." },
  { id: "absent", label: "Absent breath sounds", sound: { kind: "lungs", rate: 26, breath: "absent" }, key: "No breath sounds over one area — pneumothorax, large effusion or collapse." },
  { id: "silent-chest", label: "Silent chest", sound: { kind: "lungs", rate: 32, breath: "reduced", wheeze: true, wheezeKind: "faint" }, key: "Fast, barely audible breaths with hardly any wheeze left in a struggling patient — life-threatening asthma, not an improvement." },
]);

/** Over the abdomen and the great vessels: bowel sounds, and bruits with the pulse. */
export const ABDOMEN: SoundItem[] = inGroup(BRUITS_BOWEL, [
  { id: "bowel-normal", label: "Normal bowel sounds", sound: { kind: "bowel", activity: "normal", rate: 76 }, key: "Gurgles every 5–15 seconds — normal bowel activity." },
  { id: "bowel-hyper", label: "Hyperactive bowel sounds", sound: { kind: "bowel", activity: "hyperactive", rate: 90 }, key: "Loud, frequent, rushing gurgles (borborygmi) — gastroenteritis, early obstruction or a GI bleed." },
  { id: "bowel-sluggish", label: "Reduced (sluggish) bowel sounds", sound: { kind: "bowel", activity: "sluggish", rate: 84 }, key: "Only occasional faint gurgles — early ileus, after surgery, or opioids." },
  { id: "bowel-absent", label: "Absent bowel sounds", sound: { kind: "bowel", activity: "absent", rate: 110 }, key: "Silence after listening for 2–3 minutes — paralytic ileus or peritonitis." },
  { id: "bowel-tinkling", label: "Tinkling bowel sounds (obstruction)", sound: { kind: "bowel", activity: "tinkling", rate: 96 }, key: "High-pitched, tinkling, metallic sounds — mechanical bowel obstruction." },
  { id: "succussion", label: "Succussion splash", sound: { kind: "bowel", activity: "splash", rate: 88 }, key: "Fluid slopping when the abdomen is rocked, over 3–4 hours after a meal — gastric outlet obstruction." },
  { id: "hepatic-rub", label: "Perihepatic friction rub", sound: { kind: "bowel", activity: "sluggish", rate: 80, rub: true }, key: "A creak over the liver that moves with breathing — a liver tumour or abscess, a recent biopsy, or Fitz-Hugh–Curtis syndrome." },
  { id: "aortic-bruit", label: "Abdominal aortic bruit", sound: { kind: "vessel", sound: "systolic-bruit", rate: 72, pitch: "low" }, key: "A low whooshing sound with each pulse just above the umbilicus — aortic atherosclerosis or aneurysm; feel for an expansile mass." },
  { id: "renal-bruit", label: "Renal artery bruit", sound: { kind: "vessel", sound: "continuous-bruit", rate: 76, pitch: "high" }, key: "A high-pitched bruit beside the midline, spilling into diastole — renal artery stenosis (young woman with resistant hypertension: fibromuscular dysplasia)." },
  { id: "carotid-bruit", label: "Carotid bruit", sound: { kind: "vessel", sound: "systolic-bruit", rate: 70, pitch: "high" }, key: "A systolic whoosh over the carotid at the angle of the jaw — carotid stenosis (stroke/TIA risk); a radiated aortic stenosis murmur is louder lower down." },
  { id: "av-fistula", label: "AV fistula (continuous bruit)", sound: { kind: "vessel", sound: "continuous-bruit", rate: 84, pitch: "low" }, key: "A loud, continuous machinery-like bruit with a thrill over a dialysis fistula — a healthy working fistula." },
  { id: "venous-hum", label: "Venous hum", sound: { kind: "vessel", sound: "venous-hum", rate: 88 }, key: "A soft continuous hum above the clavicle that disappears on pressing the neck veins or lying down — harmless, common in children and pregnancy." },
  { id: "vessel-normal", label: "No bruit (normal)", sound: { kind: "vessel", sound: "normal", rate: 72 }, key: "Only the soft pulse, with no whooshing sound — no significant narrowing." },
]);

/**
 * Each sound heard in different patients: the same finding at different heart or breathing rates, as it varies at
 * the bedside — five rates for each heart, vessel or bowel sound and seven for each breath sound, so the number of
 * cases is always the sounds times the rates. (The answer is the finding, whatever the rate.)
 */
const HEART_RATES = [0.7, 0.85, 1, 1.2, 1.4];
const LUNG_RATES = [0.7, 0.8, 0.9, 1, 1.15, 1.3, 1.5];
const vary = (xs: SoundItem[], rates: number[]): (SoundItem & { base: string })[] =>
  xs.flatMap((x) => rates.map((r, n) => ({ ...x, base: x.id, id: `${x.id}@${n}`, sound: { ...x.sound, rate: Math.round(x.sound.rate * r) } as Auscultation })));
export const HEART_CASES = vary(HEART, HEART_RATES);
export const LUNG_CASES = vary(LUNGS, LUNG_RATES);
export const ABDOMEN_CASES = vary(ABDOMEN, HEART_RATES);

/** Harder to tell apart — residents and specialists only. */
export const ADVANCED_SOUNDS = new Set(["ar", "ms", "s4", "rub", "pleural-rub", "coarse", "os", "pda", "mvp", "renal-bruit", "av-fistula", "venous-hum", "ps", "tr", "hocm", "still", "split-s2", "mechanical", "wheeze-mono", "stridor-biphasic", "bronchial-crackles", "succussion", "hepatic-rub"]);
