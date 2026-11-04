/**
 * Video playlists by subject, picked by hand from each channel's own playlists page, with the channel's own titles.
 * tests/games-content.test.ts checks the ids are well formed; opening one goes to YouTube.
 */
export interface Playlist {
  title: string;
  channel: string;
  id: string;
}
export interface PlaylistSubject {
  subject: string;
  /** The dream branches this is the first thing to show for. */
  for?: readonly string[];
  lists: Playlist[];
}

const NN = "Ninja Nerd";
const ZF = "Zero To Finals";
const RM = "Rhesus Medicine";
const AH = "Armando Hasudungan";
const SM = "Strong Medicine";
const MC = "MedCram";
const MP = "Medicosis Perfectionalis";
const DB = "DrBeen";
const RP = "Radiopaedia";
const GM = "Geeky Medics";
const SP = "Speed Pharmacology";
const DM = "DAMS";

export const PLAYLISTS: PlaylistSubject[] = [
  { subject: "NEET PG & INI-CET", lists: [
    { title: "Revision Marathon Sessions", channel: DM, id: "PLcou4I3N5obakiq_tougFfEJFnnj6jIIw" },
    { title: "NEET PG Predictor 2025", channel: DM, id: "PLcou4I3N5obZpLeg1-q7hN1UBEtlLWBj7" },
    { title: "INI-CET Nov 2025 Recall", channel: DM, id: "PLcou4I3N5oba8DNfp2RwxaodG9Oqio1xk" },
    { title: "NEET PG 2025 Recall", channel: DM, id: "PLcou4I3N5obaBFHQqtY3uKHlqpnFvCVL0" },
  ] },
  { subject: "Cardiology", for: ["Cardiology"], lists: [
    { title: "Cardiovascular Medicine", channel: NN, id: "PLTF9h-T1TcJhi49KL8F4nZWtAYJXLInAz" },
    { title: "Electrocardiogram (ECG)", channel: NN, id: "PLTF9h-T1TcJig4K39e-PpdMuStspFyt4t" },
    { title: "Cardiology", channel: ZF, id: "PLbYQl9-UI2ipjB5L2OZyayYhMIY_iwkOf" },
    { title: "ECG Interpretation", channel: ZF, id: "PLbYQl9-UI2irBDh5Wg8riWsgY6HmGeIoz" },
    { title: "Cardiovascular Physiology", channel: SM, id: "PLYojB5NEEakUcRQCdbMz24Qf7nxK_s0eF" },
    { title: "Pacemakers and ICDs", channel: SM, id: "PLYojB5NEEakXeOM330Szj_8zsc5knrfpc" },
  ] },
  { subject: "Respiratory", for: ["Respiratory"], lists: [
    { title: "Respiratory", channel: ZF, id: "PLbYQl9-UI2iqhK18rzDMGjsgVI7ekaYjj" },
    { title: "Respiratory", channel: RM, id: "PLGNSE_HvIV4tss65eHf8rY8F5Ka6oPeTN" },
    { title: "Respiratory System Pathology", channel: DB, id: "PL_voXEIX5XhtjouodQWFOgoHWlAD4JRoc" },
    { title: "Chest X-Ray Interpretation", channel: MC, id: "PLQ_IRFkDInv9TrcrG4vfuOn57WPTtEmHw" },
  ] },
  { subject: "Gastroenterology", for: ["Gastroenterology"], lists: [
    { title: "Gastrointestinal Medicine", channel: NN, id: "PLTF9h-T1TcJhjKJC9CpkAJqMmP1pNecMN" },
    { title: "Gastroenterology", channel: ZF, id: "PLbYQl9-UI2iofHu9ADEQgsZL_5G69yr1l" },
    { title: "Gastroenterology", channel: RM, id: "PLGNSE_HvIV4um3cXFdumgDHLuaMnmZB_j" },
    { title: "Gastroenterology", channel: AH, id: "PLqTetbgey0adgJOdKjP5yMSBrdLe7QwK0" },
  ] },
  { subject: "Nephrology", for: ["Nephrology"], lists: [
    { title: "Renal", channel: ZF, id: "PLbYQl9-UI2iqXQpw0L50NX-oVG9m32YsR" },
    { title: "Nephrology", channel: RM, id: "PLGNSE_HvIV4v9PmZUL9CKB3O0oM-uNLIV" },
    { title: "Genitourinary Medicine", channel: NN, id: "PLTF9h-T1TcJi2-qKGZ-SeofYv2fl_Spmy" },
    { title: "Electrolytes Course", channel: MP, id: "PLYcLrRDaR8_fP4WuVjZRuhQl_RcFw2-Sc" },
    { title: "Urinalysis Interpretation for Clinicians", channel: MC, id: "PLQ_IRFkDInv_fT8ROSjXllGyjvr27QGKU" },
  ] },
  { subject: "Endocrinology", for: ["Endocrinology"], lists: [
    { title: "Endocrinology", channel: RM, id: "PLGNSE_HvIV4sDqJusCXsODzZhXX_qQx1Q" },
    { title: "Endocrine System", channel: DB, id: "PL_voXEIX5Xhvo-4N-Wg7rFuG7JwY8AOHp" },
    { title: "Drugs Affecting the Endocrine System", channel: SP, id: "PLUVRN4iMdIhxrAZgyZWvK3ZODwaUMtUlE" },
  ] },
  { subject: "Haematology", for: ["Medicine"], lists: [
    { title: "Hematology Medicine", channel: NN, id: "PLTF9h-T1TcJj61ec3ttHSeAARONAE8etq" },
    { title: "Haematology", channel: ZF, id: "PLbYQl9-UI2irB3LrhKSX_u3JVbxaTDp8g" },
    { title: "Haematology", channel: RM, id: "PLGNSE_HvIV4t7a33bbHN1fq-j_tge0Gmp" },
  ] },
  { subject: "Infectious Disease", for: ["Infectious Disease"], lists: [
    { title: "Microbiology & Infectious Disease", channel: RM, id: "PLGNSE_HvIV4tNKXI972O8LSm_vO2PCVmZ" },
    { title: "Antibiotics: Coverage, Side Effects, Pharmacology", channel: MC, id: "PLQ_IRFkDInv9RacVbwjWiyhbXwtnCacii" },
  ] },
  { subject: "Rheumatology", for: ["Orthopedics"], lists: [
    { title: "Musculoskeletal/Rheumatology", channel: NN, id: "PLTF9h-T1TcJhx1hri_MTO0syMgv3Fh7-j" },
    { title: "Rheumatology & Immunology", channel: RM, id: "PLGNSE_HvIV4tALytaHe2FgjQodua-bInI" },
    { title: "Rheumatology", channel: SM, id: "PLYojB5NEEakW19w1r2T-QKQLrlO-kaXws" },
  ] },
  { subject: "Pediatrics", for: ["Pediatrics"], lists: [
    { title: "Pediatrics", channel: NN, id: "PLTF9h-T1TcJgftOzLiuFiBuWSbdCl_6hA" },
    { title: "Paediatrics", channel: ZF, id: "PLbYQl9-UI2ipO1GoBoq4_1vmOrg4Pdvfx" },
    { title: "Pediatric Surgery", channel: DB, id: "PL_voXEIX5XhsNi7xu7zL8vSY-vke-PGZI" },
  ] },
  { subject: "OB/GYN", for: ["OBGYN"], lists: [
    { title: "Obstetrics and Gynaecology", channel: AH, id: "PLqTetbgey0adM_p8Xi1cJ13ICWI3Ob7MK" },
    { title: "Obstetrics", channel: ZF, id: "PLbYQl9-UI2ip_iu_owXZNYgO9KzHMd926" },
  ] },
  { subject: "Surgery", for: ["Surgery"], lists: [
    { title: "General Surgery", channel: RM, id: "PLGNSE_HvIV4t9dlOAgL__tIucA22aOOHo" },
    { title: "Surgery: Quick Review Course", channel: MP, id: "PLYcLrRDaR8_cgJx14KpCeA2v4t9LV3pb1" },
    { title: "Vascular Surgery", channel: AH, id: "PLqTetbgey0ad_CjybgsqhxEJ8Ib7c576V" },
    { title: "Urology", channel: ZF, id: "PLbYQl9-UI2ipvzpGAGcZV9h638XGlsnMi" },
    { title: "Oncology", channel: ZF, id: "PLbYQl9-UI2ipYHGTEhqz25m7J40K00dnE" },
  ] },
  { subject: "Orthopedics", for: ["Orthopedics"], lists: [
    { title: "Orthopaedics", channel: AH, id: "PLqTetbgey0adBEV3Xl1qG9NsKmQM6SJTL" },
    { title: "Muscle Anatomy", channel: NN, id: "PLTF9h-T1TcJhFNCZFBM3BRYga3RITIDpQ" },
  ] },
  { subject: "ENT", for: ["ENT"], lists: [
    { title: "Ears, Nose and Throat", channel: AH, id: "PLqTetbgey0ac_tvd5WeTOYqUPECW4NmnY" },
    { title: "ENT", channel: RM, id: "PLGNSE_HvIV4ugl0qyOPkmZVvf461Pl3ow" },
    { title: "Ear, Nose and Throat System", channel: DB, id: "PL_voXEIX5XhueeBhSb98EsyGkmP0-uMBm" },
  ] },
  { subject: "Dermatology & Eye", for: ["Dermatology", "Ophthalmology"], lists: [
    { title: "Dermatology", channel: AH, id: "PLqTetbgey0afPscdWKZ-1hqJ31NVjCkoD" },
    { title: "Ophthalmology OSCE Guides", channel: GM, id: "PLwYICl63HBzle0SXTvAWEtE0dAcbNg-7G" },
  ] },
  { subject: "Emergency & ICU", for: ["Emergency", "Anesthesiology"], lists: [
    { title: "Emergency Medicine: Quick Review Course", channel: MP, id: "PLYcLrRDaR8_c2J35DbgNV7vAxu_nvEva3" },
    { title: "Critical Care Medicine", channel: AH, id: "PLqTetbgey0acU-mIQfG69ZbgsABNzB622" },
    { title: "Rapid Response Calls", channel: SM, id: "PLYojB5NEEakVge2DFiNeDDLC77SHX4LFo" },
    { title: "IV Fluids", channel: SM, id: "PLYojB5NEEakVYmB-_2iLrYI9SkShGKcus" },
    { title: "Anaesthetics", channel: ZF, id: "PLbYQl9-UI2ipcwltoVZ7NbGaclIbaeWLx" },
    { title: "Ultrasound for Clinicians (POCUS)", channel: MC, id: "PLQ_IRFkDInv-hMXqi7cfBMTrJKdyCjem3" },
  ] },
  { subject: "Radiology", for: ["Radiology"], lists: [
    { title: "Emergency Radiology Course", channel: RP, id: "PLLX-8qcJVxpX4AgyD5PgGCV6YvO2r6bR4" },
    { title: "Medical Imaging Anatomy Course", channel: RP, id: "PLLX-8qcJVxpWx-mwBuds4MtVy2uhbWG9G" },
    { title: "Radiology Signs", channel: RP, id: "PLLX-8qcJVxpWlRhqLiqkJwfF75orSWUTx" },
    { title: "Cases in Radiology", channel: RP, id: "PLLX-8qcJVxpUKU8xbHZIvbFO_l-rbGG4e" },
  ] },
  { subject: "Neurology & Psychiatry", for: ["Neurology", "Psychiatry"], lists: [
    { title: "Neurological Examination OSCE Guides", channel: GM, id: "PLwYICl63HBzk9-kb-i3uDQthQAz3JuRTW" },
    { title: "Mental State Examination Examples", channel: GM, id: "PLwYICl63HBzkiOxI_AHWA3nbvz__a145J" },
  ] },
  { subject: "Pharmacology", lists: [
    { title: "Pharmacology", channel: NN, id: "PLTF9h-T1TcJgjGPoq4bYqiL1LLQGMh0tP" },
    { title: "Cardiovascular Pharmacology", channel: NN, id: "PLTF9h-T1TcJghboF2tNKpqbDWSyva6xSW" },
    { title: "Drugs Affecting the Cardiovascular System", channel: SP, id: "PLUVRN4iMdIhwFTQ9Rr_YAvEOCg_7FKrmq" },
    { title: "Drugs Affecting the Autonomic Nervous System", channel: SP, id: "PLUVRN4iMdIhyanyAcHZdEu38l3fD1LA8I" },
    { title: "Antiarrhythmics", channel: SM, id: "PLYojB5NEEakXTtMFJFqPm4kiWbP7NN3v8" },
  ] },
  { subject: "Community Medicine & Stats", lists: [
    { title: "Epidemiology, Medical Statistics & Biostatistics", channel: MC, id: "PLQ_IRFkDInv-MusDTdmk1kFrGwZCui3GI" },
    { title: "Statistics", channel: MP, id: "PLYcLrRDaR8_c81UXlAZN3D3qXELV9cpOM" },
    { title: "Public Health", channel: AH, id: "PLqTetbgey0afCpIjY3lDdXxSEeJmxVHK8" },
  ] },
  { subject: "Ward & OSCE Skills", for: ["General Practice"], lists: [
    { title: "Intern Crash Course", channel: SM, id: "PLYojB5NEEakX7NBjs24Vd1dZaeOus3Uju" },
    { title: "An Approach to Symptoms", channel: SM, id: "PLYojB5NEEakUdpK2b-FjIyVQ4kBpe4MIb" },
    { title: "Lab Test Interpretation", channel: SM, id: "PLYojB5NEEakU4b8WH2NrP3wDRXfa2SqgF" },
    { title: "Physical Exam Series", channel: NN, id: "PLTF9h-T1TcJgCujF_kXpBpagQtoFPx2iP" },
    { title: "Clinical Examination OSCE Guides", channel: GM, id: "PLwYICl63HBzmxTZa84pFCyuCgu2rl9dS-" },
    { title: "General Practice", channel: ZF, id: "PLbYQl9-UI2ioKanpIsFm3qqoIWAdzcpC5" },
  ] },
];
