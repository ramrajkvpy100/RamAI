/**
 * Formulary — generic drugs, reputable Indian brands, and drug classes.
 *
 * Classes drive the global safety layer (allergy, interactions, pregnancy,
 * fluid tolerance). Brands are listed most-recognisable first; the first brand
 * is what the debrief cites.
 */

import type { ParsedDose } from "./case-definition";
import type { DrugRoute } from "./types";

export type DrugClass =
  | "analgesic" | "antipyretic" | "nsaid" | "cox2" | "opioid" | "salicylate"
  | "ppi" | "h2-blocker" | "antiemetic" | "antispasmodic" | "antidiarrhoeal" | "laxative" | "ors"
  | "antibiotic" | "penicillin" | "beta-lactam" | "cephalosporin" | "macrolide" | "tetracycline"
  | "fluoroquinolone" | "nitroimidazole" | "carbapenem" | "glycopeptide" | "lincosamide" | "aminoglycoside" | "sulfonamide"
  | "antifungal" | "azole" | "allylamine" | "antifungal-topical"
  | "antiviral" | "antimalarial" | "anthelminthic" | "scabicide"
  | "retinoid-topical" | "retinoid-systemic" | "teratogen" | "depigmenting" | "sunscreen" | "emollient" | "cleanser" | "keratolytic"
  | "topical-antimicrobial" | "topical-steroid" | "topical-steroid-potent" | "steroid-combination" | "vitamin-d-analogue"
  | "antimetabolite" | "immunosuppressant" | "folate" | "folate-rescue"
  | "antihistamine" | "sedating-antihistamine"
  | "steroid-systemic"
  | "biguanide" | "sulfonylurea" | "dpp4" | "sglt2" | "tzd" | "glp1" | "insulin" | "hypoglycaemic"
  | "arb" | "acei" | "arni" | "ccb" | "beta-blocker" | "beta-blocker-nonselective" | "thiazide" | "loop-diuretic" | "mra" | "diuretic" | "antihypertensive"
  | "nitrate" | "pde5" | "pde3" | "statin" | "antiplatelet" | "p2y12" | "anticoagulant" | "doac" | "heparin" | "vasodilator"
  | "antiarrhythmic" | "digoxin" | "vasopressor" | "inotrope" | "anticholinergic" | "opioid-antagonist" | "glucose"
  | "bronchodilator" | "inhaled-steroid" | "leukotriene"
  | "antiepileptic" | "benzodiazepine" | "ssri" | "tca" | "antipsychotic" | "gabapentinoid" | "vitamin"
  | "thyroid" | "antithyroid" | "iron" | "calcium" | "estrogen" | "ocp" | "prothrombotic" | "antifibrinolytic"
  | "electrolyte" | "fluid" | "crystalloid" | "colloid" | "blood-product" | "vaccine" | "uricosuric" | "smoking-cessation"
  | "antivenom" | "uterotonic" | "mood-stabiliser" | "antigout" | "haem" | "barbiturate" | "benzodiazepine-antagonist" | "antidote"
  /** Known to precipitate acute porphyria attacks (NAPOS / EPNet "porphyrinogenic"). */
  | "porphyrinogenic";

export interface FormularyDrug {
  id: string;
  generic: string;
  brands: string[];
  aliases?: string[];
  classes: DrugClass[];
  route: DrugRoute;
  dose?: string;
  frequency?: string;
  /** Volume orders (crystalloids, colloids, blood). */
  fluid?: boolean;
}

/* -------------------------------------------------------------------------- */

export const FORMULARY: FormularyDrug[] = [
  // Analgesics & antipyretics
  { id: "paracetamol", generic: "Paracetamol", brands: ["Dolo 650", "Crocin", "Calpol", "Pacimol"], aliases: ["tylenol", "panadol", "pcm", "acetaminophen", "dolo", "paracetamol iv", "perfalgan"], classes: ["analgesic", "antipyretic"], route: "PO", dose: "650 mg", frequency: "TDS" },
  { id: "ibuprofen", generic: "Ibuprofen", brands: ["Brufen", "Ibugesic", "Combiflam"], aliases: ["advil", "motrin", "nurofen"], classes: ["nsaid", "analgesic", "antipyretic"], route: "PO", dose: "400 mg", frequency: "TDS" },
  { id: "diclofenac", generic: "Diclofenac", brands: ["Voveran", "Dynapar"], aliases: ["diclo"], classes: ["nsaid", "analgesic"], route: "PO", dose: "50 mg", frequency: "BD" },
  { id: "aceclofenac", generic: "Aceclofenac", brands: ["Zerodol", "Hifenac"], classes: ["nsaid", "analgesic"], route: "PO", dose: "100 mg", frequency: "BD" },
  { id: "naproxen", generic: "Naproxen", brands: ["Naprosyn"], aliases: ["aleve"], classes: ["nsaid", "analgesic"], route: "PO", dose: "250 mg", frequency: "BD" },
  { id: "mefenamic-acid", generic: "Mefenamic acid", brands: ["Meftal"], classes: ["nsaid", "analgesic"], route: "PO", dose: "500 mg", frequency: "TDS" },
  { id: "ketorolac", generic: "Ketorolac", brands: ["Ketorol", "Toradol"], classes: ["nsaid", "analgesic"], route: "IV", dose: "30 mg", frequency: "stat" },
  { id: "etoricoxib", generic: "Etoricoxib", brands: ["Nucoxia", "Etoshine"], classes: ["nsaid", "cox2", "analgesic"], route: "PO", dose: "90 mg", frequency: "OD" },
  { id: "nimesulide", generic: "Nimesulide", brands: ["Nise"], classes: ["nsaid", "analgesic"], route: "PO", dose: "100 mg", frequency: "BD" },
  { id: "aspirin", generic: "Aspirin", brands: ["Ecosprin", "Disprin"], aliases: ["bayer aspirin", "baby aspirin", "dispersible aspirin", "acetylsalicylic acid", "asa"], classes: ["antiplatelet", "salicylate", "nsaid"], route: "PO", dose: "75 mg", frequency: "OD" },
  { id: "tramadol", generic: "Tramadol", brands: ["Contramal", "Ultracet"], classes: ["opioid", "analgesic"], route: "PO", dose: "50 mg", frequency: "BD" },
  { id: "morphine", generic: "Morphine", brands: ["Morphine sulphate"], classes: ["opioid", "analgesic"], route: "IV", dose: "3 mg", frequency: "stat" },
  { id: "fentanyl", generic: "Fentanyl", brands: ["Fentanyl citrate"], classes: ["opioid", "analgesic"], route: "IV", dose: "50 mcg", frequency: "stat" },
  { id: "pentazocine", generic: "Pentazocine", brands: ["Fortwin"], classes: ["opioid", "analgesic"], route: "IM", dose: "30 mg", frequency: "stat" },

  // Gastrointestinal
  { id: "pantoprazole", generic: "Pantoprazole", brands: ["Pantocid", "Pan 40", "Pantop"], aliases: ["protonix", "panto", "pan d", "pantoprazole iv"], classes: ["ppi"], route: "PO", dose: "40 mg", frequency: "OD before breakfast" },
  { id: "omeprazole", generic: "Omeprazole", brands: ["Omez"], aliases: ["prilosec", "losec"], classes: ["ppi"], route: "PO", dose: "20 mg", frequency: "OD" },
  { id: "rabeprazole", generic: "Rabeprazole", brands: ["Razo", "Rablet"], classes: ["ppi"], route: "PO", dose: "20 mg", frequency: "OD" },
  { id: "esomeprazole", generic: "Esomeprazole", brands: ["Nexpro", "Sompraz"], classes: ["ppi"], route: "PO", dose: "40 mg", frequency: "OD" },
  { id: "famotidine", generic: "Famotidine", brands: ["Famocid"], aliases: ["pepcid"], classes: ["h2-blocker"], route: "PO", dose: "20 mg", frequency: "BD" },
  { id: "ondansetron", generic: "Ondansetron", brands: ["Emeset", "Ondem", "Vomikind"], aliases: ["zofran"], classes: ["antiemetic"], route: "IV", dose: "4 mg", frequency: "stat" },
  { id: "domperidone", generic: "Domperidone", brands: ["Domstal"], classes: ["antiemetic"], route: "PO", dose: "10 mg", frequency: "TDS" },
  { id: "metoclopramide", generic: "Metoclopramide", brands: ["Perinorm"], classes: ["antiemetic"], route: "IV", dose: "10 mg", frequency: "stat" },
  { id: "loperamide", generic: "Loperamide", brands: ["Eldoper", "Imodium"], aliases: ["imodium", "eldoper", "lomotil"], classes: ["antidiarrhoeal"], route: "PO", dose: "2 mg", frequency: "after each loose stool (max 8 mg/day); never in young children" },
  { id: "racecadotril", generic: "Racecadotril", brands: ["Redotil", "Hidrasec"], aliases: ["redotil"], classes: ["antidiarrhoeal"], route: "PO", dose: "100 mg", frequency: "TDS (child 1.5 mg/kg TDS)" },
  { id: "drotaverine", generic: "Drotaverine", brands: ["Drotin"], classes: ["antispasmodic"], route: "PO", dose: "80 mg", frequency: "TDS" },
  { id: "hyoscine", generic: "Hyoscine butylbromide", brands: ["Buscopan"], aliases: ["hyoscine"], classes: ["antispasmodic", "anticholinergic"], route: "IV", dose: "20 mg", frequency: "stat" },
  { id: "sucralfate", generic: "Sucralfate", brands: ["Sucrafil"], classes: ["ppi"], route: "PO", dose: "1 g", frequency: "TDS" },
  { id: "lactulose", generic: "Lactulose", brands: ["Duphalac"], classes: ["laxative"], route: "PO", dose: "15 mL", frequency: "HS" },
  // Not a medicine — but an order to eat it is carried out (salt poisoning is real).
  { id: "table-salt", generic: "Table salt (sodium chloride)", brands: ["Tata Salt"], aliases: ["table salt", "common salt", "namak", "salt"], classes: ["electrolyte"], route: "PO", dose: "1 g", frequency: "stat" },
  { id: "ors", generic: "Oral rehydration salts", brands: ["Electral"], aliases: ["pedialyte", "dioralyte", "ors", "oral rehydration", "oral rehydration solution"], classes: ["ors", "electrolyte"], route: "PO", dose: "1 sachet in 1 L water", frequency: "sips as tolerated" },

  // Antibiotics
  { id: "amoxicillin", generic: "Amoxicillin", brands: ["Novamox", "Mox"], aliases: ["amoxycillin"], classes: ["antibiotic", "penicillin", "beta-lactam"], route: "PO", dose: "500 mg", frequency: "TDS" },
  { id: "amox-clav", generic: "Amoxicillin–clavulanate", brands: ["Augmentin", "Clavam", "Moxikind-CV"], aliases: ["amoxiclav", "amoxyclav", "co amoxiclav", "amoxicillin clavulanate", "amoxycillin clavulanate"], classes: ["antibiotic", "penicillin", "beta-lactam"], route: "PO", dose: "625 mg", frequency: "BD" },
  { id: "azithromycin", generic: "Azithromycin", brands: ["Azithral", "Azee"], aliases: ["zithromax", "z pak", "zpak", "azithro"], classes: ["antibiotic", "macrolide"], route: "PO", dose: "500 mg", frequency: "OD" },
  { id: "doxycycline", generic: "Doxycycline", brands: ["Doxy-1 L-DR Forte", "Doxt-SL"], aliases: ["doryx", "vibramycin", "doxy"], classes: ["antibiotic", "tetracycline"], route: "PO", dose: "100 mg", frequency: "BD" },
  { id: "minocycline", generic: "Minocycline", brands: ["Minoz"], classes: ["antibiotic", "tetracycline"], route: "PO", dose: "50 mg", frequency: "BD" },
  { id: "ceftriaxone", generic: "Ceftriaxone", brands: ["Monocef", "Oframax"], aliases: ["rocephin"], classes: ["antibiotic", "cephalosporin", "beta-lactam"], route: "IV", dose: "1 g", frequency: "BD" },
  { id: "cefixime", generic: "Cefixime", brands: ["Taxim-O", "Zifi"], aliases: ["suprax"], classes: ["antibiotic", "cephalosporin", "beta-lactam"], route: "PO", dose: "200 mg", frequency: "BD" },
  { id: "cefuroxime", generic: "Cefuroxime", brands: ["Ceftum"], classes: ["antibiotic", "cephalosporin", "beta-lactam"], route: "PO", dose: "500 mg", frequency: "BD" },
  { id: "ciprofloxacin", generic: "Ciprofloxacin", brands: ["Ciplox"], aliases: ["cipro"], classes: ["antibiotic", "fluoroquinolone"], route: "PO", dose: "500 mg", frequency: "BD" },
  { id: "levofloxacin", generic: "Levofloxacin", brands: ["Levoflox", "Glevo"], classes: ["antibiotic", "fluoroquinolone"], route: "PO", dose: "500 mg", frequency: "OD" },
  { id: "ofloxacin", generic: "Ofloxacin", brands: ["Zanocin"], classes: ["antibiotic", "fluoroquinolone"], route: "PO", dose: "200 mg", frequency: "BD" },
  { id: "metronidazole", generic: "Metronidazole", brands: ["Flagyl", "Metrogyl"], aliases: ["metro"], classes: ["antibiotic", "nitroimidazole"], route: "IV", dose: "500 mg", frequency: "TDS" },
  { id: "pip-taz", generic: "Piperacillin–tazobactam", brands: ["Tazact", "Pipzo"], aliases: ["zosyn", "tazocin", "piptaz", "pip taz", "piperacillin tazobactam", "piperacillin", "tazobactam"], classes: ["antibiotic", "penicillin", "beta-lactam"], route: "IV", dose: "4.5 g", frequency: "QID" },
  { id: "meropenem", generic: "Meropenem", brands: ["Meronem", "Merotrol"], aliases: ["mero"], classes: ["antibiotic", "carbapenem", "beta-lactam"], route: "IV", dose: "1 g", frequency: "TDS" },
  { id: "vancomycin", generic: "Vancomycin", brands: ["Vancocin"], aliases: ["vanco"], classes: ["antibiotic", "glycopeptide"], route: "IV", dose: "1 g", frequency: "BD" },
  { id: "nitrofurantoin", generic: "Nitrofurantoin", brands: ["Niftran", "Martifur"], classes: ["antibiotic"], route: "PO", dose: "100 mg", frequency: "BD" },
  { id: "fosfomycin", generic: "Fosfomycin trometamol", brands: ["Fosirol", "Monurol"], aliases: ["fosfomycin sachet", "fosirol", "monurol"], classes: ["antibiotic"], route: "PO", dose: "3 g", frequency: "single dose at bedtime" },
  { id: "clindamycin", generic: "Clindamycin", brands: ["Dalacin C"], classes: ["antibiotic", "lincosamide"], route: "PO", dose: "300 mg", frequency: "TDS" },
  { id: "clindamycin-topical", generic: "Clindamycin 1% gel", brands: ["Clindac-A", "Faceclin"], aliases: ["clindamycin gel", "topical clindamycin", "clindamycin topical", "clindac"], classes: ["topical-antimicrobial", "lincosamide"], route: "TOP", dose: "thin layer", frequency: "BD" },
  { id: "linezolid", generic: "Linezolid", brands: ["Lizolid"], classes: ["antibiotic"], route: "PO", dose: "600 mg", frequency: "BD" },
  { id: "gentamicin", generic: "Gentamicin", brands: ["Genticyn"], classes: ["antibiotic", "aminoglycoside"], route: "IV", dose: "80 mg", frequency: "BD" },
  { id: "cotrimoxazole", generic: "Co-trimoxazole", brands: ["Septran", "Bactrim"], aliases: ["cotrimoxazole", "trimethoprim sulfamethoxazole"], classes: ["antibiotic", "sulfonamide", "porphyrinogenic"], route: "PO", dose: "960 mg", frequency: "BD" },
  { id: "mupirocin", generic: "Mupirocin 2% ointment", brands: ["T-Bact"], aliases: ["mupirocin"], classes: ["topical-antimicrobial"], route: "TOP", dose: "thin layer", frequency: "TDS" },
  { id: "nadifloxacin", generic: "Nadifloxacin 1% cream", brands: ["Nadoxin"], aliases: ["nadifloxacin"], classes: ["topical-antimicrobial", "fluoroquinolone"], route: "TOP", dose: "thin layer", frequency: "BD" },
  { id: "fusidic-acid", generic: "Fusidic acid 2% cream", brands: ["Fucidin"], aliases: ["fusidic acid"], classes: ["topical-antimicrobial"], route: "TOP", dose: "thin layer", frequency: "TDS" },

  // Antifungals
  { id: "itraconazole", generic: "Itraconazole", brands: ["Itaspor", "Canditral"], aliases: ["sporanox", "itra"], classes: ["antifungal", "azole"], route: "PO", dose: "100 mg", frequency: "BD after food" },
  { id: "terbinafine", generic: "Terbinafine", brands: ["Terbicip", "Sebifin"], aliases: ["lamisil"], classes: ["antifungal", "allylamine"], route: "PO", dose: "250 mg", frequency: "OD" },
  { id: "fluconazole", generic: "Fluconazole", brands: ["Forcan", "Zocon"], aliases: ["diflucan"], classes: ["antifungal", "azole"], route: "PO", dose: "150 mg", frequency: "weekly" },
  { id: "griseofulvin", generic: "Griseofulvin", brands: ["Grisovin-FP"], classes: ["antifungal", "porphyrinogenic"], route: "PO", dose: "500 mg", frequency: "OD" },
  { id: "luliconazole", generic: "Luliconazole 1% cream", brands: ["Lulifin"], aliases: ["luliconazole"], classes: ["antifungal-topical", "azole"], route: "TOP", dose: "thin layer, 2 cm beyond margin", frequency: "OD" },
  { id: "clotrimazole", generic: "Clotrimazole 1% cream", brands: ["Candid"], aliases: ["lotrimin", "canesten", "clotrimazole"], classes: ["antifungal-topical", "azole"], route: "TOP", dose: "thin layer", frequency: "BD" },
  { id: "sertaconazole", generic: "Sertaconazole 2% cream", brands: ["Onabet"], aliases: ["sertaconazole"], classes: ["antifungal-topical", "azole"], route: "TOP", dose: "thin layer", frequency: "BD" },
  { id: "eberconazole", generic: "Eberconazole 1% cream", brands: ["Ebernet"], aliases: ["eberconazole"], classes: ["antifungal-topical", "azole"], route: "TOP", dose: "thin layer", frequency: "BD" },
  { id: "ketoconazole-topical", generic: "Ketoconazole 2%", brands: ["Nizral"], aliases: ["ketoconazole", "ketoconazole shampoo", "ketoconazole cream"], classes: ["antifungal-topical", "azole"], route: "TOP", dose: "thin layer", frequency: "OD" },
  { id: "amorolfine", generic: "Amorolfine", brands: ["Loceryl"], classes: ["antifungal-topical"], route: "TOP", dose: "thin layer", frequency: "OD" },

  // Dermatology
  { id: "adapalene", generic: "Adapalene 0.1% gel", brands: ["Adaferin", "Deriva"], aliases: ["differin", "adapalene"], classes: ["retinoid-topical"], route: "TOP", dose: "pea-sized amount to whole face", frequency: "HS" },
  { id: "adapalene-bpo", generic: "Adapalene 0.1% + benzoyl peroxide 2.5% gel", brands: ["Epiduo"], aliases: ["adapalene benzoyl peroxide", "adapalene bpo", "adapalene with benzoyl peroxide", "adapalene and benzoyl peroxide"], classes: ["retinoid-topical", "topical-antimicrobial"], route: "TOP", dose: "pea-sized amount to whole face", frequency: "HS" },
  { id: "adapalene-clinda", generic: "Adapalene 0.1% + clindamycin 1% gel", brands: ["Deriva-CMS"], aliases: ["adapalene clindamycin", "deriva cms"], classes: ["retinoid-topical", "topical-antimicrobial", "lincosamide"], route: "TOP", dose: "pea-sized amount", frequency: "HS" },
  { id: "benzoyl-peroxide", generic: "Benzoyl peroxide 2.5% gel", brands: ["Persol", "Benzac AC"], aliases: ["benzoyl peroxide", "bpo"], classes: ["topical-antimicrobial"], route: "TOP", dose: "thin layer", frequency: "OD" },
  { id: "tretinoin", generic: "Tretinoin 0.025% cream", brands: ["Retino-A"], aliases: ["tretinoin", "retinoic acid"], classes: ["retinoid-topical"], route: "TOP", dose: "pea-sized amount", frequency: "HS" },
  { id: "azelaic-acid", generic: "Azelaic acid 20% cream", brands: ["Aziderm"], aliases: ["azelaic acid", "azelaic"], classes: ["depigmenting", "topical-antimicrobial"], route: "TOP", dose: "thin layer", frequency: "BD" },
  { id: "isotretinoin", generic: "Isotretinoin", brands: ["Isotroin", "Sotret", "Tretiva"], aliases: ["roaccutane", "absorica", "claravis", "accutane", "isotret"], classes: ["retinoid-systemic", "teratogen"], route: "PO", dose: "20 mg", frequency: "OD after food" },
  { id: "hydroquinone", generic: "Hydroquinone 2% cream", brands: ["Eukroma", "Melalite"], aliases: ["hydroquinone", "hq"], classes: ["depigmenting"], route: "TOP", dose: "thin layer to patches", frequency: "HS" },
  { id: "triple-combination", generic: "Triple combination cream (hydroquinone + tretinoin + corticosteroid)", brands: ["Melacare", "Triluma"], aliases: ["triple combination", "kligman", "kligmans", "modified kligman", "tcc"], classes: ["depigmenting", "topical-steroid", "steroid-combination", "retinoid-topical"], route: "TOP", dose: "pea-sized amount to patches", frequency: "HS" },
  { id: "benzylpenicillin", generic: "Benzylpenicillin (crystalline penicillin G)", brands: ["Pentids", "Crystapen"], aliases: ["penicillin", "penicillin g", "crystalline penicillin", "benzyl penicillin", "crystapen", "cpg"], classes: ["antibiotic", "penicillin", "beta-lactam"], route: "IV", dose: "2 million units", frequency: "every 4 h" },
  { id: "benzathine-penicillin", generic: "Benzathine penicillin G", brands: ["Penidure LA", "Pencom"], aliases: ["benzathine", "benzathine penicillin", "bpg", "penidure", "long acting penicillin", "la penicillin"], classes: ["antibiotic", "penicillin", "beta-lactam"], route: "IM", dose: "1.2 million units", frequency: "single dose (every 3–4 weeks for rheumatic fever prophylaxis)" },
  { id: "albendazole", generic: "Albendazole", brands: ["Zentel", "Bandy"], aliases: ["albenza"], classes: ["anthelminthic"], route: "PO", dose: "400 mg", frequency: "single dose" },
  { id: "pralidoxime", generic: "Pralidoxime (PAM)", brands: ["Pam-A", "Lyphe"], aliases: ["pam", "2 pam", "2-pam", "oxime", "pralidoxim"], classes: ["antidote"], route: "IV", dose: "2 g", frequency: "over 30 min, then 8 mg/kg/h infusion" },
  { id: "labetalol", generic: "Labetalol", brands: ["Labebet", "Lobet"], aliases: ["trandate"], classes: ["beta-blocker", "beta-blocker-nonselective", "antihypertensive"], route: "IV", dose: "20 mg", frequency: "over 2 min, repeat 40–80 mg every 10 min (max 300 mg)" },
  { id: "timolol", generic: "Timolol 0.5% eye drops", brands: ["Iotim", "Glucomol"], aliases: ["timolol drops", "timolol eye drops"], classes: ["beta-blocker-nonselective"], route: "OD-eye", dose: "1 drop", frequency: "BD" },
  { id: "lithium", generic: "Lithium carbonate", brands: ["Licab", "Lithosun SR"], aliases: ["lithium carbonate", "lithium"], classes: ["mood-stabiliser"], route: "PO", dose: "450 mg", frequency: "BD (by serum level 0.6–1.0 mmol/L)" },
  { id: "colchicine", generic: "Colchicine", brands: ["Zycolchin", "Goutnil"], aliases: ["colchicum"], classes: ["antigout"], route: "PO", dose: "0.5 mg", frequency: "BD–TDS" },
  { id: "zinc", generic: "Zinc sulphate", brands: ["Zinconia", "Z&D"], aliases: ["zinc", "zinc sulphate", "zinc sulfate", "zinc tablet", "zinc syrup", "zinc dispersible"], classes: ["vitamin"], route: "PO", dose: "20 mg", frequency: "OD for 14 days (10 mg under 6 months)" },
  { id: "iron-sucrose", generic: "Iron sucrose", brands: ["Orofer S", "Venofer"], aliases: ["iron sucrose", "iv iron sucrose", "venofer", "ironsucrose"], classes: ["iron"], route: "IV", dose: "200 mg", frequency: "in 100 mL NS over 20 min, alternate days" },
  { id: "oxytocin", generic: "Oxytocin", brands: ["Pitocin", "Syntocinon"], aliases: ["oxytocin infusion", "pitocin drip", "oxytocin drip"], classes: ["uterotonic"], route: "IM", dose: "10 units", frequency: "stat" },
  { id: "misoprostol", generic: "Misoprostol", brands: ["Cytolog", "Misoprost"], aliases: ["miso", "cytotec"], classes: ["uterotonic"], route: "SL", dose: "800 mcg", frequency: "stat" },
  { id: "methylergometrine", generic: "Methylergometrine", brands: ["Methergin", "Mergin"], aliases: ["methergine", "ergometrine", "methylergonovine", "ergonovine", "ergot"], classes: ["uterotonic"], route: "IM", dose: "0.2 mg", frequency: "stat, may repeat after 15 min" },
  { id: "carboprost", generic: "Carboprost (15-methyl PGF2α)", brands: ["Prostodin", "Hemabate"], aliases: ["pgf2 alpha", "pgf2a", "15 methyl pgf2", "prostodin"], classes: ["uterotonic"], route: "IM", dose: "250 mcg", frequency: "every 15 min, max 8 doses" },
  { id: "tranexamic-acid", generic: "Tranexamic acid", brands: ["Pause 250", "Trapic"], aliases: ["lysteda", "cyklokapron", "tranexamic", "txa"], classes: ["antifibrinolytic", "prothrombotic"], route: "PO", dose: "250 mg", frequency: "BD" },
  { id: "kojic-acid", generic: "Kojic acid 2% cream", brands: ["Kojivit"], aliases: ["kojic acid", "kojic"], classes: ["depigmenting"], route: "TOP", dose: "thin layer", frequency: "BD" },
  { id: "sunscreen", generic: "Broad-spectrum sunscreen SPF 50, PA+++ (tinted)", brands: ["La Shield", "Suncros", "Photostable Gold"], aliases: ["sunscreen", "sun screen", "sunblock", "sun block", "spf", "spf 50", "spf 30", "tinted sunscreen", "photoprotection"], classes: ["sunscreen"], route: "TOP", dose: "two-finger rule for face and neck", frequency: "every morning, reapply every 3 h outdoors" },
  { id: "moisturiser", generic: "Non-comedogenic moisturiser", brands: ["Cetaphil Moisturising Lotion", "Venusia", "Physiogel"], aliases: ["moisturiser", "moisturizer", "emollient", "moisturising cream", "moisturizing cream"], classes: ["emollient"], route: "TOP", dose: "liberal", frequency: "BD" },
  { id: "cleanser", generic: "Gentle cleanser", brands: ["Cetaphil Gentle Skin Cleanser", "Saslic DS"], aliases: ["cleanser", "face wash", "facewash", "salicylic acid face wash", "syndet"], classes: ["cleanser"], route: "TOP", dose: "coin-sized amount", frequency: "BD" },
  { id: "salicylic-acid", generic: "Salicylic acid 6% ointment", brands: ["Salytar"], aliases: ["salicylic acid", "salicylic"], classes: ["keratolytic"], route: "TOP", dose: "thin layer", frequency: "HS" },
  { id: "clobetasol", generic: "Clobetasol propionate 0.05%", brands: ["Tenovate", "Clop", "Dermovate"], aliases: ["clobetasol"], classes: ["topical-steroid", "topical-steroid-potent"], route: "TOP", dose: "thin layer", frequency: "BD" },
  { id: "betamethasone-topical", generic: "Betamethasone valerate 0.1%", brands: ["Betnovate"], aliases: ["betamethasone cream", "betnovate cream"], classes: ["topical-steroid", "topical-steroid-potent"], route: "TOP", dose: "thin layer", frequency: "BD" },
  { id: "mometasone", generic: "Mometasone furoate 0.1%", brands: ["Momate", "Elocon"], aliases: ["mometasone"], classes: ["topical-steroid"], route: "TOP", dose: "thin layer", frequency: "OD" },
  { id: "fluticasone-topical", generic: "Fluticasone propionate 0.05%", brands: ["Flutivate"], aliases: ["fluticasone cream"], classes: ["topical-steroid"], route: "TOP", dose: "thin layer", frequency: "OD" },
  { id: "desonide", generic: "Desonide 0.05%", brands: ["Desowen"], aliases: ["desonide"], classes: ["topical-steroid"], route: "TOP", dose: "thin layer", frequency: "BD" },
  { id: "steroid-fdc", generic: "Steroid–antifungal–antibiotic combination cream", brands: ["Panderm+", "Quadriderm", "Betnovate-GM", "Candid-B"], aliases: ["panderm", "quadriderm", "betnovate gm", "candid b", "steroid antifungal combination", "combination cream"], classes: ["topical-steroid", "topical-steroid-potent", "steroid-combination", "antifungal-topical"], route: "TOP", dose: "thin layer", frequency: "BD" },
  { id: "calcipotriol", generic: "Calcipotriol 0.005% ointment", brands: ["Sorvate", "Daivonex"], aliases: ["calcipotriol", "calcipotriene"], classes: ["vitamin-d-analogue"], route: "TOP", dose: "thin layer", frequency: "BD" },
  { id: "calcipotriol-beta", generic: "Calcipotriol + betamethasone dipropionate gel", brands: ["Daivobet"], aliases: ["taclonex", "dovobet", "calcipotriol betamethasone"], classes: ["vitamin-d-analogue", "topical-steroid", "topical-steroid-potent"], route: "TOP", dose: "thin layer", frequency: "OD" },
  { id: "methotrexate", generic: "Methotrexate", brands: ["Folitrax", "Imutrex"], aliases: ["trexall", "maxtrex", "mtx"], classes: ["antimetabolite", "immunosuppressant", "teratogen"], route: "PO", dose: "7.5 mg", frequency: "once weekly" },
  { id: "folic-acid", generic: "Folic acid", brands: ["Folvite"], classes: ["folate", "vitamin"], route: "PO", dose: "5 mg", frequency: "OD" },
  { id: "folinic-acid", generic: "Folinic acid (calcium leucovorin)", brands: ["Leucovorin"], aliases: ["folinic acid", "leucovorin", "calcium leucovorin", "calcium folinate"], classes: ["folate-rescue"], route: "IV", dose: "15 mg", frequency: "6-hourly" },
  { id: "cyclosporine", generic: "Ciclosporin", brands: ["Sandimmun Neoral", "Imusporin"], aliases: ["cyclosporine", "cyclosporin", "ciclosporin"], classes: ["immunosuppressant"], route: "PO", dose: "100 mg", frequency: "BD" },
  { id: "apremilast", generic: "Apremilast", brands: ["Aprezo"], classes: ["immunosuppressant"], route: "PO", dose: "30 mg", frequency: "BD" },
  { id: "permethrin", generic: "Permethrin 5% cream", brands: ["Permite"], aliases: ["permethrin"], classes: ["scabicide"], route: "TOP", dose: "neck down, wash after 8–12 h", frequency: "repeat after 1 week" },
  { id: "ivermectin", generic: "Ivermectin", brands: ["Ivecop"], classes: ["anthelminthic", "scabicide"], route: "PO", dose: "12 mg", frequency: "stat, repeat after 1 week" },
  { id: "levocetirizine", generic: "Levocetirizine", brands: ["Levocet", "Xyzal"], aliases: ["levocet"], classes: ["antihistamine"], route: "PO", dose: "5 mg", frequency: "OD at night" },
  { id: "cetirizine", generic: "Cetirizine", brands: ["Cetzine", "Alerid"], classes: ["antihistamine"], route: "PO", dose: "10 mg", frequency: "OD" },
  { id: "fexofenadine", generic: "Fexofenadine", brands: ["Allegra"], classes: ["antihistamine"], route: "PO", dose: "120 mg", frequency: "OD" },
  { id: "hydroxyzine", generic: "Hydroxyzine", brands: ["Atarax"], classes: ["antihistamine", "sedating-antihistamine"], route: "PO", dose: "25 mg", frequency: "HS" },
  { id: "bilastine", generic: "Bilastine", brands: ["Bilaxten"], classes: ["antihistamine"], route: "PO", dose: "20 mg", frequency: "OD" },
  { id: "chlorpheniramine", generic: "Chlorphenamine", brands: ["Avil"], aliases: ["chlorpheniramine", "pheniramine", "avil"], classes: ["antihistamine", "sedating-antihistamine"], route: "IV", dose: "22.75 mg", frequency: "stat" },

  // Corticosteroids (systemic)
  { id: "prednisolone", generic: "Prednisolone", brands: ["Wysolone", "Omnacortil"], aliases: ["prednisone", "pred"], classes: ["steroid-systemic"], route: "PO", dose: "40 mg", frequency: "OD" },
  { id: "dexamethasone", generic: "Dexamethasone", brands: ["Dexona", "Decdan"], aliases: ["dexa"], classes: ["steroid-systemic"], route: "IV", dose: "8 mg", frequency: "stat" },
  { id: "hydrocortisone", generic: "Hydrocortisone", brands: ["Lycortin-S"], aliases: ["hydrocortisone iv", "hc"], classes: ["steroid-systemic"], route: "IV", dose: "100 mg", frequency: "stat" },
  { id: "methylprednisolone", generic: "Methylprednisolone", brands: ["Solu-Medrol", "Medrol"], aliases: ["solu medrone"], classes: ["steroid-systemic"], route: "IV", dose: "125 mg", frequency: "stat" },

  // Antivirals, antimalarials
  { id: "acyclovir", generic: "Aciclovir", brands: ["Acivir", "Zovirax"], aliases: ["acyclovir", "aciclovir"], classes: ["antiviral"], route: "PO", dose: "800 mg", frequency: "5 times daily" },
  { id: "valacyclovir", generic: "Valaciclovir", brands: ["Valcivir"], aliases: ["valacyclovir", "valaciclovir"], classes: ["antiviral"], route: "PO", dose: "1 g", frequency: "TDS" },
  { id: "oseltamivir", generic: "Oseltamivir", brands: ["Fluvir", "Antiflu"], aliases: ["tamiflu"], classes: ["antiviral"], route: "PO", dose: "75 mg", frequency: "BD" },
  { id: "artesunate", generic: "Artesunate", brands: ["Falcigo"], classes: ["antimalarial"], route: "IV", dose: "2.4 mg/kg", frequency: "0, 12, 24 h then daily" },
  { id: "artemether-lumefantrine", generic: "Artemether–lumefantrine", brands: ["Lumerax", "Coartem"], aliases: ["act", "artemether"], classes: ["antimalarial"], route: "PO", dose: "80/480 mg", frequency: "BD" },
  { id: "chloroquine", generic: "Chloroquine", brands: ["Lariago"], classes: ["antimalarial"], route: "PO", dose: "600 mg base", frequency: "stat" },

  // Diabetes
  { id: "metformin", generic: "Metformin", brands: ["Glycomet", "Glyciphage"], aliases: ["glucophage"], classes: ["biguanide", "hypoglycaemic"], route: "PO", dose: "500 mg", frequency: "BD after food" },
  { id: "glimepiride", generic: "Glimepiride", brands: ["Amaryl", "Glimy"], classes: ["sulfonylurea", "hypoglycaemic"], route: "PO", dose: "1 mg", frequency: "OD before breakfast" },
  { id: "gliclazide", generic: "Gliclazide", brands: ["Diamicron"], classes: ["sulfonylurea", "hypoglycaemic"], route: "PO", dose: "40 mg", frequency: "BD" },
  { id: "sitagliptin", generic: "Sitagliptin", brands: ["Januvia", "Istavel"], classes: ["dpp4", "hypoglycaemic"], route: "PO", dose: "100 mg", frequency: "OD" },
  { id: "vildagliptin", generic: "Vildagliptin", brands: ["Galvus", "Jalra"], classes: ["dpp4", "hypoglycaemic"], route: "PO", dose: "50 mg", frequency: "BD" },
  { id: "teneligliptin", generic: "Teneligliptin", brands: ["Zita"], classes: ["dpp4", "hypoglycaemic"], route: "PO", dose: "20 mg", frequency: "OD" },
  { id: "dapagliflozin", generic: "Dapagliflozin", brands: ["Forxiga", "Oxra"], aliases: ["farxiga"], classes: ["sglt2", "hypoglycaemic"], route: "PO", dose: "10 mg", frequency: "OD" },
  { id: "empagliflozin", generic: "Empagliflozin", brands: ["Jardiance", "Gibtulio"], classes: ["sglt2", "hypoglycaemic"], route: "PO", dose: "10 mg", frequency: "OD" },
  { id: "pioglitazone", generic: "Pioglitazone", brands: ["Pioz"], classes: ["tzd", "hypoglycaemic"], route: "PO", dose: "15 mg", frequency: "OD" },
  { id: "semaglutide", generic: "Semaglutide", brands: ["Rybelsus", "Ozempic"], classes: ["glp1", "hypoglycaemic"], route: "PO", dose: "3 mg", frequency: "OD" },
  { id: "insulin-regular", generic: "Regular insulin", brands: ["Actrapid", "Huminsulin R"], aliases: ["insulin", "regular insulin", "short acting insulin", "human insulin", "insulin infusion"], classes: ["insulin", "hypoglycaemic"], route: "SC", dose: "6 units", frequency: "stat" },
  { id: "insulin-glargine", generic: "Insulin glargine", brands: ["Lantus", "Basalog"], aliases: ["glargine", "basal insulin"], classes: ["insulin", "hypoglycaemic"], route: "SC", dose: "10 units", frequency: "OD at bedtime" },
  { id: "insulin-premix", generic: "Premixed insulin 30/70", brands: ["Mixtard 30/70", "Huminsulin 30/70"], aliases: ["premix", "premixed insulin", "mixtard"], classes: ["insulin", "hypoglycaemic"], route: "SC", dose: "10 units", frequency: "BD before meals" },

  // Cardiovascular
  { id: "telmisartan", generic: "Telmisartan", brands: ["Telma", "Telmikind"], aliases: ["micardis"], classes: ["arb", "antihypertensive"], route: "PO", dose: "40 mg", frequency: "OD" },
  { id: "losartan", generic: "Losartan", brands: ["Losar", "Repace"], classes: ["arb", "antihypertensive"], route: "PO", dose: "50 mg", frequency: "OD" },
  { id: "olmesartan", generic: "Olmesartan", brands: ["Olmezest"], classes: ["arb", "antihypertensive"], route: "PO", dose: "20 mg", frequency: "OD" },
  { id: "amlodipine", generic: "Amlodipine", brands: ["Amlong", "Stamlo", "Amlokind"], aliases: ["norvasc"], classes: ["ccb", "antihypertensive"], route: "PO", dose: "5 mg", frequency: "OD" },
  { id: "cilnidipine", generic: "Cilnidipine", brands: ["Cilacar"], classes: ["ccb", "antihypertensive"], route: "PO", dose: "10 mg", frequency: "OD" },
  { id: "nifedipine", generic: "Nifedipine", brands: ["Calcigard", "Depin"], classes: ["ccb", "antihypertensive"], route: "PO", dose: "10 mg", frequency: "BD" },
  { id: "ramipril", generic: "Ramipril", brands: ["Cardace"], classes: ["acei", "antihypertensive"], route: "PO", dose: "2.5 mg", frequency: "OD" },
  { id: "enalapril", generic: "Enalapril", brands: ["Envas"], classes: ["acei", "antihypertensive"], route: "PO", dose: "5 mg", frequency: "OD" },
  { id: "metoprolol", generic: "Metoprolol succinate", brands: ["Metolar XR", "Met XL"], aliases: ["toprol", "lopressor", "metoprolol"], classes: ["beta-blocker", "antihypertensive"], route: "PO", dose: "25 mg", frequency: "OD" },
  { id: "atenolol", generic: "Atenolol", brands: ["Aten", "Tenormin"], classes: ["beta-blocker", "antihypertensive"], route: "PO", dose: "50 mg", frequency: "OD" },
  { id: "bisoprolol", generic: "Bisoprolol", brands: ["Concor"], classes: ["beta-blocker", "antihypertensive"], route: "PO", dose: "2.5 mg", frequency: "OD" },
  { id: "carvedilol", generic: "Carvedilol", brands: ["Carca", "Cardivas"], classes: ["beta-blocker", "beta-blocker-nonselective", "antihypertensive"], route: "PO", dose: "3.125 mg", frequency: "BD" },
  { id: "propranolol", generic: "Propranolol", brands: ["Ciplar", "Inderal"], classes: ["beta-blocker", "beta-blocker-nonselective", "antihypertensive"], route: "PO", dose: "20 mg", frequency: "BD" },
  { id: "chlorthalidone", generic: "Chlorthalidone", brands: ["CTD"], aliases: ["chlorthalidone", "chlortalidone"], classes: ["thiazide", "diuretic", "antihypertensive"], route: "PO", dose: "12.5 mg", frequency: "OD" },
  { id: "hydrochlorothiazide", generic: "Hydrochlorothiazide", brands: ["Aquazide"], aliases: ["hctz"], classes: ["thiazide", "diuretic", "antihypertensive"], route: "PO", dose: "12.5 mg", frequency: "OD" },
  { id: "indapamide", generic: "Indapamide", brands: ["Natrilix SR"], classes: ["thiazide", "diuretic", "antihypertensive"], route: "PO", dose: "1.5 mg", frequency: "OD" },
  { id: "furosemide", generic: "Furosemide", brands: ["Lasix"], aliases: ["frusemide", "lasix iv"], classes: ["loop-diuretic", "diuretic"], route: "IV", dose: "40 mg", frequency: "stat" },
  { id: "torsemide", generic: "Torsemide", brands: ["Dytor"], aliases: ["torasemide"], classes: ["loop-diuretic", "diuretic"], route: "PO", dose: "10 mg", frequency: "OD" },
  { id: "spironolactone", generic: "Spironolactone", brands: ["Aldactone"], classes: ["mra", "diuretic"], route: "PO", dose: "25 mg", frequency: "OD" },
  { id: "sacubitril-valsartan", generic: "Sacubitril–valsartan", brands: ["Vymada"], aliases: ["sacubitril valsartan", "arni", "entresto"], classes: ["arni", "antihypertensive"], route: "PO", dose: "50 mg", frequency: "BD" },
  { id: "digoxin", generic: "Digoxin", brands: ["Lanoxin"], classes: ["digoxin", "antiarrhythmic"], route: "PO", dose: "0.25 mg", frequency: "OD" },
  { id: "gtn", generic: "Glyceryl trinitrate", brands: ["Angised", "Nitrocontin", "Millisrol"], aliases: ["glyceryl trinitrate", "gtn spray", "nitro spray", "nitroglycerin spray", "nitrostat", "gtn", "nitroglycerin", "nitroglycerine", "ntg", "nitrate infusion", "ng infusion"], classes: ["nitrate", "vasodilator"], route: "SL", dose: "0.5 mg", frequency: "stat" },
  { id: "isosorbide-dinitrate", generic: "Isosorbide dinitrate", brands: ["Sorbitrate"], aliases: ["isordil", "isoket", "isosorbide dinitrate", "isdn"], classes: ["nitrate", "vasodilator"], route: "SL", dose: "5 mg", frequency: "SOS" },
  { id: "isosorbide-mononitrate", generic: "Isosorbide mononitrate", brands: ["Monotrate"], aliases: ["isosorbide mononitrate", "ismn"], classes: ["nitrate", "vasodilator"], route: "PO", dose: "20 mg", frequency: "BD" },
  { id: "nicorandil", generic: "Nicorandil", brands: ["Nikoran"], classes: ["vasodilator", "nitrate"], route: "PO", dose: "5 mg", frequency: "BD" },
  { id: "atorvastatin", generic: "Atorvastatin", brands: ["Atorva", "Storvas", "Lipitor"], classes: ["statin"], route: "PO", dose: "40 mg", frequency: "OD at night" },
  { id: "rosuvastatin", generic: "Rosuvastatin", brands: ["Rosuvas", "Crestor"], classes: ["statin"], route: "PO", dose: "20 mg", frequency: "OD at night" },
  { id: "clopidogrel", generic: "Clopidogrel", brands: ["Clopilet", "Deplatt", "Plavix"], classes: ["antiplatelet", "p2y12"], route: "PO", dose: "75 mg", frequency: "OD" },
  { id: "ticagrelor", generic: "Ticagrelor", brands: ["Brilinta", "Axcer"], classes: ["antiplatelet", "p2y12"], route: "PO", dose: "90 mg", frequency: "BD" },
  { id: "heparin", generic: "Unfractionated heparin", brands: ["Beparine"], aliases: ["heparin", "ufh"], classes: ["anticoagulant", "heparin"], route: "IV", dose: "5000 units", frequency: "bolus" },
  { id: "enoxaparin", generic: "Enoxaparin", brands: ["Clexane", "Lomoh"], aliases: ["lmwh", "low molecular weight heparin"], classes: ["anticoagulant", "heparin"], route: "SC", dose: "40 mg", frequency: "OD" },
  { id: "warfarin", generic: "Warfarin", brands: ["Warf", "Uniwarfin"], classes: ["anticoagulant"], route: "PO", dose: "5 mg", frequency: "OD" },
  { id: "apixaban", generic: "Apixaban", brands: ["Eliquis", "Apigat"], classes: ["anticoagulant", "doac"], route: "PO", dose: "5 mg", frequency: "BD" },
  { id: "rivaroxaban", generic: "Rivaroxaban", brands: ["Xarelto"], classes: ["anticoagulant", "doac"], route: "PO", dose: "20 mg", frequency: "OD" },
  { id: "cilostazol", generic: "Cilostazol", brands: ["Pletoz"], aliases: ["pletal"], classes: ["pde3", "antiplatelet", "vasodilator"], route: "PO", dose: "100 mg", frequency: "BD" },
  { id: "pentoxifylline", generic: "Pentoxifylline", brands: ["Trental"], classes: ["vasodilator"], route: "PO", dose: "400 mg", frequency: "TDS" },
  { id: "sildenafil", generic: "Sildenafil", brands: ["Penegra", "Manforce", "Suhagra"], aliases: ["viagra"], classes: ["pde5", "vasodilator"], route: "PO", dose: "50 mg", frequency: "SOS, 1 h before intercourse" },
  { id: "tadalafil", generic: "Tadalafil", brands: ["Tadacip", "Megalis", "Forzest"], aliases: ["cialis"], classes: ["pde5", "vasodilator"], route: "PO", dose: "10 mg", frequency: "SOS" },
  { id: "amiodarone", generic: "Amiodarone", brands: ["Cordarone"], classes: ["antiarrhythmic"], route: "IV", dose: "150 mg", frequency: "over 10 min" },
  { id: "adenosine", generic: "Adenosine", brands: ["Adenoject"], classes: ["antiarrhythmic"], route: "IV", dose: "6 mg", frequency: "rapid bolus" },
  { id: "diltiazem", generic: "Diltiazem", brands: ["Dilzem"], classes: ["ccb", "antiarrhythmic"], route: "PO", dose: "30 mg", frequency: "TDS" },
  { id: "atropine", generic: "Atropine", brands: ["Atropine sulphate"], classes: ["anticholinergic"], route: "IV", dose: "0.6 mg", frequency: "stat" },
  { id: "adrenaline", generic: "Adrenaline", brands: ["Adrenaline 1 mg/mL"], aliases: ["epipen", "epinephrine", "adrenaline im", "epi"], classes: ["vasopressor"], route: "IM", dose: "0.5 mg (1:1000)", frequency: "stat, repeat every 5 min" },
  { id: "noradrenaline", generic: "Noradrenaline", brands: ["Adrenor"], aliases: ["levophed", "norepinephrine", "norad", "nor adrenaline"], classes: ["vasopressor"], route: "IV", dose: "0.05 µg/kg/min", frequency: "infusion" },
  { id: "dopamine", generic: "Dopamine", brands: ["Dopamine"], classes: ["vasopressor", "inotrope"], route: "IV", dose: "5 µg/kg/min", frequency: "infusion" },
  { id: "dobutamine", generic: "Dobutamine", brands: ["Cardiject"], classes: ["inotrope"], route: "IV", dose: "5 µg/kg/min", frequency: "infusion" },
  { id: "flumazenil", generic: "Flumazenil", brands: ["Flumazen"], aliases: ["anexate"], classes: ["benzodiazepine-antagonist"], route: "IV", dose: "0.2 mg", frequency: "stat" },
  { id: "acetylcysteine", generic: "N-acetylcysteine", brands: ["Mucomix"], aliases: ["nac", "n acetylcysteine", "parvolex"], classes: ["antidote"], route: "IV", dose: "150 mg/kg", frequency: "stat" },
  { id: "naloxone", generic: "Naloxone", brands: ["Narcan"], classes: ["opioid-antagonist"], route: "IV", dose: "0.4 mg", frequency: "stat, repeat 2–3 min" },
  { id: "dextrose-25", generic: "25% dextrose", brands: ["D25"], aliases: ["20% glucose", "glucose 20%", "20% dextrose", "d20", "50% glucose", "dextrose 50%", "glucose 50%", "d25", "25 dextrose", "25% dextrose", "dextrose 25", "dextrose 25%", "50% dextrose", "d50", "iv glucose"], classes: ["glucose"], route: "IV", dose: "100 mL", frequency: "stat" },
  { id: "glucagon", generic: "Glucagon", brands: ["GlucaGen"], classes: ["glucose"], route: "IM", dose: "1 mg", frequency: "stat" },
  { id: "potassium-chloride", generic: "Potassium chloride", brands: ["KCl"], aliases: ["potassium chloride", "kcl", "potassium supplement"], classes: ["electrolyte"], route: "IV", dose: "20 mEq", frequency: "over 2 h" },
  { id: "calcium-gluconate", generic: "Calcium gluconate 10%", brands: ["Calcium gluconate"], aliases: ["calcium gluconate"], classes: ["electrolyte", "calcium"], route: "IV", dose: "10 mL", frequency: "over 10 min" },
  { id: "sodium-bicarbonate", generic: "Sodium bicarbonate 8.4%", brands: ["Sodabicarb"], aliases: ["sodium bicarbonate", "bicarbonate", "soda bicarb", "sodium bicarb", "bicarb", "nahco3", "soda bicarbonate"], classes: ["electrolyte"], route: "IV", dose: "50 mEq", frequency: "stat" },
  { id: "magnesium-sulphate", generic: "Magnesium sulphate", brands: ["MgSO4"], aliases: ["magnesium sulphate", "magnesium sulfate", "mgso4", "magnesium"], classes: ["electrolyte"], route: "IV", dose: "2 g", frequency: "over 20 min" },

  // Respiratory
  { id: "salbutamol", generic: "Salbutamol", brands: ["Asthalin"], aliases: ["ventolin", "proair", "albuterol", "salbutamol neb", "salbutamol nebulisation"], classes: ["bronchodilator"], route: "NEB", dose: "2.5 mg", frequency: "stat" },
  { id: "levosalbutamol-ipratropium", generic: "Levosalbutamol + ipratropium", brands: ["Duolin"], aliases: ["duolin neb", "ipratropium"], classes: ["bronchodilator", "anticholinergic"], route: "NEB", dose: "1 respule", frequency: "stat" },
  { id: "budesonide", generic: "Budesonide", brands: ["Budecort"], aliases: ["budesonide neb"], classes: ["inhaled-steroid"], route: "NEB", dose: "0.5 mg", frequency: "BD" },
  { id: "budesonide-formoterol", generic: "Budesonide + formoterol", brands: ["Foracort"], aliases: ["formoterol"], classes: ["inhaled-steroid", "bronchodilator"], route: "INH", dose: "200/6 µg", frequency: "BD" },
  { id: "montelukast", generic: "Montelukast", brands: ["Montair"], classes: ["leukotriene"], route: "PO", dose: "10 mg", frequency: "HS" },

  // Neuro & psychiatry
  { id: "carbamazepine", generic: "Carbamazepine", brands: ["Tegretol", "Mazetol"], aliases: ["cbz"], classes: ["antiepileptic", "porphyrinogenic"], route: "PO", dose: "200 mg", frequency: "BD" },
  { id: "phenobarbitone", generic: "Phenobarbitone", brands: ["Gardenal", "Luminal"], aliases: ["phenobarbital", "phenobarb", "barbiturate"], classes: ["antiepileptic", "barbiturate", "porphyrinogenic"], route: "IV", dose: "20 mg/kg", frequency: "loading" },
  { id: "levetiracetam", generic: "Levetiracetam", brands: ["Levipil"], classes: ["antiepileptic"], route: "IV", dose: "1 g", frequency: "BD" },
  { id: "phenytoin", generic: "Phenytoin", brands: ["Eptoin"], classes: ["antiepileptic", "porphyrinogenic"], route: "IV", dose: "20 mg/kg", frequency: "loading" },
  { id: "valproate", generic: "Sodium valproate", brands: ["Encorate", "Valparin"], aliases: ["valproate", "valproic acid"], classes: ["antiepileptic", "teratogen", "porphyrinogenic"], route: "PO", dose: "500 mg", frequency: "BD" },
  { id: "lorazepam", generic: "Lorazepam", brands: ["Ativan"], classes: ["benzodiazepine"], route: "IV", dose: "2 mg", frequency: "stat" },
  { id: "midazolam", generic: "Midazolam", brands: ["Mezolam"], classes: ["benzodiazepine"], route: "IV", dose: "2 mg", frequency: "stat" },
  { id: "diazepam", generic: "Diazepam", brands: ["Calmpose"], classes: ["benzodiazepine"], route: "IV", dose: "5 mg", frequency: "stat" },
  { id: "alprazolam", generic: "Alprazolam", brands: ["Alprax"], classes: ["benzodiazepine"], route: "PO", dose: "0.25 mg", frequency: "HS" },
  { id: "clonazepam", generic: "Clonazepam", brands: ["Clonotril", "Rivotril"], classes: ["benzodiazepine"], route: "PO", dose: "0.25 mg", frequency: "HS" },
  { id: "escitalopram", generic: "Escitalopram", brands: ["Nexito", "Cipralex"], classes: ["ssri"], route: "PO", dose: "10 mg", frequency: "OD" },
  { id: "sertraline", generic: "Sertraline", brands: ["Daxid", "Serta"], classes: ["ssri"], route: "PO", dose: "50 mg", frequency: "OD" },
  { id: "fluoxetine", generic: "Fluoxetine", brands: ["Fludac"], classes: ["ssri"], route: "PO", dose: "20 mg", frequency: "OD" },
  { id: "amitriptyline", generic: "Amitriptyline", brands: ["Tryptomer"], classes: ["tca"], route: "PO", dose: "10 mg", frequency: "HS" },
  { id: "olanzapine", generic: "Olanzapine", brands: ["Oleanz"], classes: ["antipsychotic"], route: "PO", dose: "5 mg", frequency: "HS" },
  { id: "haloperidol", generic: "Haloperidol", brands: ["Serenace"], classes: ["antipsychotic"], route: "IM", dose: "5 mg", frequency: "stat" },
  { id: "pregabalin", generic: "Pregabalin", brands: ["Lyrica", "Pregalin"], classes: ["gabapentinoid"], route: "PO", dose: "75 mg", frequency: "HS" },
  { id: "gabapentin", generic: "Gabapentin", brands: ["Gabapin"], classes: ["gabapentinoid"], route: "PO", dose: "300 mg", frequency: "HS" },
  { id: "methylcobalamin", generic: "Methylcobalamin", brands: ["Nurokind", "Mecobal"], aliases: ["mecobalamin", "vitamin b12 supplement"], classes: ["vitamin"], route: "PO", dose: "1500 µg", frequency: "OD" },
  { id: "vitamin-k", generic: "Vitamin K1 (phytomenadione)", brands: ["Kenadion", "K-Vit"], aliases: ["vit k", "vitamin k", "vit k1", "vitamin k1", "phytonadione", "phytomenadione", "kenadion"], classes: ["vitamin", "prothrombotic"], route: "IV", dose: "10 mg", frequency: "slowly over 15–30 min (newborn: 1 mg IM once)" },
  { id: "thiamine", generic: "Thiamine", brands: ["Benfomet"], aliases: ["vitamin b1"], classes: ["vitamin"], route: "IV", dose: "100 mg", frequency: "TDS" },

  // Endocrine, haematinics, women's health
  { id: "levothyroxine", generic: "Levothyroxine", brands: ["Thyronorm", "Eltroxin"], aliases: ["thyroxine"], classes: ["thyroid"], route: "PO", dose: "50 µg", frequency: "OD empty stomach" },
  { id: "carbimazole", generic: "Carbimazole", brands: ["Neo-Mercazole"], classes: ["antithyroid"], route: "PO", dose: "10 mg", frequency: "TDS" },
  { id: "vitamin-d3", generic: "Cholecalciferol", brands: ["Uprise-D3 60K", "Calcirol"], aliases: ["vitamin d3", "cholecalciferol", "d3 sachet", "60k"], classes: ["vitamin"], route: "PO", dose: "60,000 IU", frequency: "weekly" },
  { id: "calcium-carbonate", generic: "Calcium carbonate", brands: ["Shelcal"], aliases: ["calcium supplement"], classes: ["calcium"], route: "PO", dose: "500 mg", frequency: "BD" },
  { id: "ferrous-ascorbate", generic: "Ferrous ascorbate + folic acid", brands: ["Orofer XT"], aliases: ["ferrous ascorbate", "iron tablets", "oral iron"], classes: ["iron"], route: "PO", dose: "100 mg elemental iron", frequency: "OD" },
  { id: "fcm", generic: "Ferric carboxymaltose", brands: ["Orofer FCM", "Ferinject"], aliases: ["ferric carboxymaltose", "iv iron"], classes: ["iron"], route: "IV", dose: "1 g", frequency: "single dose" },
  { id: "ocp", generic: "Combined oral contraceptive (levonorgestrel + ethinylestradiol)", brands: ["Ovral L", "Novelon"], aliases: ["ocp", "ocps", "oral contraceptive", "contraceptive pill", "birth control pill"], classes: ["estrogen", "ocp", "prothrombotic", "porphyrinogenic"], route: "PO", dose: "1 tablet", frequency: "OD" },
  { id: "nicotine-replacement", generic: "Nicotine replacement (gum / patch)", brands: ["Nicotex", "Nicorette"], aliases: ["nicotine gum", "nicotine patch", "nrt", "nicotine"], classes: ["smoking-cessation"], route: "PO", dose: "2 mg gum", frequency: "every 1–2 h when craving (max 20/day)" },
  { id: "bupropion", generic: "Bupropion SR", brands: ["Bupron SR"], aliases: ["bupropion"], classes: ["smoking-cessation"], route: "PO", dose: "150 mg", frequency: "OD × 3 days, then BD" },
  { id: "allopurinol", generic: "Allopurinol", brands: ["Zyloric"], classes: ["uricosuric"], route: "PO", dose: "100 mg", frequency: "OD" },
  { id: "asv", generic: "Polyvalent anti-snake venom", brands: ["VINS ASV", "Bharat Serums ASVS", "Premium Serums ASV"], aliases: ["asv", "anti snake venom", "antisnake venom", "antivenom", "anti venom", "snake antivenom", "asvs", "polyvalent asv"], classes: ["antivenom"], route: "IV", dose: "10 vials", frequency: "over 1 hour" },
  { id: "hydroxychloroquine", generic: "Hydroxychloroquine", brands: ["HCQS", "Oxcq"], aliases: ["hcq", "hcqs", "plaquenil"], classes: ["antimalarial", "immunosuppressant"], route: "PO", dose: "200 mg", frequency: "BD" },
  { id: "mycophenolate", generic: "Mycophenolate mofetil", brands: ["Mycept", "Cellcept", "Mycofit"], aliases: ["mmf", "mycophenolate mofetil", "mycophenolic acid", "myfortic"], classes: ["immunosuppressant", "antimetabolite", "teratogen"], route: "PO", dose: "1 g", frequency: "BD" },
  { id: "cyclophosphamide", generic: "Cyclophosphamide", brands: ["Endoxan", "Cycloxan"], aliases: ["cyclophosphamide pulse", "euro lupus", "ivcyc", "cyc"], classes: ["immunosuppressant", "teratogen"], route: "IV", dose: "500 mg", frequency: "every 2 weeks × 6" },
  { id: "haem-arginate", generic: "Haem arginate", brands: ["Normosang"], aliases: ["haem arginate", "heme arginate", "hemin", "haemin", "panhematin", "iv haem", "iv heme"], classes: ["haem"], route: "IV", dose: "3 mg/kg (max 250 mg)", frequency: "OD × 4 days" },
  { id: "tetanus", generic: "Tetanus toxoid", brands: ["TT", "Boostrix"], aliases: ["tetanus", "tetanus toxoid", "tt injection", "tdap"], classes: ["vaccine"], route: "IM", dose: "0.5 mL", frequency: "stat" },

  // Fluids & blood
  { id: "ns", generic: "0.9% sodium chloride", brands: ["Normal saline"], aliases: ["ns", "normal saline", "saline", "0 9 saline", "0 9 normal saline", "nacl", "iv ns", "iv saline"], classes: ["fluid", "crystalloid"], route: "IV", dose: "500 mL", frequency: "bolus", fluid: true },
  { id: "rl", generic: "Ringer lactate", brands: ["Ringer lactate"], aliases: ["lactated ringer", "lactated ringers", "lactated ringer s", "lr", "hartmann s", "compound sodium lactate", "rl", "ringer lactate", "ringers lactate", "ringer s lactate", "ringers", "hartmann", "hartmanns", "iv rl"], classes: ["fluid", "crystalloid"], route: "IV", dose: "500 mL", frequency: "bolus", fluid: true },
  { id: "dns", generic: "Dextrose 5% in 0.9% saline", brands: ["DNS"], aliases: ["dns", "dextrose normal saline"], classes: ["fluid", "crystalloid"], route: "IV", dose: "500 mL", frequency: "over 6 h", fluid: true },
  { id: "d10", generic: "10% dextrose", brands: ["D10"], aliases: ["10% glucose", "glucose 10%", "10% glucose infusion", "d10", "10 dextrose", "10% dextrose", "dextrose 10", "dextrose 10%", "iv dextrose 10%", "carbohydrate loading", "glucose infusion"], classes: ["fluid", "crystalloid", "glucose"], route: "IV", dose: "1000 mL", frequency: "over 8 h", fluid: true },
  { id: "hypertonic-saline", generic: "3% sodium chloride", brands: ["3% NaCl"], aliases: ["3% saline", "3 saline", "hypertonic saline", "3% nacl", "hts"], classes: ["fluid", "electrolyte"], route: "IV", dose: "100 mL", frequency: "over 10 min", fluid: true },
  { id: "d5", generic: "5% dextrose", brands: ["D5"], aliases: ["d5", "d5w", "5 dextrose", "5% dextrose", "dextrose 5", "dextrose 5%"], classes: ["fluid", "crystalloid"], route: "IV", dose: "500 mL", frequency: "over 6 h", fluid: true },
  { id: "albumin", generic: "Human albumin 20%", brands: ["Albumed"], aliases: ["albumin", "human albumin"], classes: ["fluid", "colloid"], route: "IV", dose: "100 mL", frequency: "over 1 h", fluid: true },
  { id: "prbc", generic: "Packed red blood cells", brands: ["PRBC"], aliases: ["prbc", "packed red cells", "packed cells", "blood transfusion", "transfuse blood", "transfusion", "whole blood", "unit of blood"], classes: ["blood-product", "fluid"], route: "IV", dose: "1 unit", frequency: "over 3 h", fluid: true },
  { id: "platelet-transfusion", generic: "Platelet concentrate", brands: ["RDP", "SDP"], aliases: ["platelet transfusion", "random donor platelets", "single donor platelets", "rdp", "sdp", "transfuse platelets"], classes: ["blood-product"], route: "IV", dose: "1 unit SDP", frequency: "stat" },
  { id: "ffp", generic: "Fresh frozen plasma", brands: ["FFP"], aliases: ["ffp", "fresh frozen plasma", "plasma"], classes: ["blood-product", "fluid"], route: "IV", dose: "2 units", frequency: "stat", fluid: true },
];

/**
 * The routes a drug is commonly given by, when there is more than one — so an order that doesn't
 * say is asked about. Anything not listed is given by its one usual route.
 */
const ROUTE_OPTIONS: Record<string, DrugRoute[]> = {
  paracetamol: ["PO", "IV", "PR"], diclofenac: ["PO", "IM", "IV", "PR"], ketorolac: ["IV", "IM", "PO"], tramadol: ["PO", "IV", "IM"],
  morphine: ["IV", "IM", "SC", "PO"], fentanyl: ["IV", "IN", "IM"], pentazocine: ["IM", "IV"],
  pantoprazole: ["PO", "IV"], omeprazole: ["PO", "IV"], esomeprazole: ["PO", "IV"], famotidine: ["PO", "IV"], ondansetron: ["PO", "IV", "IM"],
  metoclopramide: ["PO", "IV", "IM"], drotaverine: ["PO", "IV", "IM"], hyoscine: ["IV", "IM", "PO"],
  "amox-clav": ["PO", "IV"], azithromycin: ["PO", "IV"], ceftriaxone: ["IV", "IM"], cefuroxime: ["PO", "IV"], ciprofloxacin: ["PO", "IV"],
  levofloxacin: ["PO", "IV"], metronidazole: ["PO", "IV"], vancomycin: ["IV", "PO"], clindamycin: ["PO", "IV"], linezolid: ["PO", "IV"],
  gentamicin: ["IV", "IM"], cotrimoxazole: ["PO", "IV"],
  dexamethasone: ["IV", "IM", "PO"], hydrocortisone: ["IV", "IM"], methylprednisolone: ["IV", "PO"],
  acyclovir: ["PO", "IV"], artesunate: ["IV", "IM"],
  "insulin-regular": ["SC", "IV"],
  metoprolol: ["PO", "IV"], furosemide: ["IV", "PO", "IM"], torsemide: ["PO", "IV"], digoxin: ["PO", "IV"], gtn: ["SL", "IV"], "isosorbide-dinitrate": ["SL", "PO"],
  heparin: ["IV", "SC"], enoxaparin: ["SC", "IV"], amiodarone: ["IV", "PO"], diltiazem: ["PO", "IV"], atropine: ["IV", "IM"],
  adrenaline: ["IM", "IV", "SC"], acetylcysteine: ["IV", "PO"], naloxone: ["IV", "IM", "IN"], glucagon: ["IM", "IV", "SC"],
  "potassium-chloride": ["IV", "PO"], "sodium-bicarbonate": ["IV", "PO"], "magnesium-sulphate": ["IV", "IM"],
  salbutamol: ["NEB", "INH"], "levosalbutamol-ipratropium": ["NEB", "INH"], budesonide: ["NEB", "INH"],
  phenobarbitone: ["IV", "PO", "IM"], levetiracetam: ["IV", "PO"], phenytoin: ["IV", "PO"], valproate: ["PO", "IV"],
  lorazepam: ["IV", "IM", "PO"], midazolam: ["IV", "IM", "IN"], diazepam: ["IV", "PR", "PO"],
  olanzapine: ["PO", "IM"], haloperidol: ["IM", "IV", "PO"], thiamine: ["IV", "IM", "PO"], methylcobalamin: ["PO", "IM"],
  cyclophosphamide: ["IV", "PO"], "tranexamic-acid": ["PO", "IV"],
  labetalol: ["IV", "PO"], "vitamin-k": ["IV", "IM", "PO", "SC"], "benzylpenicillin": ["IV", "IM"], pralidoxime: ["IV"],
  oxytocin: ["IM", "IV"], misoprostol: ["SL", "PO", "PR"], methylergometrine: ["IM", "IV"], carboprost: ["IM"],
};

/** The routes this drug is given by — its usual one first. */
export function routesFor(drug: FormularyDrug): DrugRoute[] {
  const list = ROUTE_OPTIONS[drug.id];
  return list ? [drug.route, ...list.filter((r) => r !== drug.route)] : [drug.route];
}

const BRAND_STEM_STOPLIST = new Set(["pause", "tide", "mox", "pan", "met", "clop", "zita", "warf", "dns", "rl", "tt"]);

export function formularyDrug(id: string): FormularyDrug | undefined {
  return FORMULARY.find((d) => d.id === id);
}

/** All lowercase phrases that identify a drug in free text. */
export function drugMatchPhrases(drug: FormularyDrug): string[] {
  const phrases = new Set<string>();
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9%+ ]+/g, " ").replace(/\s+/g, " ").trim();
  phrases.add(norm(drug.generic.split(/[(,]/)[0] ?? drug.generic));
  // The name without its strength ("Betamethasone" from "Betamethasone 0.1%") — not for fluids, where the strength is the drug
  // ("Dextrose 5% in saline" isn't plain "dextrose").
  if (!drug.fluid) phrases.add(norm(drug.generic.replace(/\s[\d.]+%.*$/, "")));
  for (const a of drug.aliases ?? []) phrases.add(norm(a));
  for (const b of drug.brands) {
    phrases.add(norm(b));
    const stem = norm(b.replace(/[\s-]*[\d./]+.*$/, ""));
    if (stem.length >= 4 && !BRAND_STEM_STOPLIST.has(stem)) phrases.add(stem);
  }
  return [...phrases].filter((p) => p.length >= 2);
}

/* -------------------------------------------------------------------------- */
/* Order parsing                                                               */
/* -------------------------------------------------------------------------- */

const ROUTE_PATTERNS: [RegExp, DrugRoute][] = [
  // Drops in the eye (atropine 1%, timolol, moxifloxacin): never asked "IV or IM?". Ear drops are topical.
  [/\b(ear drops?|ear drop|otic)\b/, "TOP"],
  [/\b(eye drops?|eye drop|e\/d|eye ointment|ophthalmic|instil\w*|in (?:the|both|right|left|each) eyes?)\b/, "OD-eye"],
  [/\b(iv|intravenous(?:ly)?|i v|infusion|bolus|drip)\b/, "IV"],
  // Added to a bag of fluid: "40 units in 1 litre RL", "in 500 ml NS".
  [/\bin (?:a |one |1 )?(?:\d+(?:\.\d+)?\s*(?:ml|l|litres?|liters?|pints?)\b|bag|pint|ns|rl|dns|normal saline|saline|ringer|d5|dextrose)/, "IV"],
  [/\b(im|intramuscular(?:ly)?|i m)\b/, "IM"],
  [/\b(sc|s c|subcut(?:aneous(?:ly)?)?|sub cutaneous)\b/, "SC"],
  [/\b(sl|sublingual(?:ly)?|under (?:the|his|her|your|their) tongue)\b/, "SL"],
  [/\b(pr|per rectal|rectal(?:ly)?|suppository)\b/, "PR"],
  [/\b(neb|nebuli[sz](?:e|ation|ed)|nebs)\b/, "NEB"],
  [/\b(inhaler|mdi|inhaled|puffs?)\b/, "INH"],
  [/\b(topical(?:ly)?|local(?:ly)?|apply|application|cream|gel|ointment|lotion)\b/, "TOP"],
  [/\b(po|oral(?:ly)?|per oral|by mouth|swallow|tab|tabs|tablet|tablets|cap|caps|capsule|capsules|syrup|syp)\b/, "PO"],
];

const FREQUENCY_PATTERNS: [RegExp, string][] = [
  [/\b(once (?:a |per )?week(?:ly)?|weekly|every week|1 day a week|once in a week)\b/, "once weekly"],
  [/\b(stat|immediately|right now|now)\b/, "stat"],
  [/\b(sos|prn|as needed|when required|if needed)\b/, "SOS"],
  [/\b(od|once daily|once a day|daily|every day|qd|1 0 0|0 0 1)\b/, "OD"],
  [/\b(bd|bid|twice daily|twice a day|two times a day|1 0 1|12 hourly|q12h)\b/, "BD"],
  [/\b(tds|tid|thrice daily|three times a day|1 1 1|8 hourly|q8h)\b/, "TDS"],
  [/\b(qid|qds|four times a day|6 hourly|q6h)\b/, "QID"],
  [/\b(hs|at night|at bedtime|bedtime|night time|nightly|every night|every evening)\b/, "HS"],
  [/\b(every morning|in the morning|each morning|mornings)\b/, "OD (morning)"],
  [/\b(alternate days?|every other day)\b/, "alternate days"],
];

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fourteen: 14, fifteen: 15, twenty: 20, thirty: 30, half: 0.5,
};

export function wordToNumber(token: string): number | undefined {
  if (/^\d+(\.\d+)?$/.test(token)) return parseFloat(token);
  return NUMBER_WORDS[token];
}

/** Extracts dose, route, frequency, duration and fluid volume from an order. */
export function parseOrderDetails(text: string, opts: { weightKg?: number } = {}): ParsedDose {
  // A number glued to letters is part of a name ("d10", "d25", "b12", "ns1"), not an amount.
  const t = ` ${text.toLowerCase()} `.replace(/\b([a-z]+)\d+\b/g, (w) => w.replace(/\d/g, "§"))
    // Penicillin's "2.4 million units", "12 lakh units", "1.2 MU": counted in units.
    .replace(/(\d+(?:\.\d+)?)\s*(million|mega|mu|lakhs?|lacs?)\s*(?:units?|iu|u)?\b/g, (_, n: string, w: string) => ` ${Math.round(parseFloat(n) * (/^l/.test(w) ? 1e5 : 1e6))} units `);
  const out: ParsedDose = {};

  // Fluid volume: litres, millilitres, ml/kg, pints.
  const litre = t.match(/(\d+(?:\.\d+)?)\s*(?:l|lt|ltr|litre|litres|liter|liters)\b/);
  const ml = t.match(/(\d+(?:\.\d+)?)\s*(?:ml|cc)\b(?!\s*(?:\/|per|an?|each)\s*(?:kg|h|hr|hrs|hour))/);
  const mlPerKg = t.match(/(\d+(?:\.\d+)?)\s*ml\s*\/\s*kg/);
  const pints = t.match(/(\d+|one|two|three|a)\s*(?:pint|pints|unit|units)\b/);
  const wordLitre = t.match(/\b(one|two|three|four|half|a)\s*(?:l|litre|litres|liter|liters)\b/);
  // A drip's rate: "100 mL/h", "30 drops a minute" (a standard set: 20 drops a mL).
  const perHour = t.match(/(\d+(?:\.\d+)?)\s*(?:ml|cc)\s*(?:\/|per|an?|each)\s*(?:h|hr|hrs|hour)\b/);
  // (Only drops counted per minute — "2 drops in each eye" is a dose, not a rate.)
  const drops = t.match(/(\d+)\s*(?:dpm\b|drops?\s*(?:\/|per|a|each)\s*(?:min|minute)\b)/) ?? t.match(/\bat\s+(\d+)\s*drops?\b/);
  if (perHour?.[1]) out.rateMlH = parseFloat(perHour[1]);
  else if (drops?.[1] && /drop|dpm/.test(drops[0])) out.rateMlH = parseFloat(drops[1]) * 3;
  if (mlPerKg?.[1]) out.volumeMl = Math.round(parseFloat(mlPerKg[1]) * (opts.weightKg ?? 60));
  else if (litre?.[1]) out.volumeMl = Math.round(parseFloat(litre[1]) * 1000);
  else if (wordLitre?.[1]) out.volumeMl = Math.round((wordToNumber(wordLitre[1]) ?? 1) * 1000);
  else if (ml?.[1]) out.volumeMl = Math.round(parseFloat(ml[1]));
  else if (pints?.[1] && /pint/.test(pints[0])) out.volumeMl = Math.round((wordToNumber(pints[1]) ?? 1) * 350);

  // Dose. A percentage is usually the strength in the name ("25% dextrose", "1% cream"),
  // so it counts as the dose only when no other dose or volume is given.
  // Per kilogram first ("1 mg/kg", "0.1 units per kg"): worked out for this patient's weight.
  const perKg = t.match(/(\d+(?:[.,]\d+)?)\s*(mg|mcg|µg|ug|g|units?|u|meq|mmol)\s*(?:\/|per|a)\s*kg\b/);
  if (perKg?.[1] && perKg[2] && opts.weightKg) {
    const unit = perKg[2].replace(/^(ug|µg)$/, "mcg").replace(/^u$|^unit$/, "units");
    const per = parseFloat(perKg[1].replace(",", "."));
    const total = per * opts.weightKg;
    const nice = total >= 100 ? Math.round(total / 5) * 5 : total >= 10 ? Math.round(total) : Math.round(total * 10) / 10;
    out.amount = nice;
    out.unit = unit;
    out.text = `${nice} ${unit} (${per} ${unit}/kg)`;
  }
  const dose = out.amount !== undefined ? null :
    t.match(/(\d+(?:[.,]\d+)?)\s*(mg|mcg|µg|ug|g|gm|grams?|iu|units?|u|meq|mmol|vials?)(?![a-z/])/) ??
    (out.volumeMl ? null : t.match(/(\d+(?:[.,]\d+)?)\s*(%)(?![a-z])/));
  // Counted forms: "2 tablets", "one respule", "2 puffs".
  const count = dose || out.amount !== undefined ? null : t.match(/\b(\d+(?:\.\d+)?|one|two|three|four|half|a|an)\s*(tabs?|tablets?|caps?|capsules?|respules?|puffs?|sachets?|ampoules?|amps?|drops?)\b/);
  if (dose?.[1] && dose[2]) {
    const unit = dose[2].replace(/^(gm|grams?)$/, "g").replace(/^(ug|µg)$/, "mcg").replace(/^(u|iu)$/, "units").replace(/^unit$/, "units").replace(/^vial$/, "vials");
    out.amount = parseFloat(dose[1].replace(",", ""));
    out.unit = unit;
    const n = parseFloat(dose[1].replace(",", ""));
    out.text = `${dose[1].replace(",", "")} ${n === 1 && /s$/.test(unit) && unit !== "units" ? unit : n === 1 && unit === "units" ? "unit" : unit}`;
    if (unit === "units" && n >= 100_000) out.text = `${+(n / 1e6).toFixed(2)} million units`;
  } else if (count?.[1] && count[2]) {
    const n = wordToNumber(count[1]) ?? 1;
    const unit = count[2].replace(/^tabs?$|^tablets$/, "tablet").replace(/^caps?$|^capsules$/, "capsule").replace(/s$/, "").replace(/^amp$/, "ampoule");
    out.amount = n;
    out.unit = unit;
    out.text = `${n} ${unit}${n === 1 ? "" : "s"}`;
  } else if (out.amount !== undefined) {
    // already set from a per-kg dose
  } else if (out.volumeMl) {
    out.text = out.volumeMl >= 1000 ? `${+(out.volumeMl / 1000).toFixed(2)} L` : `${out.volumeMl} mL`;
  }

  for (const [re, route] of ROUTE_PATTERNS) {
    if (re.test(t)) { out.route = route; break; }
  }
  for (const [re, freq] of FREQUENCY_PATTERNS) {
    if (re.test(t)) { out.frequency = freq; break; }
  }

  // The rate: "in 1 min", "over 30 minutes", "within 2 sec"; a push or bolus goes in over about a minute.
  const over = t.match(/\b(?:in|over|within)\s*(\d+(?:\.\d+)?|one|two|three|four|five|six|ten|fifteen|twenty|thirty|a|an|half an?)\s*(seconds?|secs?|s|minutes?|mins?|hours?|hrs?|h)\b/);
  if (over?.[1] && over[2]) {
    const n = wordToNumber(over[1].replace(/^half an?$/, "half")) ?? 1;
    out.overMin = /^s/.test(over[2]) ? Math.max(n / 60, 0.02) : /^h/.test(over[2]) ? n * 60 : n;
  } else if (/\b(push|bolus|stat push|iv push|rapid|rapidly|fast|wide open|free flow|free-flow)\b/.test(t)) {
    out.overMin = 1;
    out.rapid = true;
  }

  // The course: "for 5 days", "x 2 weeks" ("over 2 hours" is the rate, above — though "over 3 days" is still a course).
  const dur = t.match(/\b(?:for|x|×)\s*(\d+|one|two|three|four|five|six|seven|eight|ten|twelve|fourteen|a|an)\s*(day|days|week|weeks|wk|wks|month|months|hour|hours|hr|hrs|h|min|mins|minutes)\b/) ?? t.match(/\bover\s*(\d+|one|two|three|four|five|six|seven|eight|ten|twelve|fourteen|a|an)\s*(day|days|week|weeks|wk|wks|month|months)\b/);
  if (dur?.[1] && dur[2]) {
    const n = wordToNumber(dur[1]) ?? 1;
    const unit = dur[2].replace(/^(wk|wks)$/, "weeks").replace(/^(hr|hrs|h)$/, "hours").replace(/^(min|mins)$/, "minutes");
    const singular = unit.replace(/s$/, "");
    out.duration = `${n} ${n === 1 ? singular : singular + "s"}`;
  } else if (/\b(long term|longterm|life ?long|indefinitely|continue|continued|ongoing|till (?:next )?(?:review|follow up)|until (?:next )?(?:review|follow up)|chronic(?:ally)?)\b/.test(t)) {
    out.duration = "long term";
  }
  return out;
}
