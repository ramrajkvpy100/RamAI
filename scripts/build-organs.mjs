/**
 * Builds the brain and the lungs into public/models (run after changing organ-model.ts):
 *   npx jiti scripts/build-organs.mjs
 * (jiti, not plain node: organ-model.ts imports heart-model without a file extension.)
 * Two sizes each, like the heart: "hd" for large screens, "sd" for phones and small cards.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

import { encodeHeart } from "../src/components/three/heart-asset.ts";
import { buildBrainModel, buildLungsModel } from "../src/components/three/organ-model.ts";

mkdirSync("public/models", { recursive: true });
const organs = { brain: buildBrainModel, lungs: buildLungsModel };
for (const [organ, build] of Object.entries(organs)) {
  // The brain's folds need fewer, larger cells to stay a sensible download.
  for (const [size, step] of organ === "brain" ? [["hd", 0.018], ["sd", 0.026]] : [["hd", 0.0145], ["sd", 0.022]]) {
    const started = performance.now();
    const model = build(step);
    const packed = encodeHeart(model);
    const gz = gzipSync(packed, { level: 9 });
    writeFileSync(`public/models/${organ}-${size}.bin.gz`, gz);
    const kb = (b) => `${Math.round(b / 1024)} KB`;
    console.log(`${organ}-${size}: ${model.positions.length / 3} vertices, ${(model.quads.length / 4) * 2} triangles, ${kb(packed.length)} → ${kb(gz.length)} gzipped, ${Math.round(performance.now() - started)} ms`);
  }
}
