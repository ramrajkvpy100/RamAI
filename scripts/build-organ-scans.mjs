/**
 * Builds the brain and the lungs from real anatomy: BodyParts3D, meshes segmented from the MRI and CT
 * scans of a real human body (Database Center for Life Science, Japan — CC BY-SA 2.1 JP). The parts
 * are welded, simplified for the web, oriented from the anatomy itself (frontal vs occipital lobes;
 * right vs left lungs; the middle lobe in front), shaded (sulci and fissures darker, crowns lighter)
 * and packed in the heart's format into public/models. The packed models are derived from
 * BodyParts3D and are shared under the same licence (CC BY-SA 2.1 JP), credited on the site.
 *
 *   git clone --depth 1 --filter=blob:none --no-checkout https://github.com/Kevin-Mattheus-Moerman/bodyparts3d
 *   (check out the STL files named below), then:
 *   node --experimental-strip-types scripts/build-organ-scans.mjs <path to bodyparts3d/assets/BodyParts3D_data/stl>
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

import { MeshoptSimplifier } from "meshoptimizer";

import { encodeHeart } from "../src/components/three/heart-asset.ts";

const SRC = process.argv[2];
if (!SRC) throw new Error("Usage: node --experimental-strip-types scripts/build-organ-scans.mjs <stl dir>");

/* Parts (FMA ids), grouped by how they look. ----------------------------- */

const CORTEX = [
  "FMA72653", "FMA72654", "FMA72655", "FMA72656", "FMA72661", "FMA72662", "FMA72665", "FMA72666", "FMA72667", "FMA72668", "FMA72669", "FMA72670",
  "FMA72685", "FMA72686", "FMA72687", "FMA72688", "FMA72689", "FMA72690", "FMA72701", "FMA72702", "FMA72705", "FMA72706", "FMA72717", "FMA72718",
  "FMA72800", "FMA72801", "FMA72804", "FMA72805", "FMA72975", "FMA72976", "FMA72977", "FMA72978", "BP49", "BP50", "BP51",
];
const BRAIN = {
  groups: [
    { tone: "cortex", ids: CORTEX },
    { tone: "cerebellum", ids: ["FMA67944"] },
    { tone: "stem", ids: ["FMA67943", "FMA62004", "FMA61993nsn", "FMA62394"] },
  ],
  sizes: { hd: 140_000, sd: 60_000 },
};
const LUNGS = {
  groups: [
    { tone: "lung", ids: ["FMA7333", "FMA7383", "FMA7337", "FMA7370", "FMA7371"] },
    { tone: "airway", ids: ["FMA7394", "FMA7409"] },
  ],
  sizes: { hd: 100_000, sd: 48_000 },
};

/** sRGB colours of living tissue: crown and depth. */
const TONES = {
  cortex: { crown: [0.86, 0.67, 0.64], depth: [0.55, 0.33, 0.34] },
  cerebellum: { crown: [0.82, 0.6, 0.58], depth: [0.5, 0.3, 0.31] },
  stem: { crown: [0.9, 0.78, 0.72], depth: [0.68, 0.52, 0.5] },
  lung: { crown: [0.92, 0.6, 0.57], depth: [0.62, 0.34, 0.36] },
  airway: { crown: [0.94, 0.86, 0.8], depth: [0.7, 0.58, 0.55] },
};
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/* Reading and welding ---------------------------------------------------- */

function readStl(id) {
  const buf = readFileSync(path.join(SRC, `${id}.stl`));
  const n = buf.readUInt32LE(80);
  if (84 + n * 50 !== buf.length) throw new Error(`${id}: not a binary STL`);
  const tris = new Float32Array(n * 9);
  for (let t = 0; t < n; t++) for (let k = 0; k < 9; k++) tris[t * 9 + k] = buf.readFloatLE(84 + t * 50 + 12 + k * 4);
  return tris;
}

/** Shared corners become one vertex (STL repeats them per triangle). */
function weld(tris) {
  const map = new Map();
  const positions = [];
  const indices = new Uint32Array(tris.length / 3);
  for (let v = 0; v < tris.length / 3; v++) {
    const x = tris[v * 3], y = tris[v * 3 + 1], z = tris[v * 3 + 2];
    const key = `${Math.round(x * 1e3)},${Math.round(y * 1e3)},${Math.round(z * 1e3)}`;
    let i = map.get(key);
    if (i === undefined) {
      i = positions.length / 3;
      positions.push(x, y, z);
      map.set(key, i);
    }
    indices[v] = i;
  }
  // Drop triangles that welded into slivers.
  const kept = [];
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t], b = indices[t + 1], c = indices[t + 2];
    if (a !== b && b !== c && a !== c) kept.push(a, b, c);
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(kept) };
}

/** Simplified to about `targetTris`, keeping the outline; unused vertices dropped. */
function simplify(mesh, targetTris) {
  if (mesh.indices.length / 3 <= targetTris) return mesh;
  const [out] = MeshoptSimplifier.simplify(mesh.indices, mesh.positions, 3, targetTris * 3, 0.02, []);
  const remap = new Int32Array(mesh.positions.length / 3).fill(-1);
  const positions = [];
  const indices = new Uint32Array(out.length);
  for (let i = 0; i < out.length; i++) {
    const v = out[i];
    if (remap[v] < 0) {
      remap[v] = positions.length / 3;
      positions.push(mesh.positions[v * 3], mesh.positions[v * 3 + 1], mesh.positions[v * 3 + 2]);
    }
    indices[i] = remap[v];
  }
  return { positions: new Float32Array(positions), indices };
}

const centroid = (mesh) => {
  const c = [0, 0, 0];
  const n = mesh.positions.length / 3;
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) c[k] += mesh.positions[i * 3 + k] / n;
  return c;
};
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a) => {
  const l = Math.hypot(...a) || 1;
  return a.map((x) => x / l);
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/* Shading ----------------------------------------------------------------- */

/** How deep each vertex lies in a groove: concave (sulcus, fissure) → 1, convex crown → 0. Smoothed. */
function cavity(positions, indices) {
  const n = positions.length / 3;
  const normal = new Float32Array(n * 3);
  const sum = new Float32Array(n * 3);
  const count = new Uint32Array(n);
  let edge = 0;
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
    const p = (i) => [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
    const A = p(a), B = p(b), C = p(c);
    const u = sub(B, A), v = sub(C, A);
    const f = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    for (const i of [a, b, c]) for (let k = 0; k < 3; k++) normal[i * 3 + k] += f[k];
    for (const [i, j] of [[a, b], [b, c], [c, a]]) {
      for (let k = 0; k < 3; k++) {
        sum[i * 3 + k] += positions[j * 3 + k];
        sum[j * 3 + k] += positions[i * 3 + k];
      }
      count[i]++;
      count[j]++;
      edge += Math.hypot(...sub(p(i), p(j)));
    }
  }
  edge /= indices.length;
  let value = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const nn = norm([normal[i * 3], normal[i * 3 + 1], normal[i * 3 + 2]]);
    const lap = [0, 1, 2].map((k) => sum[i * 3 + k] / (count[i] || 1) - positions[i * 3 + k]);
    value[i] = dot(lap, nn) / edge; // > 0: the neighbours sit above the tangent plane — a groove.
  }
  // Grooves are wider than one ring of neighbours: spread the measure a few rings.
  const neighbours = Array.from({ length: n }, () => []);
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
    neighbours[a].push(b, c);
    neighbours[b].push(a, c);
    neighbours[c].push(a, b);
  }
  for (let it = 0; it < 6; it++) {
    const next = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let s = value[i] * 2;
      for (const j of neighbours[i]) s += value[j];
      next[i] = s / (neighbours[i].length + 2);
    }
    value = next;
  }
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.min(1, Math.max(0, value[i] * 3.2 + 0.18));
  return out;
}

/* Building ---------------------------------------------------------------- */

function build(organ, spec, size, frame) {
  const total = spec.groups.reduce((s, g) => s + g.meshes.reduce((t, m) => t + m.indices.length / 3, 0), 0);
  const target = spec.sizes[size];
  const positions = [];
  const colors = [];
  const attrs = [];
  const quads = [];
  for (const g of spec.groups) {
    const tone = TONES[g.tone];
    for (const raw of g.meshes) {
      const mesh = simplify(raw, Math.max(60, Math.round(((raw.indices.length / 3) / total) * target)));
      const base = positions.length / 3;
      const n = mesh.positions.length / 3;
      for (let i = 0; i < n; i++) {
        const p = frame([mesh.positions[i * 3], mesh.positions[i * 3 + 1], mesh.positions[i * 3 + 2]]);
        positions.push(...p);
      }
      const depth = cavity(mesh.positions, mesh.indices);
      for (let i = 0; i < n; i++) {
        const d = depth[i];
        for (let k = 0; k < 3; k++) colors.push(lin(tone.crown[k] * (1 - d) + tone.depth[k] * d));
        // Baked shade (ambient occlusion): deep grooves get less light. No fat, no beat.
        attrs.push(1 - 0.55 * d, 0, 0, 0);
      }
      // Triangles, stored as quads with a repeated corner.
      for (let t = 0; t < mesh.indices.length; t += 3) quads.push(base + mesh.indices[t], base + mesh.indices[t + 1], base + mesh.indices[t + 2], base + mesh.indices[t + 2]);
    }
  }
  const model = { positions: new Float32Array(positions), colors: new Float32Array(colors), attrs: new Float32Array(attrs), quads: new Uint32Array(quads), vessels: [], center: [0, 0, 0] };
  const packed = encodeHeart(model);
  const gz = gzipSync(packed, { level: 9 });
  writeFileSync(`public/models/${organ}-${size}.bin.gz`, gz);
  console.log(`${organ}-${size}: ${model.positions.length / 3} vertices, ${model.quads.length / 4} triangles → ${Math.round(gz.length / 1024)} KB gzipped`);
}

/** Axes from the anatomy: x = the patient's left, y = up, z = forwards; centred, scaled to `extent` along `along`. */
function frameFrom(all, { right, anterior, along, extent }) {
  const up = [0, 0, 1]; // BodyParts3D: z runs from feet to head.
  const r = norm(sub(right, [0, 0, 0]));
  const x = norm([-r[0], -r[1], 0]);
  let z = norm([anterior[0], anterior[1], 0]);
  z = norm(sub(z, x.map((v) => v * dot(z, x))));
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  const toLocal = (p) => [dot(p, x), dot(p, up), dot(p, z)];
  for (const m of all) {
    for (let i = 0; i < m.positions.length; i += 3) {
      const q = toLocal([m.positions[i], m.positions[i + 1], m.positions[i + 2]]);
      for (let k = 0; k < 3; k++) {
        lo[k] = Math.min(lo[k], q[k]);
        hi[k] = Math.max(hi[k], q[k]);
      }
    }
  }
  const mid = lo.map((v, k) => (v + hi[k]) / 2);
  const scale = extent / (hi[along] - lo[along]);
  return (p) => toLocal(p).map((v, k) => (v - mid[k]) * scale);
}

await MeshoptSimplifier.ready;
const load = (spec) => {
  for (const g of spec.groups) g.meshes = g.ids.map((id) => weld(readStl(id)));
};
load(BRAIN);
load(LUNGS);

// Brain: forwards = from the occipital lobes to the superior frontal gyri; the patient's right = the right hemisphere's side.
{
  const byId = (id) => BRAIN.groups[0].meshes[CORTEX.indexOf(id)];
  const frontal = centroid({ positions: Float32Array.from([...byId("FMA72653").positions, ...byId("FMA72654").positions]) });
  const occipital = centroid({ positions: Float32Array.from([...byId("FMA72975").positions, ...byId("FMA72976").positions]) });
  const rightHemi = centroid(byId("FMA72653"));
  const leftHemi = centroid(byId("FMA72654"));
  const frame = frameFrom(BRAIN.groups.flatMap((g) => g.meshes), { right: sub(rightHemi, leftHemi), anterior: sub(frontal, occipital), along: 2, extent: 2.45 });
  for (const size of ["hd", "sd"]) build("brain", BRAIN, size, frame);
}
// Lungs: the right lung's lobes (upper, middle, lower) against the left's; the middle lobe lies in front of the lower.
{
  const [ru, rm, rl, lu, ll] = LUNGS.groups[0].meshes;
  const right = centroid({ positions: Float32Array.from([...ru.positions, ...rm.positions, ...rl.positions]) });
  const left = centroid({ positions: Float32Array.from([...lu.positions, ...ll.positions]) });
  const frame = frameFrom(LUNGS.groups.flatMap((g) => g.meshes), { right: sub(right, left), anterior: sub(centroid(rm), centroid(rl)), along: 1, extent: 2.5 });
  for (const size of ["hd", "sd"]) build("lungs", LUNGS, size, frame);
}
