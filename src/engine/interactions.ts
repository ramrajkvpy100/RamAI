/**
 * Major drug interactions (standard references: BNF Appendix 1, Stockley's Drug Interactions), for
 * the debrief: every pair among the drugs the doctor gave and the patient's own medicines.
 */

const NSAIDS = ["ibuprofen", "diclofenac", "aceclofenac", "aspirin"];
const NITRATES = ["gtn", "isosorbide-dinitrate", "isosorbide-mononitrate"];
const ACE_ARB = ["enalapril", "ramipril", "telmisartan", "losartan"];
const QT = ["azithromycin", "levofloxacin", "ciprofloxacin", "ondansetron", "haloperidol", "domperidone", "amiodarone"];
const SSRI = ["sertraline", "fluoxetine", "escitalopram"];
const BENZO = ["diazepam", "midazolam", "lorazepam", "alprazolam"];
const OPIOID = ["morphine", "tramadol"];
const SU = ["glimepiride", "gliclazide"];
const BETA = ["metoprolol", "atenolol", "propranolol"];
const PPI = ["omeprazole", "esomeprazole"];

interface Rule {
  a: string[];
  b: string[];
  effect: string;
  advice: string;
}

const RULES: Rule[] = [
  { a: ["warfarin"], b: NSAIDS, effect: "Bleeding risk rises sharply (antiplatelet effect and gastric erosion on top of anticoagulation).", advice: "Avoid; use paracetamol for pain, and a PPI if an NSAID is unavoidable." },
  { a: ["warfarin"], b: ["metronidazole", "fluconazole", "cotrimoxazole", "ciprofloxacin", "levofloxacin"], effect: "INR rises (warfarin's metabolism is inhibited) — bleeding risk.", advice: "Choose another antibiotic or check the INR within 3–5 days and reduce the dose." },
  { a: ["sildenafil", "tadalafil"], b: NITRATES, effect: "Profound, sometimes fatal, hypotension.", advice: "Contraindicated: no nitrate within 24 h of sildenafil (48 h of tadalafil)." },
  { a: ACE_ARB, b: ["spironolactone", "potassium-chloride"], effect: "Hyperkalaemia.", advice: "Check potassium and renal function within a week; avoid in CKD unless monitored." },
  { a: ["atorvastatin", "rosuvastatin"], b: ["fluconazole", "amiodarone", "diltiazem"], effect: "Statin levels rise — myopathy and rhabdomyolysis.", advice: "Use a lower statin dose or pause it during the course." },
  { a: SSRI, b: ["tramadol"], effect: "Serotonin syndrome, and a lower seizure threshold.", advice: "Avoid the combination; choose another analgesic." },
  { a: QT, b: QT, effect: "QT prolongation — torsades de pointes.", advice: "Avoid combining QT-prolonging drugs; check the ECG and potassium/magnesium if unavoidable." },
  { a: ["digoxin"], b: ["amiodarone", "diltiazem"], effect: "Digoxin levels rise — toxicity (bradycardia, arrhythmia, nausea).", advice: "Halve the digoxin dose and monitor levels." },
  { a: ["gentamicin"], b: ["furosemide", "vancomycin"], effect: "Additive ototoxicity and nephrotoxicity.", advice: "Monitor renal function and drug levels; avoid if possible." },
  { a: ["methotrexate"], b: ["cotrimoxazole"], effect: "Bone-marrow suppression (both antifolate).", advice: "Avoid the combination." },
  { a: ["clopidogrel"], b: PPI, effect: "Clopidogrel's antiplatelet effect is reduced (CYP2C19 inhibition).", advice: "Use pantoprazole instead of omeprazole/esomeprazole." },
  { a: BETA, b: ["diltiazem"], effect: "Bradycardia, heart block and hypotension.", advice: "Avoid together, especially IV; monitor the heart rate and ECG." },
  { a: SU, b: ["fluconazole", "cotrimoxazole"], effect: "Hypoglycaemia (sulfonylurea levels rise).", advice: "Monitor glucose closely or reduce the sulfonylurea dose." },
  { a: OPIOID, b: BENZO, effect: "Additive sedation and respiratory depression.", advice: "Avoid together, or use the lowest doses with monitoring of breathing and SpO₂." },
  { a: NSAIDS, b: ACE_ARB, effect: "Acute kidney injury ('triple whammy' with a diuretic) and reduced blood-pressure control.", advice: "Avoid NSAIDs, especially in the elderly, dehydrated or with CKD." },
];

export interface Interaction {
  drugs: [string, string];
  effect: string;
  advice: string;
}

/** Every interacting pair among these drugs (formulary ids, or the patient's own medicine names). */
export function findInteractions(drugIds: readonly string[], name: (id: string) => string): Interaction[] {
  const ids = [...new Set(drugIds.map((d) => d.toLowerCase().trim()))];
  const has = (list: string[], id: string) => list.some((x) => id === x || id.startsWith(`${x} `) || id.startsWith(`${x}-`));
  const out: Interaction[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++)
      for (const r of RULES) {
        const x = ids[i]!, y = ids[j]!;
        if ((has(r.a, x) && has(r.b, y)) || (has(r.a, y) && has(r.b, x))) {
          const key = [x, y].sort().join("|") + r.effect;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({ drugs: [name(x), name(y)], effect: r.effect, advice: r.advice });
        }
      }
  return out;
}
