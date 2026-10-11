import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { decodeHeart, encodeHeart } from "@/components/three/heart-asset";
import { buildHeartModel } from "@/components/three/heart-model";

const file = (name: string) => {
  const raw = gunzipSync(readFileSync(`public/models/${name}.bin.gz`));
  return decodeHeart(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
};

describe("the anatomical heart", () => {
  it("packs and unpacks without losing anything that shows", () => {
    const model = buildHeartModel(0.05);
    const back = decodeHeart(encodeHeart(model).slice().buffer);
    const n = model.positions.length / 3;
    expect(back.positions.length).toBe(n * 3);
    let worst = 0;
    for (let i = 0; i < model.positions.length; i++) worst = Math.max(worst, Math.abs(back.positions[i]! - model.positions[i]!));
    expect(worst).toBeLessThan(0.0003);
    expect(back.indices.length).toBe((model.quads.length / 4) * 6);
    expect(Math.max(...back.indices)).toBeLessThan(n);
    expect(back.vessels.map((v) => v.kind)).toEqual(model.vessels.map((v) => v.kind));
  });

  it.each(["heart-hd", "heart-sd"])("%s: a whole heart, upright, with its coronary vessels", (name) => {
    const heart = file(name);
    const n = heart.positions.length / 3;
    expect(n).toBeGreaterThan(15_000);
    let minY = Infinity, maxY = -Infinity;
    for (let i = 1; i < heart.positions.length; i += 3) {
      minY = Math.min(minY, heart.positions[i]!);
      maxY = Math.max(maxY, heart.positions[i]!);
    }
    // Apex at the bottom, the arch branches at the top: about 2.4 tall.
    expect(maxY - minY).toBeGreaterThan(2.2);
    expect(maxY - minY).toBeLessThan(2.8);
    expect(heart.vessels.filter((v) => v.kind === "artery").length).toBeGreaterThanOrEqual(6);
    expect(heart.vessels.filter((v) => v.kind === "vein").length).toBeGreaterThanOrEqual(2);
    // Some of it beats as ventricle, some as atrium.
    const ventricle = [...heart.attrs].filter((_, i) => i % 4 === 2 && heart.attrs[i]! > 200).length;
    const atrium = [...heart.attrs].filter((_, i) => i % 4 === 3 && heart.attrs[i]! > 200).length;
    expect(ventricle).toBeGreaterThan(n * 0.2);
    expect(atrium).toBeGreaterThan(n * 0.05);
  });
});
