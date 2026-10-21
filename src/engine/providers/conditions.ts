/**
 * The conditions an invented case is drawn from, for the specialties made best first. Chosen here — not left to the
 * model, which leans on whatever is seasonal (five monsoon cases in a row were dengue or leptospirosis) — so cases
 * vary, and each is a condition worth learning at that level and in that mode.
 *
 * Levels: "low" = PHC, CHC and district hospital; "mid" = district hospital and medical college. National referral
 * and global centres choose freely (rare and complex cases). "in": only in India.
 */
import type { Country } from "../countries";
import type { CareLevel, CaseTrack, Specialty } from "../types";

type Where = "low" | "mid" | "both";
type Mode = "opd" | "emergency" | "any";
type Entry = [condition: string, where: Where, mode: Mode, inOnly?: boolean];

const POOLS: Partial<Record<Specialty, Entry[]>> = {
  "General Practice": [
    ["Common cold (viral upper respiratory infection)", "low", "opd"], ["Acute streptococcal pharyngitis", "low", "opd"],
    ["Acute otitis media in a child", "low", "opd"], ["Allergic rhinitis", "low", "opd"], ["Acute uncomplicated cystitis", "low", "opd"],
    ["Acute gastroenteritis in an adult without dehydration", "low", "opd"], ["Dyspepsia / acid peptic disease", "low", "opd"],
    ["Newly detected essential hypertension", "low", "opd"], ["Newly diagnosed type 2 diabetes", "low", "opd"],
    ["Iron-deficiency anaemia in a woman", "low", "opd"], ["Tinea corporis", "low", "opd"], ["Scabies", "low", "opd"], ["Acne vulgaris", "low", "opd"],
    ["Mild acute exacerbation of asthma", "low", "opd"], ["Tension-type headache", "low", "opd"], ["Migraine without aura", "low", "opd"],
    ["Mechanical low back pain", "low", "opd"], ["Knee osteoarthritis", "low", "opd"], ["Acute bacterial conjunctivitis", "low", "opd"],
    ["Primary hypothyroidism", "low", "opd"], ["Intestinal worm infestation (ascariasis)", "low", "opd"], ["Uncomplicated vivax malaria", "low", "opd", true],
    ["Uncomplicated enteric fever", "low", "opd", true], ["Dengue fever without warning signs", "low", "opd", true],
    ["Community-acquired pneumonia suitable for home treatment (CURB-65 0)", "low", "opd"], ["Acute urticaria", "low", "opd"],
    ["Impetigo", "low", "opd"], ["Vulvovaginal candidiasis", "low", "opd"], ["Generalised anxiety disorder", "low", "opd"],
  ],
  Medicine: [
    ["Community-acquired pneumonia", "both", "any"], ["Uncontrolled type 2 diabetes", "both", "opd"], ["Diabetic ketoacidosis", "both", "emergency"],
    ["Acute decompensated heart failure", "both", "emergency"], ["Acute exacerbation of COPD", "both", "any"], ["Acute severe asthma", "both", "emergency"],
    ["Pulmonary tuberculosis", "both", "opd"], ["Enteric fever", "low", "any", true], ["Falciparum malaria", "both", "any", true],
    ["Dengue with warning signs", "both", "any", true], ["Scrub typhus", "both", "any", true], ["Leptospirosis", "mid", "any", true],
    ["Acute viral hepatitis A", "low", "opd"], ["Alcohol-related cirrhosis with ascites", "mid", "any"], ["Acute upper GI bleed from a peptic ulcer", "both", "emergency"],
    ["Acute ischaemic stroke", "both", "emergency"], ["Hypothyroidism", "low", "opd"], ["Graves' disease", "mid", "opd"], ["Iron-deficiency anaemia", "low", "opd"],
    ["Vitamin B12 deficiency", "mid", "opd"], ["Chronic kidney disease stage 4", "mid", "opd"], ["Acute pyelonephritis", "both", "any"],
    ["Cellulitis of the leg", "low", "any"], ["Hyponatraemia from thiazide use", "mid", "any"], ["Acute gout", "low", "opd"],
    ["Rheumatoid arthritis", "mid", "opd"], ["Systemic lupus erythematosus", "mid", "opd"], ["Nephrotic syndrome in an adult", "mid", "opd"],
    ["Hypokalaemic periodic paralysis", "mid", "emergency"], ["Hypertensive urgency", "low", "any"],
  ],
  Dermatology: [
    ["Tinea corporis et cruris", "both", "opd"], ["Scabies", "low", "opd"], ["Acne vulgaris", "both", "opd"], ["Plaque psoriasis", "both", "opd"],
    ["Atopic dermatitis", "both", "opd"], ["Allergic contact dermatitis", "both", "opd"], ["Chronic spontaneous urticaria", "both", "opd"], ["Vitiligo", "both", "opd"],
    ["Melasma", "both", "opd"], ["Pityriasis versicolor", "low", "opd"], ["Impetigo", "low", "opd"], ["Herpes zoster", "both", "any"],
    ["Seborrhoeic dermatitis", "low", "opd"], ["Leprosy (borderline tuberculoid)", "both", "opd", true], ["Fixed drug eruption", "both", "opd"],
    ["Alopecia areata", "mid", "opd"], ["Viral warts", "low", "opd"], ["Molluscum contagiosum", "low", "opd"], ["Lichen planus", "mid", "opd"],
    ["Candidal intertrigo", "low", "opd"], ["Pediculosis capitis", "low", "opd"], ["Pityriasis rosea", "both", "opd"], ["Varicella in an adult", "low", "any"],
    ["Stevens–Johnson syndrome", "mid", "emergency"], ["Pemphigus vulgaris", "mid", "any"], ["Erythema nodosum leprosum", "mid", "any", true],
    ["Steroid-modified tinea (tinea incognito)", "both", "opd", true],
  ],
  Emergency: [
    ["Acute inferior STEMI", "both", "emergency"], ["Acute severe asthma", "both", "emergency"], ["Anaphylaxis", "both", "emergency"],
    ["Diabetic ketoacidosis", "both", "emergency"], ["Hypoglycaemia in a diabetic on insulin", "low", "emergency"], ["Status epilepticus", "both", "emergency"],
    ["Acute ischaemic stroke within the thrombolysis window", "mid", "emergency"], ["Septic shock from pneumonia", "both", "emergency"],
    ["Upper GI bleed from varices", "mid", "emergency"], ["Russell's viper bite with coagulopathy", "low", "emergency", true],
    ["Krait bite with neuroparalysis", "low", "emergency", true], ["Organophosphate poisoning", "both", "emergency", true],
    ["Paracetamol overdose", "both", "emergency"], ["Scorpion sting with autonomic storm", "low", "emergency", true], ["Heat stroke", "both", "emergency"],
    ["Head injury after a road traffic accident", "both", "emergency"], ["Tension pneumothorax", "both", "emergency"], ["Acute pulmonary oedema", "both", "emergency"],
    ["Hypertensive emergency", "mid", "emergency"], ["Severe dehydration from acute gastroenteritis", "low", "emergency"], ["Acute pancreatitis", "mid", "emergency"],
    ["Renal colic", "low", "emergency"], ["Category III dog bite", "low", "emergency"], ["Hyperkalaemia in chronic kidney disease", "mid", "emergency"],
    ["Opioid overdose", "both", "emergency"], ["Alcohol withdrawal", "mid", "emergency"], ["Complete heart block", "mid", "emergency"], ["Burns (20% body surface)", "both", "emergency"],
  ],
  Pediatrics: [
    ["Acute watery diarrhoea with some dehydration", "low", "any"], ["Pneumonia in a young child (IMCI)", "both", "any"], ["Acute bronchiolitis", "both", "any"],
    ["Acute otitis media", "low", "opd"], ["Simple febrile seizure", "both", "emergency"], ["Acute asthma in a child", "both", "any"],
    ["Severe acute malnutrition", "both", "opd"], ["Measles", "low", "any"], ["Varicella", "low", "opd"], ["Dengue in a child", "both", "any", true],
    ["Falciparum malaria in a child", "both", "any", true], ["Enteric fever in a child", "low", "opd", true], ["Urinary tract infection in a child", "both", "opd"],
    ["Nephrotic syndrome", "mid", "opd"], ["Neonatal jaundice", "both", "any"], ["Neonatal sepsis", "mid", "emergency"], ["Iron-deficiency anaemia in a toddler", "low", "opd"],
    ["Worm infestation in a child", "low", "opd"], ["Scabies in a child", "low", "opd"], ["Viral croup", "both", "emergency"],
    ["Acute post-streptococcal glomerulonephritis", "mid", "any"], ["Diabetic ketoacidosis in a child", "mid", "emergency"], ["Bacterial meningitis", "mid", "emergency"],
    ["Pulmonary tuberculosis in a child", "mid", "opd"], ["Hand, foot and mouth disease", "low", "opd"], ["Kerosene ingestion", "low", "emergency", true],
  ],
};

const LOW: CareLevel[] = ["phc", "chc", "district"];
const MID: CareLevel[] = ["district", "college"];

/** A condition for this choice — or undefined to let the model choose (national and global centres, other specialties). */
export function pickCondition(specialty: Specialty, level: CareLevel, track: CaseTrack, country: Country, random: () => number = Math.random): string | undefined {
  const pool = POOLS[specialty];
  if (!pool || level === "apex" || level === "grandrounds") return undefined;
  const fits = pool.filter(([, where, mode, inOnly]) =>
    (where === "both" ? [...LOW, ...MID].includes(level) : where === "low" ? LOW.includes(level) : MID.includes(level))
    && (mode === "any" || mode === track)
    && (!inOnly || country === "IN"));
  if (fits.length === 0) return undefined;
  return fits[Math.floor(random() * fits.length)]![0];
}
