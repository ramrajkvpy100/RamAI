/**
 * Real screening mammograms for radiology reporting, from TCIA's CBIS-DDSM collection (CC BY 3.0).
 * Each patient's ID says the abnormality (Mass-… or Calc-…), so the answer is the dataset's own.
 * Saved to public/radiology/singles/mammo-(mass|calc) and appended to src/lib/radiology-singles.json — after a
 * person has looked at them (run, review, then keep). Run: node scripts/radiology-mammo.mjs [count]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import dicomParser from "dicom-parser";
import { unzipSync } from "fflate";
import jpeg from "jpeg-js";

const NBIA = "https://services.cancerimagingarchive.net/nbia-api/services/v1";
const PER = Number(process.argv[2] ?? 6);
const H = 900;

function decode(bytes) {
  const ds = dicomParser.parseDicom(bytes);
  const ts = (ds.string("x00020010") ?? "").trim();
  if (!["1.2.840.10008.1.2", "1.2.840.10008.1.2.1"].includes(ts)) return null;
  const rows = ds.uint16("x00280010"), cols = ds.uint16("x00280011"), bits = ds.uint16("x00280100");
  const el = ds.elements.x7fe00010;
  const n = rows * cols, off = bytes.byteOffset + el.dataOffset;
  const px = bits === 16 ? new Uint16Array(bytes.buffer.slice(off, off + n * 2)) : new Uint8Array(bytes.buffer.slice(off, off + n));
  const invert = (ds.string("x00280004") ?? "").includes("MONOCHROME1");
  // Window from the breast tissue, not the black background.
  const tissue = Float32Array.from(px.filter((v, i) => i % 7 === 0 && v > 0)).sort();
  const lo = tissue[Math.floor(tissue.length * 0.02)], hi = tissue[Math.floor(tissue.length * 0.995)];
  const scale = H / rows, w = Math.round(cols * scale);
  const data = Buffer.alloc(w * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < w; x++) {
      const v = px[Math.min(rows - 1, Math.floor(y / scale)) * cols + Math.min(cols - 1, Math.floor(x / scale))];
      let g = Math.max(0, Math.min(255, Math.round(((v - lo) / (hi - lo)) * 255)));
      if (invert) g = 255 - g;
      const i = (y * w + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = g;
      data[i + 3] = 255;
    }
  return jpeg.encode({ data, width: w, height: H }, 82).data;
}

const series = await (await fetch(`${NBIA}/getSeries?Collection=CBIS-DDSM&Modality=MG`)).json();
const full = series.filter((s) => /full mammogram/i.test(s.SeriesDescription ?? "") && /_(CC|MLO)$/.test(s.PatientID ?? ""));
const out = [];
for (const [kind, prefix] of [["mammo-mass", "Mass-"], ["mammo-calc", "Calc-"]]) {
  const dir = path.join("public/radiology/singles", kind);
  mkdirSync(dir, { recursive: true });
  const pick = full.filter((s) => s.PatientID.startsWith(prefix)).sort(() => Math.random() - 0.5);
  let n = 0;
  for (const s of pick) {
    if (n >= PER) break;
    try {
      const zip = new Uint8Array(await (await fetch(`${NBIA}/getImage?SeriesInstanceUID=${s.SeriesInstanceUID}`)).arrayBuffer());
      const file = Object.entries(unzipSync(zip)).find(([name]) => name.endsWith(".dcm"));
      const img = file && decode(file[1]);
      if (!img) continue;
      const name = `t${n}.jpg`;
      writeFileSync(path.join(dir, name), img);
      out.push({ item: kind, modality: "mammo", src: `/radiology/singles/${kind}/${name}`, author: "CBIS-DDSM (Lee RS et al.)", license: "CC BY 3.0", source: "https://doi.org/10.7937/K9/TCIA.2016.7O02S9CY", patient: s.PatientID });
      n++;
      console.log(`${kind} ${s.PatientID}`);
    } catch (err) {
      console.log(`skip ${s.PatientID}: ${err.message}`);
    }
  }
}
writeFileSync(process.env.CANDIDATES ?? "mammo-candidates.json", JSON.stringify(out, null, 2));
