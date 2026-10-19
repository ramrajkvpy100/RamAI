import type { Country } from "./countries";

/**
 * Where treatment advice comes from. A case's own teaching names the guideline it follows; when it
 * doesn't, the specialty's guideline body for the country — and always the standard textbook — stand in.
 */
const GUIDELINES: Record<string, { IN: string; INTL: string }> = {
  Pediatrics: { IN: "IAP (Indian Academy of Pediatrics) guidelines; IAP Standard Treatment Guidelines", INTL: "AAP / NICE paediatric guidelines; WHO IMCI" },
  OBGYN: { IN: "FOGSI guidelines; MoHFW / NHM maternal health guidelines", INTL: "ACOG / RCOG guidelines; WHO maternal care guidance" },
  Cardiology: { IN: "CSI guidance; ESC and ACC/AHA guidelines", INTL: "ACC/AHA and ESC guidelines" },
  Medicine: { IN: "API guidance; ICMR Standard Treatment Guidelines", INTL: "NICE / ACP guidance" },
  Surgery: { IN: "Association of Surgeons of India guidance", INTL: "ACS / NICE surgical guidance" },
  Dermatology: { IN: "IADVL guidelines", INTL: "AAD / BAD guidelines" },
  Psychiatry: { IN: "Indian Psychiatric Society clinical practice guidelines", INTL: "APA / NICE mental health guidelines" },
  ENT: { IN: "Association of Otolaryngologists of India guidance", INTL: "AAO-HNS / ENT UK guidance" },
  Ophthalmology: { IN: "AIOS guidance", INTL: "AAO Preferred Practice Patterns" },
  Orthopedics: { IN: "Indian Orthopaedic Association guidance", INTL: "AAOS / BOA guidance" },
  "Infectious Disease": { IN: "ICMR antimicrobial treatment guidelines; NCVBDC, NTEP and NACO programme guidelines", INTL: "IDSA guidelines; WHO" },
  Endocrinology: { IN: "RSSDI and Endocrine Society of India guidance; ADA Standards of Care", INTL: "ADA Standards of Care; Endocrine Society guidelines" },
  Respiratory: { IN: "ICS–NCCP guidelines; GINA; GOLD", INTL: "GINA; GOLD; BTS guidelines" },
  Gastroenterology: { IN: "Indian Society of Gastroenterology guidance", INTL: "ACG / BSG guidelines" },
  Nephrology: { IN: "Indian Society of Nephrology guidance; KDIGO", INTL: "KDIGO guidelines" },
  Neurology: { IN: "Indian Academy of Neurology guidance; AHA/ASA stroke guidelines", INTL: "AAN and AHA/ASA guidelines" },
  Urology: { IN: "Urological Society of India guidance; EAU guidelines", INTL: "AUA / EAU guidelines" },
  Emergency: { IN: "AHA ACLS/PALS; Society for Emergency Medicine India guidance", INTL: "AHA ACLS/PALS; ATLS; RCEM guidance" },
};

/** The standard textbook for each specialty. */
export const TEXTBOOK: Record<string, string> = {
  Pediatrics: "Nelson Textbook of Pediatrics",
  OBGYN: "Williams Obstetrics",
  Cardiology: "Braunwald's Heart Disease",
  Medicine: "Harrison's Principles of Internal Medicine",
  Surgery: "Bailey & Love's Short Practice of Surgery",
  Dermatology: "Rook's Textbook of Dermatology",
  Psychiatry: "Kaplan & Sadock's Synopsis of Psychiatry",
  ENT: "Scott-Brown's Otorhinolaryngology",
  Ophthalmology: "Kanski's Clinical Ophthalmology",
  Orthopedics: "Apley and Solomon's System of Orthopaedics and Trauma",
  "Infectious Disease": "Harrison's Principles of Internal Medicine; Mandell, Douglas and Bennett's Infectious Diseases",
  Endocrinology: "Williams Textbook of Endocrinology",
  Respiratory: "Murray & Nadel's Textbook of Respiratory Medicine",
  Gastroenterology: "Sleisenger and Fordtran's Gastrointestinal and Liver Disease",
  Nephrology: "Brenner and Rector's The Kidney",
  Neurology: "Adams and Victor's Principles of Neurology",
  Urology: "Campbell-Walsh-Wein Urology",
  Emergency: "Tintinalli's Emergency Medicine",
};

/**
 * The guideline for the condition itself, when it's a common one — matched on the diagnosis.
 * [pattern, India, elsewhere]
 */
const CONDITION: [RegExp, string, string][] = [
  [/snake ?bite|envenom|viper|krait|cobra/i, "National Snakebite Management Protocol (MoHFW, India, 2017); WHO Guidelines for the Management of Snakebites", "WHO Guidelines for the Management of Snakebites (2016)"],
  [/dengue/i, "NCVBDC National Guidelines for Clinical Management of Dengue; WHO dengue guidelines", "WHO dengue guidelines (2009/2012); CDC dengue clinical guidance"],
  [/malaria|falciparum|vivax/i, "NCVBDC National Drug Policy and Guidelines on Malaria Treatment", "WHO Guidelines for Malaria"],
  [/tubercul|\btb\b/i, "NTEP Technical and Operational Guidelines; Index-TB guidelines", "WHO consolidated guidelines on tuberculosis"],
  [/typhoid|enteric fever/i, "ICMR Treatment Guidelines for Antimicrobial Use (enteric fever)", "WHO typhoid guidance; IDSA"],
  [/organophosph|pesticide poison/i, "AIIMS / ICMR poisoning management guidance; WHO IPCS", "WHO IPCS; TOXBASE"],
  [/scrub typhus|rickettsi/i, "ICMR guidelines for scrub typhus", "WHO / CDC rickettsial disease guidance"],
  [/leptospir/i, "NCDC national guidelines on leptospirosis", "WHO leptospirosis guidance"],
  [/myocardial infarction|\bstemi\b|\bnstemi\b|acute coronary/i, "ESC acute coronary syndrome guidelines (2023); CSI guidance", "ESC (2023) / ACC/AHA acute coronary syndrome guidelines"],
  [/heart failure/i, "ESC heart failure guidelines; CSI guidance", "ESC / ACC/AHA heart failure guidelines"],
  [/atrial fibrillation/i, "ESC atrial fibrillation guidelines (2024)", "ESC (2024) / ACC/AHA atrial fibrillation guidelines"],
  [/stroke|cerebral infarct|intracerebral h/i, "AHA/ASA stroke guidelines; Indian Stroke Association guidance", "AHA/ASA stroke guidelines; NICE NG128"],
  [/diabetic ketoacidosis|\bdka\b|hyperosmolar/i, "ADA Standards of Care (hyperglycaemic crises); RSSDI", "ADA consensus on hyperglycaemic crises; JBDS (UK)"],
  [/diabetes/i, "RSSDI clinical practice recommendations; ADA Standards of Care", "ADA Standards of Care; NICE NG28"],
  [/hypertens/i, "Indian Guidelines on Hypertension (IGH-IV); ESC/ESH", "ESC/ESH (2023) / ACC/AHA hypertension guidelines; NICE NG136"],
  [/sepsis|septic shock/i, "Surviving Sepsis Campaign guidelines (2021); ICMR antimicrobial guidelines", "Surviving Sepsis Campaign guidelines (2021)"],
  [/asthma/i, "GINA (Global Initiative for Asthma); ICS–NCCP guidelines", "GINA; BTS/SIGN asthma guideline"],
  [/\bcopd\b|chronic obstructive/i, "GOLD report; ICS–NCCP guidelines", "GOLD report; NICE NG115"],
  [/pneumonia/i, "ICS–NCCP pneumonia guidelines; ICMR antimicrobial guidelines", "ATS/IDSA community-acquired pneumonia guideline; BTS"],
  [/pre-?eclampsia|eclampsia/i, "FOGSI guidance; MoHFW maternal health guidelines (magnesium sulphate)", "ACOG / NICE NG133 hypertension in pregnancy"],
  [/post-?partum haem|\bpph\b/i, "FOGSI / MoHFW PPH guidelines; WHO PPH recommendations", "WHO PPH recommendations; RCOG Green-top 52"],
  [/ectopic/i, "FOGSI guidance", "RCOG / NICE NG126 ectopic pregnancy guidance"],
  [/gastroenteritis|diarrh|dehydrat/i, "IAP / WHO guidance on diarrhoea (ORS and zinc); IMNCI", "WHO / ESPGHAN acute gastroenteritis guidance"],
  [/bronchiolitis/i, "IAP guidance on bronchiolitis", "AAP / NICE NG9 bronchiolitis guideline"],
  [/febrile seizure|status epilepticus|seizure/i, "IAP / Indian Epilepsy Society guidance", "NICE / AES status epilepticus guidance"],
  [/anaphyla/i, "Resuscitation Council UK / WAO anaphylaxis guidance", "Resuscitation Council UK (2021) / WAO anaphylaxis guidance"],
  [/appendicitis/i, "Association of Surgeons of India guidance; WSES Jerusalem guidelines", "WSES Jerusalem guidelines (appendicitis)"],
  [/pancreatitis/i, "Indian Society of Gastroenterology guidance; IAP/APA guidelines", "ACG / IAP–APA acute pancreatitis guidelines"],
  [/urinary tract infection|pyelonephritis|\buti\b/i, "ICMR Treatment Guidelines for Antimicrobial Use", "IDSA / NICE NG109 UTI guidance"],
  [/acute kidney injury|\baki\b/i, "KDIGO AKI guideline", "KDIGO AKI guideline"],
  [/anaemia|anemia/i, "Anemia Mukt Bharat / ICMR guidance", "WHO / BSH anaemia guidance"],
];

/** The sources to show for a case's treatment: its own, else the condition's guideline, else the specialty's — and always the textbook. */
export function treatmentSources(own: readonly string[] | undefined, specialty: string, country: Country | undefined, diagnosis = ""): string[] {
  const book = TEXTBOOK[specialty] ?? TEXTBOOK.Medicine!;
  const g = GUIDELINES[specialty];
  const guideline = g ? (country === "IN" || country === "WW" ? (country === "WW" ? `WHO guidance; ${g.INTL}` : g.IN) : g.INTL) : country === "IN" ? "ICMR Standard Treatment Guidelines" : "WHO guidance";
  const cond = CONDITION.find(([re]) => re.test(diagnosis));
  const list = own?.length ? [...own] : cond ? [country === "IN" || !country ? cond[1] : cond[2]] : [guideline];
  if (!list.some((s) => s.toLowerCase().includes(book.split(/[';]/)[0]!.toLowerCase().slice(0, 12)))) list.push(`Standard textbook: ${book}`);
  return list;
}
