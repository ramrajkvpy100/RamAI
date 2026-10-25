/**
 * True CT windows for the scroll-through stacks: for each CT stack in src/lib/radiology-stacks.json, the very same
 * series is downloaded again from TCIA and saved three ways — soft tissue (W400/L40), lung (W1500/L−600) and bone
 * (W1800/L400) — in public/radiology/<id>/<window>/NNN.jpg. The manifest lists the windows each stack has.
 * Free, public data (CC BY). Run: node scripts/radiology-windows.mjs [ids…]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import dicomParser from "dicom-parser";
import { unzipSync } from "fflate";
import jpeg from "jpeg-js";

const NBIA = "https://services.cancerimagingarchive.net/nbia-api/services/v1";
const OUT = path.resolve("public/radiology");
const SIZE = 384;
const MAX_SLICES = 72;
const WINDOWS = { soft: [40, 400], lung: [-600, 1500], bone: [400, 1800] };

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


const only = process.argv.slice(2);
const manifest = JSON.parse(readFileSync("src/lib/radiology-stacks.json", "utf8"));
for (const st of manifest) {
  if (st.modality !== "CT" || (only.length && !only.includes(st.id))) continue;
  try {
    const series = (await getJson(`${NBIA}/getSeries?Collection=${encodeURIComponent(st.collection)}&PatientID=${encodeURIComponent(st.patient)}&Modality=CT`)).filter((s) => (s.SeriesDescription ?? "") === (st.series ?? "")).sort((a, b) => Math.abs(a.ImageCount - 120) - Math.abs(b.ImageCount - 120));
    let done = false;
    for (const s of series) {
      const files = unzipSync(new Uint8Array(await (await fetch(`${NBIA}/getImage?SeriesInstanceUID=${s.SeriesInstanceUID}`)).arrayBuffer()));
      const slices = Object.entries(files).filter(([n]) => n.endsWith(".dcm")).map(([, b]) => { try { return readSlice(b); } catch { return null; } }).filter(Boolean);
      slices.sort((a, b) => b.z - a.z || a.inst - b.inst);
      const step = Math.max(1, Math.ceil(slices.length / MAX_SLICES));
      const kept = slices.filter((_, i) => i % step === 0);
      // The same slices as the stack already shown — otherwise the windows wouldn't line up.
      if (kept.length !== st.slices) continue;
      for (const [name, win] of Object.entries(WINDOWS)) {
        const dir = path.join(OUT, st.id, name);
        mkdirSync(dir, { recursive: true });
        kept.forEach((sl, i) => writeFileSync(path.join(dir, `${String(i).padStart(3, "0")}.jpg`), toJpeg(sl, win)));
      }
      st.windows = Object.keys(WINDOWS);
      console.log(`✓ ${st.id}: ${kept.length} slices × ${Object.keys(WINDOWS).length} windows`);
      done = true;
      break;
    }
    if (!done) console.log(`✗ ${st.id}: series not found again (${series.length} candidates)`);
  } catch (err) {
    console.log(`✗ ${st.id}: ${err.message}`);
  }
}
writeFileSync("src/lib/radiology-stacks.json", JSON.stringify(manifest, null, 2) + "\n");
