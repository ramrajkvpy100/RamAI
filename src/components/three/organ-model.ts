/**
 * Two more organs for the site, built like the heart (heart-model.ts): signed
 * distances blended into one surface, meshed by surface nets, shading baked in.
 *   · the brain — two hemispheres carrying the landmark sulci (the Sylvian
 *     fissure, the central sulcus between the precentral and postcentral gyri,
 *     the frontal, temporal and intraparietal sulci), the gyri grown between
 *     them; the cerebellum's hemispheres and folia, the pons and brainstem, and
 *     the middle cerebral artery's branches rising out of the Sylvian fissure;
 *   · the lungs — three lobes on the right and two on the left (fissures
 *     carved in), the cardiac notch and lingula, concave bases on the
 *     diaphragm (the right dome higher), and the ringed trachea dividing into
 *     the main bronchi (the right shorter, wider and steeper).
 * Units match the heart's (about 2.5 tall), y up, z towards the viewer.
 */
import { catmull, ellipsoid, gradient, len3, linear, mix3, noise3, onSurface, roundCone, smin, smooth, surfaceNets, type Coronary, type HeartModel, type SD, type V3 } from "./heart-model";

const smax = (a: number, b: number, k: number) => -smin(-a, -b, k);

/** Settles each vertex onto the surface, then bakes colour and ambient occlusion. */
function finish(full: SD, min: V3, max: V3, step: number, colour: (x: number, y: number, z: number) => V3, vessels: Coronary[] = [], center: V3 = [0, 0, 0]): HeartModel {
  const { positions, quads } = surfaceNets(full, min, max, step);
  const count = positions.length / 3;
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
  const occlusion = (x: number, y: number, z: number) => {
    const g = gradient(full, x, y, z, step * 0.5);
    const l = len3(g[0], g[1], g[2]) || 1;
    const nx = g[0] / l, ny = g[1] / l, nz = g[2] / l;
    let occ = 0;
    let fall = 1;
    for (let k = 1; k <= 6; k++) {
      const h = 0.01 + 0.026 * k;
      occ += (h - full(x + nx * h, y + ny * h, z + nz * h)) * fall;
      fall *= 0.72;
    }
    return Math.min(1, Math.max(0, 1 - 2.4 * occ));
  };
  const colors = new Float32Array(count * 3);
  const attrs = new Float32Array(count * 4);
  for (let v = 0; v < count; v++) {
    const x = positions[v * 3]!, y = positions[v * 3 + 1]!, z = positions[v * 3 + 2]!;
    const c = colour(x, y, z);
    colors.set(c, v * 3);
    attrs[v * 4] = occlusion(x, y, z);
  }
  // Vessels lying on the surface: their shading from the surface beneath.
  const placed = vessels.map((v) => {
    const ao: number[] = [];
    for (let i = 0; i < v.points.length; i += 3) {
      const under = onSurface(full, [v.points[i]!, v.points[i + 1]!, v.points[i + 2]!], 0.004);
      ao.push(Math.min(1, occlusion(under[0], under[1], under[2]) * 0.85 + 0.2));
    }
    return { ...v, ao, ventricle: ao.map(() => 0), atrium: ao.map(() => 0) };
  });
  return { positions, colors, attrs, quads, vessels: placed, center };
}

/* -------------------------------------------------------------------------- */
/* The brain                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The map the folds grow on, round the long axis: the hemisphere unrolled about
 * an axis outside it (in the other one), so no point of its surface is a pole
 * of the map — a pole would gather the folds into a star. Near-true lengths on
 * the lateral surface.
 */
const foldV = (y: number, z: number) => 1.1 * Math.atan2(y - 0.1, Math.abs(z) + 0.25);

/**
 * The fold map along the long axis: x, stretched to the length over the surface
 * where the hemisphere rounds off into the frontal and occipital poles, so the
 * folds keep their width there.
 */
const foldS = (() => {
  const X0 = -1.25, H = 0.002, n = 1251;
  const table = new Float64Array(n);
  const rate = (x: number) => {
    const occipital = x > 0.02 ? Math.min(0.995, (x - 0.02) / 1.12) : 0;
    const frontal = x < -0.55 ? Math.min(0.995, (-0.55 - x) / 0.62) : 0;
    const k = (xi: number, flat: number) => (flat * flat * xi * xi) / (1 - xi * xi);
    return Math.sqrt(1 + k(occipital, 0.55) + k(frontal, 0.9));
  };
  // Integrated out from x = 0 both ways.
  const zero = Math.round(-X0 / H);
  for (let i = zero + 1; i < n; i++) table[i] = table[i - 1]! + rate(X0 + (i - 0.5) * H) * H;
  for (let i = zero - 1; i >= 0; i--) table[i] = table[i + 1]! - rate(X0 + (i + 0.5) * H) * H;
  return (x: number) => {
    const f = Math.max(0, Math.min(n - 1.001, (x - X0) / H)), i = Math.floor(f);
    return table[i]! + (table[i + 1]! - table[i]!) * (f - i);
  };
})();

/** A sulcus on the unrolled surface: its course, how wide it opens, how deep it runs (1 = a major sulcus). */
interface Sulcus {
  course: [number, number][];
  w: number;
  depth: number;
}

/**
 * The left hemisphere's landmark sulci, seen from the side with the frontal
 * pole to the left (the right hemisphere mirrors them): the ones a doctor
 * looks for first. The smaller folds between them grow around them (see
 * `foldPattern`). Laid out on the hemisphere unrolled about its long axis: x
 * front to back; v = 0.62·atan2(y − 0.1, |z| − 0.32), from the base up over the
 * top to the midline (≈ height on the lateral surface, 0 at mid-height, about
 * 0.93 at the top, 1.2 at the midline).
 */
const SULCI: Sulcus[] = [
  // The Sylvian fissure: from the temporal pole back, rising, its end turning up into the supramarginal gyrus.
  { course: [[-0.68, -0.25], [-0.45, -0.2], [-0.2, -0.16], [0.05, -0.12], [0.28, -0.07], [0.44, -0.01], [0.53, 0.09], [0.57, 0.2]], w: 0.038, depth: 1.8 },
  // Its anterior rami, cutting the inferior frontal gyrus into pars orbitalis, triangularis and opercularis.
  { course: [[-0.4, -0.19], [-0.37, -0.04], [-0.33, 0.08]], w: 0.02, depth: 0.8 },
  { course: [[-0.44, -0.2], [-0.56, -0.13], [-0.68, -0.09]], w: 0.02, depth: 0.8 },
  // The central sulcus, top to bottom, with the backward bend at the hand knob; never quite reaching the Sylvian fissure.
  { course: [[0.12, 1.24], [0.1, 1.02], [0.07, 0.86], [0.1, 0.74], [0.04, 0.63], [0.0, 0.48], [-0.03, 0.34], [-0.07, 0.18], [-0.1, 0.04], [-0.12, -0.05]], w: 0.026, depth: 1.3 },
  // The precentral and postcentral sulci, either side of it.
  { course: [[-0.07, 1.22], [-0.09, 1.0], [-0.12, 0.82], [-0.14, 0.66], [-0.17, 0.5], [-0.2, 0.34], [-0.24, 0.18], [-0.28, 0.02], [-0.3, -0.07]], w: 0.024, depth: 1.0 },
  { course: [[0.32, 1.22], [0.3, 1.0], [0.27, 0.82], [0.24, 0.64], [0.2, 0.46], [0.15, 0.3], [0.1, 0.16], [0.06, 0.03]], w: 0.024, depth: 1.0 },
  // The superior and inferior frontal sulci, running forward from the precentral: the superior, middle and inferior frontal gyri.
  { course: [[-0.11, 0.76], [-0.28, 0.74], [-0.46, 0.75], [-0.62, 0.7], [-0.78, 0.62], [-0.9, 0.52]], w: 0.024, depth: 0.95 },
  { course: [[-0.21, 0.27], [-0.36, 0.25], [-0.52, 0.22], [-0.68, 0.2], [-0.84, 0.14], [-0.95, 0.06]], w: 0.024, depth: 0.9 },
  // The superior and inferior temporal sulci, parallel to the Sylvian fissure: the three temporal gyri. The superior's end rises into the angular gyrus.
  { course: [[-0.62, -0.43], [-0.4, -0.4], [-0.15, -0.37], [0.1, -0.33], [0.32, -0.28], [0.5, -0.2], [0.62, -0.07], [0.68, 0.08]], w: 0.024, depth: 1.0 },
  { course: [[-0.52, -0.57], [-0.25, -0.55], [0.05, -0.51], [0.35, -0.45], [0.6, -0.36], [0.76, -0.24]], w: 0.022, depth: 0.85 },
  // The intraparietal sulcus: the superior parietal lobule above, the supramarginal and angular gyri below.
  { course: [[0.22, 0.52], [0.4, 0.56], [0.58, 0.54], [0.72, 0.48], [0.84, 0.38]], w: 0.024, depth: 1.0 },
  // The parieto-occipital sulcus notching the top, and the lateral occipital sulcus.
  { course: [[0.84, 1.24], [0.82, 1.06], [0.8, 0.94]], w: 0.022, depth: 0.9 },
  { course: [[0.76, 0.02], [0.86, 0.06], [0.95, 0.05]], w: 0.022, depth: 0.8 },
];

/** In-place radix-2 FFT of one row (n a power of two). */
function fft(re: Float64Array, im: Float64Array, n: number, inverse: boolean) {
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const xr = re[b]! * cr - im[b]! * ci, xi = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - xr;
        im[b] = im[a]! - xi;
        re[a] = re[a]! + xr;
        im[a] = im[a]! + xi;
        [cr, ci] = [cr * wr - ci * wi, cr * wi + ci * wr];
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) (re[i] = re[i]! / n), (im[i] = im[i]! / n);
}

/** 2-D FFT of an n×n grid, rows then columns. */
function fft2(re: Float64Array, im: Float64Array, n: number, inverse: boolean) {
  const r = new Float64Array(n), i = new Float64Array(n);
  for (let y = 0; y < n; y++) {
    r.set(re.subarray(y * n, y * n + n));
    i.set(im.subarray(y * n, y * n + n));
    fft(r, i, n, inverse);
    re.set(r, y * n);
    im.set(i, y * n);
  }
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) (r[y] = re[y * n + x]!), (i[y] = im[y * n + x]!);
    fft(r, i, n, inverse);
    for (let y = 0; y < n; y++) (re[y * n + x] = r[y]!), (im[y * n + x] = i[y]!);
  }
}

/** Bilinear lookup in an n×n grid laid out from (x0, y0) at spacing h. */
function lookup(field: Float64Array, n: number, h: number, x0: number, y0: number) {
  return (x: number, y: number) => {
    const fx = Math.max(0, Math.min(n - 1.001, (x - x0) / h)), fy = Math.max(0, Math.min(n - 1.001, (y - y0) / h));
    const i = Math.floor(fx), j = Math.floor(fy), a = fx - i, t = fy - j;
    const at = (p: number, q: number) => field[q * n + p]!;
    return (at(i, j) * (1 - a) + at(i + 1, j) * a) * (1 - t) + (at(i, j + 1) * (1 - a) + at(i + 1, j + 1) * a) * t;
  };
}

/**
 * The Swift–Hohenberg equation on an n×n grid of spacing h: from faint noise it
 * settles into a labyrinth of stripes, all `period` apart — the way the cortex
 * folds. Held to `target` wherever `hold` is 1. About ±0.7 along the crests and
 * troughs.
 */
function settle(n: number, h: number, period: number, hold: Float64Array, target: Float64Array, seed: number) {
  const k0 = (2 * Math.PI) / period, r = 0.35, dt = 0.4;
  const denom = new Float64Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const kx = (2 * Math.PI * (i <= n / 2 ? i : i - n)) / (n * h), ky = (2 * Math.PI * (j <= n / 2 ? j : j - n)) / (n * h);
      const q = (k0 * k0 - (kx * kx + ky * ky)) / (k0 * k0);
      denom[j * n + i] = 1 - dt * (r - q * q);
    }
  }
  const u = new Float64Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) u[j * n + i] = 0.2 * (noise3(i * 0.9, j * 0.9, seed) - 0.5);
  const held = (k: number) => u[k]! * (1 - hold[k]!) + target[k]! * hold[k]!;
  const re = new Float64Array(n * n), im = new Float64Array(n * n);
  for (let step = 0; step < 260; step++) {
    for (let k = 0; k < n * n; k++) {
      const v = held(k);
      re[k] = v - dt * v * v * v;
      im[k] = 0;
    }
    fft2(re, im, n, false);
    for (let k = 0; k < n * n; k++) (re[k] = re[k]! / denom[k]!), (im[k] = im[k]! / denom[k]!);
    fft2(re, im, n, true);
    u.set(re);
  }
  for (let k = 0; k < n * n; k++) u[k] = held(k);
  return u;
}

/**
 * The folds between the landmarks, grown rather than drawn: settled on the fold
 * map with the landmark sulci held down as grooves, so the gyri beside them run
 * parallel to them (the temporal gyri along the Sylvian fissure, the
 * precentral and postcentral along the central sulcus) and wind freely in
 * between. About −1 down a sulcus, +0.7 on a gyral crown.
 */
function foldPattern(landmarks: Sulcus[], period: number) {
  const N = 256, H = 0.0137, X0 = -1.75, V0 = -1.75;
  const lines = landmarks.map((s) => catmull(s.course.map(([x, v]): V3 => [x, v, 0]), 8));
  const hold = new Float64Array(N * N);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const [x, v] = wander(X0 + i * H, V0 + j * H);
      let best = Infinity;
      for (const pts of lines) {
        for (let k = 0; k < pts.length - 1; k++) {
          const a = pts[k]!, b = pts[k + 1]!;
          const bx = b[0] - a[0], bv = b[1] - a[1];
          const t = Math.max(0, Math.min(1, ((x - a[0]) * bx + (v - a[1]) * bv) / (bx * bx + bv * bv || 1)));
          best = Math.min(best, (x - a[0] - bx * t) ** 2 + (v - a[1] - bv * t) ** 2);
        }
      }
      hold[j * N + i] = Math.exp(-best / (0.016 * 0.016));
    }
  }
  return lookup(settle(N, H, period, hold, new Float64Array(N * N).fill(-1), 5.5), N, H, X0, V0);
}

/** Sulci wander a little, as real ones do: a point of the map, displaced. */
const wander = (x: number, v: number): [number, number] => [x + 0.06 * (noise3(x * 6, v * 6, 1.3) - 0.5), v + 0.06 * (noise3(x * 6 + 11, v * 6, 4.7) - 0.5)];

/**
 * The landmark sulci, worked out once on a fine grid of the fold map: how deep
 * the groove is at each point.
 */
function sulcalMap(sulci: Sulcus[]) {
  const X0 = -1.75, V0 = -1.75, H = 0.005, NX = 701, NV = 701;
  const groove = new Float32Array(NX * NV);
  const lines = sulci.map((s) => {
    const pts = catmull(s.course.map(([x, v]): V3 => [x, v, 0]), 8);
    const xs = pts.map((p) => p[0]), vs = pts.map((p) => p[1]);
    return { ...s, pts, box: [Math.min(...xs) - 0.12, Math.max(...xs) + 0.12, Math.min(...vs) - 0.12, Math.max(...vs) + 0.12] as const };
  });
  for (let j = 0; j < NV; j++) {
    for (let i = 0; i < NX; i++) {
      const [x, v] = wander(X0 + i * H, V0 + j * H);
      let g = 0;
      for (const l of lines) {
        if (x < l.box[0] || x > l.box[1] || v < l.box[2] || v > l.box[3]) continue;
        let best = Infinity;
        for (let k = 0; k < l.pts.length - 1; k++) {
          const a = l.pts[k]!, b = l.pts[k + 1]!;
          const bx = b[0] - a[0], bv = b[1] - a[1];
          const t = Math.max(0, Math.min(1, ((x - a[0]) * bx + (v - a[1]) * bv) / (bx * bx + bv * bv || 1)));
          const dx = x - a[0] - bx * t, dv = v - a[1] - bv * t;
          best = Math.min(best, dx * dx + dv * dv);
        }
        g = Math.max(g, l.depth * Math.exp(-best / (l.w * l.w)));
      }
      groove[j * NX + i] = g;
    }
  }
  return (x: number, v: number) => {
    const fx = Math.max(0, Math.min(NX - 1.001, (x - X0) / H)), fv = Math.max(0, Math.min(NV - 1.001, (v - V0) / H));
    const i = Math.floor(fx), j = Math.floor(fv), u = fx - i, t = fv - j;
    const at = (a: number, b: number) => groove[b * NX + a]!;
    return (at(i, j) * (1 - u) + at(i + 1, j) * u) * (1 - t) + (at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u) * t;
  };
}

/**
 * The middle cerebral artery's branches, out of the Sylvian fissure and up the
 * sulci they follow: prefrontal, precentral, central, anterior parietal,
 * angular, and the temporal branch.
 */
const MCA: [number, number][][] = [
  [[-0.4, -0.19], [-0.46, 0.02], [-0.56, 0.18], [-0.74, 0.23]],
  [[-0.3, -0.15], [-0.28, 0.02], [-0.24, 0.18], [-0.2, 0.34], [-0.17, 0.5], [-0.15, 0.62]],
  [[-0.14, -0.13], [-0.1, 0.04], [-0.07, 0.18], [-0.03, 0.34], [0.0, 0.48], [0.03, 0.6]],
  [[0.03, -0.11], [0.07, 0.04], [0.1, 0.16], [0.15, 0.3], [0.2, 0.46], [0.23, 0.58]],
  [[0.32, -0.08], [0.48, -0.02], [0.62, 0.04], [0.78, 0.11], [0.9, 0.13]],
  [[-0.05, -0.15], [0.05, -0.25], [0.18, -0.32], [0.36, -0.35]],
];

/** x: front (−) to back (+); y: up; z: the left hemisphere towards the viewer (+). */
export function brainField() {
  const hemi = (side: 1 | -1) => {
    const main = ellipsoid([0.02, 0.12, side * 0.37], [1.12, 0.74, 0.53]);
    const frontal = ellipsoid([-0.55, 0.06, side * 0.34], [0.62, 0.62, 0.5]);
    const temporal = ellipsoid([-0.02, -0.36, side * 0.44], [0.64, 0.3, 0.36], 0.12);
    return (x: number, y: number, z: number) => {
      let d = smin(main(x, y, z), frontal(x, y, z), 0.18);
      d = smin(d, temporal(x, y, z), 0.07);
      // A flatter base, where the brain rests on the skull.
      d = smax(d, -(y + 0.6), 0.12);
      return d;
    };
  };
  const left = hemi(1);
  const right = hemi(-1);
  // The cerebellum's two hemispheres, the vermis between them; the pons bulging forward under the temporal lobes.
  const cerebellar = [ellipsoid([0.76, -0.52, 0.3], [0.42, 0.29, 0.4]), ellipsoid([0.76, -0.52, -0.3], [0.42, 0.29, 0.4]), ellipsoid([0.74, -0.5, 0], [0.38, 0.26, 0.2])] as const;
  const cerebellum = (x: number, y: number, z: number) => smin(smin(cerebellar[0](x, y, z), cerebellar[1](x, y, z), 0.12), cerebellar[2](x, y, z), 0.08);
  const pons = ellipsoid([0.27, -0.64, 0], [0.22, 0.21, 0.25]);
  const stem = roundCone([0.34, -0.5, 0], [0.5, -1.18, 0], 0.17, 0.12);
  const cerebrumOf = (x: number, y: number, z: number) => smin(left(x, y, z), right(x, y, z), 0.025);
  const stemOf = (x: number, y: number, z: number) => smin(stem(x, y, z), pons(x, y, z), 0.08);
  // The arteries lie on the brain's smooth envelope, bridging the sulci they run in.
  const envelope = (x: number, y: number, z: number) => smin(cerebrumOf(x, y, z), cerebellum(x, y, z), 0.05);
  /** The envelope's point at (x, v) of the design map on the left hemisphere, found along the ray out from that map's axis. */
  const lateral = (x: number, v: number): V3 => {
    const t = v / 0.62, dy = Math.sin(t), dz = Math.cos(t);
    let lo = 0, hi = 1.6;
    for (let i = 0; i < 32; i++) {
      const r = (lo + hi) / 2;
      if (envelope(x, 0.1 + dy * r, 0.32 + dz * r) > 0) hi = r;
      else lo = r;
    }
    return [x, 0.1 + dy * lo, 0.32 + dz * lo];
  };

  // The landmarks, laid out on the design map, carried onto the fold map.
  const landmarks = SULCI.map((s) => ({
    ...s,
    course: s.course.map(([x, v]): [number, number] => {
      const p = lateral(x, v);
      return [foldS(p[0]), foldV(p[1], p[2])];
    }),
  }));
  const map = sulcalMap(landmarks);
  const folds = foldPattern(landmarks, 0.16);

  /**
   * The poles' faces, where any unrolling of the whole surface strains: each
   * grows its own folds on a map of the face seen end-on, centred on its tip
   * (distances out from the tip as measured over the surface), held round its
   * rim to the folds already there, so they carry on unbroken.
   *   centre — the middle of the ellipsoid the pole rounds off (x, y, z);
   *   reach — its half-length along x, and its cross-section's radii (y, z);
   *   gate — the x over which the cap takes over, from the middle out.
   */
  const cap = (centre: V3, reach: V3, gate: [number, number], seed: number) => {
    const [a, by, bz] = reach, end = Math.sign(gate[1] - gate[0]);
    /** The cross-section's radius in direction t round the long axis. */
    const radius = (t: number) => 1 / Math.hypot(Math.sin(t) / by, Math.cos(t) / bz);
    /** Distance over the surface from the tip, out to the point at angle θ along a meridian of half-axes (a, b). */
    const arc = (theta: number, b: number) => {
      let sum = 0;
      for (let i = 0; i <= 8; i++) {
        const th = (theta * i) / 8, w = i === 0 || i === 8 ? 1 : i % 2 ? 4 : 2;
        sum += w * Math.hypot(a * Math.sin(th), b * Math.cos(th));
      }
      return (sum * theta) / 24;
    };
    /** Where a point sits on the cap's map. */
    const place = (y: number, z: number): [number, number] => {
      const dy = y - centre[1], dz = Math.abs(z) - centre[2], t = Math.atan2(dy, dz), b = radius(t);
      const rho = arc(Math.asin(Math.min(1, Math.hypot(dy, dz) / b)), b);
      return [rho * Math.cos(t), rho * Math.sin(t)];
    };
    const n = 128, h = 0.0141, o = -0.9;
    const hold = new Float64Array(n * n), target = new Float64Array(n * n);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const P = o + i * h, Q = o + j * h, rho = Math.hypot(P, Q), k = j * n + i;
        hold[k] = smooth(0.4, 0.52, rho);
        if (!hold[k]) continue;
        // The face's point this far from the tip, in this direction round it.
        const t = Math.atan2(Q, P), b = radius(t);
        let lo = 0, hi = Math.PI / 2;
        for (let it = 0; it < 24; it++) {
          const mid = (lo + hi) / 2;
          if (arc(mid, b) < rho) lo = mid;
          else hi = mid;
        }
        const r = b * Math.sin(lo), y = centre[1] + r * Math.sin(t), z = centre[2] + r * Math.cos(t);
        let inside = centre[0], outside = centre[0] + end * (a + 0.3);
        for (let it = 0; it < 30; it++) {
          const x = (inside + outside) / 2;
          if (left(x, y, z) > 0) outside = x;
          else inside = x;
        }
        target[k] = folds(foldS(inside), foldV(y, z));
      }
    }
    const grown = lookup(settle(n, h, 0.16, hold, target, seed), n, h, o, o);
    return { gate, place, grown };
  };
  const caps = [cap([0.02, 0.12, 0.37], [1.12, 0.74, 0.53], [0.3, 0.6], 7.1), cap([-0.55, 0.06, 0.34], [0.62, 0.62, 0.5], [-0.6, -0.8], 9.3)];
  const foldAt = (x: number, y: number, z: number) => {
    let u = folds(foldS(x), foldV(y, z));
    for (const c of caps) {
      const near = smooth(c.gate[0], c.gate[1], x);
      if (!near) continue;
      const [P, Q] = c.place(y, z);
      const w = near * smooth(0.52, 0.4, Math.hypot(P, Q));
      if (w) u = u * (1 - w) + w * c.grown(P, Q);
    }
    return u;
  };
  /** How far down a sulcus a point of the cortex lies: 0 on a gyral crown, 1 at the bottom (the landmarks a little deeper). */
  const sulcusAt = (x: number, y: number, z: number) => ({ fold: smooth(0.45, -0.85, foldAt(x, y, z)), landmark: map(foldS(x), foldV(y, z)) });
  /** The folds fade out on the flat base, where the brain rests on the skull. */
  const base = (y: number) => smooth(-0.62, -0.5, y);
  const full: SD = (x, y, z) => {
    const cer = cerebrumOf(x, y, z);
    const cb = cerebellum(x, y, z);
    const bs = stemOf(x, y, z);
    let d = smin(smin(cer, cb, 0.05), bs, 0.08);
    if (d > -0.08 && d < 0.08) {
      if (cer < cb + 0.02 && cer < bs) {
        // Narrow, deep sulci between rounded gyri.
        const s = sulcusAt(x, y, z);
        d += (0.045 * s.fold ** 1.3 + 0.025 * s.landmark) * base(y);
        // The longitudinal fissure between the hemispheres.
        d += 0.06 * Math.exp(-((z / 0.03) ** 2)) * smooth(-0.35, 0.1, y);
        d -= 0.004 * noise3(x * 13, y * 13, z * 13);
      } else if (cb < bs) {
        // Folia: fine, curved ridges across the cerebellum.
        const phase = (y + 0.5 + 0.22 * ((x - 0.78) / 0.42) ** 2 + 0.05 * (noise3(x * 4, y * 4, z * 4) - 0.5)) * 56;
        d += 0.01 * (0.5 + 0.5 * Math.sin(phase));
      }
    }
    return d;
  };

  const CORTEX = linear(0xd59bbd);
  const SULCUS = linear(0x9d5f86);
  const CEREBELLUM = linear(0xc684ae);
  const STEM = linear(0xe0b2c9);
  const colour = (x: number, y: number, z: number): V3 => {
    const cer = cerebrumOf(x, y, z);
    const cb = cerebellum(x, y, z);
    const bs = stemOf(x, y, z);
    if (bs < cer && bs < cb) return mix3(STEM, CEREBELLUM, 0.15 * noise3(x * 8, y * 8, z * 8));
    if (cb < cer) return mix3(CEREBELLUM, SULCUS, 0.25 * noise3(x * 9, y * 9, z * 9));
    const s = sulcusAt(x, y, z);
    const deep = Math.min(1, (0.8 * s.fold + 0.3 * s.landmark) * base(y));
    const shade = 0.9 + 0.16 * noise3(x * 5, y * 5, z * 5);
    const c = mix3(CORTEX, SULCUS, deep * 0.8);
    return [c[0] * shade, c[1] * shade, c[2] * shade];
  };

  const vessels: Coronary[] = MCA.map((course) => {
    const pts = catmull(course.map(([x, v]) => lateral(x, v)), 8).map((p) => onSurface(envelope, p, 0.006));
    const n = pts.length - 1;
    return { kind: "artery", points: pts.flatMap((p) => [p[0], p[1], p[2]]), radii: pts.map((_, i) => 0.012 - 0.005 * (i / n)), ao: [], ventricle: [], atrium: [] };
  });

  return { full, colour, vessels, min: [-1.3, -1.28, -1.0] as V3, max: [1.32, 0.98, 1.0] as V3, center: [0.05, -0.12, 0] as V3 };
}

export function buildBrainModel(step = 0.016): HeartModel {
  const b = brainField();
  return finish(b.full, b.min, b.max, step, b.colour, b.vessels, b.center);
}

/* -------------------------------------------------------------------------- */
/* The lungs                                                                   */
/* -------------------------------------------------------------------------- */

/** x: the patient's right (−) to left (+); y: up; z: anterior (towards the viewer). */
export function lungsField() {
  const lung = (side: 1 | -1) => {
    // Three overlapping lobes, blended into one rounded organ, then shaped against the heart and the diaphragm.
    const upper = ellipsoid([side * 0.5, 0.48, -0.03], [0.32, 0.5, 0.34]);
    const middle = ellipsoid([side * 0.58, -0.02, 0], [side > 0 ? 0.41 : 0.44, 0.56, 0.43]);
    const lower = ellipsoid([side * 0.62, -0.46, 0.02], [side > 0 ? 0.45 : 0.48, 0.42, 0.46]);
    const body = (x: number, y: number, z: number) => smin(smin(upper(x, y, z), middle(x, y, z), 0.32), lower(x, y, z), 0.3);
    // The right dome of the diaphragm sits higher, over the liver.
    const dome = ellipsoid([side * 0.6, side > 0 ? -1.36 : -1.31, 0.04], [0.86, 0.7, 0.8]);
    // The cardiac notch: the left lung's anterior border swept aside by the heart, the lingula curling under it.
    const notch = ellipsoid([0.24, -0.25, 0.3], [0.25, 0.29, 0.42]);
    return (x: number, y: number, z: number) => {
      let d = body(x, y, z);
      d = smax(d, -dome(x, y, z), 0.1); // the concave base on the diaphragm
      d = smax(d, side > 0 ? 0.24 - x : x + 0.15, 0.12); // the flatter medial surface, facing the heart
      if (side > 0) d = smax(d, -notch(x, y, z), 0.06);
      return d;
    };
  };
  const right = lung(-1);
  const left = lung(1);
  // The trachea divides at the carina: the right main bronchus shorter, wider and more vertical; the left longer, narrower and more horizontal.
  const trachea = roundCone([0, 1.46, -0.05], [0, 0.52, -0.05], 0.11, 0.115);
  const rightBronchus = roundCone([0, 0.54, -0.05], [-0.27, 0.16, -0.05], 0.1, 0.085);
  const leftBronchus = roundCone([0, 0.54, -0.05], [0.44, 0.2, -0.05], 0.088, 0.07);
  const airwayOf = (x: number, y: number, z: number) => smin(trachea(x, y, z), smin(rightBronchus(x, y, z), leftBronchus(x, y, z), 0.05), 0.05);

  /**
   * Where the oblique fissure runs, as a height: a plane rising steeply towards
   * the back. Seen from the front it comes round the lateral border at about
   * mid-height and runs down and medially to the inferior border (the 6th
   * costal cartilage); behind, it climbs towards the 3rd thoracic vertebra.
   */
  const oblique = (x: number, z: number) => (x < 0 ? -0.4 : -0.37) + 0.44 * Math.abs(x) - 1.235 * z;
  /** The fissures, carved into each lung: oblique on both sides, horizontal on the right. */
  const fissures = (x: number, y: number, z: number) => {
    const ax = Math.abs(x);
    const ob = (y - oblique(x, z)) / (1.65 * 0.012);
    let g = Math.exp(-(ob * ob)) * smooth(0.12, 0.24, ax);
    if (x < 0) {
      // Horizontal (right lung only): level with the 4th costal cartilage, from the anterior border back to where it meets the oblique, so the middle lobe is the wedge between them.
      const hz = (y - 0.072 + 0.06 * ax) / 0.013;
      g = Math.max(g, Math.exp(-(hz * hz)) * smooth(-0.01, 0.03, y - oblique(x, z)) * smooth(0.12, 0.24, ax));
    }
    return g;
  };
  const full: SD = (x, y, z) => {
    const lungs = Math.min(right(x, y, z), left(x, y, z));
    const air = airwayOf(x, y, z);
    let d = smin(lungs, air, 0.05);
    if (d > -0.06 && d < 0.06) {
      if (lungs < air) {
        d += 0.02 * fissures(x, y, z);
        d += 0.004 * (noise3(x * 14, y * 14, z * 14) - 0.5);
      } else if (y > 0.5) {
        // Cartilage rings down the trachea.
        d -= 0.009 * (0.5 + 0.5 * Math.cos(y * 64));
      }
    }
    return d;
  };

  const LUNG = linear(0xe3a3bd);
  const LUNG_DEEP = linear(0xb06f95);
  const CARTILAGE = linear(0xeed4e0);
  const colour = (x: number, y: number, z: number): V3 => {
    const lungs = Math.min(right(x, y, z), left(x, y, z));
    const air = airwayOf(x, y, z);
    if (air < lungs) return mix3(CARTILAGE, LUNG_DEEP, 0.1 + 0.15 * (0.5 + 0.5 * Math.cos(y * 64)));
    // Fine lobules mottle the surface; the fissures run deeper.
    const lob = noise3(x * 11, y * 11, z * 11);
    const c = mix3(LUNG, LUNG_DEEP, 0.18 * lob + 0.6 * fissures(x, y, z));
    const shade = 0.92 + 0.12 * noise3(x * 4, y * 4, z * 4);
    return [c[0] * shade, c[1] * shade, c[2] * shade];
  };
  return { full, colour, vessels: [] as Coronary[], min: [-1.2, -1.05, -0.62] as V3, max: [1.2, 1.56, 0.62] as V3, center: [0, 0.22, 0] as V3 };
}

export function buildLungsModel(step = 0.016): HeartModel {
  const l = lungsField();
  return finish(l.full, l.min, l.max, step, l.colour, l.vessels, l.center);
}
