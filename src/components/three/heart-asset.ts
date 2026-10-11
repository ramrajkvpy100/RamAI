/**
 * The heart's file format: everything the scene needs, quantised and packed,
 * then gzipped. Written by `node scripts/build-heart.mjs`, read in the browser.
 *
 *   "RHT2" · u32 vertices · u32 indices · u32 vessels · f32 min[3] · f32 max[3] · f32 centre[3]
 *   positions: per axis, 14-bit deltas as a low-byte then a high-byte plane
 *   colours (sRGB) and attributes (shade, fat, ventricle, atrium): byte-delta planes
 *   quads (four indices each): zigzag varint deltas
 *   per vessel: u8 kind · u32 points · points × (f32 x, y, z, radius · u8 shade, ventricle, atrium)
 */
import type { HeartModel } from "./heart-model";

export interface HeartVessel {
  kind: "artery" | "vein";
  points: Float32Array;
  radii: Float32Array;
  /** Per point: shade, ventricle, atrium (0…1). */
  attrs: Float32Array;
}

export interface HeartAsset {
  positions: Float32Array;
  /** Linear RGB. */
  colors: Float32Array;
  /** Shade, fat, ventricle, atrium — normalised bytes. */
  attrs: Uint8Array;
  indices: Uint16Array | Uint32Array;
  vessels: HeartVessel[];
  center: [number, number, number];
}

const MAGIC = 0x32544852; // "RHT2"
const BITS = 14;
const Q = (1 << BITS) - 1;
const toSrgb8 = (c: number) => Math.round(255 * Math.min(1, Math.max(0, c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)));
const byte = (v: number) => Math.round(255 * Math.min(1, Math.max(0, v)));
const zig = (d: number) => (d << 1) ^ (d >> 31);
const unzig = (z: number) => (z >>> 1) ^ -(z & 1);

/** A growable byte buffer. */
class Bytes {
  private buf = new Uint8Array(1 << 16);
  length = 0;
  private room(n: number) {
    if (this.length + n <= this.buf.length) return;
    const next = new Uint8Array(Math.max(this.buf.length * 2, this.length + n));
    next.set(this.buf.subarray(0, this.length));
    this.buf = next;
  }
  u8(v: number) {
    this.room(1);
    this.buf[this.length++] = v & 255;
  }
  u32(v: number) {
    for (let i = 0; i < 4; i++) this.u8(v >>> (i * 8));
  }
  f32(v: number) {
    const b = new Uint8Array(new Float32Array([v]).buffer);
    for (const x of b) this.u8(x);
  }
  varint(v: number) {
    while (v > 127) {
      this.u8((v & 127) | 128);
      v >>>= 7;
    }
    this.u8(v);
  }
  bytes() {
    return this.buf.slice(0, this.length);
  }
}

/**
 * Packed for gzip: coordinates quantised to 14 bits and stored as deltas
 * along the vertex order (neighbouring vertices are neighbours in space), each
 * value split into a low-byte and a high-byte plane; colours and attributes as
 * byte deltas, one plane per channel; indices as varint deltas.
 */
export function encodeHeart(m: HeartModel): Uint8Array {
  const n = m.positions.length / 3;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.positions.length; i++) {
    const k = i % 3;
    min[k] = Math.min(min[k]!, m.positions[i]!);
    max[k] = Math.max(max[k]!, m.positions[i]!);
  }
  const out = new Bytes();
  out.u32(MAGIC);
  out.u32(n);
  out.u32(m.quads.length);
  out.u32(m.vessels.length);
  for (let k = 0; k < 3; k++) out.f32(min[k]!);
  for (let k = 0; k < 3; k++) out.f32(max[k]!);
  for (let k = 0; k < 3; k++) out.f32(m.center[k]!);
  for (let k = 0; k < 3; k++) {
    const z = new Uint16Array(n);
    let prev = 0;
    for (let i = 0; i < n; i++) {
      const q = Math.round(((m.positions[i * 3 + k]! - min[k]!) / (max[k]! - min[k]! || 1)) * Q);
      z[i] = zig(q - prev);
      prev = q;
    }
    for (let i = 0; i < n; i++) out.u8(z[i]!);
    for (let i = 0; i < n; i++) out.u8(z[i]! >> 8);
  }
  const plane = (get: (i: number) => number) => {
    let prev = 0;
    for (let i = 0; i < n; i++) {
      const v = get(i);
      out.u8(v - prev);
      prev = v;
    }
  };
  for (let c = 0; c < 3; c++) plane((i) => toSrgb8(m.colors[i * 3 + c]!));
  for (let c = 0; c < 4; c++) plane((i) => byte(m.attrs[i * 4 + c]!));
  let prev = 0;
  for (const v of m.quads) {
    out.varint(zig(v - prev));
    prev = v;
  }
  for (const v of m.vessels) {
    const count = v.points.length / 3;
    out.u8(v.kind === "artery" ? 0 : 1);
    out.u32(count);
    for (let p = 0; p < count; p++) {
      out.f32(v.points[p * 3]!);
      out.f32(v.points[p * 3 + 1]!);
      out.f32(v.points[p * 3 + 2]!);
      out.f32(v.radii[p]!);
      out.u8(byte(v.ao[p]!));
      out.u8(byte(v.ventricle[p]!));
      out.u8(byte(v.atrium[p]!));
    }
  }
  return out.bytes();
}

const SRGB = Array.from({ length: 256 }, (_, i) => {
  const c = i / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});

export function decodeHeart(buffer: ArrayBuffer): HeartAsset {
  const bytes = new Uint8Array(buffer);
  const dv = new DataView(buffer);
  let o = 0;
  const u32 = () => {
    const v = dv.getUint32(o, true);
    o += 4;
    return v;
  };
  const f32 = () => {
    const v = dv.getFloat32(o, true);
    o += 4;
    return v;
  };
  if (u32() !== MAGIC) throw new Error("Not a heart model");
  const n = u32();
  const quadIndexCount = u32();
  const vesselCount = u32();
  const min = [f32(), f32(), f32()];
  const max = [f32(), f32(), f32()];
  const center = [f32(), f32(), f32()] as [number, number, number];
  const positions = new Float32Array(n * 3);
  for (let k = 0; k < 3; k++) {
    const scale = (max[k]! - min[k]!) / Q;
    let q = 0;
    for (let i = 0; i < n; i++) {
      q += unzig(bytes[o + i]! | (bytes[o + n + i]! << 8));
      positions[i * 3 + k] = min[k]! + q * scale;
    }
    o += n * 2;
  }
  const colors = new Float32Array(n * 3);
  for (let c = 0; c < 3; c++) {
    let v = 0;
    for (let i = 0; i < n; i++) {
      v = (v + bytes[o + i]!) & 255;
      colors[i * 3 + c] = SRGB[v]!;
    }
    o += n;
  }
  const attrs = new Uint8Array(n * 4);
  for (let c = 0; c < 4; c++) {
    let v = 0;
    for (let i = 0; i < n; i++) {
      v = (v + bytes[o + i]!) & 255;
      attrs[i * 4 + c] = v;
    }
    o += n;
  }
  // Quads → triangles, each split along its shorter diagonal.
  const indices = n > 65535 ? new Uint32Array((quadIndexCount / 4) * 6) : new Uint16Array((quadIndexCount / 4) * 6);
  let prev = 0;
  const quad = [0, 0, 0, 0];
  const d2 = (a: number, b: number) => {
    const dx = positions[a * 3]! - positions[b * 3]!, dy = positions[a * 3 + 1]! - positions[b * 3 + 1]!, dz = positions[a * 3 + 2]! - positions[b * 3 + 2]!;
    return dx * dx + dy * dy + dz * dz;
  };
  for (let i = 0, t = 0; i < quadIndexCount; i++) {
    let z = 0;
    let shift = 0;
    let b: number;
    do {
      b = bytes[o++]!;
      z |= (b & 127) << shift;
      shift += 7;
    } while (b & 128);
    prev += unzig(z >>> 0);
    quad[i & 3] = prev;
    if ((i & 3) !== 3) continue;
    const [a, bq, c, d] = quad as [number, number, number, number];
    if (d2(a, c) <= d2(bq, d)) indices.set([a, bq, c, a, c, d], t);
    else indices.set([a, bq, d, bq, c, d], t);
    t += 6;
  }
  const vessels: HeartVessel[] = [];
  for (let v = 0; v < vesselCount; v++) {
    const kind = bytes[o++] === 0 ? "artery" : "vein";
    const count = u32();
    const points = new Float32Array(count * 3);
    const radii = new Float32Array(count);
    const vattrs = new Float32Array(count * 3);
    for (let p = 0; p < count; p++) {
      points[p * 3] = f32();
      points[p * 3 + 1] = f32();
      points[p * 3 + 2] = f32();
      radii[p] = f32();
      vattrs[p * 3] = bytes[o++]! / 255;
      vattrs[p * 3 + 1] = bytes[o++]! / 255;
      vattrs[p * 3 + 2] = bytes[o++]! / 255;
    }
    vessels.push({ kind, points, radii, attrs: vattrs });
  }
  return { positions, colors, attrs, indices, vessels, center };
}

/** Fetches and unpacks a heart file (gzipped by the build script — unless something on the way already unzipped it). */
export async function loadHeart(url: string, signal?: AbortSignal): Promise<HeartAsset> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Heart model unavailable (${res.status})`);
  const raw = await res.arrayBuffer();
  const head = new Uint8Array(raw, 0, 2);
  if (head[0] !== 0x1f || head[1] !== 0x8b) return decodeHeart(raw);
  const unzipped = new Blob([raw]).stream().pipeThrough(new DecompressionStream("gzip"));
  return decodeHeart(await new Response(unzipped).arrayBuffer());
}
