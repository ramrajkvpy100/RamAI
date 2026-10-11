/**
 * Builds the anatomical heart into public/models (run after changing heart-model.ts):
 *   node scripts/build-heart.mjs
 * Two sizes: "hd" for large screens, "sd" for phones and small cards.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

import { encodeHeart } from "../src/components/three/heart-asset.ts";
import { buildHeartModel } from "../src/components/three/heart-model.ts";

mkdirSync("public/models", { recursive: true });
for (const [name, step] of [["heart-hd", 0.0145], ["heart-sd", 0.022]]) {
  const started = performance.now();
  const model = buildHeartModel(step);
  const packed = encodeHeart(model);
  const gz = gzipSync(packed, { level: 9 });
  writeFileSync(`public/models/${name}.bin.gz`, gz);
  const kb = (b) => `${Math.round(b / 1024)} KB`;
  console.log(`${name}: ${model.positions.length / 3} vertices, ${(model.quads.length / 4) * 2} triangles, ${kb(packed.length)} → ${kb(gz.length)} gzipped, ${Math.round(performance.now() - started)} ms`);
}
