/**
 * The library outside India — who each patient is in the USA and the UK, and
 * how they say it: names, places, food, drug brands, the ambulance number.
 * Server-only: it holds every case's hidden lines.
 *
 * `lines` are keyed by the exact Indian text (`tests/country.test.ts` fails if
 * a key no longer exists in its case); `subs` and the shared TERMS catch the
 * rest. Units, money and US spelling are converted later, on output — so the
 * text here stays in conventional units, rupees and British spelling.
 */
import "server-only";

import type { PatientIdentity } from "../types";

export type Abroad = "US" | "UK";

export interface CaseLocale {
  patient: Partial<PatientIdentity>;
  /** Exact Indian line → local line. */
  lines?: Record<string, string>;
  /** Case-specific substitutions, applied after `lines` and before TERMS. */
  subs?: [RegExp, string][];
}

/* -------------------------------------------------------------------------- */
/* Shared terms                                                                */
/* -------------------------------------------------------------------------- */

/** Brands, places and habits every case shares. Order matters: longer phrases first. */
export const TERMS: Record<Abroad, [RegExp, string][]> = {
  US: [
    [/\bNamaste\b/g, "Hello"],
    [/\bDolo(?: 650)?\b/g, "Tylenol"],
    [/\bCombiflam\b/g, "Advil"],
    [/\bMeftal Spas\b/g, "Advil"],
    [/\bDisprin\b/g, "aspirin"],
    [/\bEcosprin\b/g, "baby aspirin"],
    [/\bSorbitrate tablets\b/g, "nitroglycerin pills"],
    [/\bSorbitrate\b/g, "nitroglycerin"],
    [/\bManforce\b/g, "Viagra"],
    [/\bOvral[- ]L\b/g, "Levora"],
    [/\bPanderm Plus\b/g, "Lotrisone"],
    [/\bTelma\b/g, "Micardis"],
    [/\bMetolar\b/g, "metoprolol"],
    [/\bMonocef\b/g, "Rocephin"],
    [/\bTaxim-O\b/g, "Suprax"],
    [/\bAzee\b/g, "Zithromax"],
    [/\bElectral\b/g, "Pedialyte"],
    [/\bThe chemist\b/g, "The pharmacist"],
    [/\bthe chemist\b/g, "the pharmacist"],
    [/\bchemists\b/g, "pharmacists"],
    [/\bchemist\b/g, "pharmacist"],
    [/\bOPD nurse\b/g, "clinic nurse"],
    [/\bOPD\b/g, "clinic"],
    [/\b([Cc]all|[Cc]alling|[Cc]alled|[Dd]ial|[Dd]ialing|[Dd]ialling) 108\b/g, "$1 911"],
    [/\(108\)/g, "(911)"],
    [/\binnerwear\b/g, "underwear"],
    [/\bbidis\b/g, "cigarettes"],
    [/\bbidi\b/g, "cigarette"],
    [/\bsugar tablet\b/g, "diabetes pill"],
    [/\bcopper-T\b/g, "copper IUD"],
  ],
  UK: [
    [/\bNamaste\b/g, "Hello"],
    [/\bDolo(?: 650)?\b/g, "paracetamol"],
    [/\bCombiflam\b/g, "ibuprofen"],
    [/\bMeftal Spas\b/g, "Buscopan"],
    [/\bEcosprin\b/g, "aspirin"],
    [/\bSorbitrate tablets\b/g, "GTN spray"],
    [/\bSorbitrate\b/g, "GTN"],
    [/\bManforce\b/g, "Viagra"],
    [/\bOvral[- ]L\b/g, "Microgynon"],
    [/\bPanderm Plus\b/g, "Canesten HC"],
    [/\bTelma\b/g, "telmisartan"],
    [/\bMetolar\b/g, "metoprolol"],
    [/\bMonocef\b/g, "ceftriaxone"],
    [/\bTaxim-O\b/g, "cefixime"],
    [/\bAzee\b/g, "azithromycin"],
    [/\bElectral\b/g, "Dioralyte"],
    [/\bOPD nurse\b/g, "clinic nurse"],
    [/\bOPD\b/g, "clinic"],
    [/\b([Cc]all|[Cc]alling|[Cc]alled|[Dd]ial|[Dd]ialing|[Dd]ialling) 108\b/g, "$1 999"],
    [/\(108\)/g, "(999)"],
    [/\binnerwear\b/g, "underwear"],
    [/\bbidis\b/g, "cigarettes"],
    [/\bbidi\b/g, "cigarette"],
    [/\bsugar tablet\b/g, "diabetes tablet"],
    [/\bthe copper-T\b/g, "the copper coil"],
    [/\bcopper-T\b/g, "copper coil"],
  ],
};

/** Teaching-monograph brands: Indian brand → local brand ("" when it's prescribed by generic name). */
export const TEACHING_BRANDS: Record<string, Record<Abroad, string>> = {
  Epiduo: { US: "Epiduo", UK: "Epiduo" },
  "Doxy-1 L-DR Forte": { US: "Doryx", UK: "" },
  Isotroin: { US: "Absorica", UK: "Roaccutane" },
  Melacare: { US: "Tri-Luma", UK: "" },
  Pause: { US: "Lysteda", UK: "Cyklokapron" },
  Itaspor: { US: "Sporanox", UK: "Sporanox" },
  Lulifin: { US: "Luzu", UK: "" },
  Levocet: { US: "Xyzal", UK: "Xyzal" },
  Folitrax: { US: "Trexall", UK: "Maxtrex" },
  Daivobet: { US: "Taclonex", UK: "Dovobet" },
  Clopilet: { US: "Plavix", UK: "Plavix" },
  Atorva: { US: "Lipitor", UK: "Lipitor" },
  Telma: { US: "Micardis", UK: "Micardis" },
  Forxiga: { US: "Farxiga", UK: "Forxiga" },
  Pletoz: { US: "Pletal", UK: "Pletal" },
  Nicotex: { US: "Nicorette", UK: "Nicorette" },
  "Dolo 650": { US: "Tylenol", UK: "Panadol" },
  Electral: { US: "Pedialyte", UK: "Dioralyte" },
  Monocef: { US: "Rocephin", UK: "Rocephin" },
  Metrogyl: { US: "Flagyl", UK: "Flagyl" },
  Emeset: { US: "Zofran", UK: "Zofran" },
  Lasix: { US: "Lasix", UK: "Lasix" },
  Vymada: { US: "Entresto", UK: "Entresto" },
  Disprin: { US: "Bayer Aspirin", UK: "Disprin" },
  Sorbitrate: { US: "Isordil", UK: "Isoket" },
  Elaxim: { US: "TNKase", UK: "Metalyse" },
  HCQS: { US: "Plaquenil", UK: "Plaquenil" },
  Mycept: { US: "CellCept", UK: "CellCept" },
  "Solu-Medrol": { US: "Solu-Medrol", UK: "Solu-Medrone" },
  Normosang: { US: "Panhematin", UK: "Normosang" },
  Givlaari: { US: "Givlaari", UK: "Givlaari" },
  GlucaGen: { US: "GlucaGen", UK: "GlucaGen" },
  D25: { US: "D50", UK: "" },
  D10: { US: "D10", UK: "" },
};

/* -------------------------------------------------------------------------- */
/* Cases                                                                       */
/* -------------------------------------------------------------------------- */

const both = (lines: Record<string, string>) => lines;

const ACNE = both({
  "Evidence for azithromycin in acne is weaker, and macrolide resistance in C. acnes is high in India.": "Evidence for azithromycin in acne is weaker, and macrolide resistance in C. acnes is widespread.",
  "Adolescent onset 18 months ago; comedones evolving to painful red lesions; premenstrual flares; a chemist's steroid cream made it worse; brother scarred.": "Adolescent onset 18 months ago; comedones evolving to painful red lesions; premenstrual flares; a borrowed steroid cream made it worse; brother scarred.",
  "She had used an over-the-counter betamethasone cream for two months. Topical steroids aggravate acne and are the commonest reason for 'nothing works' in Indian OPDs.": "She had been using a borrowed betamethasone cream for two months. Topical steroids aggravate acne and are a common hidden reason for 'nothing works'.",
  "PIH common in Indian skin": "PIH common in skin of colour",
  "In Indian skin, PIH fades only if UV keeps it from re-darkening.": "In skin of colour, PIH fades only if sun protection stops it re-darkening.",
  "In Indian skin, every inflamed papule is a future dark mark. Treat acne early and adequately — and always ask what the patient is already applying. An over-the-counter steroid cream is the commonest reason “nothing works.”": "In skin of colour, every inflamed papule is a future dark mark. Treat acne early and adequately — and always ask what the patient is already applying. A borrowed or over-the-counter steroid cream is a common reason “nothing works.”",
});

const MELASMA = both({
  "A 34-year-old teacher is waiting in Dermatology OPD, room 2, holding a tube of cream.": "A 34-year-old teacher is waiting in the dermatology clinic, room 2, holding a tube of cream.",
  "A fairness cream from the market for a few months, and I get a facial and bleach at the parlour every month. Nothing from a doctor.": "A skin-lightening cream I bought online for a few months, and I get a facial and bleach at the salon every month. Nothing from a doctor.",
  "Cosmetic fairness cream; monthly parlour bleach/facials; no medicated creams": "Cosmetic skin-lightening cream (bought online); monthly salon bleach/facials; no medicated creams",
  "It works quickly but contains a corticosteroid; beyond 8–12 weeks it causes atrophy, telangiectasia and steroid dependence — the commonest harm in Indian melasma practice.": "It works quickly but contains a corticosteroid; beyond 8–12 weeks it causes atrophy, telangiectasia and steroid dependence — a common harm when it's used unsupervised.",
  "Gave practical photoprotection advice — helmet, reapplication, visible light.": "Gave practical photoprotection advice — a hat, reapplication, visible light.",
  "They're lighter, doctor — my husband noticed. I wear the helmet and use the sunscreen every day, even indoors. The cream stung a little for the first week.": "They're lighter, doctor — my husband noticed. I wear the hat and use the sunscreen every day, even indoors. The cream stung a little for the first week.",
  "Full-face helmet or scarf, shade, reapplication — and avoiding heat exposure where possible.": "A wide-brimmed hat, shade, reapplication — and avoiding heat exposure where possible.",
  "Check adherence — sunscreen amount, reapplication, helmet": "Check adherence — sunscreen amount, reapplication, hat",
  "Fairness creams, parlour bleach and unsupervised steroid combinations are common aggravators in India.": "Skin-lightening creams, salon bleaching and unsupervised steroid combinations are common aggravators.",
  "Ask about every cream, bleach and parlour procedure.": "Ask about every cream, bleach and salon procedure.",
  "Asked about creams and parlour bleaching.": "Asked about creams and salon bleaching.",
  "Steroid damage from unsupervised triple-combination or 'fairness' creams — atrophy, telangiectasia, rosacea": "Steroid damage from unsupervised triple-combination or 'skin-lightening' creams — atrophy, telangiectasia, rosacea",
  "Bleach, fairness creams, parlour facials": "Bleach, skin-lightening creams, salon facials",
  "Stop fairness creams & parlour bleach": "Stop skin-lightening creams & salon bleaching",
  "Sunscreen alone is not enough for 1.5 hours a day on a two-wheeler.": "Sunscreen alone is not enough for 1.5 hours a day in the sun.",
});

const TINEA = both({
  "A 28-year-old sales executive has come to Dermatology OPD in the lunch hour. He keeps scratching his waist.": "A 28-year-old sales rep has come to the dermatology clinic in his lunch hour. He keeps scratching his waist.",
  "No sugar, no other illness. It happened once last year too, milder.": "No diabetes, no other illness. It happened once last year too, milder.",
  "Species — T. indotineae is now dominant in India and often terbinafine-resistant.": "Species — T. indotineae is now spreading worldwide and is often terbinafine-resistant.",
  "Terbinafine resistance (SQLE mutations in T. indotineae) is now common in India; failure rates are high in extensive disease.": "Terbinafine resistance (SQLE mutations in T. indotineae) is rising worldwide; failure rates are high in extensive disease.",
  "Both are less effective than itraconazole for extensive tinea corporis/cruris in India today.": "Both are less effective than itraconazole for extensive, resistant tinea corporis/cruris.",
  "Steroids suppress local immunity, let the fungus spread and modify its appearance (tinea incognito) — the main driver of India's dermatophytosis epidemic.": "Steroids suppress local immunity, let the fungus spread and modify its appearance (tinea incognito) — a major driver of resistant, extensive dermatophytosis.",
  "Okay — cotton, separate towels, and I'll iron the innerwear.": "Okay — cotton, separate towels, and I'll hot-wash my underwear.",
  "Chose itraconazole — the most reliable systemic agent against Indian dermatophytes today.": "Chose itraconazole — the most reliable systemic agent against resistant dermatophytes today.",
  "Concentrates in skin and sebum and stays there for weeks; remains active against most Indian T. indotineae strains.": "Concentrates in skin and sebum and stays there for weeks; remains active against most T. indotineae strains.",
  "Dry in the sun, then iron innerwear": "Hot-wash and tumble-dry or iron underwear",
  "In India today, a ring that keeps coming back is rarely just “resistant fungus.” Look for the steroid cream, the itching wife, the sweaty jeans and the toe webs — treat the person, the household and the reservoir, and continue for two weeks after the skin looks clear.": "A ring that keeps coming back is rarely just “resistant fungus.” Look for the steroid cream, the itching partner, the sweaty jeans and the toe webs — treat the person, the household and the reservoir, and continue for two weeks after the skin looks clear.",
});

const PSORIASIS = both({
  "No sugar or BP that I know of. No liver problem, no jaundice, no TB.": "No diabetes or blood pressure that I know of. No liver problems, no jaundice, no TB.",
  "Customers stare at my elbows. I've stopped wearing half sleeves.": "Customers stare at my elbows. I've stopped wearing short sleeves.",
});

const PAD = both({
  "Claudication without rest pain or tissue loss is managed in the OPD.": "Claudication without rest pain or tissue loss is managed as an outpatient.",
  "Yes. I have type 2 diabetes — for six years now. Two years ago a doctor said my BP was high, but I never started tablets for it.": "Yes. I have type 2 diabetes — for six years now. Two years ago a doctor said my blood pressure was high, but I never started anything for it.",
});

const DENGUE = both({
  "Dengue kills in the critical phase — usually day 3 to 7, just as the fever falls. The fever coming down is not good news until the haematocrit, the pulse pressure and the urine output say so. Paracetamol only — and always ask what the chemist already gave.": "Dengue kills in the critical phase — usually day 3 to 7, just as the fever falls. The fever coming down is not good news until the haematocrit, the pulse pressure and the urine output say so. Paracetamol only — and always ask what painkillers have already been taken.",
  "Ask about every tablet, especially from the chemist, and stop NSAIDs.": "Ask about every tablet, especially over-the-counter painkillers, and stop NSAIDs.",
  "Stopped the NSAID he had been given by the chemist.": "Stopped the NSAID he had been taking.",
});

const APPENDIX = both({
  "Pain that begins around the umbilicus and settles in the right iliac fossa, followed by vomiting and anorexia, is appendicitis until proven otherwise. And allergies are not a formality in surgical patients: the reflex pre-op antibiotic in many Indian ERs — piperacillin–tazobactam — is a penicillin.": "Pain that begins around the umbilicus and settles in the right iliac fossa, followed by vomiting and anorexia, is appendicitis until proven otherwise. And allergies are not a formality in surgical patients: the reflex pre-op antibiotic in many emergency departments — piperacillin–tazobactam — is a penicillin.",
});

const ADHF = both({
  "She had a heart attack four years ago — they put a stent. She has sugar and BP too.": "She had a heart attack four years ago — they put a stent in. She has diabetes and high blood pressure too.",
});

const ACS = both({
  "He has BP and sugar for eight years. Never any heart problem before.": "He's had high blood pressure and diabetes for eight years. Never any heart problem before.",
  "He smokes about ten bidis a day. He doesn't drink.": "He smokes about ten cigarettes a day. He doesn't drink.",
  "Before any nitrate, ask directly about sildenafil or tadalafil (Manforce, Penegra, Tadacip) in the last 24–48 hours.": "Before any nitrate, ask directly about sildenafil or tadalafil (Viagra, Cialis) in the last 24–48 hours.",
  "Chewed aspirin reduces MI mortality by about a quarter and is in most Indian homes.": "Chewed aspirin reduces MI mortality by about a quarter and is in most homes.",
  "4 km from district hospital (cath lab); car available": "3 miles from a hospital with a cath lab; car available",
});

const SLE = both({
  "Before high-dose steroids and immunosuppression in India.": "Before high-dose steroids and immunosuppression.",
});

const AIP = both({});

const TUT = both({
  "He has had sugar for twelve years, and BP. No heart problem that we know of.": "He's had diabetes for twelve years, and high blood pressure. No heart problems that we know of.",
  "Taking the sugar tablet and skipping the meal": "Taking the diabetes tablet and skipping the meal",
});

export const CASE_LOCALES: Record<string, Record<Abroad, CaseLocale>> = {
  "derm-acne-moderate-01": {
    US: {
      patient: { name: "Jasmine", city: "Atlanta, Georgia", occupation: "Business student at Georgia State", context: "Dermatology clinic" },
      lines: {
        ...ACNE,
        "A 19-year-old college student is waiting in Dermatology OPD, room 3.": "A 19-year-old college student is waiting in the dermatology clinic, room 3.",
        "I've tried lots of face washes. For the last two months I've been putting on a cream at night that the chemist gave me — Betnovate-something. At first it seemed to calm things down, but now it's worse than before. No tablets.": "I've tried lots of face washes. For the last two months I've been putting on a steroid cream at night that my roommate gave me — betamethasone-something. At first it seemed to calm things down, but now it's worse than before. No pills.",
        "Mostly home food. But I have three or four cups of milk tea a day, and sweets quite often. Junk food with friends sometimes.": "Mostly home cooking. But I drink three or four glasses of milk a day, and have sweets quite often. Fast food with friends sometimes.",
        "High glycaemic load; milk tea 3–4 cups/day": "High glycaemic load; milk 3–4 glasses/day",
        "Okay. I'll cut down the tea and sweets.": "Okay. I'll cut down the milk and sweets.",
      },
    },
    UK: {
      patient: { name: "Aisha", city: "Leicester", occupation: "Business student at De Montfort University", context: "Dermatology clinic" },
      lines: {
        ...ACNE,
        "A 19-year-old college student is waiting in Dermatology OPD, room 3.": "A 19-year-old university student is waiting in the dermatology clinic, room 3.",
        "I've tried lots of face washes. For the last two months I've been putting on a cream at night that the chemist gave me — Betnovate-something. At first it seemed to calm things down, but now it's worse than before. No tablets.": "I've tried loads of face washes. For the last two months I've been putting on a cream at night that my flatmate gave me — Betnovate-something. At first it seemed to calm things down, but now it's worse than before. No tablets.",
        "Mostly home food. But I have three or four cups of milk tea a day, and sweets quite often. Junk food with friends sometimes.": "Mostly home cooking. But I have three or four milky teas a day, and sweets quite often. Takeaways with friends sometimes.",
        "High glycaemic load; milk tea 3–4 cups/day": "High glycaemic load; milky tea 3–4 cups/day",
      },
    },
  },

  "derm-melasma-01": {
    US: {
      patient: { name: "Maria", city: "San Antonio, Texas", occupation: "Schoolteacher", context: "Dermatology clinic" },
      lines: {
        ...MELASMA,
        "I ride my scooty to school — about forty minutes each way — and I do bus duty in the afternoon. I don't use sunscreen. I just cover with my dupatta sometimes.": "I drive to school with the window down — about forty minutes each way — and I do recess and bus duty outside in the afternoon. I don't use sunscreen. I just wear a cap sometimes.",
        "~1.5 h daily sun exposure on a two-wheeler; no sunscreen": "~1.5 h daily sun exposure (commute, outdoor duty); no sunscreen",
        "I'll wear a full-face helmet on the scooty and reapply at lunch.": "I'll wear a wide-brimmed hat on duty and reapply at lunch.",
        "UV and visible light drive melasma; a daily scooter commute without protection explains both the onset and the summer flare.": "UV and visible light drive melasma; a daily commute and outdoor duty without protection explain both the onset and the summer flare.",
        "Reapply every 2–3 h outdoors; full-face helmet or scarf on the scooter": "Reapply every 2–3 h outdoors; a wide-brimmed hat on outdoor duty",
        "Symmetric facial darkening for 8–9 months, worse after summer; daily two-wheeler sun exposure without sunscreen; began months after starting the OCP; mother affected. Asymptomatic.": "Symmetric facial darkening for 8–9 months, worse after summer; daily sun exposure (commute, outdoor duty) without sunscreen; began months after starting the OCP; mother affected. Asymptomatic.",
      },
    },
    UK: {
      patient: { name: "Priya", city: "Birmingham", occupation: "Primary school teacher", context: "Dermatology clinic" },
      lines: {
        ...MELASMA,
        "I ride my scooty to school — about forty minutes each way — and I do bus duty in the afternoon. I don't use sunscreen. I just cover with my dupatta sometimes.": "I cycle to school — about forty minutes each way — and I do playground duty in the afternoon. I don't use sunscreen. I just wear a scarf sometimes.",
        "~1.5 h daily sun exposure on a two-wheeler; no sunscreen": "~1.5 h daily sun exposure (cycling, playground duty); no sunscreen",
        "I'll wear a full-face helmet on the scooty and reapply at lunch.": "I'll wear a hat on playground duty and reapply at lunch.",
        "UV and visible light drive melasma; a daily scooter commute without protection explains both the onset and the summer flare.": "UV and visible light drive melasma; a daily cycle commute and playground duty without protection explain both the onset and the summer flare.",
        "Reapply every 2–3 h outdoors; full-face helmet or scarf on the scooter": "Reapply every 2–3 h outdoors; a hat or shade on playground duty",
        "Symmetric facial darkening for 8–9 months, worse after summer; daily two-wheeler sun exposure without sunscreen; began months after starting the OCP; mother affected. Asymptomatic.": "Symmetric facial darkening for 8–9 months, worse after summer; daily sun exposure cycling and on playground duty without sunscreen; began months after starting the OCP; mother affected. Asymptomatic.",
      },
    },
  },

  "derm-tinea-01": {
    US: {
      patient: { name: "Marcus", city: "Houston, Texas", occupation: "Field sales rep", context: "Dermatology clinic" },
      lines: {
        ...TINEA,
        "It started in the groin during the monsoon, then went to the belt area, my buttocks and inner thighs. Each time a ring heals in the middle, it grows at the edge.": "It started in the groin over the summer — it was so humid — then went to the belt area, my buttocks and inner thighs. Each time a ring heals in the middle, it grows at the edge.",
        "The chemist gave me Panderm Plus — I've put it twice a day for two months. It settles in a few days, then the rings come back bigger. A local doctor gave me one white tablet a week for three weeks last year.": "An urgent care gave me Lotrisone — I've put it on twice a day for two months. It settles in a few days, then the rings come back bigger. Last year a doctor gave me one white pill a week for three weeks.",
        "Steroid–antifungal–antibiotic FDC (Panderm Plus) BD × 2 months; brief relief then worse; fluconazole weekly ×3 last year": "Steroid–antifungal cream (Lotrisone: clotrimazole + betamethasone) BD × 2 months; brief relief then worse; fluconazole weekly ×3 last year",
        "I wear jeans all day for work and synthetic innerwear. We share towels at home. I bathe once a day, at night.": "I wear jeans all day for work and synthetic underwear. We share towels at home. I shower once a day, at night.",
        "Tight jeans, synthetic innerwear; shared towels; bathes once daily": "Tight jeans, synthetic underwear; shared towels; showers once daily",
        "Always ask about chemist creams — and ask to see the tube.": "Always ask about steroid combination creams — and ask to see the tube.",
      },
    },
    UK: {
      patient: { name: "Imran", city: "Bradford", occupation: "Field sales rep", context: "Dermatology clinic" },
      lines: {
        ...TINEA,
        "It started in the groin during the monsoon, then went to the belt area, my buttocks and inner thighs. Each time a ring heals in the middle, it grows at the edge.": "It started in the groin after a family trip to Pakistan in the summer, then went to the belt area, my buttocks and inner thighs. Each time a ring heals in the middle, it grows at the edge.",
        "The chemist gave me Panderm Plus — I've put it twice a day for two months. It settles in a few days, then the rings come back bigger. A local doctor gave me one white tablet a week for three weeks last year.": "The chemist gave me Canesten HC — I've put it on twice a day for two months. It settles in a few days, then the rings come back bigger. Last year a doctor gave me one white tablet a week for three weeks.",
        "Steroid–antifungal–antibiotic FDC (Panderm Plus) BD × 2 months; brief relief then worse; fluconazole weekly ×3 last year": "Steroid–antifungal cream (Canesten HC: clotrimazole + hydrocortisone) BD × 2 months; brief relief then worse; fluconazole weekly ×3 last year",
        "I wear jeans all day for work and synthetic innerwear. We share towels at home. I bathe once a day, at night.": "I wear jeans all day for work and synthetic underwear. We share towels at home. I shower once a day, at night.",
        "Tight jeans, synthetic innerwear; shared towels; bathes once daily": "Tight jeans, synthetic underwear; shared towels; showers once daily",
      },
    },
  },

  "derm-psoriasis-01": {
    US: {
      patient: { name: "Mike", city: "Columbus, Ohio", occupation: "Runs a hardware store", context: "Dermatology clinic" },
      lines: {
        ...PSORIASIS,
        "A 41-year-old shopkeeper is waiting in Dermatology OPD. He has rolled up his trouser legs.": "A 41-year-old store owner is waiting in the dermatology clinic. He has rolled up his pant legs.",
        "I smoke about ten cigarettes a day. Drinks only at weddings, maybe twice a month.": "I smoke about ten cigarettes a day. Only socially — a couple of beers, maybe twice a month.",
        "About three years. They get much worse every winter and with stress at the shop. Summer is a little better.": "About three years. They get much worse every winter and with stress at the store. Summer is a little better.",
        "A local doctor gave me two injections last year — the patches vanished in a week, but a month later they came back worse than ever, all over my body. Now I only use coconut oil.": "An urgent care doctor gave me two steroid shots last year — the patches vanished in a week, but a month later they came back worse than ever, all over my body. Now I just use coconut oil.",
      },
    },
    UK: {
      patient: { name: "Gareth", city: "Cardiff", occupation: "Runs a hardware shop", context: "Dermatology clinic" },
      lines: {
        ...PSORIASIS,
        "A 41-year-old shopkeeper is waiting in Dermatology OPD. He has rolled up his trouser legs.": "A 41-year-old shopkeeper is waiting in the dermatology clinic. He has rolled up his trouser legs.",
        "I smoke about ten cigarettes a day. Drinks only at weddings, maybe twice a month.": "I smoke about ten cigarettes a day. Only socially — a couple of pints, maybe twice a month.",
        "A local doctor gave me two injections last year — the patches vanished in a week, but a month later they came back worse than ever, all over my body. Now I only use coconut oil.": "A private clinic gave me two steroid injections last year — the patches vanished in a week, but a month later they came back worse than ever, all over my body. Now I just use coconut oil.",
      },
    },
  },

  "med-pad-leriche-01": {
    US: {
      patient: { name: "Steve", city: "Pittsburgh, Pennsylvania", occupation: "Accounts manager at a private firm", context: "Internal medicine clinic" },
      lines: {
        ...PAD,
        "A 47-year-old man has come to the Medicine OPD. His wife waits outside.": "A 47-year-old man has come to the internal medicine clinic. His wife waits outside.",
        "I think I've lost two or three kilos without trying. Appetite is fine.": "I think I've lost five or six pounds without trying. Appetite is fine.",
        "A year ago I'd walk to the market and back — about a kilometre — without any problem. Now I have to stop after about two hundred metres. Stairs are worse.": "A year ago I'd walk to the store and back — over half a mile — without any problem. Now I have to stop after a couple of blocks. Stairs are worse.",
        "Metformin 500, twice a day — though honestly I miss the evening one quite often. And the small tablet for chest heaviness — Sorbitrate. I keep it in my wallet. I've used it twice in the last three months.": "Metformin 500, twice a day — though honestly I miss the evening one quite often. And the little pill for chest tightness — nitroglycerin. I keep it in my wallet. I've used it twice in the last three months.",
        "Sometimes when I climb stairs quickly, I get a heaviness in the middle of my chest. It goes away when I stop. Twice I put the tablet under my tongue that our local doctor gave me.": "Sometimes when I climb stairs quickly, I get a tightness in the middle of my chest. It goes away when I stop. Twice I put one of the little pills under my tongue that my doctor gave me.",
        "Two pegs on weekends, sometimes.": "A couple of whiskeys on weekends, sometimes.",
        "Parathas in the morning, rice and dal, a sweet after dinner. I eat out a lot for work.": "Bagels or a breakfast sandwich in the morning, a big lunch, dessert after dinner. I eat out a lot for work.",
        "My sugar readings are much better, doctor. I'm down to two cigarettes a day with the gum, and I'm trying to stop completely. I walk every morning — I can manage about 400 metres now before I need to stop.": "My sugar readings are much better, doctor. I'm down to two cigarettes a day with the gum, and I'm trying to stop completely. I walk every morning — I can manage about four blocks now before I need to stop.",
        "The sugar is a little better. The leg pain is about the same — I still stop after a couple of hundred metres.": "The sugar is a little better. The leg pain is about the same — I still stop after a couple of blocks.",
        "Honestly, doctor, it's worse. Now I have to stop after a hundred metres. And the chest heaviness came again last week.": "Honestly, doctor, it's worse. Now I have to stop after one block. And the chest tightness came again last week.",
        "He asked for a tablet for erections, and he keeps Sorbitrate in his wallet. Sildenafil or tadalafil with any nitrate causes profound, prolonged hypotension — collapse at home, myocardial ischaemia, even death.": "He asked for a pill for erections, and he keeps nitroglycerin in his wallet. Sildenafil or tadalafil with any nitrate causes profound, prolonged hypotension — collapse at home, myocardial ischaemia, even death.",
        "Claudication distance ~200 m (was > 1 km a year ago)": "Claudication distance ~2 blocks (was > half a mile a year ago)",
      },
    },
    UK: {
      patient: { name: "Paul", city: "Nottingham", occupation: "Accounts manager at a private firm", context: "Medical outpatient clinic" },
      lines: {
        ...PAD,
        "A 47-year-old man has come to the Medicine OPD. His wife waits outside.": "A 47-year-old man has come to the medical outpatient clinic. His wife waits outside.",
        "I think I've lost two or three kilos without trying. Appetite is fine.": "I think I've lost about half a stone without trying. Appetite is fine.",
        "A year ago I'd walk to the market and back — about a kilometre — without any problem. Now I have to stop after about two hundred metres. Stairs are worse.": "A year ago I'd walk to the shops and back — over half a mile — without any problem. Now I have to stop after a couple of hundred yards. Stairs are worse.",
        "Metformin 500, twice a day — though honestly I miss the evening one quite often. And the small tablet for chest heaviness — Sorbitrate. I keep it in my wallet. I've used it twice in the last three months.": "Metformin 500, twice a day — though honestly I miss the evening one quite often. And the spray for chest tightness — GTN. I keep it in my jacket. I've used it twice in the last three months.",
        "Sometimes when I climb stairs quickly, I get a heaviness in the middle of my chest. It goes away when I stop. Twice I put the tablet under my tongue that our local doctor gave me.": "Sometimes when I climb stairs quickly, I get a tightness in the middle of my chest. It goes away when I stop. Twice I used the spray under my tongue that my GP gave me.",
        "Two pegs on weekends, sometimes.": "A couple of whiskies at the weekend, sometimes.",
        "Parathas in the morning, rice and dal, a sweet after dinner. I eat out a lot for work.": "A fry-up or toast in the morning, a meal deal at lunch, pudding after dinner. I eat out a lot for work.",
        "My sugar readings are much better, doctor. I'm down to two cigarettes a day with the gum, and I'm trying to stop completely. I walk every morning — I can manage about 400 metres now before I need to stop.": "My sugar readings are much better, doctor. I'm down to two cigarettes a day with the gum, and I'm trying to stop completely. I walk every morning — I can manage about four hundred yards now before I need to stop.",
        "The sugar is a little better. The leg pain is about the same — I still stop after a couple of hundred metres.": "The sugar is a little better. The leg pain is about the same — I still stop after a couple of hundred yards.",
        "Honestly, doctor, it's worse. Now I have to stop after a hundred metres. And the chest heaviness came again last week.": "Honestly, doctor, it's worse. Now I have to stop after a hundred yards. And the chest tightness came again last week.",
        "He asked for a tablet for erections, and he keeps Sorbitrate in his wallet. Sildenafil or tadalafil with any nitrate causes profound, prolonged hypotension — collapse at home, myocardial ischaemia, even death.": "He asked for a tablet for erections, and he carries a GTN spray. Sildenafil or tadalafil with any nitrate causes profound, prolonged hypotension — collapse at home, myocardial ischaemia, even death.",
        "Claudication distance ~200 m (was > 1 km a year ago)": "Claudication distance ~200 yards (was > half a mile a year ago)",
      },
    },
  },

  "id-dengue-01": {
    US: {
      patient: { name: "Ethan", city: "Miami, Florida", occupation: "Graduate student", context: "Urgent care" },
      lines: {
        ...DENGUE,
        "October, 19:30. A 26-year-old student has come to the evening fever clinic with his roommate.": "October, 19:30. A 26-year-old graduate student has come to urgent care with his roommate.",
        "Dolo 650, three times a day. Yesterday the chemist also gave me Combiflam for the body ache — I took two.": "Tylenol, three times a day. Yesterday my roommate also gave me some Advil for the body aches — I took two.",
        "Paracetamol 650 TDS; Combiflam (ibuprofen + paracetamol) ×2 yesterday": "Acetaminophen 650 mg TDS; Advil (ibuprofen) ×2 yesterday",
        "Two boys in my PG have dengue. There are a lot of mosquitoes this season.": "I got back from Puerto Rico a week ago — two of the friends I travelled with got dengue there. There were mosquitoes everywhere.",
        "Dengue cases in his PG; no travel": "Returned from Puerto Rico 7 days ago; two travel companions had dengue",
        "Four days of high fever with myalgia and retro-orbital pain in October, cases in his PG; fever settling while he worsens — abdominal pain, persistent vomiting, gum bleeding, oliguria, lethargy; took Combiflam.": "Four days of high fever with myalgia and retro-orbital pain, a week after returning from Puerto Rico where companions had dengue; fever settling while he worsens — abdominal pain, persistent vomiting, gum bleeding, oliguria, lethargy; took ibuprofen.",
        "He had taken Combiflam (ibuprofen) — an NSAID with a falling platelet count.": "He had taken Advil (ibuprofen) — an NSAID with a falling platelet count.",
        "No Combiflam, ibuprofen, diclofenac or aspirin": "No Advil, Motrin (ibuprofen), naproxen or aspirin",
        "He couldn't even stand in the queue, doctor. He was dizzy when he got up from the bed.": "He couldn't even stand in line, doctor. He was dizzy when he got up from the bed.",
        "ORS, coconut water, juices, soups": "Oral rehydration solution, juices, broths",
      },
    },
    UK: {
      patient: { name: "Tom", city: "London", occupation: "Postgraduate student", context: "Urgent treatment centre" },
      lines: {
        ...DENGUE,
        "October, 19:30. A 26-year-old student has come to the evening fever clinic with his roommate.": "October, 19:30. A 26-year-old student has come to the urgent treatment centre with his flatmate.",
        "High fever, 103–104, with chills since Friday. Since this morning it has come down — but I feel worse, not better.": "High fever, 39 to 40 degrees, with chills since Friday. Since this morning it has come down — but I feel worse, not better.",
        "Dolo 650, three times a day. Yesterday the chemist also gave me Combiflam for the body ache — I took two.": "Paracetamol, three times a day. Yesterday I also took some ibuprofen from the chemist for the body aches — two tablets.",
        "Paracetamol 650 TDS; Combiflam (ibuprofen + paracetamol) ×2 yesterday": "Paracetamol 1 g TDS; ibuprofen 400 mg ×2 yesterday",
        "Two boys in my PG have dengue. There are a lot of mosquitoes this season.": "I flew back from Thailand a week ago — two of the friends I travelled with got dengue there. There were mosquitoes everywhere.",
        "Dengue cases in his PG; no travel": "Returned from Thailand 7 days ago; two travel companions had dengue",
        "Four days of high fever with myalgia and retro-orbital pain in October, cases in his PG; fever settling while he worsens — abdominal pain, persistent vomiting, gum bleeding, oliguria, lethargy; took Combiflam.": "Four days of high fever with myalgia and retro-orbital pain, a week after returning from Thailand where companions had dengue; fever settling while he worsens — abdominal pain, persistent vomiting, gum bleeding, oliguria, lethargy; took ibuprofen.",
        "He had taken Combiflam (ibuprofen) — an NSAID with a falling platelet count.": "He had taken ibuprofen — an NSAID with a falling platelet count.",
        "No Combiflam, ibuprofen, diclofenac or aspirin": "No ibuprofen (Nurofen), naproxen, diclofenac or aspirin",
        "ORS, coconut water, juices, soups": "Oral rehydration salts (Dioralyte), juices, soups",
      },
    },
  },

  "surg-appendicitis-01": {
    US: {
      patient: { name: "Tyler", city: "Phoenix, Arizona", occupation: "Delivery driver" },
      lines: {
        ...APPENDIX,
        "Moving makes it worse. Every bump in the auto on the way here hurt. Lying still with my knees up helps a little.": "Moving makes it worse. Every bump in the car on the way here hurt. Lying still with my knees up helps a little.",
        "I passed stool once this morning — normal. No loose motions.": "I had a bowel movement this morning — normal. No diarrhoea.",
        "I took one Meftal Spas from the chemist at noon. It didn't help much.": "I took two Advil at noon. It didn't help much.",
        "I haven't eaten anything since last night. Not hungry at all. The last thing I had was a cup of tea at six this morning.": "I haven't eaten anything since last night. Not hungry at all. The last thing I had was a cup of coffee at six this morning.",
        "Anorexia; last intake tea at 06:00": "Anorexia; last intake coffee at 06:00",
      },
    },
    UK: {
      patient: { name: "Jake", city: "Manchester", occupation: "Delivery rider" },
      lines: {
        ...APPENDIX,
        "Moving makes it worse. Every bump in the auto on the way here hurt. Lying still with my knees up helps a little.": "Moving makes it worse. Every bump in the taxi on the way here hurt. Lying still with my knees up helps a little.",
        "I passed stool once this morning — normal. No loose motions.": "I went to the loo once this morning — normal. No diarrhoea.",
        "I took one Meftal Spas from the chemist at noon. It didn't help much.": "I took a Buscopan from the chemist at noon. It didn't help much.",
      },
    },
  },

  "em-adhf-01": {
    US: {
      patient: { name: "Dolores", city: "Toledo, Ohio", occupation: "Retired school cook" },
      lines: {
        ...ADHF,
        "Ecosprin, a sugar tablet, Metolar for BP, a cholesterol tablet — and the water tablet, Lasix. The Lasix finished five days ago and we didn't get it refilled.": "A baby aspirin, a diabetes pill, metoprolol for her blood pressure, a cholesterol pill — and the water pill, Lasix. The Lasix ran out five days ago and we didn't get it refilled.",
        "There was a wedding in the family — for three days she ate pickles, namkeen, papad, everything.": "There was a family wedding — for three days she ate ham, chips, pickles, everything.",
        "No pickles, papad, namkeen, packaged food": "No chips, deli meats, canned soup or packaged food",
        "NSAIDs (Combiflam, diclofenac)": "NSAIDs (Advil, Aleve)",
        "I can walk to the market again, doctor, and I sleep with one pillow. I weigh myself every morning like you said.": "I can walk to the store again, doctor, and I sleep with one pillow. I weigh myself every morning like you said.",
        "Take the water tablet in the morning": "Take the water pill in the morning",
        "In a breathless elderly patient, the most dangerous reflex in an Indian ER is “start NS.” Look at the neck veins and listen to the lung bases before you hang a bag. She needed less water, not more — and the precipitant (AF, salt, the furosemide that ran out) needs as much attention as the oedema.": "In a breathless elderly patient, the most dangerous reflex in a busy ER is “start a saline bolus.” Look at the neck veins and listen to the lung bases before you hang a bag. She needed less water, not more — and the precipitant (AF, salt, the furosemide that ran out) needs as much attention as the oedema.",
      },
    },
    UK: {
      patient: { name: "Margaret", city: "Sheffield", occupation: "Retired dinner lady" },
      lines: {
        ...ADHF,
        "Ecosprin, a sugar tablet, Metolar for BP, a cholesterol tablet — and the water tablet, Lasix. The Lasix finished five days ago and we didn't get it refilled.": "Aspirin, a diabetes tablet, metoprolol for her blood pressure, a statin — and the water tablet, furosemide. The furosemide ran out five days ago and we didn't get the repeat prescription.",
        "There was a wedding in the family — for three days she ate pickles, namkeen, papad, everything.": "There was a family wedding — for three days she ate crisps, bacon, takeaways, everything.",
        "No pickles, papad, namkeen, packaged food": "No crisps, bacon, ready meals or packaged food",
        "NSAIDs (Combiflam, diclofenac)": "NSAIDs (ibuprofen, diclofenac)",
        "I can walk to the market again, doctor, and I sleep with one pillow. I weigh myself every morning like you said.": "I can walk to the shops again, doctor, and I sleep with one pillow. I weigh myself every morning like you said.",
        "In a breathless elderly patient, the most dangerous reflex in an Indian ER is “start NS.” Look at the neck veins and listen to the lung bases before you hang a bag. She needed less water, not more — and the precipitant (AF, salt, the furosemide that ran out) needs as much attention as the oedema.": "In a breathless elderly patient, the most dangerous reflex in a busy A&E is “start a bag of saline.” Look at the neck veins and listen to the lung bases before you hang a bag. She needed less water, not more — and the precipitant (AF, salt, the furosemide that ran out) needs as much attention as the oedema.",
      },
    },
  },

  "ph-acs-01": {
    US: {
      patient: { name: "Robert", city: "Dayton, Ohio", occupation: "Owns a fabric store" },
      lines: {
        ...ACS,
        "He just told me — for two weeks he's had a little tightness climbing to the shop's upper floor. It went off with rest, so he didn't say anything.": "He just told me — for two weeks he's had a little tightness climbing to the store's upper floor. It went away with rest, so he didn't say anything.",
        "(The father, quietly.) Telma for BP, a sugar tablet… and — this evening I took one Manforce tablet. Around eight o'clock.": "(The father, quietly.) Micardis for blood pressure, a diabetes pill… and — this evening I took one Viagra. Around eight o'clock.",
        "Smoker — 10 bidis/day": "Smoker — 10 cigarettes/day",
        "We're in Talwandi, Kota. The district hospital is about 4 km — they have a heart unit now. A private heart hospital is 6 km. We have a car.": "We're on the south side of Dayton. The county hospital is about 3 miles away — they have a heart unit. A bigger heart hospital is 6 miles. We have a car.",
        "We have Disprin and Dolo in the medicine box — and my uncle's Sorbitrate tablets.": "We have aspirin and Tylenol in the medicine cabinet — and my uncle's nitroglycerin pills.",
        "At home: Disprin (aspirin 350 mg), paracetamol, Sorbitrate": "At home: aspirin 325 mg, acetaminophen, nitroglycerin (his brother's)",
        "The ambulance is here. They've put stickers on his chest and oxygen — they say the ECG shows a heart attack and they're taking him straight to the district hospital's cath lab.": "The paramedics are here. They've put stickers on his chest and oxygen — they say the EKG shows a heart attack and they're taking him straight to the cath lab.",
        "They gave him a clot-dissolving injection at the district hospital and did the angiography this morning. They said part of his heart is weak.": "They opened the artery with a stent in the cath lab last night. They said part of his heart is weak.",
        "Chew one Disprin or 325 mg aspirin now, unless allergic.": "Chew one regular-strength aspirin (325 mg) — or four 81 mg — now, unless allergic.",
        "Same-day emergency assessment — not 'OPD tomorrow'": "Same-day emergency assessment — not 'see your doctor tomorrow'",
        "300–350 mg (one Disprin), chewed": "325 mg (one regular aspirin, or four 81 mg), chewed",
        "Chew one Disprin (aspirin 325–350 mg)": "Chew one regular-strength aspirin (325 mg)",
        "Painkillers like Combiflam or diclofenac": "Painkillers like Advil or Aleve",
      },
    },
    UK: {
      patient: { name: "David", city: "Stoke-on-Trent", occupation: "Runs a fabric shop" },
      lines: {
        ...ACS,
        "(The father, quietly.) Telma for BP, a sugar tablet… and — this evening I took one Manforce tablet. Around eight o'clock.": "(The father, quietly.) Telmisartan for blood pressure, a diabetes tablet… and — this evening I took one Viagra. Around eight o'clock.",
        "Smoker — 10 bidis/day": "Smoker — 10 cigarettes/day",
        "We're in Talwandi, Kota. The district hospital is about 4 km — they have a heart unit now. A private heart hospital is 6 km. We have a car.": "We're in Hanley, in Stoke. The main hospital is about 3 miles away — it has a heart attack centre. We have a car.",
        "We have Disprin and Dolo in the medicine box — and my uncle's Sorbitrate tablets.": "We have Disprin and paracetamol in the medicine cupboard — and my uncle's GTN spray.",
        "At home: Disprin (aspirin 350 mg), paracetamol, Sorbitrate": "At home: Disprin (aspirin 300 mg), paracetamol, GTN spray (his brother's)",
        "The ambulance is here. They've put stickers on his chest and oxygen — they say the ECG shows a heart attack and they're taking him straight to the district hospital's cath lab.": "The ambulance is here. They've put stickers on his chest and oxygen — they say the ECG shows a heart attack and they're taking him straight to the heart attack centre.",
        "Doctor — he put the Sorbitrate under his tongue and now he's gone completely white. He says everything is going dark… he's sliding off the sofa!": "Doctor — he sprayed the GTN under his tongue and now he's gone completely white. He says everything is going dark… he's sliding off the sofa!",
        "They gave him a clot-dissolving injection at the district hospital and did the angiography this morning. They said part of his heart is weak.": "They put a stent in at the heart attack centre last night. They said part of his heart is weak.",
        "Chew one Disprin or 325 mg aspirin now, unless allergic.": "Chew one Disprin or 300 mg aspirin now, unless allergic.",
        "Same-day emergency assessment — not 'OPD tomorrow'": "Same-day emergency assessment — not 'see your GP tomorrow'",
        "300–350 mg (one Disprin), chewed": "300 mg (one Disprin), chewed",
        "Chew one Disprin (aspirin 325–350 mg)": "Chew one Disprin (aspirin 300 mg)",
        "Painkillers like Combiflam or diclofenac": "Painkillers like ibuprofen or diclofenac",
      },
    },
  },

  "med-sle-apex-01": {
    US: {
      patient: { name: "Aaliyah", city: "Hagerstown, Maryland", occupation: "Master's student", context: "Clinic" },
      lines: {
        ...SLE,
        "11:20. Medicine OPD at a national referral institute. A 24-year-old woman referred from Lucknow with 'fever not settling', carrying a thick file of reports.": "11:20. Internal medicine clinic at a national referral center. A 24-year-old woman referred from Hagerstown with 'fever not settling', carrying a thick folder of reports.",
        "My cheeks went red after a wedding in the sun — I thought it was tanning and went to the parlour. Sunlight makes it worse.": "My cheeks went red after a day at the beach — I thought it was sunburn. Sunlight makes it worse.",
        "I've lost about four kilos. I'm tired all the time.": "I've lost about nine pounds. I'm tired all the time.",
        "Azee, then Taxim-O, then five days of injections — Monocef. Dolo for the fever and Combiflam for the joints, two or three a day.": "A Z-Pak, then Augmentin, then five days of shots — Rocephin. Tylenol for the fever and Advil for the joints, two or three a day.",
        "Three antibiotic courses; daily ibuprofen–paracetamol (Combiflam)": "Three antibiotic courses; daily ibuprofen (Advil) and acetaminophen",
        "Paracetamol for pain; steroids treat the arthritis. Stop Combiflam.": "Acetaminophen for pain; steroids treat the arthritis. Stop the Advil.",
        "Stop Combiflam / NSAIDs": "Stop Advil / NSAIDs",
        "I understand — no pregnancy until the doctors say the lupus is quiet. Can I have a copper-T?": "I understand — no pregnancy until the doctors say the lupus is quiet. Can I get a copper IUD?",
      },
      subs: [
        [/\bprednisolone\b/g, "prednisone"],
        [/\bPrednisolone\b/g, "Prednisone"],
      ],
    },
    UK: {
      patient: { name: "Zara", city: "Grimsby", occupation: "Master's student", context: "Clinic" },
      lines: {
        ...SLE,
        "11:20. Medicine OPD at a national referral institute. A 24-year-old woman referred from Lucknow with 'fever not settling', carrying a thick file of reports.": "11:20. Medical outpatients at a tertiary referral centre. A 24-year-old woman referred from Grimsby with 'fever not settling', carrying a thick file of letters and results.",
        "Fever for two months — usually in the evenings, 100 or 101. It goes with Dolo and comes back.": "Fever for two months — usually in the evenings, 38 or so. It goes with paracetamol and comes back.",
        "My cheeks went red after a wedding in the sun — I thought it was tanning and went to the parlour. Sunlight makes it worse.": "My cheeks went red after a wedding in the sun — I thought it was sunburn. Sunlight makes it worse.",
        "I've lost about four kilos. I'm tired all the time.": "I've lost over half a stone. I'm tired all the time.",
        "Azee, then Taxim-O, then five days of injections — Monocef. Dolo for the fever and Combiflam for the joints, two or three a day.": "Azithromycin, then co-amoxiclav, then five days of injections — ceftriaxone. Paracetamol for the fever and ibuprofen for the joints, two or three a day.",
        "Three antibiotic courses; daily ibuprofen–paracetamol (Combiflam)": "Three antibiotic courses; daily ibuprofen and paracetamol",
        "Paracetamol for pain; steroids treat the arthritis. Stop Combiflam.": "Paracetamol for pain; steroids treat the arthritis. Stop the ibuprofen.",
        "I understand — no pregnancy until the doctors say the lupus is quiet. Can I have a copper-T?": "I understand — no pregnancy until the doctors say the lupus is quiet. Can I have the copper coil?",
        "My joints are fine and the swelling has gone. I take every tablet, I wear sunscreen, and I got the copper-T.": "My joints are fine and the swelling has gone. I take every tablet, I wear sunscreen, and I had the coil fitted.",
      },
    },
  },

  "gr-aip-01": {
    US: {
      patient: { name: "Emily", city: "Seattle, Washington", occupation: "Software engineer" },
      lines: {
        ...AIP,
        "Terrible pain all over my tummy for three days — cramping, coming in waves. I keep vomiting, and I haven't passed stool for four days.": "Terrible pain all over my stomach for three days — cramping, coming in waves. I keep throwing up, and I haven't had a bowel movement in four days.",
        "drugs-porphyria.org / NAPOS — show it to every doctor and chemist": "drugs-porphyria.org (American Porphyria Foundation) — show it to every doctor and pharmacist",
        "IV haem arginate (Normosang)": "IV hemin (Panhematin)",
        "Haem arginate diluted in 100 mL of 20% albumin — running over 30 minutes through the large-bore cannula.": "Hemin reconstituted with 20% albumin — running over 30 minutes through the large-bore IV.",
        "Haem arginate 3 mg/kg (max 250 mg) IV daily × 4 days": "Hemin 3–4 mg/kg IV daily × 4 days",
        "Haem arginate 3 mg/kg IV daily for 4 days, started early.": "Hemin 3–4 mg/kg IV daily for 4 days, started early.",
        "Haem arginate 3 mg/kg × 4 days": "Hemin 3–4 mg/kg × 4 days",
        "3 mg/kg (max 250 mg) in 100 mL 20% albumin over 30 min": "3–4 mg/kg, reconstituted with 20% albumin, over 30 min",
      },
      subs: [
        [/\b[Hh]aem arginate\b/g, "hemin"],
        [/\bhaem\b(?! (?:demand|pool|synthesis|biosynthesis))/g, "hemin"],
        [/^hemin\b/, "Hemin"],
      ],
    },
    UK: {
      patient: { name: "Sophie", city: "Bristol", occupation: "Software engineer" },
      lines: {
        ...AIP,
        "Terrible pain all over my tummy for three days — cramping, coming in waves. I keep vomiting, and I haven't passed stool for four days.": "Terrible pain all over my tummy for three days — cramping, coming in waves. I keep being sick, and I haven't been to the toilet for four days.",
        "drugs-porphyria.org / NAPOS — show it to every doctor and chemist": "drugs-porphyria.org (NAPOS) — show it to every doctor and pharmacist",
      },
    },
  },

  "tut-hypoglycaemia-01": {
    US: {
      patient: { name: "Frank", city: "Cleveland, Ohio", occupation: "Retired postal clerk" },
      lines: {
        ...TUT,
        "IV 25% dextrose": "IV D50 (50% dextrose)",
        "25% dextrose going in through the IV line.": "D50 going in through the IV line.",
        "IV 25% dextrose (or IM glucagon); oral glucose only once he's fully awake and swallowing safely.": "IV D50 (or IM glucagon); oral glucose only once he's fully awake and swallowing safely.",
        "IV 25% dextrose 50–100 mL (or IM glucagon 1 mg)": "IV D50 25–50 mL (or IM glucagon 1 mg)",
        "IV 25% dextrose (50–100 mL) now; recheck the sugar in 15 minutes.": "IV D50 (25–50 mL) now; recheck the glucose in 15 minutes.",
        "IV 25% dextrose 50–100 mL": "IV D50 25–50 mL",
        "IV 25% dextrose 50–100 mL (or IM glucagon)": "IV D50 25–50 mL (or IM glucagon)",
        "Dextrose 25%": "Dextrose 50% (D50)",
        "50–100 mL (12.5–25 g)": "25–50 mL (12.5–25 g)",
        "Taking the sugar tablet and skipping the meal": "Taking the diabetes pill and skipping the meal",
      },
    },
    UK: {
      patient: { name: "Brian", city: "Leeds", occupation: "Retired council clerk" },
      lines: {
        ...TUT,
        "IV 25% dextrose": "IV 20% glucose",
        "25% dextrose going in through the IV line.": "20% glucose going in through the cannula.",
        "IV 25% dextrose (or IM glucagon); oral glucose only once he's fully awake and swallowing safely.": "IV 20% glucose (or IM glucagon); oral glucose only once he's fully awake and swallowing safely.",
        "IV 25% dextrose 50–100 mL (or IM glucagon 1 mg)": "IV 20% glucose 75–100 mL (or IM glucagon 1 mg)",
        "IV 25% dextrose (50–100 mL) now; recheck the sugar in 15 minutes.": "IV 20% glucose (75–100 mL) now; recheck the glucose in 15 minutes.",
        "IV 25% dextrose 50–100 mL": "IV 20% glucose 75–100 mL",
        "IV 25% dextrose 50–100 mL (or IM glucagon)": "IV 20% glucose 75–100 mL (or IM glucagon)",
        "Dextrose 25%": "Glucose 20%",
        "50–100 mL (12.5–25 g)": "75–100 mL (15–20 g)",
        "Stat; repeat if glucose < 70 at 15 min": "Stat; repeat if glucose < 4 mmol/L at 15 min",
        "Recheck in 15 minutes; repeat if still below 70": "Recheck in 15 minutes; repeat if still below 4 mmol/L",
        "Still below 70 mg/dL? Repeat step 2": "Still below 4 mmol/L? Repeat step 2",
        "10% dextrose infusion": "10% glucose infusion",
        "Started a 10% dextrose infusion — sulfonylurea lows come back for hours.": "Started a 10% glucose infusion — sulfonylurea lows come back for hours.",
      },
    },
  },
};
