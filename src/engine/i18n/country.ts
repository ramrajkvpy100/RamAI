/**
 * Country rendering — server-only.
 *
 *   localizeCase()   who the patient is and how they say it (US / UK content)
 *   presentState()   units, money, local names and US spelling on what the
 *   presentEffects() player sees: vitals, results, messages, the drug chart
 *   presentDebrief() and the debrief
 *
 * The engine itself always runs on the Indian case in conventional units and
 * rupees, so scoring and physiology are identical in every country; only the
 * rendering changes. India passes through untouched.
 */
import "server-only";

import type { ClinicalCaseDefinition } from "../case-definition";
import { COUNTRY, formatMoney, localPrice, type Country } from "../countries";
import { levelMeta } from "../levels";
import type { CaseDebrief, CaseState, DrugAdministration, LabRow, TurnEffect, VitalPatch, VitalReading } from "../types";
import { CASE_LOCALES, TEACHING_BRANDS, TERMS, type Abroad } from "./country-content";

/* -------------------------------------------------------------------------- */
/* Case content                                                                */
/* -------------------------------------------------------------------------- */

/** Ids, match phrases, enums and numbers: the engine's working parts, never rewritten. */
const STRUCTURAL = new Set([
  "id", "match", "drugIds", "drugClasses", "measureIds", "concernsDrugs", "rescues", "rescue", "preventedBy", "idealTreatment",
  "diagnosisAccept", "diagnosisPartial", "differentials", "arms", "ifHazard", "patientBand", "ids", "spec", "src", "frequencyAnyOf",
  "wrongFrequencies", "kind", "group", "role", "speaker", "importance", "appropriateness", "priority", "category", "track", "level",
  "setting", "settingAfter", "specialty", "status", "statusAfter", "initialStatus", "key", "flag", "unit", "route", "severity", "when",
  "rows", "vitals", "vitalsAfter", "baselineVitals", "phoneVitals", "triageVitals", "profile", "doseRange", "minLevel", "countries",
]);

function walk(value: unknown, key: string, fix: (s: string, key: string) => string): unknown {
  if (typeof value === "string") return fix(value, key);
  if (Array.isArray(value)) return value.map((v) => walk(v, key, fix));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = STRUCTURAL.has(k) ? v : walk(v, k, fix);
    return out;
  }
  return value;
}

const localized = new WeakMap<ClinicalCaseDefinition, Partial<Record<Abroad, ClinicalCaseDefinition>>>();

/** The case as it happens in the player's country — same clinical truth, local people and places. */
export function localizeCase(def: ClinicalCaseDefinition, country: Country): ClinicalCaseDefinition {
  if (country === "IN") return def;
  let byCountry = localized.get(def);
  if (!byCountry) localized.set(def, (byCountry = {}));
  return (byCountry[country] ??= buildCase(def, country));
}

function buildCase(def: ClinicalCaseDefinition, country: Abroad): ClinicalCaseDefinition {
  const loc = CASE_LOCALES[def.id]?.[country];
  const fix = (s: string, key: string) => {
    if (key === "brand") return TEACHING_BRANDS[s]?.[country] ?? "";
    let t = loc?.lines?.[s] ?? s;
    for (const [re, rep] of loc?.subs ?? []) t = t.replace(re, rep);
    for (const [re, rep] of TERMS[country]) t = t.replace(re, rep);
    return t;
  };
  const out = walk(def, "", fix) as ClinicalCaseDefinition;
  return { ...out, patient: { ...out.patient, ...loc?.patient }, facility: levelMeta(def.level, country).label };
}

/* -------------------------------------------------------------------------- */
/* Numbers                                                                     */
/* -------------------------------------------------------------------------- */

const NUM = String.raw`(\d+(?:,\d{3})*(?:\.\d+)?)`;
const num = (s: string) => Number(s.replace(/,/g, ""));
const fmt = (x: number, dp: number) => x.toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });
const toC = (f: number) => ((f - 32) * 5) / 9;

interface Conv {
  /** Analyte names (rows) or the words that name it in prose. */
  name: RegExp;
  from: string;
  to: string;
  f: (x: number) => number;
  dp: number;
  /** A new analyte name for rows, e.g. Urea → BUN. */
  rename?: string;
}

const same = (x: number) => x;

/** UK: SI units. Order matters where names overlap (HbA1c before haemoglobin). */
const UK_CONV: Conv[] = [
  { name: /glucose|sugar|\bRBS\b|\bCBG\b|\bFBS\b|\bPPBS\b|glyc/i, from: "mg/dL", to: "mmol/L", f: (x) => x / 18, dp: 1 },
  { name: /creatinine/i, from: "mg/dL", to: "µmol/L", f: (x) => x * 88.4, dp: 0 },
  { name: /\burea\b/i, from: "mg/dL", to: "mmol/L", f: (x) => x / 6.006, dp: 1 },
  { name: /bilirubin/i, from: "mg/dL", to: "µmol/L", f: (x) => x * 17.1, dp: 0 },
  { name: /cholesterol|\bLDL\b|\bHDL\b/i, from: "mg/dL", to: "mmol/L", f: (x) => x / 38.67, dp: 1 },
  { name: /triglyceride/i, from: "mg/dL", to: "mmol/L", f: (x) => x / 88.57, dp: 1 },
  { name: /calcium/i, from: "mg/dL", to: "mmol/L", f: (x) => x / 4.008, dp: 2 },
  { name: /magnesium/i, from: "mg/dL", to: "mmol/L", f: (x) => x / 2.43, dp: 2 },
  { name: /uric acid|urate/i, from: "mg/dL", to: "µmol/L", f: (x) => x * 59.48, dp: 0 },
  { name: /\bC[34]\b/, from: "mg/dL", to: "g/L", f: (x) => x / 100, dp: 2 },
  { name: /hba1c|\bA1c\b/i, from: "%", to: "mmol/mol", f: (x) => (x - 2.15) * 10.929, dp: 0 },
  { name: /haemoglobin|hemoglobin|\bHb\b/i, from: "g/dL", to: "g/L", f: (x) => x * 10, dp: 0 },
  { name: /albumin|total protein/i, from: "g/dL", to: "g/L", f: (x) => x * 10, dp: 0 },
  { name: /pO₂|pCO₂|pO2|pCO2/, from: "mmHg", to: "kPa", f: (x) => x / 7.5, dp: 1 },
  { name: /platelet/i, from: "lakh/µL", to: "×10⁹/L", f: (x) => x * 100, dp: 0 },
  { name: /leucocyte|leukocyte|\(absolute\)|\bTLC\b|\bWBC\b/i, from: "/µL", to: "×10⁹/L", f: (x) => x / 1000, dp: 1 },
  { name: /serum iron|TIBC/i, from: "µg/dL", to: "µmol/L", f: (x) => x * 0.179, dp: 0 },
  { name: /vitamin d/i, from: "ng/mL", to: "nmol/L", f: (x) => x * 2.496, dp: 0 },
  { name: /free t4/i, from: "ng/dL", to: "pmol/L", f: (x) => x * 12.87, dp: 0 },
  { name: /ferritin/i, from: "ng/mL", to: "µg/L", f: same, dp: -1 },
  { name: /b12|proBNP/i, from: "pg/mL", to: "ng/L", f: same, dp: -1 },
  { name: /UACR/i, from: "mg/g", to: "mg/mmol", f: (x) => x / 8.84, dp: 1, rename: "ACR" },
  { name: /protein : creatinine/i, from: "g/g", to: "mg/mmol", f: (x) => x * 113, dp: 0 },
  { name: /./, from: "mEq/L", to: "mmol/L", f: same, dp: -1 },
];

/** USA: conventional units, as in India, except BUN and cell counts. */
const US_CONV: Conv[] = [
  { name: /^urea$/i, from: "mg/dL", to: "mg/dL", f: (x) => x / 2.14, dp: 0, rename: "BUN" },
  { name: /platelet/i, from: "lakh/µL", to: "×10³/µL", f: (x) => x * 100, dp: 0 },
  { name: /leucocyte|leukocyte|\(absolute\)/i, from: "/µL", to: "×10³/µL", f: (x) => x / 1000, dp: 1 },
];

const CONV: Record<Abroad, Conv[]> = { US: US_CONV, UK: UK_CONV };

/** "2,800" → "2.8"; keeps "> 120" style prefixes; leaves words ("Unrecordable") alone. */
function convertValue(value: string, c: Conv): string {
  if (c.dp < 0) return value;
  const m = value.match(new RegExp(`^([<>≤≥]\\s?)?${NUM}$`));
  return m ? `${m[1] ?? ""}${fmt(c.f(num(m[2]!)), c.dp)}` : value;
}

function convertReference(ref: string, c: Conv): string {
  if (c.dp < 0) return ref;
  return ref.replace(new RegExp(`${NUM}%?`, "g"), (_, n: string) => fmt(c.f(num(n)), c.dp));
}

const ANALYTE_NAMES: [RegExp, string][] = [
  [/^ALT \(SGPT\)$/, "ALT"],
  [/^AST \(SGOT\)$/, "AST"],
  [/^Total leucocyte count$/, "White cell count"],
];

function presentRow(row: LabRow, country: Abroad): LabRow {
  let analyte = row.analyte;
  for (const [re, rep] of ANALYTE_NAMES) analyte = analyte.replace(re, rep);
  const c = row.unit ? CONV[country].find((x) => x.from === row.unit && x.name.test(row.analyte)) : undefined;
  const out: LabRow = c
    ? { ...row, analyte: c.rename ?? analyte, value: convertValue(row.value, c), unit: c.to, reference: row.reference ? convertReference(row.reference, c) : row.reference }
    : { ...row, analyte };
  return { ...out, analyte: text(out.analyte, country), value: text(out.value, country), reference: out.reference && text(out.reference, country) };
}

/* -------------------------------------------------------------------------- */
/* Prose                                                                       */
/* -------------------------------------------------------------------------- */

interface ProseFamily {
  re: RegExp;
  convs: { conv: Conv; name: RegExp }[];
  percent: boolean;
}

const escapeUnit = (u: string) => u.replace(/[/%]/g, (ch) => `\\${ch}`);

/** Per country, one pattern per unit, with the analytes that use it (US urea → BUN is handled on its own). */
const PROSE: Record<Abroad, ProseFamily[]> = { US: proseFamilies(US_CONV), UK: proseFamilies(UK_CONV) };

function proseFamilies(list: Conv[]): ProseFamily[] {
  const convs = list.filter((c) => c.dp >= 0 && c.from !== "lakh/µL" && c.from !== "/µL" && c.rename !== "BUN");
  return [...new Set(convs.map((c) => c.from))].map((unit) => ({
    re: new RegExp(`${NUM}(?:\\s?(–|-|to)\\s?${NUM})?\\s?${escapeUnit(unit)}(?![\\w/])`, "g"),
    convs: convs.filter((c) => c.from === unit).map((conv) => ({ conv, name: new RegExp(conv.name.source, `${conv.name.flags.replace("g", "")}g`) })),
    percent: unit === "%",
  }));
}

const F_TO_C = new RegExp(`${NUM}\\s?°F`, "g");
const LAKH = new RegExp(`${NUM}(?:\\s?(–|-)\\s?${NUM})?\\s?lakh(?:\\/µL|\\/mm³|\\/cumm)?`, "g");
const US_UREA = new RegExp(`\\b[Uu]rea(\\s(?:of\\s)?)${NUM}(?:\\s?(–|-)\\s?${NUM})?\\s?mg\\/dL`, "g");

/** Units written into sentences: the nearest analyte named before the number decides the conversion. */
function proseUnits(s: string, country: Abroad): string {
  if (country === "UK") s = s.replace(F_TO_C, (_, n: string) => `${fmt(toC(num(n)), 1)} °C`);
  s = s.replace(LAKH, (_, a: string, sep?: string, b?: string) => {
    const v = (n: string) => fmt(num(n) * 100, 0);
    return `${v(a)}${sep && b ? `${sep}${v(b)}` : ""} ${country === "US" ? "×10³/µL" : "×10⁹/L"}`;
  });
  for (const family of PROSE[country]) {
    const source = s;
    s = source.replace(family.re, (m: string, a: string, sep: string | undefined, b: string | undefined, offset: number) => {
      const before = source.slice(Math.max(0, offset - 80), offset);
      let best: Conv | undefined;
      let at = -1;
      for (const { conv, name } of family.convs) {
        for (const hit of before.matchAll(name)) if (hit.index! > at) ((at = hit.index!), (best = conv));
      }
      if (!best || (family.percent && before.length - at > 30)) return m;
      const v = (n: string) => fmt(best!.f(num(n)), best!.dp);
      return `${v(a)}${sep && b ? `${sep === "to" ? " to " : sep}${v(b)}` : ""} ${best.to}`;
    });
  }
  if (country === "US") {
    s = s.replace(US_UREA, (_, gap: string, a: string, sep?: string, b?: string) => {
      const v = (n: string) => fmt(num(n) / 2.14, 0);
      return `BUN${gap}${v(a)}${sep && b ? `${sep}${v(b)}` : ""} mg/dL`;
    });
  }
  return s;
}

const RUPEES = new RegExp(`₹\\s?${NUM}`, "g");
const money = (s: string, country: Country) => s.replace(RUPEES, (_, n: string) => formatMoney(localPrice(num(n), country), country));

/** Names that differ: drugs, fluids, tests, and India-only shorthand. */
const NAMES: Record<Abroad, [RegExp, string][]> = {
  US: [
    [/\b[Gg]lyceryl trinitrate\b/g, "nitroglycerin"],
    [/\bGTN\b/g, "nitroglycerin"],
    [/\bRinger(?:'s)? [Ll]actate\b/g, "lactated Ringer's"],
    [/\bRL\b/g, "LR"],
    [/\b25% dextrose\b/g, "50% dextrose (D50)"],
    [/\bco-amoxiclav\b/gi, "amoxicillin–clavulanate"],
    [/\bco-trimoxazole\b/gi, "TMP–SMX"],
    [/\bRenal function tests\b/g, "Basic metabolic panel"],
    [/\bFasting blood sugar\b/g, "Fasting glucose"],
    [/\bPost-prandial blood sugar\b/g, "2-hour post-meal glucose"],
    [/\bRandom blood sugar\b/gi, "Blood glucose"],
    [/\bUrine routine & microscopy\b/g, "Urinalysis with microscopy"],
    [/\bStool routine & microscopy\b/g, "Stool microscopy"],
    [/\b(Blood|Urine) culture & sensitivity\b/g, "$1 culture"],
    [/\bUSG\b/g, "Ultrasound"],
    [/\bCECT abdomen & pelvis\b/g, "CT abdomen & pelvis with contrast"],
    [/\bCECT\b/g, "contrast CT"],
    [/\bNCCT head\b/g, "Non-contrast CT head"],
    [/\bNCCT\b/g, "non-contrast CT"],
    [/\bX-ray abdomen erect\b/g, "Upright abdominal X-ray"],
    [/\b2D echocardiography\b/g, "Echocardiogram"],
    [/\bBlood grouping & cross-match\b/g, "Type and crossmatch"],
    [/\bPeripheral blood smear\b/g, "Peripheral smear"],
    [/\bKOH mount\b/g, "KOH prep"],
    [/\b(?:RFT|KFT)s?\b/g, "BMP"],
    [/\bUrine R\/M\b/g, "UA"],
    [/\bSGPT\b/g, "ALT"],
    [/\bSGOT\b/g, "AST"],
    [/\bTLC\b/g, "WBC"],
    [/\bG?RBS\b/g, "Glucose"],
    [/\bIndian Standard Series\b/g, "North American standard series"],
  ],
  UK: [
    [/\bRinger(?:'s)? [Ll]actate\b/g, "Hartmann's solution"],
    [/\bRL\b/g, "Hartmann's"],
    [/\b25% dextrose\b/g, "20% glucose"],
    [/\b(\d+)% dextrose\b/g, "$1% glucose"],
    [/\bDextrose (\d+)%/g, "Glucose $1%"],
    [/\bdextrose (\d+)%/g, "glucose $1%"],
    [/\bDextrose\b/g, "Glucose"],
    [/\bdextrose\b/g, "glucose"],
    [/\bComplete blood count\b/g, "Full blood count"],
    [/\bRenal function tests\b/g, "Urea & electrolytes"],
    [/\bFasting blood sugar\b/g, "Fasting glucose"],
    [/\bPost-prandial blood sugar\b/g, "2-hour glucose"],
    [/\bRandom blood sugar\b/gi, "Capillary blood glucose"],
    [/\bUrine routine & microscopy\b/g, "Urine microscopy"],
    [/\bStool routine & microscopy\b/g, "Stool microscopy"],
    [/\bBlood culture & sensitivity\b/g, "Blood cultures"],
    [/\bUrine culture & sensitivity\b/g, "Urine culture (MC&S)"],
    [/\bUSG\b/g, "Ultrasound"],
    [/\bCECT abdomen & pelvis\b/g, "CT abdomen & pelvis with contrast"],
    [/\bCECT\b/g, "contrast CT"],
    [/\bNCCT head\b/g, "CT head (non-contrast)"],
    [/\bNCCT\b/g, "non-contrast CT"],
    [/\bX-ray abdomen erect\b/g, "Abdominal X-ray"],
    [/\b2D echocardiography\b/g, "Echocardiogram"],
    [/\bBlood grouping & cross-match\b/g, "Group and save / cross-match"],
    [/\bPeripheral blood smear\b/g, "Blood film"],
    [/\bCoagulation profile\b/g, "Clotting screen"],
    [/\bKOH mount\b/g, "Skin scrapings (KOH)"],
    [/\b(?:RFT|KFT)s?\b/g, "U&E"],
    [/\bCBC\b/g, "FBC"],
    [/\bUrine R\/M\b/g, "Urine microscopy"],
    [/\bSGPT\b/g, "ALT"],
    [/\bSGOT\b/g, "AST"],
    [/\bTLC\b/g, "WCC"],
    [/\bG?RBS\b/g, "CBG"],
    [/\bSOS\b/g, "PRN"],
    [/\bHS\b/g, "at night"],
    [/\bmEq\/L\b/g, "mmol/L"],
    [/\bIndian Standard Series\b/g, "British baseline series"],
  ],
};

/** US drug names, matched as whole words with the original capitalisation kept. */
const US_DRUGS: Record<string, string> = {
  paracetamol: "acetaminophen", adrenaline: "epinephrine", noradrenaline: "norepinephrine", salbutamol: "albuterol",
  levosalbutamol: "levalbuterol", lignocaine: "lidocaine", frusemide: "furosemide", pethidine: "meperidine", isoprenaline: "isoproterenol",
};

const US_FREQ: Record<string, string> = { OD: "daily", BD: "BID", TDS: "TID", QDS: "QID", HS: "at bedtime", SOS: "PRN" };

/* US spelling, word by word. */
const OUR = new Set(["colour", "behaviour", "favour", "odour", "tumour", "labour", "humour", "vapour", "rumour", "honour", "harbour", "neighbour", "flavour", "savour", "vigour", "rigour", "armour", "endeavour", "parlour", "fervour", "splendour", "clamour"]);
const IZE = new Set([
  "recogn", "organ", "minim", "maxim", "stabil", "priorit", "sensit", "desensit", "character", "catheter", "immun", "hospital", "mobil",
  "immobil", "normal", "optim", "real", "summar", "util", "visual", "neutral", "final", "apolog", "critic", "special", "local", "general",
  "steril", "random", "standard", "individual", "internal", "categor", "memor", "author", "familiar", "emphas", "harmon", "metabol",
  "colon", "ion", "agon", "sympath", "tranquil", "anaesthet", "anesthet", "fertil", "capital", "rational", "symbol", "prioritis",
]);
const WORDS: Record<string, string> = {
  haem: "heme", programme: "program", programmes: "programs", grey: "gray", catalogue: "catalog", analogue: "analog", analogues: "analogs",
  aluminium: "aluminum", licence: "license", practise: "practice", defence: "defense", offence: "offense", mould: "mold",
  travelled: "traveled", travelling: "traveling", labelled: "labeled", labelling: "labeling", cancelled: "canceled", fulfil: "fulfill",
  enrol: "enroll", ageing: "aging", judgement: "judgment", centred: "centered", manoeuvre: "maneuver", manoeuvres: "maneuvers",
  mum: "mom", mums: "moms",
};

function usWordLower(w: string): string {
  if (WORDS[w]) return WORDS[w]!;
  const our = w.match(/^([a-z]+?our)(s|ed|ing|able|ite|ites)?$/);
  if (our && OUR.has(our[1]!)) return our[1]!.replace(/our$/, "or") + (our[2] ?? "");
  const ize = w.match(/^([a-z]+?)is(e|ed|es|ing|ation|ations|er|ers)$/);
  if (ize && IZE.has(ize[1]!)) w = `${ize[1]}iz${ize[2]}`;
  w = w.replace(/^(anal|paral|dial|hydrol|haemol|hemol|electrol)ys(e|ed|es|ing)$/, "$1yz$2");
  w = w.replace(/^(.*?)(cent|lit|met|fib|tit|theat|calib)re(s?)$/, "$1$2er$3");
  w = w.replace(/^haem/, "hem").replace(/aem/g, "em").replace(/^paed/, "ped").replace(/orthopaed/, "orthoped").replace(/^gynaec/, "gynec");
  w = w.replace(/^anaesth/, "anesth").replace(/^aetiol/, "etiol").replace(/^caesar/, "cesar").replace(/^faec/, "fec").replace(/^leuc/, "leuk");
  w = w.replace(/^oe(dema|sophag|strogen|stradiol)/, "e$1").replace(/rrhoea/, "rrhea").replace(/pnoea/, "pnea").replace(/^foet/, "fet");
  w = w.replace(/^coeliac/, "celiac").replace(/sulph/, "sulf");
  return w;
}

function usWord(w: string): string {
  const lower = w.toLowerCase();
  const x = US_DRUGS[lower] ?? usWordLower(lower);
  if (x === lower) return w;
  if (w.length > 1 && w === w.toUpperCase()) return x.toUpperCase();
  return w[0] === w[0]!.toUpperCase() ? x[0]!.toUpperCase() + x.slice(1) : x;
}

/** Any player-visible sentence in the country's units, money, names and spelling. */
export function text(s: string, country: Country): string {
  if (country === "IN" || !s) return s;
  let t = money(proseUnits(s, country), country);
  for (const [re, rep] of NAMES[country]) t = t.replace(re, rep as string);
  t = t.replace(/\bNamaste\b/g, "Hello");
  if (country === "US") {
    t = t.replace(/\b(OD|BD|TDS|QDS|HS|SOS)\b/g, (m) => US_FREQ[m] ?? m);
    t = t.replace(/[A-Za-z]+/g, usWord);
  }
  return t;
}

/* -------------------------------------------------------------------------- */
/* State, effects, debrief                                                     */
/* -------------------------------------------------------------------------- */

function presentVital<T extends VitalPatch | VitalReading>(v: T, country: Abroad): T {
  const n = Number(v.value);
  const label = "label" in v && v.key === "rbs" ? { label: COUNTRY[country].glucoseLabel } : {};
  if (!Number.isFinite(n) || v.value.trim() === "") return { ...v, ...label };
  if (country === "UK" && v.key === "temp") {
    const c = Number(fmt(toC(n), 1));
    return { ...v, ...label, value: fmt(c, 1), unit: "°C", numeric: c };
  }
  if (country === "UK" && v.key === "rbs") {
    const mmol = Number(fmt(n / 18, 1));
    return { ...v, ...label, value: fmt(mmol, 1), unit: "mmol/L", numeric: mmol };
  }
  return { ...v, ...label };
}

const cost = (n: number | undefined, country: Country) => (typeof n === "number" ? localPrice(n, country) : n);

function presentDrug<T extends Pick<DrugAdministration, "generic" | "brand" | "dose" | "frequency">>(d: T, country: Abroad): T {
  const frequency = d.frequency && (country === "US" ? d.frequency.replace(/\b(OD|BD|TDS|QDS|HS|SOS)\b/g, (m) => US_FREQ[m] ?? m) : text(d.frequency, country));
  return { ...d, generic: text(d.generic, country), brand: undefined, dose: text(d.dose, country), frequency };
}

const fromPlayer = (role: string) => role === "doctor";

export function presentState(state: CaseState, country: Country): CaseState {
  if (country === "IN") return { ...state, country };
  const t = (s: string) => text(s, country);
  return {
    ...state,
    country,
    briefing: t(state.briefing),
    messages: state.messages.map((m) => (fromPlayer(m.role) ? m : { ...m, text: t(m.text) })),
    vitals: Object.fromEntries(
      Object.entries(state.vitals).map(([k, track]) => [k, track && { current: presentVital(track.current, country), history: track.history.map((h) => presentVital(h, country)) }]),
    ),
    facts: state.facts.map((f) => ({ ...f, label: t(f.label), value: t(f.value) })),
    investigations: state.investigations.map((i) => ({
      ...i,
      name: t(i.name),
      rows: i.rows?.map((r) => presentRow(r, country)),
      report: i.report && t(i.report),
      cost: cost(i.cost, country),
    })),
    drugs: state.drugs.map((d) => presentDrug(d, country)),
    procedures: state.procedures.map((p) => ({ ...p, name: t(p.name), note: p.note && t(p.note) })),
    timeline: state.timeline.map((e) => ({ ...e, label: t(e.label), detail: e.detail && t(e.detail) })),
  };
}

export function presentEffects(effects: TurnEffect[], country: Country): TurnEffect[] {
  if (country === "IN") return effects;
  const t = (s: string) => text(s, country);
  return effects.map((e): TurnEffect => {
    switch (e.type) {
      case "message":
        return fromPlayer(e.role) ? e : { ...e, text: t(e.text) };
      case "vitals":
        return { ...e, readings: e.readings.map((r) => presentVital(r, country)) };
      case "fact":
        return { ...e, label: t(e.label), value: t(e.value) };
      case "investigation_ordered":
        return { ...e, name: t(e.name), cost: cost(e.cost, country) };
      case "investigation_resulted":
        return { ...e, rows: e.rows?.map((r) => presentRow(r, country)), report: e.report && t(e.report) };
      case "drug":
        return { ...e, drug: presentDrug(e.drug, country) };
      case "procedure":
        return { ...e, name: t(e.name), note: e.note && t(e.note) };
      case "patient_status":
        return { ...e, notice: e.notice && t(e.notice) };
      case "timeline":
        return { ...e, label: t(e.label), detail: e.detail && t(e.detail) };
      default:
        return e;
    }
  });
}

/** Debrief keys that are ids, enums or the player's own words. */
const DEBRIEF_FIXED = new Set(["caseRef", "specialty", "track", "level", "verdict", "finalStatus", "priority", "rescued", "category", "route", "severity", "stage", "id", "orderedInvestigationIds", "patientBand", "spec", "src", "userDiagnosis", "country"]);

export function presentDebrief(debrief: CaseDebrief, country: Country): CaseDebrief {
  if (country === "IN") return { ...debrief, country };
  const fix = (value: unknown): unknown => {
    if (typeof value === "string") return text(value, country);
    if (Array.isArray(value)) return value.map(fix);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, DEBRIEF_FIXED.has(k) ? v : fix(v)]));
    return value;
  };
  const out = fix(debrief) as CaseDebrief;
  return {
    ...out,
    country,
    spend: localPrice(debrief.spend, country),
    investigations: out.investigations.map((i) => ({ ...i, cost: cost(i.cost, country) })),
  };
}
