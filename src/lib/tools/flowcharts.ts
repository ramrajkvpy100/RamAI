/**
 * Ready clinical decision flowcharts. Curated by hand, in code: teaching summaries of the guideline named on each, for adults
 * unless the title says otherwise. The first node is the start. Every link must point at a node (tests/games-content.test.ts checks).
 */

export interface FlowNode {
  id: string;
  /** A question branches Yes/No; a step goes on to `next`; an end stops. */
  kind: "question" | "step" | "end";
  text: string;
  dose?: string;
  yes?: string;
  no?: string;
  next?: string;
}

export interface Flowchart {
  id: string;
  title: string;
  specialty: string;
  source: string;
  nodes: FlowNode[];
}

const q = (id: string, text: string, yes: string, no: string): FlowNode => ({ id, kind: "question", text, yes, no });
const s = (id: string, text: string, next: string, dose?: string): FlowNode => ({ id, kind: "step", text, next, ...(dose ? { dose } : {}) });
const e = (id: string, text: string, dose?: string): FlowNode => ({ id, kind: "end", text, ...(dose ? { dose } : {}) });

export const FLOWCHARTS: Flowchart[] = [
  { id: "anaphylaxis", title: "Anaphylaxis", specialty: "Emergency", source: "Resuscitation Council UK; WAO", nodes: [
    q("a", "Sudden airway, breathing or circulation problem, usually with skin changes, after a likely trigger?", "b", "x"),
    s("b", "Call for help, remove the trigger, lie flat with legs raised (sit up if breathing is the problem).", "c"),
    s("c", "Give IM adrenaline into the mid outer thigh.", "d", "0.5 mg IM (0.5 mL of 1:1000)"),
    q("d", "Still unwell after 5 minutes?", "f", "g"),
    s("f", "Repeat IM adrenaline, start IV fluid bolus and high-flow oxygen.", "h", "Crystalloid 500–1000 mL"),
    q("h", "Still unwell after 2 IM doses?", "i", "g"),
    e("i", "Refractory: adrenaline infusion with senior or ICU help."),
    e("g", "Observe for biphasic reaction, usually 6–12 hours. Give an adrenaline auto-injector plan and allergy referral."),
    e("x", "Look for another cause: asthma, vasovagal, panic, urticaria alone."),
  ] },
  { id: "asthma", title: "Acute severe asthma", specialty: "Respiratory", source: "GINA; BTS/SIGN", nodes: [
    s("a", "Sit up. Oxygen to SpO₂ 93–95%. Check PEF, RR, pulse and speech.", "b"),
    s("b", "Give salbutamol by nebuliser or spacer, repeat every 20 minutes for the first hour.", "c", "Salbutamol 5 mg neb; add ipratropium 0.5 mg neb"),
    s("c", "Give a systemic steroid.", "d", "Prednisolone 40–50 mg PO, or hydrocortisone 100 mg IV"),
    q("d", "Life-threatening: silent chest, exhaustion, confusion, PEF under 33%, or normal or rising pCO₂?", "f", "g"),
    s("f", "Call ICU. Give IV magnesium.", "h", "Magnesium sulphate 2 g IV over 20 minutes"),
    e("h", "Prepare for intubation if tiring or pCO₂ rises."),
    q("g", "PEF over 75% an hour after treatment and speaking in sentences?", "i", "j"),
    e("i", "Discharge on inhaled steroid-containing treatment, a steroid course and a written plan."),
    e("j", "Admit. Continue nebulisers and steroids; review within the hour."),
  ] },
  { id: "stemi", title: "STEMI", specialty: "Cardiology", source: "ACC/AHA; ESC", nodes: [
    s("a", "12-lead ECG within 10 minutes. Monitor, IV access. Oxygen only if SpO₂ is under 90%.", "b"),
    s("b", "Load with aspirin and a P2Y12 inhibitor; start an anticoagulant.", "c", "Aspirin 300–325 mg chewed; ticagrelor 180 mg or clopidogrel 300–600 mg"),
    q("c", "Primary PCI possible within 120 minutes of diagnosis?", "d", "f"),
    e("d", "Primary PCI. Door-to-balloon goal: 90 minutes or less."),
    q("f", "Any absolute contraindication to lysis (prior haemorrhage, recent stroke, active bleeding, dissection)?", "g", "h"),
    e("g", "Transfer for PCI whatever the delay."),
    s("h", "Thrombolyse within 30 minutes of arrival, then transfer.", "i", "Tenecteplase by weight, half dose if aged 75 or over; or streptokinase 1.5 MU over 60 min"),
    q("i", "Pain persisting or ST resolution under 50% at 60–90 minutes?", "j", "k"),
    e("j", "Rescue PCI."),
    e("k", "Angiography within 2–24 hours."),
  ] },
  { id: "arrest", title: "Adult cardiac arrest", specialty: "Emergency", source: "AHA ACLS 2025; ERC", nodes: [
    s("a", "Start CPR: 100–120 per minute, 5–6 cm deep, full recoil. Attach a defibrillator, give oxygen.", "b"),
    q("b", "Shockable rhythm (VF or pulseless VT)?", "c", "f"),
    s("c", "Shock, then 2 minutes of CPR before rechecking.", "d", "Biphasic 120–200 J or as per device"),
    s("d", "Still shockable: shock, CPR, adrenaline every 3–5 minutes.", "h", "Adrenaline 1 mg IV/IO"),
    s("h", "Still shockable after the third shock: give an antiarrhythmic.", "i", "Amiodarone 300 mg IV, then 150 mg; or lidocaine 1–1.5 mg/kg"),
    s("f", "Asystole or PEA: CPR and adrenaline as soon as possible, every 3–5 minutes.", "i", "Adrenaline 1 mg IV/IO"),
    s("i", "Treat causes: the 4 Hs and 4 Ts. Secure an airway; use waveform capnography.", "j"),
    q("j", "Return of spontaneous circulation?", "k", "b"),
    e("k", "Post-arrest care: SpO₂ 92–98%, avoid hypotension, ECG for PCI, temperature control, ICU."),
  ] },
  { id: "brady", title: "Unstable bradycardia", specialty: "Cardiology", source: "AHA ACLS", nodes: [
    q("a", "Heart rate under 50 with shock, syncope, ischaemia or heart failure?", "b", "c"),
    e("c", "Monitor, look for causes (drugs, hyperkalaemia, inferior MI, hypothyroidism)."),
    s("b", "Oxygen if hypoxic, IV access, 12-lead ECG. Give atropine.", "d", "Atropine 1 mg IV, repeat every 3–5 min, max 3 mg"),
    q("d", "Improved?", "f", "g"),
    e("f", "Treat the cause and observe; seek cardiology advice if high-grade block."),
    s("g", "Start transcutaneous pacing or an infusion.", "h", "Dopamine 5–20 mcg/kg/min, or adrenaline 2–10 mcg/min"),
    e("h", "Expert consult for a transvenous pacing wire."),
  ] },
  { id: "svt", title: "Narrow-complex tachycardia (SVT)", specialty: "Cardiology", source: "AHA ACLS", nodes: [
    q("a", "Unstable: shock, syncope, ischaemia or acute heart failure?", "b", "c"),
    e("b", "Synchronised cardioversion.", "50–100 J biphasic; sedate if time allows"),
    s("c", "Modified Valsalva manoeuvre.", "d"),
    q("d", "Back to sinus rhythm?", "f", "g"),
    e("f", "Record the ECG and review for pre-excitation."),
    s("g", "Give adenosine by fast IV push with a flush, under ECG recording.", "h", "6 mg, then 12 mg, then 12 mg"),
    q("h", "Terminated?", "f", "i"),
    e("i", "Give a calcium-channel or beta blocker, avoid both in pre-excited AF; consider cardioversion."),
  ] },
  { id: "hyperk", title: "Hyperkalaemia", specialty: "Nephrology", source: "UK Kidney Association; AHA", nodes: [
    s("a", "Check for a spurious sample. ECG and monitor at once.", "b"),
    q("b", "ECG changes, or K⁺ of 6.5 or above?", "c", "h"),
    s("c", "Protect the heart, repeating if ECG changes persist after 5 minutes.", "d", "Calcium gluconate 10% 30 mL IV over 10 minutes (or 10 mL as local protocol)"),
    s("d", "Shift potassium into cells. Check glucose hourly for 6 hours.", "f", "Insulin 10 units in 25 g dextrose IV; salbutamol 10–20 mg neb"),
    s("f", "Remove potassium: treat the cause, stop offending drugs, give a loop diuretic if overloaded, or a binder.", "g"),
    q("g", "Refractory, or anuric?", "i", "j"),
    e("i", "Urgent dialysis."),
    e("j", "Recheck K⁺ at 1, 2, 4, 6 and 24 hours."),
    s("h", "Stop offending drugs (ACE inhibitor, spironolactone, NSAID) and diet review.", "j"),
  ] },
  { id: "dka", title: "Diabetic ketoacidosis", specialty: "Endocrinology", source: "ADA/EASD 2024; JBDS", nodes: [
    q("a", "Glucose high (or known diabetes), ketones raised, and pH under 7.3 or bicarbonate under 18?", "b", "x"),
    e("x", "Consider HHS, starvation ketosis, alcoholic ketoacidosis, or another acidosis."),
    s("b", "Start isotonic saline first.", "c", "0.9% saline 1 L in the first hour"),
    q("c", "Potassium under 3.5 mmol/L?", "d", "f"),
    s("d", "Hold insulin. Replace potassium first.", "f", "KCl 10–20 mmol/h, with monitoring"),
    s("f", "Start a fixed-rate insulin infusion.", "g", "Regular insulin 0.1 unit/kg/h"),
    s("g", "Add potassium to fluids while K⁺ is in range; recheck every 2–4 hours.", "h", "KCl 20–30 mmol/L of fluid when K⁺ is 3.5–5.0"),
    q("h", "Glucose under 250 mg/dL?", "i", "g2"),
    s("g2", "Continue. Look for the trigger, usually infection or missed insulin.", "h"),
    s("i", "Add dextrose and continue insulin until ketones clear.", "j", "5–10% dextrose alongside saline"),
    q("j", "pH above 7.3, bicarbonate 18 or above, ketones clear, eating?", "k", "i"),
    e("k", "Start subcutaneous insulin 1–2 hours before stopping the infusion."),
  ] },
  { id: "hypo", title: "Hypoglycaemia", specialty: "Endocrinology", source: "ADA; JBDS", nodes: [
    q("a", "Glucose under 70 mg/dL with symptoms, or unconscious?", "b", "x"),
    e("x", "Look for another cause of symptoms."),
    q("b", "Awake and able to swallow?", "c", "d"),
    s("c", "Give fast sugar by mouth, recheck in 15 minutes.", "f", "15–20 g glucose"),
    s("d", "Give IV dextrose, or IM glucagon if no access.", "f", "25% dextrose 50–100 mL, or 10% dextrose 150–250 mL; glucagon 1 mg IM"),
    q("f", "Glucose above 70 mg/dL at 15 minutes?", "g", "b"),
    e("g", "Give a long-acting carbohydrate, find the cause. With a sulphonylurea or long-acting insulin, observe for recurrence."),
  ] },
  { id: "status", title: "Status epilepticus", specialty: "Neurology", source: "AES 2016; ESETT", nodes: [
    s("a", "Airway, oxygen, IV access, glucose, thiamine if alcohol use is likely. Time from onset.", "b"),
    s("b", "At 5 minutes: give a benzodiazepine. May repeat once.", "c", "Lorazepam 0.1 mg/kg IV, max 4 mg; or midazolam 10 mg IM; or diazepam 0.15 mg/kg IV"),
    q("c", "Still seizing?", "d", "g"),
    s("d", "At 20 minutes: second-line agent over 10 minutes.", "f", "Levetiracetam 60 mg/kg (max 4.5 g), or valproate 40 mg/kg (max 3 g), or fosphenytoin 20 PE/kg"),
    q("f", "Still seizing at 40 minutes?", "h", "g"),
    e("h", "Refractory: intubate, ICU, anaesthetic infusion (midazolam or propofol), EEG."),
    e("g", "Find the cause: glucose, sodium, calcium, infection, stroke, missed drugs. Load a maintenance drug."),
  ] },
  { id: "stroke", title: "Acute ischaemic stroke", specialty: "Neurology", source: "AHA/ASA", nodes: [
    s("a", "Note last-known-well time. Glucose. Urgent non-contrast CT.", "b"),
    q("b", "Haemorrhage on CT?", "c", "d"),
    e("c", "Haemorrhage pathway: reverse anticoagulation, control BP, neurosurgical review."),
    q("d", "Within 4.5 hours, disabling deficit, no contraindication?", "f", "g"),
    s("f", "Lower BP below 185/110 before lysis, then thrombolyse.", "h", "Alteplase 0.9 mg/kg, max 90 mg: 10% bolus, rest over 60 min; or tenecteplase 0.25 mg/kg, max 25 mg"),
    q("h", "Large vessel occlusion on CTA?", "i", "j"),
    e("i", "Mechanical thrombectomy (selected patients up to 24 hours)."),
    e("j", "Stroke unit. Delay antiplatelets until the 24-hour CT after lysis; BP under 180/105."),
    q("g", "Large vessel occlusion with salvageable tissue (up to 24 hours)?", "i", "k"),
    e("k", "Aspirin within 24–48 hours once haemorrhage excluded. Stroke unit, swallow screen.", "Aspirin 300–325 mg"),
  ] },
  { id: "sepsis", title: "Sepsis and septic shock", specialty: "Infectious Disease", source: "Surviving Sepsis Campaign 2026", nodes: [
    s("a", "Probable sepsis: lactate, blood cultures, source search.", "b"),
    s("b", "Broad-spectrum antimicrobials immediately, ideally within 1 hour.", "c"),
    q("c", "Hypotension or lactate of 4 or above?", "d", "g"),
    s("d", "Balanced crystalloid.", "f", "At least 30 mL/kg in the first 3 hours; reassess each bolus"),
    q("f", "MAP still under 65?", "h", "g"),
    s("h", "Noradrenaline first-line. Don't wait for a central line.", "i", "Start at 0.05–0.1 mcg/kg/min, target MAP 65"),
    q("i", "Noradrenaline rising, at 0.25 mcg/kg/min or above for 4 hours or more?", "j", "g"),
    s("j", "Add a steroid; consider vasopressin.", "g", "Hydrocortisone 200 mg/day"),
    e("g", "Source control within 6–12 hours. Reassess antibiotics daily."),
  ] },
  { id: "snake", title: "Snake bite (India)", specialty: "Emergency", source: "MoHFW National Snakebite Protocol", nodes: [
    s("a", "Reassure, immobilise the limb. No tourniquet, cutting or sucking. Transfer. Note the time.", "b"),
    s("b", "20-minute whole blood clotting test; repeat if normal, at 1 hour, then 6-hourly for 24 hours. Watch for ptosis.", "c"),
    q("c", "Signs of envenoming: incoagulable blood, neurotoxicity, shock, kidney injury, or spreading swelling?", "d", "f"),
    e("f", "No antivenom. Observe for 24 hours (longer for krait). Tetanus booster."),
    s("d", "Give polyvalent antivenom IV, keeping adrenaline ready.", "g", "8–10 vials over 1 hour (same dose for a child); low dose in some protocols"),
    q("g", "Neurotoxic with no improvement in 1–2 hours?", "h", "i"),
    s("h", "Atropine-neostigmine trial; repeat antivenom once; ventilate if needed.", "i", "Atropine 0.6 mg, then neostigmine 1.5–2.5 mg IV"),
    q("i", "Clotting still abnormal at 6 hours?", "j", "k"),
    s("j", "Repeat antivenom, and repeat clotting after 6 hours.", "i", "5 vials over 1 hour"),
    e("k", "Watch for kidney injury and compartment syndrome; avoid NSAIDs and IM injections."),
  ] },
  { id: "op", title: "Organophosphate poisoning", specialty: "Emergency", source: "Eddleston, Lancet; WHO", nodes: [
    s("a", "Protect yourself. Airway and oxygen. Remove clothes, wash skin.", "b"),
    s("b", "Atropine, doubling every 5 minutes until atropinised.", "c", "1.8–3 mg IV, then 2×, 4×…"),
    q("c", "Clear chest, HR over 80, systolic over 80, dry axillae?", "d", "b"),
    s("d", "Maintain with an infusion and watch for toxicity.", "f", "10–20% of total loading dose per hour"),
    s("f", "Consider pralidoxime, as local protocol.", "g", "30 mg/kg over 30 min, then 8 mg/kg/h"),
    s("g", "Seizures or agitation: benzodiazepine.", "h", "Diazepam 5–10 mg IV"),
    e("h", "Observe for intermediate syndrome: neck flexion weakness at 24–96 hours; measure vital capacity."),
  ] },
  { id: "pph", title: "Postpartum haemorrhage", specialty: "OBGYN", source: "WHO/FIGO/ICM 2025; E-MOTIVE", nodes: [
    q("a", "Blood loss 300 mL or more with abnormal vital signs, or 500 mL or more?", "b", "x"),
    e("x", "Keep measuring loss with a calibrated drape, keep monitoring."),
    s("b", "Call for help. Start the MOTIVE bundle: Massage the uterus.", "c"),
    s("c", "Oxytocin.", "d", "10 IU IM or slow IV, then 20–40 IU in 1 L crystalloid"),
    s("d", "Tranexamic acid, within 3 hours of birth.", "f", "1 g IV over 10 minutes; repeat after 30 minutes if bleeding continues"),
    s("f", "IV fluids; Vaginal and genital tract exam for tears and retained tissue.", "g"),
    q("g", "Still bleeding?", "h", "k"),
    s("h", "Escalate. Second-line uterotonics, avoiding ergometrine in hypertension and carboprost in asthma.", "i", "Methylergometrine 0.2 mg IM; carboprost 250 mcg IM every 15 min, max 2 mg; misoprostol 800 mcg SL"),
    q("i", "Still bleeding?", "j", "k"),
    e("j", "Uterine balloon tamponade, transfusion, theatre: compression sutures, artery ligation, hysterectomy."),
    e("k", "Monitor closely; check haemoglobin; treat anaemia."),
  ] },
  { id: "eclampsia", title: "Eclampsia", specialty: "OBGYN", source: "WHO; FOGSI-Gestosis-ICOG", nodes: [
    s("a", "Call for help. Left lateral, airway, oxygen. Don't try to stop the seizure with diazepam first.", "b"),
    s("b", "Magnesium sulphate, Pritchard regimen.", "c", "4 g IV (20%) over 5–10 min, plus 5 g deep IM in each buttock (50%). Then 5 g IM every 4 hours"),
    q("c", "Before each dose: knee jerks present, RR over 16, urine over 30 mL/h?", "d", "f"),
    e("f", "Hold magnesium. Toxic with respiratory depression: calcium gluconate.", "Calcium gluconate 10% 10 mL IV over 10 minutes"),
    q("d", "BP 160/110 or above?", "g", "h"),
    s("g", "Lower BP promptly.", "h", "Labetalol 20 mg IV, or oral nifedipine 10 mg; repeat as needed"),
    e("h", "Stabilise, then deliver. Continue magnesium for 24 hours after delivery or the last fit."),
  ] },
  { id: "neonate", title: "Newborn resuscitation", specialty: "Pediatrics", source: "NRP 8th edition", nodes: [
    s("a", "Term? Tone? Breathing or crying? If not: warm, dry, position airway, stimulate.", "b"),
    q("b", "Apnoea, gasping, or HR under 100?", "c", "g"),
    s("c", "Positive pressure ventilation. Check chest rise and start SpO₂ monitor.", "d", "40–60 breaths/min; air for 35 weeks or over"),
    q("d", "HR under 60 after 30 seconds of good PPV?", "f", "g"),
    s("f", "Intubate. Compressions, 100% oxygen.", "h", "3:1 ratio"),
    q("h", "HR still under 60 after 60 seconds?", "i", "g"),
    s("i", "Adrenaline, ideally by umbilical vein. Consider hypovolaemia.", "g", "0.02 mg/kg IV (range 0.01–0.03); saline 10 mL/kg"),
    e("g", "Post-resuscitation care, keep warm, SpO₂ per minute targets."),
  ] },
  { id: "ugib", title: "Upper GI bleed", specialty: "Gastroenterology", source: "ACG; Baveno VII", nodes: [
    s("a", "Two wide-bore lines. Group and crossmatch. Glasgow-Blatchford score. Protect the airway.", "b"),
    s("b", "Transfuse to haemoglobin 7 g/dL (8 with heart disease). Correct clotting.", "c"),
    q("c", "Likely variceal: liver disease stigmata, known varices?", "d", "f"),
    s("d", "Vasoactive drug, antibiotic prophylaxis.", "g", "Terlipressin 2 mg IV every 4 hours; ceftriaxone 1 g daily"),
    e("g", "Endoscopy within 12 hours: band ligation. Rescue TIPS or balloon tamponade if uncontrolled."),
    s("f", "Give IV PPI before endoscopy.", "h", "Pantoprazole 80 mg bolus, then high-dose per protocol"),
    e("h", "Endoscopy within 24 hours. Test and treat H. pylori; review NSAIDs."),
  ] },
  { id: "dengue", title: "Dengue fluids", specialty: "Infectious Disease", source: "WHO; NCVBDC India", nodes: [
    q("a", "Warning signs: abdominal pain, persistent vomiting, mucosal bleed, lethargy, rising HCT with falling platelets?", "b", "c"),
    e("c", "Home care: oral fluids, paracetamol. No NSAIDs. Daily CBC until 48 hours afebrile."),
    q("b", "Shock: narrow pulse pressure, cold limbs, or systolic drop?", "f", "d"),
    s("d", "Admit. Isotonic crystalloid, adjusted to urine output and HCT.", "e1", "5–7 mL/kg/h for 1–2 h, then 3–5, then 2–3"),
    e("e1", "Reduce as leak settles, usually 24–48 hours. Watch for fluid overload in recovery."),
    s("f", "Rapid bolus and reassess, with HCT before and after.", "g", "10–20 mL/kg over 15–60 minutes"),
    q("g", "Improved?", "e1", "h"),
    e("h", "HCT rising: colloid. HCT falling with no improvement: look for bleeding and transfuse."),
  ] },
  { id: "hyponatraemia", title: "Hyponatraemia", specialty: "Nephrology", source: "European Society of Endocrinology", nodes: [
    q("a", "Severe symptoms: seizures, coma, or vomiting with confusion?", "b", "c"),
    s("b", "Hypertonic saline bolus. Repeat until sodium is up 5 mmol/L or symptoms settle.", "d", "3% NaCl 150 mL IV over 20 minutes"),
    e("d", "Cap correction: at most 10 mmol/L in the first 24 hours, 8 thereafter, to avoid osmotic demyelination."),
    s("c", "Serum and urine osmolality, urine sodium, volume status, TSH, cortisol.", "f"),
    q("f", "Hypovolaemic?", "g", "h"),
    e("g", "Isotonic saline. Watch for fast correction once the volume is replaced."),
    q("h", "Oedematous: heart failure, cirrhosis?", "i", "j"),
    e("i", "Fluid restriction, treat the cause, diuretic."),
    e("j", "SIADH likely: fluid restriction; stop culprit drugs; look for lung or CNS cause."),
  ] },
  { id: "htn-emergency", title: "Hypertensive emergency", specialty: "Medicine", source: "AHA/ACC 2025", nodes: [
    q("a", "BP above 180/120 with new organ damage: encephalopathy, ACS, pulmonary oedema, AKI, dissection, stroke?", "b", "c"),
    e("c", "Severe hypertension without acute organ damage: oral drugs, review within days. Don't rapidly lower."),
    q("b", "Aortic dissection?", "d", "f"),
    e("d", "Beta blocker first; systolic under 120 and HR under 60 within 20 minutes.", "Esmolol or labetalol IV"),
    s("f", "ICU. IV titratable drug. Lower by no more than 25% in the first hour.", "g", "Labetalol, nicardipine or nitroprusside"),
    e("g", "Then to 160/100 over 2–6 hours; normal over 24–48 hours. Stroke, eclampsia and pheochromocytoma have their own targets."),
  ] },
  { id: "apo", title: "Acute pulmonary oedema", specialty: "Cardiology", source: "ESC 2021", nodes: [
    s("a", "Sit up. Oxygen if SpO₂ under 90%. ECG, BP, troponin.", "b"),
    q("b", "Respiratory distress?", "c", "d"),
    s("c", "Start CPAP or BiPAP early.", "d"),
    q("d", "Systolic BP above 110?", "f", "g"),
    s("f", "Nitrates, IV loop diuretic.", "h", "GTN 10–20 mcg/min and up; furosemide 40 mg IV (or 1–2.5× home dose)"),
    s("g", "Systolic under 90 with shock: inotrope or vasopressor, urgent echo.", "h", "Noradrenaline or dobutamine"),
    e("h", "Look for the trigger: ACS, arrhythmia, valve, kidney, missed drugs. Monitor urine output."),
  ] },
  { id: "pe", title: "Pulmonary embolism", specialty: "Respiratory", source: "ESC 2019", nodes: [
    q("a", "Shock or persistent hypotension?", "b", "c"),
    s("b", "Bedside echo or CTPA. If RV strain and no contraindication, reperfuse.", "x", "Alteplase 100 mg over 2 hours (0.6 mg/kg over 15 min in arrest)"),
    e("x", "Heparin alongside. Surgical or catheter embolectomy if lysis fails or contraindicated."),
    q("c", "Wells likely, or D-dimer positive?", "d", "f"),
    e("f", "PE excluded (with low or intermediate probability and negative D-dimer)."),
    s("d", "CTPA. V/Q scan if renal failure or pregnancy with normal chest X-ray.", "g"),
    q("g", "PE confirmed?", "h", "f2"),
    e("f2", "Look for another diagnosis."),
    e("h", "Anticoagulate; at least 3 months. PESI low-risk may go home.", "Apixaban 10 mg BD for 7 days then 5 mg BD; or LMWH"),
  ] },
  { id: "meningitis", title: "Bacterial meningitis", specialty: "Infectious Disease", source: "IDSA; ESCMID", nodes: [
    s("a", "Blood cultures straight away. Don't delay antibiotics for imaging.", "b"),
    q("b", "Focal deficit, papilloedema, seizure, immunosuppression, or GCS under 10?", "c", "d"),
    s("c", "Give dexamethasone and antibiotics, then CT, then LP if safe.", "f", "Dexamethasone 10 mg IV before or with first dose"),
    s("d", "LP now, then dexamethasone and antibiotics, within 1 hour of arrival.", "f", "Dexamethasone 10 mg IV every 6 hours for 4 days"),
    s("f", "Empirical antibiotics.", "g", "Ceftriaxone 2 g IV every 12 hours, plus vancomycin where resistance is a risk"),
    q("g", "Age over 50, pregnant, or immunosuppressed?", "h", "i"),
    s("h", "Add Listeria cover.", "i", "Ampicillin 2 g IV every 4 hours"),
    e("i", "Narrow with culture. Meningococcus: isolate for 24 hours and give prophylaxis to close contacts."),
  ] },
  { id: "rabies", title: "Animal bite and rabies", specialty: "Infectious Disease", source: "NCDC India; WHO", nodes: [
    s("a", "Wash the wound with soap and running water for 15 minutes. Apply povidone-iodine. Don't suture early.", "b"),
    q("b", "Only touching, feeding or licks on intact skin (Category I)?", "c", "d"),
    e("c", "No vaccine needed."),
    q("d", "Nibbles or scratches with no bleeding (Category II)?", "f", "g"),
    e("f", "Rabies vaccine only.", "IM days 0, 3, 7, 14, 28 or ID 2-site on days 0, 3, 7, 28"),
    s("g", "Category III: bleeding bite, licks on broken skin or mucosa, bats. Rabies immunoglobulin into and around the wound.", "h", "HRIG 20 IU/kg or equine RIG 40 IU/kg; monoclonals per label"),
    e("h", "Vaccine as for Category II. Tetanus cover; antibiotics for high-risk wounds."),
  ] },
  { id: "tension", title: "Tension pneumothorax", specialty: "Emergency", source: "ATLS 10th edition", nodes: [
    q("a", "Trauma or ventilated patient, respiratory distress, hypotension, absent breath sounds, tracheal shift?", "b", "c"),
    e("c", "Upright chest X-ray or lung ultrasound; a stable pneumothorax is managed by size and symptoms."),
    s("b", "Don't wait for an X-ray. High-flow oxygen.", "d"),
    s("d", "Decompress with a large-bore cannula.", "f", "Adults: 5th intercostal space, anterior to the mid-axillary line"),
    e("f", "Then an intercostal chest drain in the safe triangle."),
  ] },
];

/** The chart as a list of management steps a doctor can drill: its order, from the top, down the main line. */
export function flashcardsFrom(chart: Flowchart): { front: string; back: string }[] {
  const byId = new Map(chart.nodes.map((n) => [n.id, n]));
  const cards: { front: string; back: string }[] = [];
  for (const n of chart.nodes) {
    const parent = chart.nodes.find((p) => p.next === n.id || p.yes === n.id || p.no === n.id);
    if (n.kind === "question") {
      const yes = byId.get(n.yes ?? "");
      const no = byId.get(n.no ?? "");
      if (yes && no) cards.push({ front: `${chart.title}: ${n.text}`, back: `Yes: ${yes.text}\nNo: ${no.text}` });
    } else if (n.dose) {
      cards.push({ front: `${chart.title}: ${n.text} What's the dose?`, back: n.dose });
    } else if (parent?.kind === "step") {
      cards.push({ front: `${chart.title}: after "${parent.text}", what's next?`, back: n.text });
    }
  }
  return cards;
}
