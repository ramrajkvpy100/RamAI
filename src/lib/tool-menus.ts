/**
 * Clinical tool menus — shortcuts into natural language, never a substitute.
 *
 * These are deliberately generic and identical for every case: a menu that
 * changed with the case would be a hint. Each item only drafts text into the
 * composer; the player still decides to send it.
 */
import type { IconName } from "@/components/ui/icon";
import type { Country } from "@/engine/countries";

export type InsertMode = "replace" | "order" | "append";

export interface ToolItem {
  label: string;
  text: string;
  mode: InsertMode;
}

export interface ToolGroup {
  title?: string;
  items: ToolItem[];
}

export interface ToolCategory {
  id: "history" | "examination" | "investigations" | "treatment" | "procedures" | "monitoring";
  label: string;
  icon: IconName;
  groups: ToolGroup[];
}

const q = (label: string, text: string): ToolItem => ({ label, text, mode: "replace" });
const order = (label: string): ToolItem => ({ label, text: label, mode: "order" });
const draft = (label: string, text = label): ToolItem => ({ label, text, mode: "replace" });

export const TOOL_CATEGORIES: ToolCategory[] = [
  {
    id: "history",
    label: "History",
    icon: "chat",
    groups: [
      {
        items: [
          q("Chief complaint", "What brings you here today?"),
          q("History of present illness", "Tell me more about it — when did it start, and how has it changed?"),
          q("Past history", "Any medical conditions — diabetes, BP, thyroid, asthma, TB? Any surgeries?"),
          q("Medications", "What medicines are you taking — including anything from the chemist or under the tongue?"),
          q("Allergies", "Are you allergic to any medicine?"),
          q("Family history", "Does anyone in the family have similar problems or any illnesses?"),
          q("Social history", "What work do you do? Do you smoke, chew tobacco or drink alcohol?"),
          q("Diet", "What does a typical day of eating look like?"),
          q("Sexual history", "Any concerns related to sexual health?"),
          q("Menstrual & obstetric", "Are your periods regular? When was your last period? Any pregnancies?"),
          q("Systemic review", "Any fever, weight loss, breathlessness, chest pain, or urinary problems?"),
        ],
      },
    ],
  },
  {
    id: "examination",
    label: "Examination",
    icon: "hand",
    groups: [
      { title: "Vitals", items: [draft("All vitals", "Check vitals"), draft("BP", "Check BP"), draft("Pulse", "Check pulse"), draft("SpO₂", "Check SpO2"), draft("Temperature", "Check temperature"), draft("RBS", "Check RBS"), draft("Weight & BMI", "Check weight and BMI")] },
      { title: "General", items: [draft("General examination", "General examination"), draft("Hydration", "Check hydration"), draft("Lymph nodes", "Examine lymph nodes"), draft("JVP", "Check JVP"), draft("Pedal oedema", "Check for pedal oedema")] },
      { title: "Systemic", items: [draft("Cardiovascular", "Examine CVS"), draft("Respiratory", "Examine RS"), draft("Abdomen", "Examine abdomen"), draft("Neurological", "Neurological examination"), draft("Musculoskeletal", "Examine joints and spine"), draft("Peripheral pulses", "Examine peripheral pulses")] },
      { title: "Local", items: [draft("Skin / lesion", "Examine the skin lesions"), draft("Dermoscopy", "Dermoscopy"), draft("Wood's lamp", "Wood's lamp examination"), draft("Feet", "Examine the feet"), draft("Eyes & fundus", "Examine the eyes and fundus"), draft("ENT", "Examine throat and ears"), draft("Per-rectal", "Per rectal examination"), draft("Genital", "Genital examination")] },
    ],
  },
  {
    id: "investigations",
    label: "Investigations",
    icon: "flask",
    groups: [
      { title: "Bedside", items: [order("ECG"), order("UPT"), order("Urine dipstick"), order("ABG"), order("ABI"), order("KOH mount")] },
      { title: "Blood", items: [order("CBC"), order("LFT"), order("RFT"), order("Electrolytes"), order("HbA1c"), order("FBS"), order("Lipid profile"), order("TSH"), order("CRP"), order("ESR"), order("PT/INR"), order("Dengue NS1"), order("Malaria antigen"), order("Troponin"), order("Blood culture")] },
      { title: "Urine & stool", items: [order("Urine routine"), order("Urine culture"), order("UACR"), order("Stool routine")] },
      { title: "Imaging", items: [order("Chest X-ray"), order("USG abdomen"), order("2D echo"), order("Arterial Doppler"), order("CECT abdomen"), order("NCCT head"), order("MRI brain")] },
      { title: "Dermatology", items: [order("Skin biopsy"), order("Tzanck smear"), order("Patch test")] },
    ],
  },
  {
    id: "treatment",
    label: "Treatment",
    icon: "pill",
    groups: [
      { title: "Give now", items: [draft("Paracetamol", "Give paracetamol 650 mg PO"), draft("IV fluids", "Start IV ringer lactate 500 mL"), draft("Oxygen", "Start oxygen"), draft("Antiemetic", "Give ondansetron 4 mg IV"), draft("Nebulisation", "Nebulise with salbutamol"), draft("Other medicine…", "Give ")] },
      { title: "Prescribe", items: [draft("Prescribe…", "Prescribe "), draft("Topical…", "Apply "), draft("Stop a medicine…", "Stop ")] },
      { title: "Counsel", items: [draft("Counsel…", "Counsel about "), draft("Lifestyle advice…", "Advise ")] },
      { title: "Plan", items: [draft("Working diagnosis", "Diagnosis: "), draft("Differentials", "Differentials: "), draft("Follow-up", "Follow up after 2 weeks"), draft("Close case", "Case close")] },
    ],
  },
  {
    id: "procedures",
    label: "Procedures",
    icon: "scalpel",
    groups: [
      {
        items: [
          draft("IV access", "Secure IV access"), draft("Nil by mouth", "Keep nil by mouth"), draft("Urinary catheter", "Insert Foley catheter"),
          draft("Ryle's tube", "Insert Ryle's tube"), draft("NIV", "Start BiPAP"), draft("Intubation", "Intubate"),
          draft("Wound care", "Clean and dress the wound"), draft("Surgery…", "Take up for "), draft("Admit", "Admit"),
          draft("Refer…", "Refer to "), draft("Discharge", "Discharge"),
        ],
      },
    ],
  },
  {
    id: "monitoring",
    label: "Monitoring",
    icon: "monitor",
    groups: [
      {
        items: [
          draft("Attach monitor", "Attach cardiac monitor"), draft("Reassess", "Reassess the patient"), draft("Repeat vitals", "Repeat vitals"),
          draft("Wait 15 min", "Wait 15 minutes"), draft("Wait for results", "Wait for results"), draft("Observe 1 hour", "Observe for 1 hour"),
          draft("Strict I/O chart", "Monitor urine output"),
        ],
      },
    ],
  },
];

/** The quick-action chips under the composer; Treat also holds procedures and referrals. */
export const QUICK_ACTIONS: { id: string; label: string; categories: ToolCategory["id"][] }[] = [
  { id: "history", label: "Ask", categories: ["history"] },
  { id: "examination", label: "Examine", categories: ["examination"] },
  { id: "investigations", label: "Tests", categories: ["investigations"] },
  { id: "treatment", label: "Treat", categories: ["treatment", "procedures"] },
  { id: "monitoring", label: "Monitor", categories: ["monitoring"] },
];

/** Applies a menu item to the current draft. Orders accumulate: "Order CBC, LFT". */
export function applyInsert(draftText: string, item: ToolItem): string {
  if (item.mode === "order") {
    const m = draftText.match(/^order\s+(.+)$/i);
    if (m?.[1]) {
      const existing = m[1].split(/,\s*/).map((s) => s.trim());
      if (existing.some((e) => e.toLowerCase() === item.text.toLowerCase())) return draftText;
      return `Order ${[...existing, item.text].join(", ")}`;
    }
    return `Order ${item.text}`;
  }
  if (item.mode === "append" && draftText.trim()) return `${draftText.trim()} ${item.text}`;
  return item.text;
}

/** The same shortcuts in the words used where the case is set: BMP in the USA, U&E in the UK. */
const LOCAL_WORDS: Record<Exclude<Country, "IN">, [RegExp, string][]> = {
  US: [
    [/\bRBS\b/g, "glucose"], [/^glucose$/, "Glucose"], [/\bRFT\b/g, "BMP"], [/\bFBS\b/g, "Fasting glucose"], [/\bUSG\b/g, "Ultrasound"],
    [/\bCECT\b/g, "CT"], [/\bNCCT head\b/g, "CT head"], [/\bUrine routine\b/g, "Urinalysis"], [/\bStool routine\b/g, "Stool microscopy"],
    [/\b2D echo\b/g, "Echo"], [/\bKOH mount\b/g, "KOH prep"], [/\bRyle's tube\b/g, "NG tube"], [/\bparacetamol\b/g, "acetaminophen"],
    [/\bParacetamol\b/g, "Acetaminophen"], [/\bringer lactate\b/g, "lactated Ringer's"], [/\bsalbutamol\b/g, "albuterol"],
    [/\bNebulise\b/g, "Nebulize"], [/\bNebulisation\b/g, "Nebulizer"], [/\boedema\b/g, "edema"],
  ],
  UK: [
    [/\bRBS\b/g, "CBG"], [/\bRFT\b/g, "U&E"], [/\bCBC\b/g, "FBC"], [/\bFBS\b/g, "Fasting glucose"], [/\bUSG\b/g, "Ultrasound"],
    [/\bCECT\b/g, "CT"], [/\bNCCT head\b/g, "CT head"], [/\bUrine routine\b/g, "Urine microscopy"], [/\bStool routine\b/g, "Stool microscopy"],
    [/\b2D echo\b/g, "Echo"], [/\bPT\/INR\b/g, "Clotting screen"], [/\bKOH mount\b/g, "Skin scrapings"], [/\bRyle's tube\b/g, "NG tube"],
    [/paracetamol 650 mg/g, "paracetamol 1 g"], [/\bringer lactate\b/g, "Hartmann's"],
  ],
};

const localized = new Map<Country, ToolCategory[]>();

export function menusFor(country: Country = "IN"): ToolCategory[] {
  if (country === "IN") return TOOL_CATEGORIES;
  const words = LOCAL_WORDS[country];
  const fix = (s: string) => words.reduce((t, [re, rep]) => t.replace(re, rep), s);
  let menus = localized.get(country);
  if (!menus) {
    menus = TOOL_CATEGORIES.map((c) => ({ ...c, groups: c.groups.map((g) => ({ ...g, items: g.items.map((i) => ({ ...i, label: fix(i.label), text: fix(i.text) })) })) }));
    localized.set(country, menus);
  }
  return menus;
}
