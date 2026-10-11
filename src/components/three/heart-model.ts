/**
 * The anatomical heart, built offline (`node scripts/build-heart.ts`) into a
 * compact file the browser loads: ventricles and the conus, atria with their
 * crinkled auricles, the great vessels with open, cut ends, epicardial fat
 * that fills the grooves and cushions the coronary vessels, and shading baked
 * into every crease.
 *
 * Each part is a signed-distance shape (round cones, ellipsoids, tapering
 * tubes); a smooth minimum blends them into one surface and surface nets mesh
 * it. Where parts blend, the blend fills a groove — and that is where the fat
 * goes, as on a real heart. Pure maths; nothing is downloaded.
 *
 * Units: about 2.5 tall, y up, x towards the patient's left (the viewer's
 * right), z anterior (towards the viewer).
 */

export type V3 = readonly [number, number, number];
type SD = (x: number, y: number, z: number) => number;
type Tissue = "lv" | "rv" | "conus" | "atrium" | "auricle" | "aorta" | "pulmonary" | "cava" | "pvein";

/** 0 ventricle, 1 atrium, 2 vessel — what moves with each beat. */
const GROUP: Record<Tissue, 0 | 1 | 2> = { lv: 0, rv: 0, conus: 0, atrium: 1, auricle: 1, aorta: 2, pulmonary: 2, cava: 2, pvein: 2 };

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

/** A coronary artery or cardiac vein, drawn as a tapering tube lying on the surface. */
export interface Coronary {
  kind: "artery" | "vein";
  /** xyz per point. */
  points: number[];
  radii: number[];
  /** Per point, 0…1: baked shading, and how much the vessel moves with the ventricles and atria. */
  ao: number[];
  ventricle: number[];
  atrium: number[];
}

export interface HeartModel {
  positions: Float32Array;
  /** Linear RGB. */
  colors: Float32Array;
  /** Per vertex: baked ambient occlusion, fat, ventricle weight, atrium weight (0…1 each). */
  attrs: Float32Array;
  /** Four vertex indices per quad, wound outwards. */
  quads: Uint32Array;
  vessels: Coronary[];
  /** Middle of the heart, for framing. */
  center: V3;
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

/** A smooth curve through control points. */
export function catmull(points: readonly V3[], per = 6): V3[] {
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

const len3 = (x: number, y: number, z: number) => Math.sqrt(x * x + y * y + z * z);

/** A vessel: a tube tapering from r0 to r1 along a curve, cut square at its free end. */
function vessel(tissue: Tissue, control: V3[], r0: number, r1: number, k = 0.05, cutEnd = true): Part {
  const pts = catmull(control, 5);
  const n = pts.length - 1;
  const radius = (i: number) => r0 + (r1 - r0) * (i / n);
  const segs = pts.slice(0, -1).map((p, i) => {
    const q = pts[i + 1]!;
    const m: V3 = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2];
    return { sd: roundCone(p, q, radius(i), radius(i + 1)), m, r: len3(q[0] - p[0], q[1] - p[1], q[2] - p[2]) / 2 + Math.max(radius(i), radius(i + 1)) };
  });
  const end = pts[n]!, prev = pts[n - 1]!;
  const dl = len3(end[0] - prev[0], end[1] - prev[1], end[2] - prev[2]);
  const dir: V3 = [(end[0] - prev[0]) / dl, (end[1] - prev[1]) / dl, (end[2] - prev[2]) / dl];
  const sd: SD = (x, y, z) => {
    let d = Infinity;
    for (const s of segs) {
      if (len3(x - s.m[0], y - s.m[1], z - s.m[2]) - s.r >= d) continue;
      d = Math.min(d, s.sd(x, y, z));
    }
    return cutEnd ? Math.max(d, (x - end[0]) * dir[0] + (y - end[1]) * dir[1] + (z - end[2]) * dir[2]) : d;
  };
  const c: V3 = [0, 1, 2].map((k) => pts.reduce((a, p) => a + p[k as 0]!, 0) / pts.length) as unknown as V3;
  const r = Math.max(...pts.map((p) => len3(p[0] - c[0], p[1] - c[1], p[2] - c[2]))) + Math.max(r0, r1);
  return { tissue, sd, c, r, k, ...(cutEnd ? { cut: { at: end, dir, radius: r1 } } : {}) };
}

const blob = (tissue: Tissue, sd: SD, c: V3, r: number, k: number): Part => ({ tissue, sd, c, r, k });

/** Squash a shape front-to-back (hearts are flatter than they are wide). */
const flatten = (sd: SD, fz: number, cz = 0): SD => (x, y, z) => sd(x, y, cz + (z - cz) / fz) * Math.min(1, fz + 0.04);

/* The heart ---------------------------------------------------------------- */

/** Base and apex of the left ventricle — the long axis the beat squeezes towards. */
export const LV_BASE: V3 = [0.05, 0.12, -0.1];
export const LV_APEX: V3 = [0.37, -0.68, 0.05];
const RV_A: V3 = [-0.2, 0.06, 0.13];
const RV_B: V3 = [0.12, -0.5, 0.21];

export function heartParts(): Part[] {
  const lv = flatten(roundCone(LV_BASE, LV_APEX, 0.44, 0.075), 0.88, -0.05);
  const rv = flatten(roundCone(RV_A, RV_B, 0.37, 0.1), 0.84, 0.15);
  const conus = roundCone([-0.02, 0.12, 0.24], [0.08, 0.34, 0.26], 0.2, 0.145);
  return [
    blob("lv", lv, [0.21, -0.27, -0.03], 0.98, 0.07),
    blob("rv", rv, [-0.04, -0.22, 0.17], 0.82, 0.07),
    // The conus: the right ventricle's outflow, rising into the pulmonary trunk.
    blob("conus", conus, [0.03, 0.23, 0.25], 0.32, 0.08),
    blob("atrium", ellipsoid([-0.48, 0.3, 0.02], [0.245, 0.285, 0.255]), [-0.48, 0.3, 0.02], 0.3, 0.09),
    blob("atrium", ellipsoid([0.1, 0.36, -0.3], [0.33, 0.2, 0.22], 0.1), [0.1, 0.36, -0.3], 0.34, 0.09),
    // Auricles: ear-shaped flaps either side of the great vessels, crinkled at the edges.
    blob("auricle", ellipsoid([-0.31, 0.45, 0.17], [0.18, 0.11, 0.125], -0.55, 0.25), [-0.31, 0.45, 0.17], 0.2, 0.07),
    blob("auricle", ellipsoid([-0.19, 0.51, 0.23], [0.12, 0.075, 0.085], -0.75, 0.3), [-0.19, 0.51, 0.23], 0.13, 0.09),
    blob("auricle", ellipsoid([0.37, 0.42, 0.13], [0.16, 0.095, 0.125], 0.55, -0.5), [0.37, 0.42, 0.13], 0.19, 0.06),
    blob("auricle", ellipsoid([0.27, 0.47, 0.21], [0.095, 0.065, 0.075], 0.75, -0.4), [0.27, 0.47, 0.21], 0.12, 0.06),
    // The aorta: a bulging root, ascending, arching back over the pulmonary arteries, descending behind.
    blob("aorta", ellipsoid([-0.06, 0.34, 0.03], [0.17, 0.15, 0.17]), [-0.06, 0.34, 0.03], 0.18, 0.05),
    vessel("aorta", [[-0.06, 0.3, 0.02], [-0.12, 0.66, 0.05], [-0.12, 0.98, 0.02], [-0.02, 1.18, -0.1], [0.18, 1.24, -0.26], [0.34, 1.08, -0.4], [0.38, 0.62, -0.46], [0.36, 0.0, -0.46]], 0.152, 0.108, 0.06),
    vessel("aorta", [[-0.05, 1.1, -0.05], [-0.1, 1.28, -0.05], [-0.12, 1.36, -0.05]], 0.066, 0.06, 0.04, false),
    vessel("aorta", [[-0.12, 1.34, -0.05], [-0.26, 1.48, -0.06], [-0.42, 1.55, -0.08]], 0.047, 0.042, 0.025),
    vessel("aorta", [[-0.12, 1.34, -0.05], [-0.13, 1.5, -0.03], [-0.14, 1.68, -0.02]], 0.044, 0.04, 0.025),
    vessel("aorta", [[0.1, 1.18, -0.16], [0.12, 1.44, -0.17], [0.13, 1.66, -0.17]], 0.046, 0.041, 0.035),
    vessel("aorta", [[0.25, 1.16, -0.3], [0.34, 1.42, -0.32], [0.44, 1.6, -0.33]], 0.049, 0.044, 0.035),
    // Pulmonary trunk from the conus, splitting under the arch.
    vessel("pulmonary", [[0.08, 0.32, 0.26], [0.15, 0.62, 0.2], [0.2, 0.82, 0.02]], 0.142, 0.122, 0.06, false),
    vessel("pulmonary", [[0.18, 0.8, 0.03], [0.42, 0.88, -0.12], [0.62, 0.84, -0.2]], 0.088, 0.072, 0.035),
    vessel("pulmonary", [[0.18, 0.8, 0.0], [0.0, 0.86, -0.2], [-0.3, 0.84, -0.28], [-0.54, 0.8, -0.3]], 0.082, 0.066, 0.035),
    vessel("cava", [[-0.46, 0.42, -0.04], [-0.4, 0.9, -0.08], [-0.36, 1.32, -0.08]], 0.108, 0.1, 0.05),
    vessel("cava", [[-0.48, 0.14, -0.1], [-0.47, -0.08, -0.12], [-0.46, -0.32, -0.14]], 0.118, 0.11, 0.05),
    vessel("pvein", [[0.3, 0.42, -0.32], [0.5, 0.48, -0.4], [0.64, 0.5, -0.43]], 0.058, 0.052, 0.03),
    vessel("pvein", [[0.28, 0.28, -0.34], [0.48, 0.26, -0.42], [0.62, 0.24, -0.45]], 0.056, 0.05, 0.03),
    vessel("pvein", [[-0.08, 0.42, -0.34], [-0.3, 0.48, -0.43], [-0.44, 0.5, -0.47]], 0.058, 0.052, 0.03),
    vessel("pvein", [[-0.06, 0.28, -0.36], [-0.28, 0.25, -0.45], [-0.42, 0.22, -0.49]], 0.056, 0.05, 0.03),
  ];
}

/* Noise -------------------------------------------------------------------- */

function hash3(x: number, y: number, z: number) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1440662683);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise, 0…1. */
export function noise3(x: number, y: number, z: number) {
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

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const smin = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};

/* The field ------------------------------------------------------------------ */

/** Nearest distance to a set of points (each with a radius: the distance is measured in radii), through a coarse spatial hash. */
function pointCloud(points: number[], radii: number[], cell = 0.08) {
  const grid = new Map<string, number[]>();
  const key = (i: number, j: number, k: number) => `${i},${j},${k}`;
  for (let p = 0; p < points.length; p += 3) {
    const k = key(Math.floor(points[p]! / cell), Math.floor(points[p + 1]! / cell), Math.floor(points[p + 2]! / cell));
    const list = grid.get(k);
    if (list) list.push(p);
    else grid.set(k, [p]);
  }
  return (x: number, y: number, z: number, max = 6) => {
    const ci = Math.floor(x / cell), cj = Math.floor(y / cell), ck = Math.floor(z / cell);
    let best = max * max;
    for (let a = -1; a <= 1; a++)
      for (let b = -1; b <= 1; b++)
        for (let c = -1; c <= 1; c++) {
          const list = grid.get(key(ci + a, cj + b, ck + c));
          if (!list) continue;
          for (const p of list) {
            const dx = x - points[p]!, dy = y - points[p + 1]!, dz = z - points[p + 2]!;
            const r = radii[p / 3]!;
            const d2 = (dx * dx + dy * dy + dz * dz) / (r * r);
            if (d2 < best) best = d2;
          }
        }
    return Math.sqrt(best);
  };
}

interface Sample {
  /** The plain smooth union of the parts. */
  u: number;
  /** How much the blend filled in between parts here — a groove. */
  groove: number;
  /** Distance to the nearest auricle. */
  auricle: number;
}

function fieldOf(ps: Part[]) {
  const n = ps.length;
  /** Distance to each part at the last point evaluated (a lower bound for parts skipped). */
  const dist = new Float64Array(n);
  const s: Sample = { u: 0, groove: 0, auricle: 1 };
  const base = (x: number, y: number, z: number): Sample => {
    let u = 1e9, raw = 1e9, aur = 1e9;
    for (let i = 0; i < n; i++) {
      const p = ps[i]!;
      const bound = len3(x - p.c[0], y - p.c[1], z - p.c[2]) - p.r;
      if (bound > u + p.k) {
        dist[i] = bound;
        continue;
      }
      const di = p.sd(x, y, z);
      dist[i] = di;
      u = smin(u, di, p.k);
      if (di < raw) raw = di;
      if (p.tissue === "auricle" && di < aur) aur = di;
    }
    s.u = u;
    s.groove = Math.max(0, raw - u);
    s.auricle = aur;
    return s;
  };
  return { base, dist };
}

/* Coronary vessels ------------------------------------------------------------ */

function gradient(f: (x: number, y: number, z: number) => number, x: number, y: number, z: number, e = 0.003): V3 {
  return [(f(x + e, y, z) - f(x - e, y, z)) / (2 * e), (f(x, y + e, z) - f(x, y - e, z)) / (2 * e), (f(x, y, z + e) - f(x, y, z - e)) / (2 * e)];
}

/** Moves a point onto the surface f = 0, then out along the normal by `lift`. */
function onSurface(f: (x: number, y: number, z: number) => number, p: V3, lift: number): V3 {
  let [x, y, z] = p;
  for (let it = 0; it < 10; it++) {
    const d = f(x, y, z);
    const g = gradient(f, x, y, z);
    const l2 = g[0] * g[0] + g[1] * g[1] + g[2] * g[2] || 1;
    x -= (d * g[0]) / l2;
    y -= (d * g[1]) / l2;
    z -= (d * g[2]) / l2;
  }
  const g = gradient(f, x, y, z);
  const l = len3(g[0], g[1], g[2]) || 1;
  return [x + (g[0] / l) * lift, y + (g[1] / l) * lift, z + (g[2] / l) * lift];
}

/** Into the groove where two shapes meet: where their distances are equal. */
function intoGroove(a: SD, b: SD, p: V3): V3 {
  let [x, y, z] = p;
  const g = (x: number, y: number, z: number) => a(x, y, z) - b(x, y, z);
  for (let it = 0; it < 8; it++) {
    const d = g(x, y, z);
    const gr = gradient(g, x, y, z);
    const l2 = gr[0] * gr[0] + gr[1] * gr[1] + gr[2] * gr[2] || 1;
    x -= (0.6 * d * gr[0]) / l2;
    y -= (0.6 * d * gr[1]) / l2;
    z -= (0.6 * d * gr[2]) / l2;
  }
  return [x, y, z];
}

interface CoronaryPath {
  kind: Coronary["kind"];
  control: V3[];
  r0: number;
  r1: number;
  /** Keep it in the anterior interventricular groove. */
  groove?: boolean;
}

const CORONARIES: CoronaryPath[] = [
  // Left anterior descending, down the anterior interventricular groove and round the apex.
  { kind: "artery", control: [[0.24, 0.3, 0.3], [0.22, 0.08, 0.42], [0.25, -0.15, 0.42], [0.3, -0.38, 0.32], [0.35, -0.6, 0.16], [0.37, -0.7, 0.0]], r0: 0.024, r1: 0.011, groove: true },
  // Diagonal branches over the left ventricle.
  { kind: "artery", control: [[0.23, 0.06, 0.42], [0.36, -0.02, 0.37], [0.47, -0.12, 0.27], [0.54, -0.22, 0.14]], r0: 0.016, r1: 0.008 },
  { kind: "artery", control: [[0.27, -0.24, 0.39], [0.38, -0.32, 0.31], [0.47, -0.44, 0.17]], r0: 0.014, r1: 0.007 },
  // Circumflex round the left atrioventricular groove, with an obtuse marginal branch.
  { kind: "artery", control: [[0.24, 0.3, 0.3], [0.38, 0.25, 0.26], [0.53, 0.15, 0.08], [0.57, 0.08, -0.16], [0.5, 0.02, -0.36]], r0: 0.02, r1: 0.012 },
  { kind: "artery", control: [[0.53, 0.15, 0.08], [0.58, -0.1, 0.06], [0.56, -0.36, 0.0]], r0: 0.014, r1: 0.007 },
  // Right coronary round the right atrioventricular groove, with its conus and acute marginal branches.
  { kind: "artery", control: [[-0.14, 0.3, 0.22], [-0.28, 0.22, 0.3], [-0.44, 0.08, 0.26], [-0.55, -0.06, 0.1], [-0.56, -0.16, -0.1], [-0.45, -0.24, -0.3]], r0: 0.024, r1: 0.014 },
  { kind: "artery", control: [[-0.16, 0.3, 0.24], [-0.05, 0.27, 0.34], [0.05, 0.24, 0.37]], r0: 0.011, r1: 0.006 },
  { kind: "artery", control: [[-0.46, 0.06, 0.25], [-0.37, -0.16, 0.33], [-0.21, -0.4, 0.32]], r0: 0.015, r1: 0.007 },
  // Great cardiac vein beside the descending artery, then along the left groove.
  { kind: "vein", control: [[0.33, -0.56, 0.22], [0.29, -0.25, 0.42], [0.27, 0.02, 0.45], [0.28, 0.22, 0.38], [0.44, 0.2, 0.24], [0.57, 0.1, 0.02]], r0: 0.012, r1: 0.019 },
  // Anterior cardiac veins over the right ventricle.
  { kind: "vein", control: [[-0.3, -0.26, 0.32], [-0.36, -0.03, 0.32], [-0.41, 0.12, 0.27]], r0: 0.009, r1: 0.013 },
];

/* Colour -------------------------------------------------------------------- */

const linear = (hex: number): V3 => {
  const ch = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return [ch((hex >> 16) & 255), ch((hex >> 8) & 255), ch(hex & 255)];
};

/** A crimson-and-violet palette — the brand's colours — rather than a textbook's. */
const TISSUE: Record<Tissue, V3> = {
  lv: linear(0x8a1b2c),
  rv: linear(0x982233),
  conus: linear(0x9c2436),
  atrium: linear(0x7a1d38),
  auricle: linear(0x8a2343),
  aorta: linear(0xbf2e45),
  pulmonary: linear(0x4b42a0),
  cava: linear(0x3d3890),
  pvein: linear(0x8a2c52),
};
// The grooves and vessel tracks catch a soft rose light instead of yellow fat.
const FAT = linear(0xd57c86);
const FAT_DEEP = linear(0xb65a6b);
const FAT_PALE = linear(0xe9a7ac);
const LUMEN = linear(0x2e070b);

const mix3 = (a: V3, b: V3, t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/* Surface nets -------------------------------------------------------------- */

function surfaceNets(f: (x: number, y: number, z: number) => number, min: V3, max: V3, step: number) {
  const nx = Math.ceil((max[0] - min[0]) / step) + 1;
  const ny = Math.ceil((max[1] - min[1]) / step) + 1;
  const nz = Math.ceil((max[2] - min[2]) / step) + 1;
  const val = new Float32Array(nx * ny * nz);
  const at = (i: number, j: number, k: number) => i + nx * (j + ny * k);
  // A coarse pass first: far from the surface only the sign matters, and a distance field can't change sign within its own value.
  const C = 4;
  const mx = Math.ceil((nx - 1) / C) + 1, my = Math.ceil((ny - 1) / C) + 1, mz = Math.ceil((nz - 1) / C) + 1;
  const coarse = new Float32Array(mx * my * mz);
  for (let k = 0; k < mz; k++) for (let j = 0; j < my; j++) for (let i = 0; i < mx; i++) coarse[i + mx * (j + my * k)] = f(min[0] + i * C * step, min[1] + j * C * step, min[2] + k * C * step);
  const far = step * C * 1.1;
  for (let k = 0; k < nz; k++) {
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
  const corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]] as const;
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]] as const;
  const cv = new Float32Array(8);
  for (let k = 0; k < cz; k++)
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
        pos.push(min[0] + (i + sx / n) * step, min[1] + (j + sy / n) * step, min[2] + (k + sz / n) * step);
      }

  const idx: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) idx.push(a, d, c, b);
    else idx.push(a, b, c, d);
  };
  for (let k = 1; k < cz; k++)
    for (let j = 1; j < cy; j++)
      for (let i = 0; i < cx; i++) {
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
  return { positions: new Float32Array(pos), quads: new Uint32Array(idx) };
}

/* Build ----------------------------------------------------------------------- */

/** Builds the heart at the given grid step (smaller is finer). Deterministic. */
export function buildHeartModel(step = 0.016): HeartModel {
  const ps = heartParts();
  const { base, dist } = fieldOf(ps);
  const plain = (x: number, y: number, z: number) => base(x, y, z).u;

  // The coronaries first, on the bare surface: the fat then grows round them.
  const lv = ps[0]!.sd, rv = ps[1]!.sd;
  const paths = CORONARIES.map((c) => {
    const pts = catmull(c.control, 10);
    const n = pts.length - 1;
    const radii = pts.map((_, i) => c.r0 + (c.r1 - c.r0) * (i / n));
    const placed = pts.map((p, i) => onSurface(plain, c.groove ? intoGroove(lv, rv, p) : p, radii[i]! * 0.6));
    return { kind: c.kind, placed, radii };
  });
  const near = pointCloud(
    paths.flatMap((p) => p.placed.flatMap((q) => [q[0], q[1], q[2]])),
    paths.flatMap((p) => p.radii),
  );

  /** Fat at a point: filling the grooves, and along each coronary vessel — a band as wide as the vessel is big, with ragged edges. */
  const fatAt = (x: number, y: number, z: number, groove: number) => {
    const fill = smooth(0.004, 0.026, groove);
    const ragged = (noise3(x * 9 + 2, y * 9, z * 9) - 0.5) * 1.4;
    const track = 1 - smooth(1.5, 3.4, near(x, y, z) + ragged);
    return Math.min(1, fill * 0.95 + track * 0.85);
  };
  /** How far the fat bulges: in ridges either side of a vessel, leaving it a channel to lie in. */
  const bulgeAt = (x: number, y: number, z: number, groove: number) => {
    const d = near(x, y, z);
    const ridge = Math.exp(-(((d - 1.9) / 1.0) ** 2)) + 0.3 * Math.exp(-((d / 0.8) ** 2));
    return Math.min(1, smooth(0.004, 0.026, groove) * 0.9 + ridge * 0.75);
  };
  const full = (x: number, y: number, z: number) => {
    const s = base(x, y, z);
    let v = s.u;
    // Only near the surface does the detail matter (and only there is it worth computing).
    if (v > -0.06 && v < 0.06) {
      const fat = bulgeAt(x, y, z, s.groove);
      if (fat > 0) v -= 0.012 * fat * (0.5 + 0.5 * noise3(x * 15 + 5, y * 15, z * 15));
      if (s.auricle < 0.08) v -= 0.007 * Math.exp(-Math.max(0, s.auricle) * 22) * (noise3(x * 20, y * 20, z * 20) - 0.5) * 2;
      v += (noise3(x * 11, y * 11, z * 11) - 0.5) * 0.006;
    }
    return v;
  };

  const min: V3 = [-0.88, -0.9, -0.74];
  const max: V3 = [0.88, 1.8, 0.62];
  const { positions, quads } = surfaceNets(full, min, max, step);
  const count = positions.length / 3;
  // Surface nets place each point near the surface, not on it — enough to leave faint steps along the edges. Settle every point onto it.
  for (let v = 0; v < count; v++) {
    let x = positions[v * 3]!, y = positions[v * 3 + 1]!, z = positions[v * 3 + 2]!;
    for (let it = 0; it < 3; it++) {
      const d = full(x, y, z);
      const g = gradient(full, x, y, z, step * 0.25);
      const l2 = g[0] * g[0] + g[1] * g[1] + g[2] * g[2] || 1;
      const k = Math.max(-step, Math.min(step, d)) / l2;
      x -= k * g[0];
      y -= k * g[1];
      z -= k * g[2];
    }
    positions[v * 3] = x;
    positions[v * 3 + 1] = y;
    positions[v * 3 + 2] = z;
  }
  const colors = new Float32Array(count * 3);
  const attrs = new Float32Array(count * 4);
  const weights = new Float64Array(ps.length);

  /** Baked ambient occlusion: how much of the open air a point can see. */
  const occlusion = (x: number, y: number, z: number) => {
    const g = gradient(full, x, y, z, step * 0.5);
    const l = len3(g[0], g[1], g[2]) || 1;
    const nx = g[0] / l, ny = g[1] / l, nz = g[2] / l;
    let occ = 0;
    let fall = 1;
    for (let k = 1; k <= 6; k++) {
      const h = 0.01 + 0.028 * k;
      occ += (h - full(x + nx * h, y + ny * h, z + nz * h)) * fall;
      fall *= 0.72;
    }
    return Math.min(1, Math.max(0, 1 - 2.2 * occ));
  };

  for (let v = 0; v < count; v++) {
    const x = positions[v * 3]!, y = positions[v * 3 + 1]!, z = positions[v * 3 + 2]!;
    const s = base(x, y, z);
    const groove = s.groove;
    let total = 0;
    let ventricle = 0;
    let atrium = 0;
    let lumen = 0;
    for (let i = 0; i < ps.length; i++) {
      const d = dist[i]!;
      weights[i] = d > 0.08 ? 0 : Math.exp(-Math.max(0, d) * 60);
      total += weights[i]!;
      const p = ps[i]!;
      if (GROUP[p.tissue] === 0) ventricle += weights[i]!;
      else if (GROUP[p.tissue] === 1) atrium += weights[i]!;
      if (p.cut && d < 0.03) {
        const { at, dir, radius } = p.cut;
        const plane = (x - at[0]) * dir[0] + (y - at[1]) * dir[1] + (z - at[2]) * dir[2];
        const off = len3(x - at[0] - dir[0] * plane, y - at[1] - dir[1] * plane, z - at[2] - dir[2] * plane);
        // The cut face: an open lumen inside a pale wall.
        if (plane > -0.01 && off < radius * 0.8) lumen = Math.max(lumen, Math.min(1, (radius * 0.8 - off) / (radius * 0.12)));
      }
    }
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < ps.length; i++) {
      if (!weights[i]) continue;
      const c = TISSUE[ps[i]!.tissue];
      r += c[0] * weights[i]!;
      g += c[1] * weights[i]!;
      b += c[2] * weights[i]!;
    }
    if (total > 0) {
      r /= total;
      g /= total;
      b /= total;
      ventricle /= total;
      atrium /= total;
    }
    // Muscle isn't one flat colour: broad patches and a fine grain.
    const shade = 0.86 + 0.2 * noise3(x * 6, y * 6, z * 6);
    const towardApex = 0.9 + 0.1 * Math.min(1, Math.max(0, (y + 0.7) / 1.2));
    r *= shade * towardApex;
    g *= shade * towardApex;
    b *= shade * (towardApex * 0.98 + 0.02);
    // Fat: golden, lobulated, paler where it bulges most.
    const fat = fatAt(x, y, z, groove);
    const lob = noise3(x * 15 + 5, y * 15, z * 15);
    if (fat > 0) {
      const fc = mix3(mix3(FAT_DEEP, FAT, smooth(0.15, 0.7, lob)), FAT_PALE, smooth(0.75, 1, lob) * 0.6);
      const t = Math.min(1, smooth(0.08, 0.6, fat) * (0.45 + 0.25 * lob));
      r += (fc[0] - r) * t;
      g += (fc[1] - g) * t;
      b += (fc[2] - b) * t;
    }
    if (lumen > 0) {
      r += (LUMEN[0] - r) * lumen;
      g += (LUMEN[1] - g) * lumen;
      b += (LUMEN[2] - b) * lumen;
    }
    colors[v * 3] = r;
    colors[v * 3 + 1] = g;
    colors[v * 3 + 2] = b;
    attrs[v * 4] = occlusion(x, y, z);
    attrs[v * 4 + 1] = smooth(0.08, 0.6, fat);
    attrs[v * 4 + 2] = ventricle;
    attrs[v * 4 + 3] = atrium;
  }

  // Each coronary point: its shading and how it moves, from the surface it lies on.
  const vessels: Coronary[] = paths.map((p) => {
    const out: Coronary = { kind: p.kind, points: [], radii: p.radii, ao: [], ventricle: [], atrium: [] };
    for (const q of p.placed) {
      out.points.push(q[0], q[1], q[2]);
      base(q[0], q[1], q[2]);
      let total = 0, ven = 0, atr = 0;
      for (let i = 0; i < ps.length; i++) {
        const w = Math.exp(-Math.max(0, dist[i]!) * 60);
        total += w;
        if (GROUP[ps[i]!.tissue] === 0) ven += w;
        else if (GROUP[ps[i]!.tissue] === 1) atr += w;
      }
      const under = onSurface(full, q, 0.004);
      out.ao.push(Math.min(1, occlusion(under[0], under[1], under[2]) * 0.85 + 0.2));
      out.ventricle.push(total ? ven / total : 0);
      out.atrium.push(total ? atr / total : 0);
    }
    return out;
  });

  return { positions, colors, attrs, quads, vessels, center: [0, 0.42, -0.04] };
}
