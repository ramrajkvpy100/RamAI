/**
 * The Latest Research feed. Curated by hand: every item links to its own publication, and each link was opened when it was added.
 * Update by adding to the top. These are teaching summaries: read the source before changing practice.
 */

export interface ResearchItem {
  id: string;
  body: string;
  kind: "Guideline" | "Trial";
  title: string;
  year: string;
  takeaway: string;
  bedside: string;
  url: string;
}

export const RESEARCH: ResearchItem[] = [
  { id: "ssc-2026", body: "Surviving Sepsis", kind: "Guideline", title: "Surviving Sepsis Campaign adult guidelines 2026", year: "2026",
    takeaway: "129 statements, 46 of them new. NEWS, MEWS or SIRS are preferred over qSOFA as a single screening tool. Antimicrobials immediately, ideally within 1 hour, in probable sepsis.",
    bedside: "Don't screen with qSOFA alone. Keep the first MAP goal at 65, and give at least 30 mL/kg crystalloid in the first 3 hours for hypoperfusion. Don't use procalcitonin to decide whether to start antibiotics.",
    url: "https://www.sccm.org/clinical-resources/guidelines/guidelines/surviving-sepsis-campaign-international-guidelines-for-management-of-sepsis-and-septic-shock-2026" },
  { id: "fogsi-hdp-2026", body: "FOGSI", kind: "Guideline", title: "FOGSI-Gestosis-ICOG Hypertensive Disorders in Pregnancy, Good Clinical Practice Recommendations, 3rd edition", year: "2026",
    takeaway: "India's joint obstetric recommendations on defining hypertension in pregnancy, risk factors for pre-eclampsia and its work-up, now in a third edition.",
    bedside: "Use this edition as the Indian reference for your labour ward protocol, and compare it with what your unit follows today.",
    url: "https://www.fogsi.org/wp-content/uploads/2026/01/Hypertensive-Disorders-in-Pregnancy-Final-pdf.pdf" },
  { id: "gold-2026", body: "GOLD", kind: "Guideline", title: "GOLD report 2026: key changes", year: "2026",
    takeaway: "COPD is reframed around disease activity, not just fixed airflow limitation. Diagnosis still needs post-bronchodilator FEV1/FVC under 0.70.",
    bedside: "Count exacerbations and check eosinophils as markers of activity. If an inhaled steroid is indicated, triple therapy is preferred over LABA plus ICS.",
    url: "https://goldcopd.org/wp-content/uploads/2025/11/KEY-CHANGES-GOLD-2026-10Nov2025.pdf" },
  { id: "who-pph-2025", body: "WHO, FIGO, ICM", kind: "Guideline", title: "Consolidated guidelines on postpartum haemorrhage", year: "2025",
    takeaway: "Act at 300 mL of blood loss with abnormal vital signs instead of waiting for 500 mL. Measure loss with a calibrated drape. Use the MOTIVE bundle once PPH is diagnosed.",
    bedside: "Massage, Oxytocic, Tranexamic acid, IV fluids, Vaginal and genital tract exam, Escalate: all together and early, not one after another.",
    url: "https://www.figo.org/press-releases/global-health-agencies-issue-new-recommendations-help-end-deaths-postpartum-haemorrhage" },
  { id: "aha-cpr-2025", body: "AHA", kind: "Guideline", title: "AHA guidelines for CPR and emergency cardiovascular care", year: "2025",
    takeaway: "One Chain of Survival for all ages and settings. Head-up CPR outside research is advised against; mechanical CPR isn't routine; standard CPR technique applies in obesity.",
    bedside: "Spend your effort on high-quality manual compressions. Don't adapt technique for a patient's size. Double sequential defibrillation remains unestablished in refractory VF.",
    url: "https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines" },
  { id: "aha-htn-2025", body: "AHA", kind: "Guideline", title: "AHA/ACC guideline on high blood pressure in adults", year: "2025",
    takeaway: "Risk is now estimated with the PREVENT equations. Treat at 130/80 or above with raised cardiovascular risk, to a systolic under 130.",
    bedside: "Screen for primary aldosteronism in resistant hypertension whatever the potassium. Send a urine albumin-to-creatinine ratio. Advise home BP, not smartwatch cuffless readings.",
    url: "https://doi.org/10.1161/HYP.0000000000000249" },
  { id: "ntep-bpalm", body: "MoHFW", kind: "Guideline", title: "National guidelines for management of drug-resistant TB (BPaLM)", year: "2025",
    takeaway: "India's programme approved BPaLM in 2024: bedaquiline, pretomanid and linezolid, with or without moxifloxacin, as a 6-month all-oral regimen for eligible patients.",
    bedside: "Send molecular susceptibility testing early. Watch linezolid toxicity (anaemia, neuropathy), and follow the guideline's dose reduction steps.",
    url: "https://tbcindia.mohfw.gov.in/wp-content/uploads/2025/01/National-Guidelines-for-Management-of-DR-TB_Final.pdf" },
  { id: "balance", body: "Trial", kind: "Trial", title: "BALANCE: 7 vs 14 days of antibiotics for bloodstream infection", year: "2025",
    takeaway: "3,608 hospitalised patients. 90-day mortality was 14.5% with 7 days, 16.1% with 14 days: non-inferior.",
    bedside: "A 7-day course can suffice for bacteraemia once a patient is improving and the source is controlled. It doesn't apply to Staph aureus or Candida.",
    url: "https://doi.org/10.1056/NEJMoa2404991" },
  { id: "gina", body: "GINA", kind: "Guideline", title: "GINA strategy report: as-needed ICS-formoterol", year: "2025",
    takeaway: "Short-acting bronchodilator alone isn't recommended for adults and adolescents. As-needed low-dose ICS-formoterol is GINA's preferred reliever (Track 1).",
    bedside: "Every adult with asthma needs inhaled steroid-containing treatment, even with mild symptoms. Check the inhaler technique before stepping up.",
    url: "https://ginasthma.org/reports/" },
  { id: "flow", body: "Trial", kind: "Trial", title: "FLOW: semaglutide in type 2 diabetes with CKD", year: "2024",
    takeaway: "Weekly semaglutide reduced major kidney outcomes by 24% against placebo; the trial stopped early for efficacy.",
    bedside: "In a diabetic with CKD, a GLP-1 receptor agonist protects the kidney as well as lowering sugar. Think of it alongside an SGLT2 inhibitor and RAS blockade.",
    url: "https://doi.org/10.1056/NEJMoa2403347" },
  { id: "kdigo-2024", body: "KDIGO", kind: "Guideline", title: "KDIGO 2024 guideline for CKD", year: "2024",
    takeaway: "CKD staging combines cause, GFR and albuminuria. SGLT2 inhibitors are recommended for type 2 diabetes with CKD at eGFR 20 or above, and for many without diabetes.",
    bedside: "Don't stop at a creatinine: send a urine albumin-to-creatinine ratio. A small early rise in creatinine after an SGLT2 inhibitor isn't a reason to stop it.",
    url: "https://doi.org/10.1016/j.kint.2023.10.018" },
  { id: "cape-cod", body: "Trial", kind: "Trial", title: "CAPE COD: hydrocortisone in severe community-acquired pneumonia", year: "2023",
    takeaway: "28-day mortality was 6.2% with hydrocortisone, 11.9% with placebo, in ICU patients with severe CAP, excluding influenza and septic shock at entry.",
    bedside: "Consider early hydrocortisone in severe CAP in ICU. Note who was excluded: influenza and shock.",
    url: "https://doi.org/10.1056/NEJMoa2215145" },
  { id: "e-motive", body: "Trial", kind: "Trial", title: "E-MOTIVE: early detection and bundled PPH treatment", year: "2023",
    takeaway: "Across 4 countries, a calibrated drape plus the bundle reduced severe outcomes from 4.3% to 1.6%.",
    bedside: "Measure, don't estimate, blood loss. Give the bundle at once, not stepwise.",
    url: "https://doi.org/10.1056/NEJMoa2303966" },
  { id: "icmr-2022", body: "ICMR", kind: "Guideline", title: "ICMR treatment guidelines for antimicrobial use in common syndromes", year: "2022",
    takeaway: "India's own syndrome-by-syndrome antibiotic guide, shaped by local resistance patterns.",
    bedside: "Check it before reaching for a carbapenem or a fluoroquinolone, and send cultures before starting.",
    url: "https://www.icmr.gov.in/guidelines" },
];

export const RESEARCH_BODIES = ["All", "ICMR", "MoHFW", "AHA", "GOLD", "GINA", "KDIGO", "FOGSI", "Surviving Sepsis", "WHO, FIGO, ICM", "Trial"] as const;
