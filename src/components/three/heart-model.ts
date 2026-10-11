/**
 * An anatomical heart, built from maths: ventricles, atria and auricles, the
 * great vessels and the coronary arteries. Each part is a signed-distance
 * shape (round cones, ellipsoids, tubes); a smooth minimum blends them into
 * one surface, and surface nets turn that into a mesh. Where parts blend into
 * each other — the atrioventricular and interventricular grooves, the roots of
 * the great vessels — the colour turns to epicardial fat, as on a real heart.
 *
 * Pure maths, no three.js and nothing downloaded: the scene builds its
 * geometry from these arrays. Units: the heart is about 2.5 tall, y up,
 * x towards the patient's left (the viewer's right), z anterior.
 */

type V3 = readonly [number, number, number];
type Tissue = "lv" | "rv" | "atrium" | "aorta" | "pulmonary" | "cava" | "pvein";
type SD = (x: number, y: number, z: number) => number;

interface Part {
  tissue: Tissue;
  sd: SD;
  /** Bounding sphere — parts far from a point are skipped. */
  c: V3;
  r: number;
  /** How softly it blends into what's already there. */
  k: number;
  /** A cut vessel end: the open lumen shows. */
  cut?: { at: V3; dir: V3; radius: number };
}

export interface HeartMesh {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
}

/** A thinner great vessel, drawn as a smooth tube: the arch branches, pulmonary arteries and veins. */
export interface GreatVessel {
  points: Float32Array;
  radius: number;
  tissue: "aorta" | "pulmonary" | "pvein";
}

export interface CoronaryVessel {
  /** Points along the vessel, xyz. */
  points: Float32Array;
  radius: number;
  kind: "artery" | "vein";
}

export interface HeartModel {
  body: HeartMesh;
  vessels: CoronaryVessel[];
  great: GreatVessel[];
  /** Centre and height of the whole model, for framing. */
  center: V3;
  height: number;
}

/* Shapes ------------------------------------------------------------------- */

/** A cone with rounded ends (sphere r1 at a, r2 at b) — Inigo Quilez's exact distance. */
function roundCone(a: V3, b: V3, r1: number, r2: number): SD {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = r1 - r2;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  return (x, y, z) => {
    const pax = x - a[0], pay = y - a[1], paz = z - a[2];
    const py = pax * bax + pay * bay + paz * baz;
    const pz = py - l2;
    const qx = pax * l2 - bax * py, qy = pay * l2 - bay * py, qz = paz * l2 - baz * py;
    const x2 = qx * qx + qy * qy + qz * qz;
    const y2 = py * py * l2;
    const z2 = pz * pz * l2;
    const k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(pz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
    if (Math.sign(py) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
    return (Math.sqrt(x2 * a2 * il2) + py * rr) * il2 - r1;
  };
}

/** An ellipsoid, turned by rz about z then ry about y (approximate distance). */
function ellipsoid(c: V3, r: V3, rz = 0, ry = 0): SD {
  const cz = Math.cos(rz), sz = Math.sin(rz), cy = Math.cos(ry), sy = Math.sin(ry);
  const [rx, ryy, rzz] = r;
  return (x, y, z) => {
    let px = x - c[0], py = y - c[1], pz = z - c[2];
    const x1 = cz * px + sz * py;
    py = -sz * px + cz * py;
    px = x1;
    const x2 = cy * px - sy * pz;
    pz = sy * px + cy * pz;
    px = x2;
    const ax = px / rx, ay = py / ryy, az = pz / rzz;
    const k0 = Math.sqrt(ax * ax + ay * ay + az * az);
    const bx = ax / rx, by = ay / ryy, bz = az / rzz;
    const k1 = Math.sqrt(bx * bx + by * by + bz * bz);
    return k1 < 1e-9 ? -Math.min(rx, ryy, rzz) : (k0 * (k0 - 1)) / k1;
  };
}

/** A smooth curve through control points (centripetal enough for gentle bends). */
function catmull(points: V3[], per = 4): V3[] {
  const out: V3[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!, p1 = points[i]!, p2 = points[i + 1]!, p3 = points[Math.min(points.length - 1, i + 2)]!;
    for (let s = 0; s < per; s++) {
      const t = s / per, t2 = t * t, t3 = t2 * t;
      const f = (k: 0 | 1 | 2) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
      out.push([f(0), f(1), f(2)]);
    }
  }
  out.push(points[points.length - 1]!);
  return out;
}

/** A vessel: a tapering tube along a curve, cut square at its free end. */
function vessel(tissue: Tissue, control: V3[], r0: number, r1: number, k = 0.05, cutEnd = true): Part {
  const pts = catmull(control);
  const n = pts.length - 1;
  const radius = (i: number) => r0 + (r1 - r0) * (i / n);
  const segs = pts.slice(0, -1).map((p, i) => {
    const q = pts[i + 1]!;
    const m: V3 = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2];
    return { sd: roundCone(p, q, radius(i), radius(i + 1)), m, r: Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) / 2 + Math.max(radius(i), radius(i + 1)) };
  });
  const end = pts[n]!, prev = pts[n - 1]!;
  const dl = Math.hypot(end[0] - prev[0], end[1] - prev[1], end[2] - prev[2]);
  const dir: V3 = [(end[0] - prev[0]) / dl, (end[1] - prev[1]) / dl, (end[2] - prev[2]) / dl];
  const sd: SD = (x, y, z) => {
    let d = Infinity;
    for (const s of segs) {
      const dx = x - s.m[0], dy = y - s.m[1], dz = z - s.m[2];
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) - s.r >= d) continue;
      d = Math.min(d, s.sd(x, y, z));
    }
    return cutEnd ? Math.max(d, (x - end[0]) * dir[0] + (y - end[1]) * dir[1] + (z - end[2]) * dir[2]) : d;
  };
  const c: V3 = [0, 1, 2].map((k) => pts.reduce((a, p) => a + p[k as 0]!, 0) / pts.length) as unknown as V3;
  const r = Math.max(...pts.map((p) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]))) + Math.max(r0, r1);
  return { tissue, sd, c, r, k, ...(cutEnd ? { cut: { at: end, dir, radius: r1 } } : {}) };
}

function blob(tissue: Tissue, sd: SD, c: V3, r: number, k: number): Part {
  return { tissue, sd, c, r, k };
}

/* The heart ---------------------------------------------------------------- */

const LV_A: V3 = [0.02, 0.12, -0.08], LV_B: V3 = [0.36, -0.62, 0.02];
const RV_A: V3 = [-0.22, 0.06, 0.14], RV_B: V3 = [0.12, -0.5, 0.2];

function parts(): Part[] {
  const lv = roundCone(LV_A, LV_B, 0.43, 0.09);
  const rv = roundCone(RV_A, RV_B, 0.36, 0.1);
  return [
    blob("lv", (x, y, z) => lv(x, y, z / 0.9) * 0.94, [0.19, -0.25, -0.03], 0.95, 0.07),
    blob("rv", (x, y, z) => rv(x, y, z / 0.88) * 0.94, [-0.05, -0.22, 0.17], 0.8, 0.07),
    blob("atrium", ellipsoid([-0.48, 0.3, 0.0], [0.24, 0.28, 0.26]), [-0.48, 0.3, 0], 0.3, 0.09),
    blob("atrium", ellipsoid([0.1, 0.36, -0.28], [0.32, 0.2, 0.22], 0.1), [0.1, 0.36, -0.28], 0.34, 0.09),
    // Auricles: the ear-shaped appendages either side of the great vessels, each with a lobed tip.
    blob("atrium", ellipsoid([-0.31, 0.45, 0.17], [0.18, 0.11, 0.125], -0.55, 0.25), [-0.31, 0.45, 0.17], 0.2, 0.07),
    blob("atrium", ellipsoid([-0.2, 0.51, 0.22], [0.12, 0.075, 0.085], -0.75, 0.3), [-0.2, 0.51, 0.22], 0.13, 0.09),
    blob("atrium", ellipsoid([0.36, 0.42, 0.12], [0.16, 0.095, 0.125], 0.55, -0.5), [0.36, 0.42, 0.12], 0.19, 0.06),
    blob("atrium", ellipsoid([0.26, 0.47, 0.2], [0.095, 0.065, 0.075], 0.75, -0.4), [0.26, 0.47, 0.2], 0.12, 0.05),
    // The great vessels thick enough for the surface: aorta, pulmonary trunk, venae cavae.
    vessel("aorta", [[-0.06, 0.28, 0.0], [-0.12, 0.7, 0.04], [-0.1, 1.0, 0.0], [0.02, 1.2, -0.12], [0.22, 1.23, -0.28], [0.36, 1.05, -0.4], [0.38, 0.6, -0.46], [0.36, 0.0, -0.46]], 0.15, 0.1, 0.06),
    vessel("pulmonary", [[0.06, 0.26, 0.24], [0.14, 0.62, 0.2], [0.2, 0.82, 0.02]], 0.135, 0.12, 0.06, false),
    vessel("cava", [[-0.46, 0.42, -0.04], [-0.4, 0.9, -0.08], [-0.36, 1.32, -0.08]], 0.105, 0.098, 0.05),
    vessel("cava", [[-0.48, 0.14, -0.1], [-0.47, -0.08, -0.12], [-0.46, -0.32, -0.14]], 0.115, 0.11, 0.05),
  ];
}

/** The thinner vessels, as smooth tubes rooted inside their parent. */
const GREAT: { tissue: GreatVessel["tissue"]; control: V3[]; radius: number }[] = [
  { tissue: "aorta", control: [[-0.04, 1.12, -0.06], [-0.12, 1.4, -0.06], [-0.18, 1.62, -0.05]], radius: 0.058 },
  { tissue: "aorta", control: [[0.1, 1.18, -0.16], [0.12, 1.42, -0.17], [0.13, 1.6, -0.17]], radius: 0.046 },
  { tissue: "aorta", control: [[0.25, 1.17, -0.3], [0.34, 1.42, -0.32], [0.42, 1.58, -0.32]], radius: 0.048 },
  { tissue: "pulmonary", control: [[0.18, 0.8, 0.03], [0.42, 0.88, -0.12], [0.62, 0.84, -0.2]], radius: 0.08 },
  { tissue: "pulmonary", control: [[0.18, 0.8, 0.0], [0.0, 0.86, -0.2], [-0.3, 0.84, -0.28], [-0.54, 0.8, -0.3]], radius: 0.074 },
  { tissue: "pvein", control: [[0.3, 0.42, -0.32], [0.5, 0.48, -0.4], [0.64, 0.5, -0.43]], radius: 0.054 },
  { tissue: "pvein", control: [[0.28, 0.28, -0.34], [0.48, 0.26, -0.42], [0.62, 0.24, -0.45]], radius: 0.052 },
  { tissue: "pvein", control: [[-0.08, 0.42, -0.34], [-0.3, 0.48, -0.43], [-0.44, 0.5, -0.47]], radius: 0.054 },
  { tissue: "pvein", control: [[-0.06, 0.28, -0.36], [-0.28, 0.25, -0.45], [-0.42, 0.22, -0.49]], radius: 0.052 },
];

/* Noise -------------------------------------------------------------------- */

function hash3(x: number, y: number, z: number) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1440662683);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise, 0…1. */
function noise3(x: number, y: number, z: number) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  return l(
    l(l(hash3(ix, iy, iz), hash3(ix + 1, iy, iz), u), l(hash3(ix, iy + 1, iz), hash3(ix + 1, iy + 1, iz), u), v),
    l(l(hash3(ix, iy, iz + 1), hash3(ix + 1, iy, iz + 1), u), l(hash3(ix, iy + 1, iz + 1), hash3(ix + 1, iy + 1, iz + 1), u), v),
    w,
  );
}

/* Field --------------------------------------------------------------------- */

const smin = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};

function fieldOf(ps: Part[]) {
  return (x: number, y: number, z: number) => {
    let d = 1e9;
    for (const p of ps) {
      const dx = x - p.c[0], dy = y - p.c[1], dz = z - p.c[2];
      const bound = Math.sqrt(dx * dx + dy * dy + dz * dz) - p.r;
      if (bound > d + p.k) continue;
      d = smin(d, p.sd(x, y, z), p.k);
    }
    // The living surface isn't perfectly smooth.
    return d + (noise3(x * 9, y * 9, z * 9) - 0.5) * 0.012;
  };
}

/* Surface nets -------------------------------------------------------------- */

/** Hands the thread back to the page now and then, so building never blocks scrolling or taps. */
type Pause = () => Promise<void>;
function slicer(pause?: Pause) {
  let last = performance.now();
  return async () => {
    if (!pause || performance.now() - last < 8) return;
    await pause();
    last = performance.now();
  };
}

async function surfaceNets(f: (x: number, y: number, z: number) => number, min: V3, max: V3, step: number, pause?: Pause) {
  const breathe = slicer(pause);
  const nx = Math.ceil((max[0] - min[0]) / step) + 1;
  const ny = Math.ceil((max[1] - min[1]) / step) + 1;
  const nz = Math.ceil((max[2] - min[2]) / step) + 1;
  const val = new Float32Array(nx * ny * nz);
  const at = (i: number, j: number, k: number) => i + nx * (j + ny * k);
  // A coarse pass first: far from the surface the sign is all that matters, and a distance field can't change sign within its own value.
  const C = 4;
  const mx = Math.ceil((nx - 1) / C) + 1, my = Math.ceil((ny - 1) / C) + 1, mz = Math.ceil((nz - 1) / C) + 1;
  const coarse = new Float32Array(mx * my * mz);
  for (let k = 0; k < mz; k++) for (let j = 0; j < my; j++) for (let i = 0; i < mx; i++) coarse[i + mx * (j + my * k)] = f(min[0] + i * C * step, min[1] + j * C * step, min[2] + k * C * step);
  const far = step * C * 0.9;
  for (let k = 0; k < nz; k++) {
    await breathe();
    const ck = Math.round(k / C);
    for (let j = 0; j < ny; j++) {
      const cj = Math.round(j / C);
      for (let i = 0; i < nx; i++) {
        const c = coarse[Math.round(i / C) + mx * (cj + my * ck)]!;
        val[at(i, j, k)] = Math.abs(c) > far ? c : f(min[0] + i * step, min[1] + j * step, min[2] + k * step);
      }
    }
  }

  const cx = nx - 1, cy = ny - 1, cz = nz - 1;
  const cell = new Int32Array(cx * cy * cz).fill(-1);
  const cat = (i: number, j: number, k: number) => i + cx * (j + cy * k);
  const pos: number[] = [];
  const nrm: number[] = [];
  const corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]] as const;
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]] as const;
  const cv = new Float32Array(8);
  for (let k = 0; k < cz; k++) {
    await breathe();
    for (let j = 0; j < cy; j++)
      for (let i = 0; i < cx; i++) {
        let inside = 0;
        for (let c = 0; c < 8; c++) {
          const o = corners[c]!;
          cv[c] = val[at(i + o[0], j + o[1], k + o[2])]!;
          if (cv[c]! < 0) inside++;
        }
        if (inside === 0 || inside === 8) continue;
        let sx = 0, sy = 0, sz = 0, n = 0;
        for (const [a, b] of edges) {
          const va = cv[a]!, vb = cv[b]!;
          if (va < 0 === vb < 0) continue;
          const t = va / (va - vb);
          const oa = corners[a]!, ob = corners[b]!;
          sx += oa[0] + (ob[0] - oa[0]) * t;
          sy += oa[1] + (ob[1] - oa[1]) * t;
          sz += oa[2] + (ob[2] - oa[2]) * t;
          n++;
        }
        cell[cat(i, j, k)] = pos.length / 3;
        const u = sx / n, v = sy / n, w = sz / n;
        pos.push(min[0] + (i + u) * step, min[1] + (j + v) * step, min[2] + (k + w) * step);
        // The gradient at each corner (central differences), blended trilinearly: smooth shading without faceting.
        let gx = 0, gy = 0, gz = 0;
        for (let c = 0; c < 8; c++) {
          const o = corners[c]!;
          const ii = Math.min(nx - 2, Math.max(1, i + o[0])), jj = Math.min(ny - 2, Math.max(1, j + o[1])), kk = Math.min(nz - 2, Math.max(1, k + o[2]));
          const wt = (o[0] ? u : 1 - u) * (o[1] ? v : 1 - v) * (o[2] ? w : 1 - w);
          gx += wt * (val[at(ii + 1, jj, kk)]! - val[at(ii - 1, jj, kk)]!);
          gy += wt * (val[at(ii, jj + 1, kk)]! - val[at(ii, jj - 1, kk)]!);
          gz += wt * (val[at(ii, jj, kk + 1)]! - val[at(ii, jj, kk - 1)]!);
        }
        const gl = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
        nrm.push(gx / gl, gy / gl, gz / gl);
      }
  }

  const idx: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) idx.push(a, d, c, a, c, b);
    else idx.push(a, b, c, a, c, d);
  };
  for (let k = 1; k < cz; k++)
    for (let j = 1; j < cy; j++)
      for (let i = 0; i < cx; i++) {
        // Edge along x from (i,j,k).
        const v0 = val[at(i, j, k)]!, v1 = val[at(i + 1, j, k)]!;
        if (v0 < 0 !== v1 < 0) quad(cell[cat(i, j - 1, k - 1)]!, cell[cat(i, j, k - 1)]!, cell[cat(i, j, k)]!, cell[cat(i, j - 1, k)]!, v1 < 0);
      }
  for (let k = 1; k < cz; k++)
    for (let j = 0; j < cy; j++)
      for (let i = 1; i < cx; i++) {
        const v0 = val[at(i, j, k)]!, v1 = val[at(i, j + 1, k)]!;
        if (v0 < 0 !== v1 < 0) quad(cell[cat(i - 1, j, k - 1)]!, cell[cat(i - 1, j, k)]!, cell[cat(i, j, k)]!, cell[cat(i, j, k - 1)]!, v1 < 0);
      }
  for (let k = 0; k < cz; k++)
    for (let j = 1; j < cy; j++)
      for (let i = 1; i < cx; i++) {
        const v0 = val[at(i, j, k)]!, v1 = val[at(i, j, k + 1)]!;
        if (v0 < 0 !== v1 < 0) quad(cell[cat(i - 1, j - 1, k)]!, cell[cat(i, j - 1, k)]!, cell[cat(i, j, k)]!, cell[cat(i - 1, j, k)]!, v1 < 0);
      }
  return { positions: new Float32Array(pos), normals: new Float32Array(nrm), indices: new Uint32Array(idx) };
}

/* Colour -------------------------------------------------------------------- */

const linear = (hex: number): V3 => {
  const ch = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return [ch((hex >> 16) & 255), ch((hex >> 8) & 255), ch(hex & 255)];
};

const TISSUE: Record<Tissue, V3> = {
  lv: linear(0x7c2523),
  rv: linear(0x8a302b),
  atrium: linear(0x76293a),
  aorta: linear(0xa9343a),
  pulmonary: linear(0x4a5ba2),
  cava: linear(0x3d4c90),
  pvein: linear(0x8a2d3e),
};
/** Colours for the tube vessels, as sRGB hex for the scene. */
export const VESSEL_HEX = { aorta: 0xa9343a, pulmonary: 0x4a5ba2, pvein: 0x8a2d3e, artery: 0xa82a2e, vein: 0x3b4b95, lumen: 0x2c080b } as const;
const FAT = linear(0xe2c272);
const FAT_DEEP = linear(0xc99a45);
const LUMEN = linear(0x34080c);

/* Coronary vessels ------------------------------------------------------------ */

function gradient(f: (x: number, y: number, z: number) => number, x: number, y: number, z: number, e = 0.004): V3 {
  return [(f(x + e, y, z) - f(x - e, y, z)) / (2 * e), (f(x, y + e, z) - f(x, y - e, z)) / (2 * e), (f(x, y, z + e) - f(x, y, z - e)) / (2 * e)];
}

/** Moves a point onto the surface f = 0, then out by `lift` (vessels sit half in the fat). */
function onSurface(f: (x: number, y: number, z: number) => number, p: V3, lift: number): V3 {
  let [x, y, z] = p;
  for (let it = 0; it < 8; it++) {
    const d = f(x, y, z);
    const g = gradient(f, x, y, z);
    const l2 = g[0] * g[0] + g[1] * g[1] + g[2] * g[2] || 1;
    x -= (d * g[0]) / l2;
    y -= (d * g[1]) / l2;
    z -= (d * g[2]) / l2;
  }
  const g = gradient(f, x, y, z);
  const l = Math.hypot(g[0], g[1], g[2]) || 1;
  return [x + (g[0] / l) * lift, y + (g[1] / l) * lift, z + (g[2] / l) * lift];
}

/** Into the groove where two parts meet: where their distances are equal. */
function intoGroove(a: SD, b: SD, p: V3): V3 {
  let [x, y, z] = p;
  const g = (x: number, y: number, z: number) => a(x, y, z) - b(x, y, z);
  for (let it = 0; it < 6; it++) {
    const d = g(x, y, z);
    const gr = gradient(g, x, y, z);
    const l2 = gr[0] * gr[0] + gr[1] * gr[1] + gr[2] * gr[2] || 1;
    x -= (0.7 * d * gr[0]) / l2;
    y -= (0.7 * d * gr[1]) / l2;
    z -= (0.7 * d * gr[2]) / l2;
  }
  return [x, y, z];
}

function coronaries(f: (x: number, y: number, z: number) => number, ps: Part[]): CoronaryVessel[] {
  const lv = ps[0]!.sd, rv = ps[1]!.sd;
  const path = (control: V3[], radius: number, kind: CoronaryVessel["kind"], groove = false): CoronaryVessel => {
    const pts = catmull(control, 8).map((p) => onSurface(f, groove ? intoGroove(lv, rv, p) : p, radius * 0.45));
    return { points: new Float32Array(pts.flat()), radius, kind };
  };
  return [
    // Left anterior descending, down the anterior interventricular groove to the apex.
    path([[0.2, 0.26, 0.36], [0.2, 0.05, 0.42], [0.24, -0.18, 0.4], [0.3, -0.4, 0.3], [0.36, -0.6, 0.14]], 0.022, "artery", true),
    // Its diagonal branches, over the left ventricle.
    path([[0.22, 0.1, 0.42], [0.36, -0.02, 0.36], [0.5, -0.16, 0.24]], 0.014, "artery"),
    path([[0.26, -0.18, 0.4], [0.4, -0.3, 0.3], [0.5, -0.42, 0.14]], 0.013, "artery"),
    // Circumflex, round the left atrioventricular groove.
    path([[0.2, 0.26, 0.36], [0.36, 0.24, 0.26], [0.52, 0.14, 0.06], [0.56, 0.08, -0.18]], 0.019, "artery"),
    // Right coronary, round the right atrioventricular groove, with its acute marginal branch.
    path([[-0.16, 0.3, 0.24], [-0.3, 0.2, 0.3], [-0.46, 0.06, 0.24], [-0.56, -0.08, 0.06], [-0.54, -0.18, -0.14]], 0.022, "artery"),
    path([[-0.46, 0.06, 0.26], [-0.38, -0.16, 0.32], [-0.22, -0.38, 0.32]], 0.014, "artery"),
    // Great cardiac vein beside the descending artery, then into the left groove.
    path([[0.28, -0.5, 0.26], [0.27, -0.2, 0.42], [0.24, 0.06, 0.44], [0.26, 0.22, 0.38], [0.42, 0.2, 0.24]], 0.016, "vein"),
    // Anterior cardiac veins over the right ventricle.
    path([[-0.3, -0.24, 0.32], [-0.36, -0.02, 0.32], [-0.38, 0.12, 0.27]], 0.011, "vein"),
  ];
}

/* Build ----------------------------------------------------------------------- */

/** Builds the heart; pass `pause` (e.g. a zero-delay timeout) to build in slices without blocking the page. */
export async function buildHeartModel(step = 0.026, pause?: Pause): Promise<HeartModel> {
  const breathe = slicer(pause);
  const ps = parts();
  const f = fieldOf(ps);
  const min: V3 = [-0.86, -0.86, -0.72];
  const max: V3 = [0.86, 1.76, 0.6];
  const { positions, normals, indices } = await surfaceNets(f, min, max, step, pause);
  const vessels = coronaries(f, ps);
  const great: GreatVessel[] = GREAT.map((g) => ({ points: new Float32Array(catmull(g.control, 8).flat()), radius: g.radius, tissue: g.tissue }));

  // Fat follows the coronaries: the sampled points of every vessel, for a nearest-distance test.
  const along = vessels.flatMap((v) => Array.from({ length: v.points.length / 3 }, (_, i) => [v.points[i * 3]!, v.points[i * 3 + 1]!, v.points[i * 3 + 2]!] as const));

  const colors = new Float32Array(positions.length);
  const w = new Float64Array(ps.length);
  for (let v = 0; v < positions.length / 3; v++) {
    if (v % 512 === 0) await breathe();
    const x = positions[v * 3]!, y = positions[v * 3 + 1]!, z = positions[v * 3 + 2]!;
    let total = 0;
    let nearest = Infinity;
    let lumen = 0;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i]!;
      w[i] = 0;
      const ex = x - p.c[0], ey = y - p.c[1], ez = z - p.c[2];
      if (Math.sqrt(ex * ex + ey * ey + ez * ez) - p.r > 0.08) continue;
      const d = p.sd(x, y, z);
      nearest = Math.min(nearest, Math.max(0, d));
      w[i] = Math.exp(-Math.max(0, d) * 70);
      total += w[i]!;
      if (p.cut && d < 0.02) {
        const { at, dir, radius } = p.cut;
        const plane = (x - at[0]) * dir[0] + (y - at[1]) * dir[1] + (z - at[2]) * dir[2];
        const off = Math.hypot(x - at[0] - dir[0] * plane, y - at[1] - dir[1] * plane, z - at[2] - dir[2] * plane);
        if (plane > -0.008 && off < radius * 0.78) lumen = Math.max(lumen, Math.min(1, (radius * 0.78 - off) / (radius * 0.15)));
      }
    }
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < ps.length; i++) {
      if (!w[i]) continue;
      const c = TISSUE[ps[i]!.tissue];
      r += c[0] * w[i]!;
      g += c[1] * w[i]!;
      b += c[2] * w[i]!;
    }
    if (total > 0) {
      r /= total;
      g /= total;
      b /= total;
    }
    // Fat: in the grooves (where the blend fills between parts) and along the coronaries.
    let near = Infinity;
    for (const q of along) {
      const dx = x - q[0], dy = y - q[1], dz = z - q[2];
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < near) near = d2;
    }
    const groove = smooth(0.003, 0.024, nearest);
    // Fat cushions each vessel and merges between close branches, thinning out over open muscle.
    const track = 1 - smooth(0.03, 0.12, Math.sqrt(near));
    const lumps = 0.6 + 0.4 * noise3(x * 5 + 3, y * 5, z * 5);
    const fat = Math.min(1, (groove * 0.95 + track * 0.72) * lumps * 1.12);
    const fc = mix3(FAT, FAT_DEEP, noise3(x * 9 + 7, y * 9, z * 9));
    r += (fc[0] - r) * fat;
    g += (fc[1] - g) * fat;
    b += (fc[2] - b) * fat;
    // Mottling, a little darker towards the apex.
    const shade = (0.88 + 0.2 * noise3(x * 10, y * 10, z * 10)) * (0.9 + 0.1 * Math.min(1, Math.max(0, (y + 0.7) / 1.2)));
    r *= shade;
    g *= shade;
    b *= shade;
    if (lumen > 0) {
      r += (LUMEN[0] - r) * lumen;
      g += (LUMEN[1] - g) * lumen;
      b += (LUMEN[2] - b) * lumen;
    }
    colors[v * 3] = r;
    colors[v * 3 + 1] = g;
    colors[v * 3 + 2] = b;
  }

  return { body: { positions, normals, colors, indices }, vessels, great, center: [0, (min[1] + max[1]) / 2 - 0.05, 0], height: 2.5 };
}

function smooth(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

const mix3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
