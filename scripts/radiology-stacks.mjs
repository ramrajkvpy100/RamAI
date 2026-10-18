/**
 * Builds the radiology scroll-through stacks from The Cancer Imaging Archive (TCIA): one real,
 * CC BY-licensed CT or MRI series per diagnosis, downloaded once, windowed and saved as JPEG slices
 * in public/radiology/<id>/, with a manifest (src/lib/radiology-stacks.json) that credits each
 * collection as its licence requires. No AI anywhere. Run: node scripts/radiology-stacks.mjs
 */
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";

import dicomParser from "dicom-parser";
import { unzipSync } from "fflate";
import jpeg from "jpeg-js";

const NBIA = "https://services.cancerimagingarchive.net/nbia-api/services/v1";
const OUT = path.resolve("public/radiology");
const SIZE = 384;
const MAX_SLICES = 72;

/** The stacks: which collection, which series, how to window it, and the case around it. */
/**
 * Each stack is kept only after its slices were looked at and the finding is plainly visible
 * (rcc, crlm and lung-nodule series were tried and left out: their lesions weren't clear enough).
 */
const STACKS = [
  { id: "gbm-mri", collection: "UPENN-GBM", license: "CC BY 4.0", doi: "10.7937/TCIA.709X-DN49", modality: "MR", match: /3D GAD|T1.*GD|POST/i, window: "auto",
    diagnosis: "Glioblastoma", history: "61-year-old man with 4 weeks of worsening headache, personality change and new left-sided weakness.", question: "MRI brain with contrast (axial T1 post-gadolinium): findings?",
    key: "A large intra-axial mass with thick, irregular ring enhancement around a necrotic centre, surrounding vasogenic oedema and mass effect — typical of glioblastoma.",
    options: ["Glioblastoma", "Cerebral abscess", "Brain metastasis", "Meningioma"] },
  { id: "lung-nodule-ct", collection: "LIDC-IDRI", license: "CC BY 3.0", doi: "10.7937/K9/TCIA.2015.LO9QL9SX", modality: "CT", match: /.*/, window: [-600, 1500],
    diagnosis: "Pulmonary nodule", history: "64-year-old man, 40 pack-years, having lung cancer screening. No symptoms.", question: "Low-dose CT chest (lung windows): findings?",
    key: "One or more well-defined soft-tissue nodules in the lung parenchyma — a pulmonary nodule to characterise by size, density and margin (Fleischner / Lung-RADS follow-up).",
    options: ["Pulmonary nodule", "Pneumothorax", "Pleural effusion", "Normal CT chest"] },
  { id: "rcc-ct", collection: "TCGA-KIRC", license: "CC BY 3.0", doi: "10.7937/K9/TCIA.2016.V6PBVTDR", modality: "CT", match: /axial|abd|venous|arterial|portal|post|contrast/i, window: [40, 400],
    diagnosis: "Renal cell carcinoma", history: "57-year-old man with painless visible haematuria and weight loss.", question: "CT abdomen with contrast: findings?",
    key: "A solid, heterogeneously enhancing mass arising from the kidney, distorting its contour — typical of clear-cell renal cell carcinoma.",
    options: ["Renal cell carcinoma", "Simple renal cyst", "Hydronephrosis", "Renal calculus"] },
  { id: "hcc-ct", collection: "TCGA-LIHC", license: "CC BY 3.0", doi: "10.7937/K9/TCIA.2016.IMMQW8UQ", modality: "CT", match: /axial|abd|venous|arterial|portal|post|contrast|liver/i, window: [60, 360],
    diagnosis: "Hepatocellular carcinoma", history: "63-year-old man with hepatitis B cirrhosis, rising alpha-fetoprotein and weight loss.", question: "CT abdomen (liver protocol): findings?",
    key: "A focal liver mass in a cirrhotic liver, enhancing in the arterial phase with washout later — hepatocellular carcinoma.",
    options: ["Hepatocellular carcinoma", "Liver abscess", "Simple hepatic cyst", "Fatty liver"] },
  { id: "crlm-ct", collection: "Colorectal-Liver-Metastases", license: "CC BY 4.0", doi: "10.7937/QXK2-QG03", modality: "CT", match: /.*/, window: [60, 360],
    diagnosis: "Liver metastases", history: "66-year-old woman, a year after surgery for colon cancer, with a rising CEA.", question: "CT abdomen, portal venous phase: findings?",
    key: "Multiple hypodense lesions in the liver, some with a faint enhancing rim — liver metastases.",
    options: ["Liver metastases", "Hepatocellular carcinoma", "Liver abscess", "Normal liver"] },
  { id: "covid-ct", collection: "COVID-19-AR", license: "CC BY 4.0", doi: "10.7937/tcia.2020.py71-5978", modality: "CT", match: /.*/, window: [-600, 1500],
    diagnosis: "COVID-19 pneumonia", history: "52-year-old man with 8 days of fever, dry cough and breathlessness; SpO₂ 89% on air.", question: "CT chest (lung windows): findings?",
    key: "Bilateral, peripheral, posterior ground-glass opacities with some consolidation — the typical pattern of COVID-19 pneumonia.",
    options: ["COVID-19 pneumonia", "Lobar pneumonia", "Pulmonary oedema", "Miliary tuberculosis"] },
  { id: "vs-mri", collection: "Vestibular-Schwannoma-MC-RC", license: "CC BY 4.0", doi: "10.7937/HRZH-2N82", modality: "MR", match: /FIESTA|CISS|T2/i, window: "auto",
    diagnosis: "Vestibular schwannoma", history: "48-year-old woman with gradual hearing loss and tinnitus in one ear, and unsteadiness.", question: "MRI internal auditory meati (high-resolution T2): findings?",
    key: "A well-defined mass in the internal auditory canal extending into the cerebellopontine angle ('ice-cream cone') — vestibular schwannoma.",
    options: ["Vestibular schwannoma", "Meningioma", "Glioblastoma", "Normal MRI"] },
  { id: "normal-abdo-ct", collection: "Pancreas-CT", license: "CC BY 3.0", doi: "10.7937/K9/TCIA.2016.tNB1kqBU", modality: "CT", match: /.*/, window: [40, 400],
    diagnosis: "Normal CT abdomen", history: "30-year-old kidney donor having a routine work-up scan. No symptoms.", question: "CT abdomen with contrast: any abnormality?",
    key: "Normal liver, pancreas, kidneys, spleen and bowel; no mass, collection or free fluid.",
    options: ["Normal CT abdomen", "Acute pancreatitis", "Liver metastases", "Renal cell carcinoma"] },
  { id: "spine-mets-ct", collection: "Spine-Mets-CT-SEG", license: "CC BY 4.0", doi: "10.7937/kh36-ds04", modality: "CT", match: /.*/, window: [400, 1800],
    diagnosis: "Spinal metastases", history: "64-year-old man with known prostate cancer and 6 weeks of worsening back pain, worse at night.", question: "CT spine (bone windows): findings?",
    key: "Focal lytic and/or sclerotic lesions in the vertebral bodies and posterior elements, with or without loss of height — spinal metastases.",
    options: ["Spinal metastases", "Osteoporotic compression fracture", "Spinal tuberculosis (Pott's)", "Normal spine"] },
  { id: "kidney-tumour-ct", collection: "C4KC-KiTS", license: "CC BY 3.0", doi: "10.7937/TCIA.2019.IX49E8NX", modality: "CT", match: /.*/, window: [40, 400],
    diagnosis: "Renal cell carcinoma", history: "59-year-old man with painless haematuria; a renal mass was seen on ultrasound.", question: "CT abdomen with contrast: findings?",
    key: "A solid, enhancing renal mass distorting the kidney's outline — renal cell carcinoma until proven otherwise.",
    options: ["Renal cell carcinoma", "Simple renal cyst", "Hydronephrosis", "Renal calculus"] },
  { id: "hcc-tace-ct", collection: "HCC-TACE-Seg", license: "CC BY 4.0", doi: "10.7937/TCIA.5FNA-0924", modality: "CT", match: /.*/, window: [60, 360],
    diagnosis: "Hepatocellular carcinoma", history: "66-year-old man with alcohol-related cirrhosis and a rising alpha-fetoprotein.", question: "Multiphase CT liver: findings?",
    key: "A focal mass in a cirrhotic liver with arterial enhancement and washout — hepatocellular carcinoma.",
    options: ["Hepatocellular carcinoma", "Liver abscess", "Hepatic haemangioma", "Liver metastases"] },
  { id: "pancreatic-ca-ct", collection: "CPTAC-PDA", license: "CC BY 4.0", doi: "10.7937/K9/TCIA.2018.SC20FO18", modality: "CT", match: /venous|portal|abd|pancreas|contrast|axial/i, window: [40, 400],
    diagnosis: "Pancreatic adenocarcinoma", history: "68-year-old woman with painless jaundice, weight loss and new-onset diabetes.", question: "CT abdomen (pancreas protocol): findings?",
    key: "A poorly defined hypodense mass in the pancreas, often with a dilated pancreatic and/or common bile duct — pancreatic adenocarcinoma.",
    options: ["Pancreatic adenocarcinoma", "Acute pancreatitis", "Pancreatic pseudocyst", "Normal pancreas"] },
  { id: "lung-ca-ct", collection: "CPTAC-LUAD", license: "CC BY 4.0", doi: "10.7937/K9/TCIA.2018.PAT12TBS", modality: "CT", match: /chest|lung|thorax|axial|ct/i, window: [-600, 1500],
    diagnosis: "Lung cancer", history: "67-year-old woman, ex-smoker, with persistent cough, weight loss and one episode of haemoptysis.", question: "CT chest (lung windows): findings?",
    key: "A spiculated soft-tissue mass in the lung, sometimes with nodal enlargement or pleural involvement — primary lung cancer.",
    options: ["Lung cancer", "Lobar pneumonia", "Tuberculous cavity", "Pulmonary embolism"] },
  { id: "breast-mri", collection: "TCGA-BRCA", license: "CC BY 3.0", doi: "10.7937/K9/TCIA.2016.AB2NAZRP", modality: "MR", match: /post|sub|dyn|vibrant|t1/i, window: "auto",
    diagnosis: "Breast cancer", history: "49-year-old woman with a palpable lump in one breast; mammogram was dense and inconclusive.", question: "Breast MRI (post-contrast): findings?",
    key: "An irregular, enhancing mass with spiculated margins in the breast — suspicious for breast carcinoma (BI-RADS 5).",
    options: ["Breast cancer", "Fibroadenoma", "Simple breast cyst", "Normal breast MRI"] },
];

const getJson = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
};

/** The pixel values of one DICOM slice, with where it sits (for ordering). */
function readSlice(bytes) {
  const ds = dicomParser.parseDicom(bytes);
  const ts = ds.string("x00020010") ?? "";
  if (!["1.2.840.10008.1.2", "1.2.840.10008.1.2.1"].includes(ts.trim())) return null; // compressed: skipped
  const rows = ds.uint16("x00280010"), cols = ds.uint16("x00280011");
  const bits = ds.uint16("x00280100"), signed = ds.uint16("x00280103") === 1;
  const el = ds.elements.x7fe00010;
  if (!el || !rows || !cols) return null;
  const slope = parseFloat(ds.string("x00281053") ?? "1") || 1, intercept = parseFloat(ds.string("x00281052") ?? "0") || 0;
  const n = rows * cols;
  const px = new Float32Array(n);
  const buf = bytes.buffer, off = bytes.byteOffset + el.dataOffset;
  const view = bits === 16 ? (signed ? new Int16Array(buf.slice(off, off + n * 2)) : new Uint16Array(buf.slice(off, off + n * 2))) : new Uint8Array(buf.slice(off, off + n));
  for (let i = 0; i < n; i++) px[i] = view[i] * slope + intercept;
  const pos = (ds.string("x00200032") ?? "").split("\\").map(Number);
  const inst = parseInt(ds.string("x00200013") ?? "0", 10);
  return { rows, cols, px, z: Number.isFinite(pos[2]) ? pos[2] : inst, inst };
}

/** Windowed to 8-bit and resized to SIZE (nearest-neighbour is enough for a teaching viewer). */
function toJpeg(s, win) {
  let lo, hi;
  if (win === "auto") {
    // MRI: the window from the tissue itself, not the black background around it.
    const tissue = Float32Array.from(s.px.filter((v) => v > 0)).sort();
    const sorted = tissue.length > 1000 ? tissue : Float32Array.from(s.px).sort();
    lo = sorted[Math.floor(sorted.length * 0.02)];
    hi = sorted[Math.floor(sorted.length * 0.99)];
  } else {
    lo = win[0] - win[1] / 2;
    hi = win[0] + win[1] / 2;
  }
  const scale = SIZE / Math.max(s.rows, s.cols);
  const w = Math.round(s.cols * scale), h = Math.round(s.rows * scale);
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = s.px[Math.min(s.rows - 1, Math.floor(y / scale)) * s.cols + Math.min(s.cols - 1, Math.floor(x / scale))];
      const g = Math.max(0, Math.min(255, Math.round(((v - lo) / (hi - lo)) * 255)));
      const i = (y * w + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = g;
      data[i + 3] = 255;
    }
  return jpeg.encode({ data, width: w, height: h }, 78).data;
}

// Only the ids named on the command line (the rest of the manifest is kept); all when none are named.
const args = process.argv.slice(2);
const only = args.map((a) => a.split("@")[0]);
const skip = Object.fromEntries(args.map((a) => [a.split("@")[0], Number(a.split("@")[1] ?? 0)]));
let manifest = [];
try {
  manifest = JSON.parse((await import("node:fs")).readFileSync("src/lib/radiology-stacks.json", "utf8")).filter((m) => only.length && !only.includes(m.id));
} catch {}
const wanted = only.length
  ? only.map((id) => {
      const base = STACKS.find((x) => x.id === id) ?? STACKS.find((x) => x.id === id.replace(/-\d+$/, ""));
      return base ? { ...base, id } : null;
    }).filter(Boolean)
  : STACKS;
for (const st of wanted) {
  try {
    const series = (await getJson(`${NBIA}/getSeries?Collection=${encodeURIComponent(st.collection)}&Modality=${st.modality}`))
      // Original axial slices only — no reformats, MIPs or scout views.
      .filter((s) => s.ImageCount >= 30 && s.ImageCount <= 400 && st.match.test(s.SeriesDescription ?? "") && !/MPR|MIP|sag|cor|scout|localizer|topogram|reformat/i.test(s.SeriesDescription ?? ""))
      .sort((a, b) => Math.abs(a.ImageCount - 120) - Math.abs(b.ImageCount - 120))
      // Another patient each time: never a second series of someone already shown for this diagnosis.
      .filter((s) => !manifest.some((m) => m.patient && m.patient === s.PatientID));
    let done = false;
    for (const s of series.slice(skip[st.id] ?? 0, (skip[st.id] ?? 0) + 6)) {
      const zip = new Uint8Array(await (await fetch(`${NBIA}/getImage?SeriesInstanceUID=${s.SeriesInstanceUID}`)).arrayBuffer());
      const files = unzipSync(zip);
      const slices = Object.entries(files).filter(([n]) => n.endsWith(".dcm")).map(([, b]) => { try { return readSlice(b); } catch { return null; } }).filter(Boolean);
      if (slices.length < 20) continue;
      // Head to feet, as radiologists read: DICOM z increases towards the head.
      slices.sort((a, b) => b.z - a.z || a.inst - b.inst);
      const step = Math.max(1, Math.ceil(slices.length / MAX_SLICES));
      const kept = slices.filter((_, i) => i % step === 0);
      const dir = path.join(OUT, st.id);
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true });
      kept.forEach((sl, i) => writeFileSync(path.join(dir, `${String(i).padStart(3, "0")}.jpg`), toJpeg(sl, st.window)));
      const { match: _m, window: _w, ...meta } = st;
      manifest.push({ ...meta, patient: s.PatientID, slices: kept.length, series: s.SeriesDescription ?? "", credit: `Data from The Cancer Imaging Archive, ${st.collection} collection (${st.license}), doi:${st.doi}` });
      console.log(`✓ ${st.id}: ${kept.length} slices from "${s.SeriesDescription}"`);
      done = true;
      break;
    }
    if (!done) console.log(`✗ ${st.id}: no uncompressed series found`);
  } catch (err) {
    console.log(`✗ ${st.id}: ${err.message}`);
  }
}
writeFileSync("src/lib/radiology-stacks.json", JSON.stringify(manifest, null, 2) + "\n");
console.log(`manifest: ${manifest.length} stacks`);
