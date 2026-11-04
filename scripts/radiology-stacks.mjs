/**
 * Builds the radiology scroll-through stacks from The Cancer Imaging Archive (TCIA): real, CC BY-licensed CT and
 * MRI series, downloaded once, windowed, resized with a proper (Lanczos) filter to 512 px and saved as grey JPEG
 * slices in public/radiology/<id>/ — CT in three true windows (soft/, lung/, bone/), MRI as acquired — with a
 * manifest (src/lib/radiology-stacks.json) that credits each collection as its licence requires. No AI anywhere.
 *
 *   node scripts/radiology-stacks.mjs redo:<id>…        the same patient's series again, at today's quality
 *   node scripts/radiology-stacks.mjs add:<base>:<n>…   n more patients for a stack (ids <base>-4, -5, …)
 *   node scripts/radiology-stacks.mjs more:<base>:<n>…  n patients for a definition in radiology-stacks-more.mjs (several at once)
 *
 * The images are served from R2, so new ones go to $STACKS_OUT and are uploaded from there; $STACKS_MANIFEST keeps a
 * batch away from the live manifest until each series has been looked at.
 *
 * A contact sheet of each new stack is written to $SHEETS (default /tmp) — every stack is looked at before it's kept.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";

import dicomParser from "dicom-parser";
import { unzipSync } from "fflate";
import sharp from "sharp";

import { MORE_STACKS } from "./radiology-stacks-more.mjs";

const NBIA = "https://services.cancerimagingarchive.net/nbia-api/services/v1";
const OUT = path.resolve(process.env.STACKS_OUT ?? "public/radiology");
const MANIFEST = process.env.STACKS_MANIFEST ?? "src/lib/radiology-stacks.json";
const SIZE = 512;
const MAX_SLICES = 64;
const SHEETS = process.env.SHEETS ?? "/tmp";
const WINDOWS = { soft: [40, 400], lung: [-600, 1500], bone: [400, 1800] };

/** The stacks: which collection, which series, how to window it, and the case around it. */
/**
 * Each stack is kept only after its slices were looked at and the finding is plainly visible
 * (rcc, crlm and lung-nodule series were tried and left out: their lesions weren't clear enough).
 */
const STACKS = [
  ...MORE_STACKS,
  { id: "gbm-mri", avoid: /DTI|FLAIR|DWI|ADC|perf|T2/i, collection: "UPENN-GBM", license: "CC BY 4.0", doi: "10.7937/TCIA.709X-DN49", modality: "MR", match: /3D GAD|T1.*GD|POST/i, window: "auto",
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
  { id: "hcc-ct", avoid: /PRE\b|non/i, collection: "TCGA-LIHC", license: "CC BY 3.0", doi: "10.7937/K9/TCIA.2016.IMMQW8UQ", modality: "CT", match: /axial|abd|venous|arterial|portal|post|contrast|liver/i, window: [60, 360],
    diagnosis: "Hepatocellular carcinoma", history: "63-year-old man with hepatitis B cirrhosis, rising alpha-fetoprotein and weight loss.", question: "CT abdomen (liver protocol): findings?",
    key: "A focal liver mass in a cirrhotic liver, enhancing in the arterial phase with washout later — hepatocellular carcinoma.",
    options: ["Hepatocellular carcinoma", "Liver abscess", "Simple hepatic cyst", "Fatty liver"] },
  { id: "crlm-ct", collection: "Colorectal-Liver-Metastases", license: "CC BY 4.0", doi: "10.7937/QXK2-QG03", modality: "CT", match: /.*/, window: [60, 360],
    diagnosis: "Liver metastases", history: "66-year-old woman, a year after surgery for colon cancer, with a rising CEA.", question: "CT abdomen, portal venous phase: findings?",
    key: "Multiple hypodense lesions in the liver, some with a faint enhancing rim — liver metastases.",
    options: ["Liver metastases", "Hepatocellular carcinoma", "Liver abscess", "Normal liver"] },
  { id: "covid-ct", avoid: /kidney|delay|abd|pelvis/i, collection: "COVID-19-AR", license: "CC BY 4.0", doi: "10.7937/tcia.2020.py71-5978", modality: "CT", match: /.*/, window: [-600, 1500],
    diagnosis: "COVID-19 pneumonia", history: "52-year-old man with 8 days of fever, dry cough and breathlessness; SpO₂ 89% on air.", question: "CT chest (lung windows): findings?",
    key: "Bilateral, peripheral, posterior ground-glass opacities with some consolidation — the typical pattern of COVID-19 pneumonia.",
    options: ["COVID-19 pneumonia", "Lobar pneumonia", "Pulmonary oedema", "Miliary tuberculosis"] },
  { id: "vs-mri", avoid: /T1|FLAIR/i, collection: "Vestibular-Schwannoma-MC-RC", license: "CC BY 4.0", doi: "10.7937/HRZH-2N82", modality: "MR", match: /FIESTA|CISS|T2/i, window: "auto",
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
  { id: "hcc-tace-ct", avoid: /PRE\b|non/i, collection: "HCC-TACE-Seg", license: "CC BY 4.0", doi: "10.7937/TCIA.5FNA-0924", modality: "CT", match: /.*/, window: [60, 360],
    diagnosis: "Hepatocellular carcinoma", history: "66-year-old man with alcohol-related cirrhosis and a rising alpha-fetoprotein.", question: "Multiphase CT liver: findings?",
    key: "A focal mass in a cirrhotic liver with arterial enhancement and washout — hepatocellular carcinoma.",
    options: ["Hepatocellular carcinoma", "Liver abscess", "Hepatic haemangioma", "Liver metastases"] },
  { id: "pancreatic-ca-ct", avoid: /DRY|chest|pre\b|non/i, collection: "CPTAC-PDA", license: "CC BY 4.0", doi: "10.7937/K9/TCIA.2018.SC20FO18", modality: "CT", match: /venous|portal|abd|pancreas|contrast|axial/i, window: [40, 400],
    diagnosis: "Pancreatic adenocarcinoma", history: "68-year-old woman with painless jaundice, weight loss and new-onset diabetes.", question: "CT abdomen (pancreas protocol): findings?",
    key: "A poorly defined hypodense mass in the pancreas, often with a dilated pancreatic and/or common bile duct — pancreatic adenocarcinoma.",
    options: ["Pancreatic adenocarcinoma", "Acute pancreatitis", "Pancreatic pseudocyst", "Normal pancreas"] },
  { id: "adrenal-ca-ct", avoid: /PRE\b|no series|non/i, collection: "Adrenal-ACC-Ki67-Seg", license: "CC BY 4.0", doi: "10.7937/1FPG-VM46", modality: "CT", match: /.*/, window: [40, 400],
    diagnosis: "Adrenal mass", history: "45-year-old woman with weight gain, new hypertension and facial plethora; cortisol is high and not suppressed.", question: "CT abdomen with contrast: findings?",
    key: "A large, heterogeneous soft-tissue mass above the kidney, separate from it, displacing nearby organs — an adrenal mass (here an adrenocortical carcinoma).",
    options: ["Adrenal mass", "Renal cell carcinoma", "Splenic cyst", "Normal CT abdomen"] },
  { id: "lung-ca-ct", avoid: /abd|pelvis/i, collection: "CPTAC-LUAD", license: "CC BY 4.0", doi: "10.7937/K9/TCIA.2018.PAT12TBS", modality: "CT", match: /chest|lung|thorax|axial|ct/i, window: [-600, 1500],
    diagnosis: "Lung cancer", history: "67-year-old woman, ex-smoker, with persistent cough, weight loss and one episode of haemoptysis.", question: "CT chest (lung windows): findings?",
    key: "A spiculated soft-tissue mass in the lung, sometimes with nodal enlargement or pleural involvement — primary lung cancer.",
    options: ["Lung cancer", "Lobar pneumonia", "Tuberculous cavity", "Pulmonary embolism"] },
  { id: "breast-mri", avoid: /pre\b|_pre|^pre/i, collection: "TCGA-BRCA", license: "CC BY 3.0", doi: "10.7937/K9/TCIA.2016.AB2NAZRP", modality: "MR", match: /post|sub|dyn|vibrant|t1/i, window: "auto",
    diagnosis: "Breast cancer", history: "49-year-old woman with a palpable lump in one breast; mammogram was dense and inconclusive.", question: "Breast MRI (post-contrast): findings?",
    key: "An irregular, enhancing mass with spiculated margins in the breast — suspicious for breast carcinoma (BI-RADS 5).",
    options: ["Breast cancer", "Fibroadenoma", "Simple breast cyst", "Normal breast MRI"] },
];

/** TCIA turns requests away now and then: three tries, a while apart. */
async function retry(fn) {
  for (let k = 0; ; k++) {
    try {
      return await fn();
    } catch (err) {
      if (k >= 2) throw err;
      await new Promise((r) => setTimeout(r, 20_000 * (k + 1)));
    }
  }
}
const getJson = (url) => retry(async () => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
});

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
  // Axial only (the slice's normal along the body's long axis); prone noted (a prone CT would show upside down; breast MRI is always prone).
  const o = (ds.string("x00200037") ?? "").split("\\").map(Number);
  const nz = o.length === 6 ? Math.abs(o[0] * o[4] - o[1] * o[3]) : 1;
  const prone = /P$/.test((ds.string("x00185100") ?? "").trim());
  // Stored top-to-bottom the wrong way (columns running back to front, as in the NIH Pancreas-CT set): flipped on output.
  const flipY = o.length === 6 && o[4] < -0.5;
  const ps = (ds.string("x00280030") ?? "").split("\\").map(Number);
  // For the case's request form, and to turn away anything that isn't an original image of the patient.
  const age = parseInt(ds.string("x00101010") ?? "", 10), sex = (ds.string("x00100040") ?? "").trim();
  const flat = /LOCALIZER|SCREEN SAVE/i.test(ds.string("x00080008") ?? "") || /^1\.2\.840\.10008\.5\.1\.4\.1\.1\.7/.test((ds.string("x00080016") ?? "").trim()) || /YES/i.test(ds.string("x00280301") ?? "");
  return { rows, cols, px, z: Number.isFinite(pos[2]) ? pos[2] : inst, inst, axial: nz > 0.8, prone, flipY, ps: Number.isFinite(ps[0]) && ps[0] > 0 ? ps[0] : null, age: Number.isFinite(age) ? age : null, sex, flat };
}

/**
 * MRI: one window for the whole series, from the tissue itself (not the black around it). `front`: from the front half
 * of the body only — breast MRI, so the window is set by the breasts, not by the brightly enhancing heart behind them.
 */
function autoWindow(slices, front = false) {
  const sample = [];
  for (const s of slices) {
    // The front half of the body: the top rows as stored, or the bottom rows when the series is stored upside down.
    const half = Math.floor(s.px.length / 2);
    const [from, to] = !front ? [0, s.px.length] : s.flipY ? [half, s.px.length] : [0, half];
    for (let i = from; i < to; i += 37) if (s.px[i] > 0) sample.push(s.px[i]);
  }
  sample.sort((a, b) => a - b);
  return [sample[Math.floor(sample.length * 0.01)], sample[Math.floor(sample.length * 0.995)]];
}

/** Windowed to 8-bit at full resolution, then resized with Lanczos to SIZE: a sharp grey JPEG. */
function toJpeg(s, lo, hi) {
  const g = Buffer.alloc(s.rows * s.cols);
  for (let i = 0; i < g.length; i++) g[i] = Math.max(0, Math.min(255, Math.round(((s.px[i] - lo) / (hi - lo)) * 255)));
  return sharp(g, { raw: { width: s.cols, height: s.rows, channels: 1 } })
    .flip(!!s.flipY)
    .resize(SIZE, SIZE, { fit: "inside", kernel: "lanczos3", withoutEnlargement: false })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}

/** Twelve slices from the middle 80% of the stack, in a grid — for looking at before keeping it. */
async function contactSheet(id, files) {
  const pick = Array.from({ length: 12 }, (_, i) => files[Math.floor(files.length * (0.1 + (0.8 * i) / 11))]);
  const tiles = await Promise.all(pick.map((f) => sharp(f).resize(240, 240, { fit: "contain", background: "#000" }).toBuffer()));
  await sharp({ create: { width: 240 * 4, height: 240 * 3, channels: 3, background: "#000" } })
    .composite(tiles.map((t, i) => ({ input: t, left: (i % 4) * 240, top: Math.floor(i / 4) * 240 })))
    .jpeg({ quality: 80 })
    .toFile(path.join(SHEETS, `${id}.jpg`));
}

/**
 * How tall one kept slice is, in shown pixels: the gap between kept slices (mm) over the size of a shown pixel (mm) —
 * so sagittal and coronal reformats are drawn true to life, never stretched or squashed.
 */
function zRatioOf(kept) {
  const gaps = kept.slice(1).map((s, i) => Math.abs(s.z - kept[i].z)).filter((g) => g > 0).sort((a, b) => a - b);
  const first = kept[0];
  if (!gaps.length || !first?.ps) return undefined;
  const shownPx = first.ps * (Math.max(first.rows, first.cols) / SIZE);
  return Math.round((gaps[Math.floor(gaps.length / 2)] / shownPx) * 100) / 100;
}

async function download(s) {
  // A download that stalls is given up after 4 minutes (the next candidate is tried).
  const zip = await retry(async () => new Uint8Array(await (await fetch(`${NBIA}/getImage?SeriesInstanceUID=${s.SeriesInstanceUID}`, { signal: AbortSignal.timeout(240_000) })).arrayBuffer()));
  const files = unzipSync(zip);
  const slices = Object.entries(files).filter(([n]) => n.endsWith(".dcm")).map(([, b]) => { try { return readSlice(b); } catch { return null; } }).filter(Boolean);
  // Head to feet, as radiologists read: DICOM z increases towards the head.
  slices.sort((a, b) => b.z - a.z || a.inst - b.inst);
  const step = Math.max(1, Math.ceil(slices.length / MAX_SLICES));
  return { slices, kept: slices.filter((_, i) => i % step === 0) };
}

/** Downloads one series and writes its slices; the manifest entry, or null when it can't be used. */
async function build(st, id, s) {
  const { slices, kept } = await download(s);
  if (slices.length < 20) return null;
  if (slices.filter((x) => x.axial && (st.modality !== "CT" || !x.prone)).length < slices.length * 0.9) return null;
  const dir = path.join(OUT, id);
  rmSync(dir, { recursive: true, force: true });
  let primary;
  let sheet = [];
  if (st.modality === "CT") {
    // The window the stack opens in: the one its definition names (lung for chest, bone for spine, soft otherwise).
    primary = Object.entries(WINDOWS).find(([, w]) => w[0] === st.window[0])?.[0] ?? "soft";
    for (const [name, [l, w]] of Object.entries(WINDOWS)) {
      mkdirSync(path.join(dir, name), { recursive: true });
      const out = await Promise.all(kept.map((sl) => toJpeg(sl, l - w / 2, l + w / 2)));
      out.forEach((b, i) => writeFileSync(path.join(dir, name, `${String(i).padStart(3, "0")}.jpg`), b));
      if (name === primary) sheet = out;
    }
  } else {
    mkdirSync(dir, { recursive: true });
    const [lo, hi] = autoWindow(kept, st.front || st.id === "breast-mri");
    sheet = await Promise.all(kept.map((sl) => toJpeg(sl, lo, hi)));
    sheet.forEach((b, i) => writeFileSync(path.join(dir, `${String(i).padStart(3, "0")}.jpg`), b));
  }
  await contactSheet(id, sheet);
  const { match: _m, window: _w, ...meta } = st;
  return {
    ...meta, id, patient: s.PatientID, seriesUid: s.SeriesInstanceUID, slices: kept.length, series: s.SeriesDescription ?? "", zRatio: zRatioOf(kept),
    ...(primary ? { windows: [primary, ...Object.keys(WINDOWS).filter((w) => w !== primary)] } : {}),
    credit: `Data from The Cancer Imaging Archive, ${st.collection} collection (${st.license}), doi:${st.doi}`,
  };
}

const candidates = async (st) =>
  (await getJson(`${NBIA}/getSeries?Collection=${encodeURIComponent(st.collection)}&Modality=${st.modality}`))
    // Original axial slices only — no reformats, MIPs or scout views.
    .filter((s) => s.ImageCount >= 30 && s.ImageCount <= 400 && st.match.test(s.SeriesDescription ?? "") && !(st.avoid && st.avoid.test(s.SeriesDescription ?? "")) && !/MPR|MIP|sag|cor|scout|localizer|topogram|reformat/i.test(s.SeriesDescription ?? ""))
    .sort((a, b) => Math.abs(a.ImageCount - 120) - Math.abs(b.ImageCount - 120));

let manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
/** Patients whose series were looked at and left out — never tried again. */
const rejected = new Set(JSON.parse(readFileSync("scripts/radiology-rejected.json", "utf8")).patients);
const save = () => writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
const baseOf = (id) => STACKS.find((x) => x.id === id) ?? STACKS.find((x) => x.id === id.replace(/-\d+$/, ""));

/** "61-year-old man": from the collection's clinical table, else the scan's own metadata; only what they say. */
function whoOf(st, s, first) {
  const c = st.clinical?.[s.PatientID];
  const age = c?.age ?? (first.age >= 18 && first.age < 90 ? first.age : null);
  const sex = c ? c.sex[0] : first.sex === "F" || first.sex === "M" ? first.sex : st.sex;
  const noun = sex === "F" ? "woman" : sex === "M" ? "man" : null;
  if (age) return noun ? `${age}-year-old ${noun}` : `${age}-year-old patient`;
  return noun ? noun[0].toUpperCase() + noun.slice(1) : "Patient";
}

/** Text burned into a scan stays put from slice to slice: bright pixels, the same in every slice, in the image's corners. */
async function burnedIn(sheet) {
  const picks = Array.from({ length: 8 }, (_, i) => sheet[Math.floor((sheet.length * (i + 0.5)) / 8)]);
  const raws = await Promise.all(picks.map((b) => sharp(b).greyscale().raw().toBuffer({ resolveWithObject: true })));
  const { width: w, height: h } = raws[0].info;
  if (raws.some((r) => r.info.width !== w || r.info.height !== h)) return true;
  const box = Math.floor(Math.min(w, h) * 0.16);
  let still = 0;
  for (let y = 0; y < h; y++) {
    if (y >= box && y < h - box) continue;
    for (let x = 0; x < w; x++) {
      if (x >= box && x < w - box) continue;
      if (raws.every((r) => r.data[y * w + x] > 140)) still++;
    }
  }
  return still > 12;
}

/** Six slices in a row with the id written on them, for looking through a whole batch. */
async function reviewRow(id, sheet) {
  const T = 165;
  const pick = Array.from({ length: 6 }, (_, i) => sheet[Math.floor(sheet.length * (0.12 + (0.76 * i) / 5))]);
  const tiles = await Promise.all(pick.map((b) => sharp(b).resize(T, T, { fit: "contain", background: "#000" }).toBuffer()));
  const label = Buffer.from(`<svg width="${T * 2}" height="16"><rect width="${T * 2}" height="16" fill="#000"/><text x="2" y="12" font-size="12" font-family="Helvetica" fill="#ff0">${id}</text></svg>`);
  await sharp({ create: { width: T * 6, height: T, channels: 3, background: "#000" } })
    .composite([...tiles.map((t, i) => ({ input: t, left: i * T, top: 0 })), { input: label, left: 0, top: 0 }])
    .jpeg({ quality: 78 })
    .toFile(path.join(SHEETS, `${id}.jpg`));
}

/** One series of a definition in radiology-stacks-more.mjs; null when it can't be used. */
async function buildMore(st, id, s, order) {
  const { slices, kept } = await download(s);
  if (slices.length < 20 || slices.some((x) => x.flat)) return null;
  if (slices.filter((x) => x.axial && (st.modality !== "CT" || !x.prone)).length < slices.length * 0.9) return null;
  // One volume: every slice its own position (no repeated phases) and all the same size.
  if (new Set(slices.map((x) => x.z.toFixed(2))).size < slices.length * 0.95 || new Set(slices.map((x) => `${x.rows}x${x.cols}`)).size > 1) return null;
  const dir = path.join(OUT, id);
  rmSync(dir, { recursive: true, force: true });
  let primary;
  let sheet = [];
  if (st.modality === "CT") {
    primary = Object.entries(WINDOWS).find(([, w]) => w[0] === st.window[0])?.[0] ?? "soft";
    for (const [name, [l, w]] of Object.entries(WINDOWS)) {
      mkdirSync(path.join(dir, name), { recursive: true });
      const out = await Promise.all(kept.map((sl) => toJpeg(sl, l - w / 2, l + w / 2)));
      out.forEach((b, i) => writeFileSync(path.join(dir, name, `${String(i).padStart(3, "0")}.jpg`), b));
      if (name === primary) sheet = out;
    }
  } else {
    mkdirSync(dir, { recursive: true });
    const [lo, hi] = autoWindow(kept, st.front);
    sheet = await Promise.all(kept.map((sl) => toJpeg(sl, lo, hi)));
    sheet.forEach((b, i) => writeFileSync(path.join(dir, `${String(i).padStart(3, "0")}.jpg`), b));
  }
  if (await burnedIn(sheet)) {
    rmSync(dir, { recursive: true, force: true });
    console.log(`  ${s.PatientID}: fixed bright pixels in the corners, left out`);
    return null;
  }
  await reviewRow(id, sheet);
  return {
    id, collection: st.collection, license: st.license, doi: st.doi, modality: st.modality, diagnosis: st.diagnosis,
    history: st.histories[order % st.histories.length].replace("{who}", whoOf(st, s, slices[0])),
    question: st.question, key: st.keyOf ? st.keyOf(s.PatientID) : st.key, options: st.options,
    patient: s.PatientID, seriesUid: s.SeriesInstanceUID, slices: kept.length, series: s.SeriesDescription ?? "", zRatio: zRatioOf(kept),
    ...(primary ? { windows: [primary, ...Object.keys(WINDOWS).filter((w) => w !== primary)] } : {}),
    credit: `Data from The Cancer Imaging Archive, ${st.collection} collection (${st.license}), doi:${st.doi}`,
  };
}

/** The series' own licence, as TCIA states it, must be the one the definition credits: CC BY only. */
const licensed = (st, s) => /Attribution/i.test(s.LicenseName ?? "") && !/Non.?Commercial|No.?Deriv/i.test(s.LicenseName ?? "") && (s.LicenseName ?? "").includes(st.license.replace("CC BY ", ""));

async function more(arg) {
  const [, base, n] = arg.split(":");
  const st = MORE_STACKS.find((x) => x.id === base);
  if (!st) return console.log(`✗ ${arg}: no such definition`);
  const all = (await candidates(st)).filter((s) => (!st.filter || st.filter(s)) && licensed(st, s) && (s.FileSize ?? 0) < 300_000_000);
  let want = Number(n) || 1, tries = 0;
  for (const s of all) {
    if (!want || tries >= Number(n) * 5) break;
    // Another patient each time: never a second series of someone already shown, nor one already looked at and left out.
    if (manifest.some((m) => m.patient === s.PatientID) || rejected.has(s.PatientID) || busy.has(s.PatientID)) continue;
    busy.add(s.PatientID);
    tries++;
    let k = 1;
    while (manifest.some((m) => m.id === `${base}-${k}`) || existsSync(path.join(OUT, `${base}-${k}`))) k++;
    const newId = `${base}-${k}`;
    mkdirSync(path.join(OUT, newId), { recursive: true });
    const entry = await buildMore(st, newId, s, k - 1).catch((e) => (console.log(`  ${s.PatientID}: ${e.message}`), null));
    busy.delete(s.PatientID);
    if (!entry) {
      rmSync(path.join(OUT, newId), { recursive: true, force: true });
      continue;
    }
    manifest.push(entry);
    save();
    want--;
    console.log(`✓ ${newId}: ${entry.slices} slices from ${s.PatientID} "${s.SeriesDescription}"`);
  }
  console.log(want ? `✗ ${base}: ${want} short (${all.length} candidates)` : `✓ ${base} done`);
}
const busy = new Set();
const moreArgs = process.argv.slice(2).filter((a) => a.startsWith("more:"));
if (moreArgs.length) {
  const queue = [...moreArgs];
  await Promise.all(Array.from({ length: Number(process.env.STACKS_JOBS ?? 4) }, async () => {
    while (queue.length) await more(queue.shift()).catch((e) => console.log(`✗ ${e.message}`));
  }));
}

for (const arg of process.argv.slice(2).filter((a) => !a.startsWith("more:"))) {
  const [mode, id, n] = arg.split(":");
  const st = baseOf(id);
  if (!st) { console.log(`✗ ${arg}: no such stack`); continue; }
  try {
    const all = await candidates(st);
    if (mode === "geo") {
      // Only the geometry (into its own file, so it can run beside an add): the series is downloaded, nothing else written.
      const was = manifest.find((m) => m.id === id);
      const s = was && (all.find((x) => (was.seriesUid ? x.SeriesInstanceUID === was.seriesUid : x.PatientID === was.patient && (x.SeriesDescription ?? "") === was.series)) ?? all.find((x) => x.PatientID === was.patient));
      if (!s) { console.log(`✗ geo ${id}: series not found`); continue; }
      const { kept } = await download(s);
      const geoFile = "src/lib/radiology-geometry.json";
      const geo = JSON.parse(existsSync(geoFile) ? readFileSync(geoFile, "utf8") : "{}");
      geo[id] = zRatioOf(kept) ?? null;
      writeFileSync(geoFile, JSON.stringify(geo, null, 2) + "\n");
      console.log(`✓ geo ${id}: ${geo[id]}`);
      continue;
    }
    if (mode === "redo") {
      const was = manifest.find((m) => m.id === id);
      const s = all.find((x) => (was.seriesUid ? x.SeriesInstanceUID === was.seriesUid : x.PatientID === was.patient && (x.SeriesDescription ?? "") === was.series)) ?? all.find((x) => x.PatientID === was.patient);
      if (!s) { console.log(`✗ ${id}: its series wasn't found again`); continue; }
      const entry = await build(st, id, s);
      if (!entry) { console.log(`✗ ${id}: couldn't be read`); continue; }
      manifest = manifest.map((m) => (m.id === id ? entry : m));
      save();
      console.log(`✓ redo ${id}: ${entry.slices} slices`);
    } else if (mode === "add") {
      let want = Number(n) || 1;
      for (const s of all) {
        if (!want) break;
        // Another patient each time: never a second series of someone already shown.
        if (manifest.some((m) => m.patient === s.PatientID) || rejected.has(s.PatientID)) continue;
        let k = 2;
        while (manifest.some((m) => m.id === `${st.id}-${k}`) || (k === 1)) k++;
        const newId = `${st.id}-${k}`;
        const entry = await build(st, newId, s).catch((e) => (console.log(`  ${s.PatientID}: ${e.message}`), null));
        if (!entry) continue;
        manifest.push(entry);
        save();
        want--;
        console.log(`✓ add ${newId}: ${entry.slices} slices from ${s.PatientID} "${s.SeriesDescription}"`);
      }
      if (want) console.log(`✗ ${id}: ${want} more not found`);
    }
  } catch (err) {
    console.log(`✗ ${arg}: ${err.message}`);
  }
}
console.log(`manifest: ${manifest.length} stacks`);
