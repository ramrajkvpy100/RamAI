/**
 * The second batch of scroll-through series, added by `node scripts/radiology-stacks.mjs more:<base>:<n>` — every one from a
 * TCIA collection whose licence was read from TCIA itself (CC BY 3.0 / 4.0; the series' own licence is checked again on
 * download) and whose label is that collection's ground truth, never guessed from the picture.
 *
 * `{who}` in a history is the patient's age and sex from the collection's clinical table or the scan's own metadata;
 * "Patient", "Man" or "Woman" for whatever neither says. The rest of a history is only what is known of every patient in the series: never invented symptoms, findings or risk factors.
 * A key says what the collection established and then what that diagnosis typically looks like, not what this patient's
 * scan was measured to show.
 */
import { readFileSync } from "node:fs";

const REMIND = JSON.parse(readFileSync(new URL("./radiology-remind-clinical.json", import.meta.url), "utf8"));
const remind = (cat) => (s) => s.StudyDesc === "Preop" && REMIND[s.PatientID]?.cat === cat && (cat !== "gbm" || REMIND[s.PatientID].enhancement === "Yes");
const place = (s) => REMIND[s]?.location.toLowerCase();

const SOFT = [40, 400];
const LUNG = [-600, 1500];
const CT_SOFT = { modality: "CT", window: SOFT };
const CT_LUNG = { modality: "CT", window: LUNG };
const MR = { modality: "MR", window: "auto" };
/** Series that are never the study a reader wants: unenhanced, delayed, or the wrong part of the body. */
const NOT_ABDO = /\bPRE\b|PRE-|PRE |non.?con|NON|S\/C|DRY|delay|LUNG|PULM|CHEST(?!.*(ABD|PEL))|bone|dual|test|bolus|monitor|recon 1|neck/i;
const NOT_CHEST = /abd|pelvis|bone|neck|head|liver|recon 2/i;

const HCC = {
  diagnosis: "Hepatocellular carcinoma",
  options: ["Hepatocellular carcinoma", "Liver metastases", "Hepatic haemangioma", "Cholangiocarcinoma"],
  question: "CT abdomen with contrast (liver): findings?",
  histories: ["{who}, referred for a contrast CT of the liver. No further clinical details on the request."],
};
const LUNG_CA = {
  diagnosis: "Lung cancer",
  options: ["Lung cancer", "Organising pneumonia", "Tuberculoma", "Round atelectasis"],
  question: "CT chest (lung windows): findings?",
  histories: ["{who}, referred for a CT of the chest. No further clinical details on the request."],
};
const PANCREAS = {
  diagnosis: "Pancreatic adenocarcinoma",
  options: ["Pancreatic adenocarcinoma", "Chronic pancreatitis", "Autoimmune pancreatitis", "Neuroendocrine tumour"],
  question: "CT abdomen with contrast (pancreas): findings?",
  histories: ["{who}, referred for a contrast CT of the abdomen. No further clinical details on the request."],
};
const COVID = {
  diagnosis: "COVID-19 pneumonia",
  options: ["COVID-19 pneumonia", "Pneumocystis pneumonia", "Pulmonary oedema", "Organising pneumonia"],
  question: "CT chest (lung windows): findings?",
  histories: ["{who}, referred for a CT of the chest. No further clinical details on the request."],
  key: "This collection's patients tested positive for COVID-19. The usual CT picture is bilateral, peripheral, often basal ground-glass opacity, with or without consolidation or a crazy-paving pattern.",
};
const GBM = {
  diagnosis: "Glioblastoma",
  options: ["Glioblastoma", "Brain metastasis", "Cerebral abscess", "CNS lymphoma"],
  question: "MRI brain with contrast (axial T1 post-gadolinium): findings?",
  histories: ["{who} having an MRI brain. No further clinical details on the request."],
};
const VS = {
  diagnosis: "Vestibular schwannoma",
  options: ["Vestibular schwannoma", "CPA meningioma", "Epidermoid cyst", "Facial nerve schwannoma"],
  question: "MRI internal auditory meati (high-resolution T2, axial): findings?",
  histories: ["{who}, referred for an MRI of the internal auditory meati. No further clinical details on the request."],
  key: "This collection is of patients with a vestibular schwannoma. It typically sits in the internal auditory canal and may extend into the cerebellopontine angle (the 'ice-cream cone' shape), a dark filling defect against bright CSF on T2.",
};

export const MORE_STACKS = [
  // ── More of the diagnoses already here ─────────────────────────────────────────────────────────────────────────────
  { ...CT_SOFT, ...HCC, id: "hcc-tace-b", collection: "HCC-TACE-Seg", license: "CC BY 4.0", doi: "10.7937/TCIA.5FNA-0924", match: /AP\)|C\/A|CAP|ABD|VENOUS|STANDARD|SOFT/i, avoid: NOT_ABDO,
    key: "This collection is of patients with hepatocellular carcinoma referred for embolisation. HCC is typically a liver mass with arterial enhancement and later washout, often in a cirrhotic liver." },
  { ...CT_SOFT, ...HCC, id: "hcc-lihc-b", collection: "TCGA-LIHC", license: "CC BY 3.0", doi: "10.7937/K9/TCIA.2016.IMMQW8UQ", match: /venous|portal|arterial|art\.|Body . CE|contrast|AXIAL/i, avoid: NOT_ABDO,
    key: "This is a TCGA patient with tissue-proven hepatocellular carcinoma. HCC is typically a liver mass with arterial enhancement and later washout, often in a cirrhotic liver." },
  { ...CT_LUNG, ...LUNG_CA, id: "lung-luad-b", collection: "TCGA-LUAD", license: "CC BY 3.0", doi: "10.7937/K9/TCIA.2016.JGNIHEP5", match: /chest|lung|thorax/i, avoid: NOT_CHEST,
    key: "This is a TCGA patient with tissue-proven lung adenocarcinoma. It typically forms a peripheral nodule or mass, often with spiculated margins, with or without a ground-glass part, nodes or pleural disease." },
  { ...CT_LUNG, ...LUNG_CA, id: "lung-lusc-b", collection: "TCGA-LUSC", license: "CC BY 3.0", doi: "10.7937/K9/TCIA.2016.TYGKKFMQ", match: /chest|lung|helical|contrast|recon/i, avoid: NOT_CHEST,
    key: "This is a TCGA patient with tissue-proven squamous cell carcinoma of the lung. It is typically a central or hilar mass, sometimes cavitating, with or without distal collapse and nodes." },
  { ...CT_LUNG, ...LUNG_CA, id: "lung-cptac-b", collection: "CPTAC-LUAD", license: "CC BY 4.0", doi: "10.7937/K9/TCIA.2018.PAT12TBS", match: /chest|lung|thorax/i, avoid: NOT_CHEST,
    key: "This is a CPTAC patient with tissue-proven lung adenocarcinoma. It typically forms a peripheral nodule or mass, often with spiculated margins, with or without a ground-glass part, nodes or pleural disease." },
  { ...CT_LUNG, ...COVID, id: "covid-ar-b", collection: "COVID-19-AR", license: "CC BY 4.0", doi: "10.7937/tcia.2020.py71-5978", match: /.*/, avoid: /kidney|delay|abd|pelvis/i },
  { ...CT_LUNG, ...COVID, id: "covid-sbu-b", collection: "COVID-19-NY-SBU", license: "CC BY 4.0", doi: "10.7937/TCIA.BBAG-2923", match: /lung|chest/i, avoid: /abd|pelvis|CTA|PE\b/i },
  { ...MR, ...GBM, id: "gbm-remind-b", collection: "ReMIND", license: "CC BY 4.0", doi: "10.7937/3RAG-D070", match: /3D_AX_T1_postcontrast/, filter: remind("gbm"), clinical: REMIND,
    keyOf: (p) => `Histology-proven glioblastoma (WHO grade 4), ${place(p)}, before surgery. It is typically an intra-axial mass with an irregular enhancing rim around a necrotic centre, with oedema and mass effect.` },
  { ...MR, ...GBM, id: "gbm-upenn-b", collection: "UPENN-GBM", license: "CC BY 4.0", doi: "10.7937/TCIA.709X-DN49", match: /3D GAD|T1.*GD|POST/i, avoid: /DTI|FLAIR|DWI|ADC|perf|T2/i,
    key: "This collection is of patients with glioblastoma. It is typically an intra-axial mass with an irregular enhancing rim around a necrotic centre, with oedema and mass effect." },
  { ...MR, ...VS, id: "vs-mcrc-b", collection: "Vestibular-Schwannoma-MC-RC", license: "CC BY 4.0", doi: "10.7937/HRZH-2N82", match: /FIESTA|CISS|DRIVE|spc|SPACE/i, avoid: /T1|FLAIR/i },
  { ...MR, ...VS, id: "vs-seg-b", collection: "Vestibular-Schwannoma-SEG", license: "CC BY 4.0", doi: "10.7937/TCIA.9YTJ-5Q73", match: /ci3d|tse3d|spc/i, avoid: /gad|S\d+_DIS|t1_/i },
  { ...CT_SOFT, ...PANCREAS, id: "panc-cptac-b", collection: "CPTAC-PDA", license: "CC BY 4.0", doi: "10.7937/K9/TCIA.2018.SC20FO18", match: /venous|portal|\bPV\b|80 SEC|pancreas|enhanced/i, avoid: NOT_ABDO,
    key: "This is a CPTAC patient with tissue-proven pancreatic ductal adenocarcinoma. It is typically a poorly defined hypodense mass, often with a dilated pancreatic and/or common bile duct." },
  { ...CT_SOFT, ...PANCREAS, id: "panc-seg-b", collection: "Pancreatic-CT-CBCT-SEG", license: "CC BY 4.0", doi: "10.7937/TCIA.ESHQ-4D90", match: /^$|DI|DIBH/i, avoid: /aligned|CBCT|chest/i,
    key: "This collection is of patients with locally advanced pancreatic cancer scanned for radiotherapy planning. It is typically a poorly defined hypodense mass, often encasing nearby vessels." },
  { ...CT_SOFT, id: "adrenal-b", collection: "Adrenal-ACC-Ki67-Seg", license: "CC BY 4.0", doi: "10.7937/1FPG-VM46", match: /.*/, avoid: /PRE\b|no series|non|delay/i,
    diagnosis: "Adrenal mass", options: ["Adrenal mass", "Upper-pole renal tumour", "Retroperitoneal sarcoma", "Gastric GIST"], question: "CT abdomen with contrast: findings?",
    histories: ["{who}, referred for a contrast CT of the abdomen. No further clinical details on the request."],
    key: "This collection is of patients with adrenocortical carcinoma. It is typically a large, heterogeneous suprarenal mass, separate from the kidney, often with central necrosis, displacing nearby organs." },
  { ...MR, id: "breast-tcga-b", front: true, collection: "TCGA-BRCA", license: "CC BY 3.0", doi: "10.7937/K9/TCIA.2016.AB2NAZRP", match: /sub|post|dyn|vibrant/i, avoid: /pre\b|_pre|^pre|calib|sag|bind/i,
    diagnosis: "Breast cancer", options: ["Breast cancer", "Fibroadenoma", "Breast abscess", "Phyllodes tumour"], question: "Breast MRI (post-contrast): findings?",
    histories: ["{who}, referred for a breast MRI. No further clinical details on the request."],
    key: "This is a TCGA patient with tissue-proven invasive breast carcinoma. It typically enhances as an irregular or spiculated mass, with rapid uptake and early washout." },
  { ...MR, id: "breast-vibrant-b", front: true, collection: "TCGA-BRCA", license: "CC BY 3.0", doi: "10.7937/K9/TCIA.2016.AB2NAZRP", match: /^Ax Vibrant \+C$/i,
    diagnosis: "Breast cancer", options: ["Breast cancer", "Fibroadenoma", "Breast abscess", "Phyllodes tumour"], question: "Breast MRI (post-contrast): findings?",
    histories: ["{who}, referred for a breast MRI. No further clinical details on the request."],
    key: "This is a TCGA patient with tissue-proven invasive breast carcinoma. It typically enhances as an irregular or spiculated mass, with rapid uptake and early washout." },
  { ...CT_SOFT, id: "normal-abdo-b", collection: "Pancreas-CT", license: "CC BY 3.0", doi: "10.7937/K9/TCIA.2016.tNB1kqBU", match: /.*/,
    diagnosis: "Normal CT abdomen", options: ["Normal CT abdomen", "Early acute pancreatitis", "Small liver metastases", "Small renal tumour"], question: "CT abdomen with contrast: any abnormality?",
    histories: ["{who}, referred for a contrast CT of the abdomen. No further clinical details on the request."],
    key: "This collection's subjects are healthy kidney donors or patients with no major abdominal disease and no pancreatic lesion. Normal liver, pancreas, kidneys and spleen." },

  // ── New diagnoses ──────────────────────────────────────────────────────────────────────────────────────────────────
  { ...MR, id: "lgg-remind", collection: "ReMIND", license: "CC BY 4.0", doi: "10.7937/3RAG-D070", match: /(2D|3D)_AX_T2_FLAIR/, filter: remind("lgg"), clinical: REMIND,
    diagnosis: "Low-grade glioma", options: ["Low-grade glioma", "Glioblastoma", "Herpes encephalitis", "Subacute infarct"], question: "MRI brain (axial FLAIR): findings?",
    histories: ["{who} having an MRI brain before planned neurosurgery. No further clinical details on the request."],
    keyOf: (p) => `Histology-proven ${REMIND[p].histology.toLowerCase()} (WHO grade 2), ${place(p)}, before surgery. Low-grade gliomas are typically ill-defined, FLAIR-bright intra-axial lesions with little mass effect and little or no enhancement.` },
  { ...MR, id: "brain-met-remind", collection: "ReMIND", license: "CC BY 4.0", doi: "10.7937/3RAG-D070", match: /3D_AX_T1_postcontrast/, filter: remind("met"), clinical: REMIND,
    diagnosis: "Brain metastasis", options: ["Brain metastasis", "Glioblastoma", "Cerebral abscess", "Tuberculoma"], question: "MRI brain with contrast (axial T1 post-gadolinium): findings?",
    histories: ["{who} having an MRI brain before planned neurosurgery. No further clinical details on the request."],
    keyOf: (p) => `Histology-proven: ${REMIND[p].histology.replace(/Metastastic/i, "Metastatic").replace(/ with .*/, "").replace(/\.$/, "").toLowerCase()}, ${place(p)}, before surgery. Brain metastases typically enhance as solid or ring lesions at the grey-white junction, with oedema out of proportion to their size.` },
  { ...CT_SOFT, id: "rcc-cptac", collection: "CPTAC-CCRCC", license: "CC BY 4.0", doi: "10.7937/k9/tcia.2018.oblamn27", match: /zyln|tetnicz|venous|arterial|portal|abd|contrast|post/i, avoid: NOT_ABDO,
    diagnosis: "Renal cell carcinoma", options: ["Renal cell carcinoma", "Angiomyolipoma", "Renal oncocytoma", "Renal abscess"], question: "CT abdomen with contrast: findings?",
    histories: ["{who}, referred for a contrast CT of the abdomen. No further clinical details on the request."],
    key: "This is a CPTAC patient with tissue-proven clear-cell renal cell carcinoma. It is typically a heterogeneous, avidly enhancing renal mass distorting the kidney's contour, often with necrosis." },
  { ...CT_SOFT, id: "rcc-kirc", collection: "TCGA-KIRC", license: "CC BY 3.0", doi: "10.7937/K9/TCIA.2016.V6PBVTDR", match: /C\/A\/P|CAP|abd|venous|arterial|portal|post|contrast|axial/i, avoid: NOT_ABDO,
    diagnosis: "Renal cell carcinoma", options: ["Renal cell carcinoma", "Angiomyolipoma", "Renal oncocytoma", "Renal abscess"], question: "CT abdomen with contrast: findings?",
    histories: ["{who}, referred for a contrast CT of the abdomen. No further clinical details on the request."],
    key: "This is a TCGA patient with tissue-proven clear-cell renal cell carcinoma. It is typically a heterogeneous, avidly enhancing renal mass distorting the kidney's contour, often with necrosis." },
  { ...CT_SOFT, id: "crlm-b", collection: "Colorectal-Liver-Metastases", license: "CC BY 4.0", doi: "10.7937/QXK2-QG03", match: /.*/, avoid: NOT_ABDO,
    diagnosis: "Liver metastases", options: ["Liver metastases", "Hepatocellular carcinoma", "Hepatic abscesses", "Hepatic lymphoma"], question: "CT abdomen, portal venous phase: findings?",
    histories: ["{who}, referred for a contrast CT of the abdomen. No further clinical details on the request."],
    key: "This collection is of patients having surgery for colorectal liver metastases, scanned beforehand. They are typically hypodense lesions in the portal venous phase, single or multiple, some with a faint enhancing rim." },
  { ...CT_SOFT, id: "ovary-tcga", collection: "TCGA-OV", license: "CC BY 3.0", doi: "10.7937/K9/TCIA.2016.NDO1MDFQ", match: /AP.Routine|AXIAL|ABD|CH\/AB|CAP|contrast/i, avoid: /cor\b|NOT_USED|DELAY|PE\b|LUNG/i, sex: "F",
    diagnosis: "Ovarian carcinoma", options: ["Ovarian carcinoma", "Tubo-ovarian abscess", "Endometrioma", "Mucinous cystadenoma"], question: "CT abdomen and pelvis with contrast: findings?",
    histories: ["{who}, referred for a contrast CT of the abdomen and pelvis. No further clinical details on the request."],
    key: "This is a TCGA patient with tissue-proven serous ovarian cystadenocarcinoma. It typically shows a complex solid-cystic adnexal mass, with or without ascites and peritoneal or omental deposits." },
  { ...CT_SOFT, id: "stomach-tcga", collection: "TCGA-STAD", license: "CC BY 3.0", doi: "10.7937/K9/TCIA.2016.GDHL9KIM", match: /C\/C|PORTAL|\bPOR\b|contrast|venous/i, avoid: /S\/C|SAG|COR|LUNG|PULM|EQUIL/i,
    diagnosis: "Gastric carcinoma", options: ["Gastric carcinoma", "Gastric lymphoma", "Gastric GIST", "Ménétrier disease"], question: "CT abdomen with contrast: findings?",
    histories: ["{who}, referred for a contrast CT of the abdomen. No further clinical details on the request."],
    key: "This is a TCGA patient with tissue-proven gastric adenocarcinoma. It is typically focal or diffuse thickening of the gastric wall, with or without a mass, nodes or spread beyond the wall." },
  { ...CT_SOFT, id: "oesophagus-tcga", collection: "TCGA-ESCA", license: "CC BY 3.0", doi: "10.7937/K9/TCIA.2016.VPTNRGFY", match: /C\/C|PORTAL|\bPOR\b|contrast|venous|chest/i, avoid: /S\/C|SAG|COR|LUNG|PULM|EQUIL/i,
    diagnosis: "Oesophageal carcinoma", options: ["Oesophageal carcinoma", "Oesophageal leiomyoma", "Achalasia", "Hiatus hernia"], question: "CT chest and abdomen with contrast: findings?",
    histories: ["{who}, referred for a contrast CT of the chest and abdomen. No further clinical details on the request."],
    key: "This is a TCGA patient with tissue-proven oesophageal carcinoma. It typically shows asymmetric or circumferential wall thickening, with or without dilatation above it, nodes or loss of fat planes." },
  { ...CT_SOFT, id: "bladder-tcga", collection: "TCGA-BLCA", license: "CC BY 3.0", doi: "10.7937/K9/TCIA.2016.8LNG8XDR", match: /ABD|PELV|C-A-P|AXIAL|CT . mm|CAP/i, avoid: /\bPRE\b|PRE-|S\/C|LUNG|CHEST|COR|SAG|APPLIED/i,
    diagnosis: "Bladder carcinoma", options: ["Bladder carcinoma", "Bladder diverticulum", "Bladder blood clot", "Prostate enlargement"], question: "CT abdomen and pelvis with contrast: findings?",
    histories: ["{who}, referred for a contrast CT of the abdomen and pelvis. No further clinical details on the request."],
    key: "This is a TCGA patient with tissue-proven urothelial carcinoma of the bladder. It is typically a focal mass or wall thickening projecting into the lumen, with or without hydronephrosis or spread outside the bladder." },
  { ...MR, id: "sarcoma-sts", collection: "Soft-tissue-Sarcoma", license: "CC BY 3.0", doi: "10.7937/K9/TCIA.2015.7GO2GSKS", match: /ax.*(T2|STIR)|T2.*ax|STIR.*ax/i, avoid: /Aligned/i,
    diagnosis: "Soft tissue sarcoma", options: ["Soft tissue sarcoma", "Intramuscular lipoma", "Muscle haematoma", "Soft tissue abscess"], question: "MRI of the limb (axial, fluid-sensitive): findings?",
    histories: ["{who} having an MRI of a limb for a soft tissue mass. No further clinical details on the request."],
    key: "This collection is of patients with histology-proven limb soft tissue sarcoma. It is typically a large, deep, heterogeneous mass, bright on fluid-sensitive sequences, with or without necrosis and surrounding oedema." },
  { ...MR, id: "cervix-tcga", collection: "TCGA-CESC", license: "CC BY 3.0", doi: "10.7937/K9/TCIA.2016.SQ4M8YP4", match: /ax.*T2|T2.*ax/i, avoid: /fat|FS|SPAIR|DIF|haste|ss/i, sex: "F",
    diagnosis: "Cervical carcinoma", options: ["Cervical carcinoma", "Endometrial carcinoma", "Uterine fibroid", "Nabothian cysts"], question: "MRI pelvis (axial T2): findings?",
    histories: ["{who}, referred for an MRI of the pelvis. No further clinical details on the request."],
    key: "This is a TCGA patient with tissue-proven cervical carcinoma. It is typically a mass of intermediate T2 signal in the cervix, interrupting the dark cervical stroma, with or without spread beyond it." },
];
