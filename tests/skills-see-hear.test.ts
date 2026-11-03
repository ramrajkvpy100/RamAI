import { describe, expect, it } from "vitest";

import baseline from "./fixtures/skills-baseline.json";

import { renderAuscultation } from "@/engine/stethoscope-audio";
import type { SoundParams as Auscultation } from "@/engine/stethoscope-audio";
import { RADIOLOGY_ALSO_TRUE, RADIOLOGY_CLUSTERS, SOUND_ALSO_TRUE, SOUND_CLUSTERS, SPOT_ALSO_TRUE, SPOT_CLUSTERS } from "@/lib/banks/confusable-data";
import { ABDOMEN, ABDOMEN_CASES, HEART, HEART_CASES, LUNG_CASES, LUNGS, type SoundItem } from "@/lib/banks/sounds";
import { optionText, optionTexts, pickConfusable, pickOptions, type Pickable } from "@/lib/confusable";
import { groupOf, groupsOf, MODALITIES, MODALITY_IDS, optionsFor, type Modality } from "@/lib/practice";
import { deckOf, EXTRA_ITEMS, extraGroup, RADIOLOGY_BRIEFS, RADIOLOGY_DECKS } from "@/lib/radiology";
import SINGLES from "@/lib/radiology-singles.json";

const SOUNDS = [...HEART, ...LUNGS, ...ABDOMEN];
const seeded = (seed: number) => {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

describe("nothing was lost", () => {
  it("every baseline Spot id is still there", () => {
    for (const m of Object.keys(baseline.spot) as Modality[]) {
      const ids = new Set(MODALITIES[m].items.map((i) => i.id));
      for (const id of (baseline.spot as Record<string, string[]>)[m]!) expect(ids.has(id), `${m}:${id}`).toBe(true);
    }
  });
  it("every baseline radiology and sound id is still there", () => {
    for (const id of baseline.radioBriefs) expect(RADIOLOGY_BRIEFS[id], id).toBeTruthy();
    const extras = new Set(EXTRA_ITEMS.map((x) => x.id));
    for (const id of baseline.radioExtra) expect(extras.has(id), id).toBe(true);
    const sounds = new Set(SOUNDS.map((x) => x.id));
    for (const id of baseline.sounds) expect(sounds.has(id), id).toBe(true);
  });
  it("ids are unique within each drill", () => {
    for (const m of MODALITY_IDS) expect(new Set(MODALITIES[m].items.map((i) => i.id)).size).toBe(MODALITIES[m].items.length);
    expect(new Set(EXTRA_ITEMS.map((i) => i.id)).size).toBe(EXTRA_ITEMS.length);
    expect(new Set(SOUNDS.map((i) => i.id)).size).toBe(SOUNDS.length);
  });
});

describe("groups", () => {
  it("every Spot item has a group, and each group holds 8–35", () => {
    for (const m of MODALITY_IDS) {
      for (const i of MODALITIES[m].items) expect(i.group, `${m}:${i.id}`).toBeTruthy();
      for (const g of groupsOf(m)) {
        const n = MODALITIES[m].items.filter((i) => groupOf(m, i) === g).length;
        expect(n, `${m} / ${g}`).toBeGreaterThanOrEqual(8);
        expect(n, `${m} / ${g}`).toBeLessThanOrEqual(35);
      }
    }
  });
  it("clinical images grew as asked", () => {
    const count = (s: string) => MODALITIES.clinical.items.filter((i) => i.subject === s).length;
    expect(count("Eye")).toBeGreaterThanOrEqual(15);
    expect(count("ENT & mouth")).toBeGreaterThanOrEqual(15);
    expect(count("Paediatrics")).toBeGreaterThanOrEqual(15);
    for (const i of MODALITIES.clinical.items) {
      expect(i.search.length, i.id).toBeGreaterThan(0);
      expect(i.key.length, i.id).toBeGreaterThan(10);
      expect(i.describe.length, i.id).toBeGreaterThan(5);
    }
  });
  it("every briefed study is in exactly one deck, every deck holds 8–35", () => {
    const placed = RADIOLOGY_DECKS.flatMap((d) => d.ids);
    expect(new Set(placed).size).toBe(placed.length);
    for (const id of Object.keys(RADIOLOGY_BRIEFS)) expect(deckOf(id), id).toBeTruthy();
    for (const x of EXTRA_ITEMS) expect(deckOf(x.id), x.id).toBeTruthy();
    const known = new Set([...Object.keys(RADIOLOGY_BRIEFS), ...EXTRA_ITEMS.map((x) => x.id)]);
    for (const id of placed) expect(known.has(id), id).toBe(true);
    for (const d of RADIOLOGY_DECKS) {
      expect(d.ids.length, d.name).toBeGreaterThanOrEqual(8);
      expect(d.ids.length, d.name).toBeLessThanOrEqual(35);
    }
  });
  it("MRI has 15 and Special Modalities 18, each new study able to find a real image", () => {
    expect(EXTRA_ITEMS.filter((x) => x.modality === "mri").length).toBeGreaterThanOrEqual(15);
    expect(EXTRA_ITEMS.filter((x) => x.modality !== "mri").length).toBeGreaterThanOrEqual(18);
    const old = new Set(baseline.radioExtra);
    for (const x of EXTRA_ITEMS.filter((x) => !old.has(x.id))) {
      expect(x.search.length, x.id).toBeGreaterThan(0);
      expect(x.history && x.question, x.id).toBeTruthy();
    }
    // Kept images all still name a study that exists.
    for (const s of SINGLES.filter((s) => !["xray", "ct", "usg"].includes(s.modality))) expect(EXTRA_ITEMS.find((x) => x.id === s.item), s.item).toBeTruthy();
  });
  it("every sound has a group; heart, breath and abdomen have grown; each group holds 8–35", () => {
    expect(HEART.length).toBeGreaterThanOrEqual(18);
    expect(LUNGS.length).toBeGreaterThanOrEqual(14);
    expect(ABDOMEN.length).toBeGreaterThanOrEqual(12);
    const groups = new Map<string, number>();
    for (const s of SOUNDS) groups.set(s.group, (groups.get(s.group) ?? 0) + 1);
    for (const [g, n] of groups) {
      expect(n, g).toBeGreaterThanOrEqual(8);
      expect(n, g).toBeLessThanOrEqual(35);
    }
    expect(HEART_CASES.length).toBe(HEART.length * 5);
    expect(LUNG_CASES.length).toBe(LUNGS.length * 7);
    expect(ABDOMEN_CASES.length).toBe(ABDOMEN.length * 5);
  });
});

describe("the picker", () => {
  const pool: (Pickable & { n: number })[] = Array.from({ length: 12 }, (_, n) => ({ id: `x${n}`, label: `Thing ${n}`, group: n < 5 ? "A" : "B", n }));
  it("gives 4 distinct options with the right one, 3 wrong from the same group", () => {
    for (let seed = 1; seed < 30; seed++) {
      const { options, answer } = pickOptions(pool[0]!, pool, { rand: seeded(seed) });
      expect(options).toHaveLength(4);
      expect(new Set(options.map((o) => o.id)).size).toBe(4);
      expect(options[answer]!.id).toBe("x0");
      expect(options.every((o) => o.group === "A")).toBe(true);
    }
  });
  it("runs on into the rest of the pool when a group is too small", () => {
    const small = [...pool.slice(0, 2), ...pool.slice(5)];
    const wrong = pickConfusable(small[0]!, small, { rand: seeded(3) });
    expect(wrong).toHaveLength(3);
    expect(wrong.filter((o) => o.group === "A")).toHaveLength(1);
  });
  it("prefers explicit look-alikes, and never pairs two that would both be right", () => {
    const wrong = pickConfusable(pool[0]!, pool, { clusters: [["x0", "x3"]], alsoTrue: [["x0", "x1"]], rand: seeded(5) });
    expect(wrong[0]!.id).toBe("x3");
    expect(wrong.map((w) => w.id)).not.toContain("x1");
  });
  it("strips the bracket that gives the answer away, unless two would then read alike", () => {
    expect(optionText("Epiglottitis (thumb sign)")).toBe("Epiglottitis");
    expect(optionText("Complete (third-degree) heart block")).toBe("Complete (third-degree) heart block");
    expect(optionText("Supraventricular tachycardia (AVNRT)")).toBe("Supraventricular tachycardia (AVNRT)");
    expect(optionTexts(["Liver abscess (CT)", "Liver abscess (USG)", "Gout (feet)"])).toEqual(["Liver abscess (CT)", "Liver abscess (USG)", "Gout"]);
  });

  it("the classic look-alikes actually come up together", () => {
    const vt = MODALITIES.ecg.items.find((i) => i.id === "vt")!;
    const wrong = pickConfusable(vt, MODALITIES.ecg.items, { clusters: SPOT_CLUSTERS.ecg, alsoTrue: SPOT_ALSO_TRUE, rand: seeded(7) }).map((o) => o.id);
    expect(wrong.sort()).toEqual(["svt", "torsades", "vf"]);
  });
  it("on the real bank: 4 distinct options, 3 from the same group, no bracket giveaway, and never two that are both right", () => {
    const pairs = new Set(SPOT_ALSO_TRUE.flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`]));
    for (const m of MODALITY_IDS) {
      for (const item of MODALITIES[m].items) {
        const { options, answer, labels } = optionsFor(m, item, MODALITIES[m].items, seeded(11));
        expect(options, `${m}:${item.id}`).toHaveLength(4);
        expect(new Set(labels).size, `${m}:${item.id}`).toBe(4);
        expect(options[answer]!.id).toBe(item.id);
        const same = MODALITIES[m].items.filter((i) => i.group === item.group);
        const usable = same.filter((c) => c.id !== item.id && c.label !== item.label && !pairs.has(`${c.id}|${item.id}`));
        if (usable.length >= 4) expect(options.filter((o) => o.group === item.group).length, `${m}:${item.id}`).toBe(4);
        for (const a of options) for (const b of options) expect(pairs.has(`${a.id}|${b.id}`), `${a.id} with ${b.id}`).toBe(false);
      }
    }
  });
  it("radiology-only studies and sounds get real look-alikes too", () => {
    const extras = EXTRA_ITEMS.map((x) => ({ ...x, group: extraGroup(x) }));
    for (const x of extras) {
      const pool = extras.filter((y) => y.modality === x.modality);
      const { options } = pickOptions(x, pool, { clusters: RADIOLOGY_CLUSTERS, alsoTrue: RADIOLOGY_ALSO_TRUE, rand: seeded(13) });
      expect(options, x.id).toHaveLength(4);
    }
    for (const list of [HEART, LUNGS, ABDOMEN] as SoundItem[][]) {
      for (const s of list) {
        const { options } = pickOptions(s, list, { clusters: SOUND_CLUSTERS, alsoTrue: SOUND_ALSO_TRUE, rand: seeded(17) });
        expect(options, s.id).toHaveLength(4);
        expect(options.filter((o) => o.group === s.group), s.id).toHaveLength(4);
      }
    }
  });
  it("every id in a look-alike list exists", () => {
    for (const m of MODALITY_IDS) for (const c of SPOT_CLUSTERS[m]) for (const id of c) expect(MODALITIES[m].items.some((i) => i.id === id), `${m}:${id}`).toBe(true);
    for (const c of RADIOLOGY_CLUSTERS) for (const id of c) expect(EXTRA_ITEMS.some((x) => x.id === id), id).toBe(true);
    for (const c of SOUND_CLUSTERS) for (const id of c) expect(SOUNDS.some((s) => s.id === id), id).toBe(true);
    const all = new Set(MODALITY_IDS.flatMap((m) => MODALITIES[m].items.map((i) => i.id)));
    for (const [a, b] of SPOT_ALSO_TRUE) {
      expect(all.has(a), a).toBe(true);
      expect(all.has(b), b).toBe(true);
    }
  });
});

/** How a sound is built: band energies across time-independent frames — what the ear hears, the noise's randomness averaged out. */
function signature(sound: Auscultation): number[] {
  const x = renderAuscultation([{ ...sound }], 42);
  const rate = 11025;
  const bands = [90, 180, 300, 500, 800, 1200, 1800, 2600];
  const size = 512;
  const energy = bands.map(() => 0);
  let count = 0;
  for (let at = 0; at + size < x.length; at += size * 4) {
    count++;
    bands.forEach((f, b) => {
      // Goertzel at the band's centre.
      const w = (2 * Math.PI * f) / rate;
      let s1 = 0;
      let s2 = 0;
      for (let i = 0; i < size; i++) {
        const s = x[at + i]! + 2 * Math.cos(w) * s1 - s2;
        s2 = s1;
        s1 = s;
      }
      energy[b]! += s1 * s1 + s2 * s2 - 2 * Math.cos(w) * s1 * s2;
    });
  }
  return energy.map((e) => Math.log10(1 + e / count));
}
const distance = (a: number[], b: number[]) => a.reduce((s, v, i) => s + Math.abs(v - b[i]!), 0);

describe("the new sounds really differ", () => {
  const fresh = SOUNDS.filter((s) => !baseline.sounds.includes(s.id));
  const params = (s: Auscultation) => {
    const { rate: _rate, ...rest } = s as Auscultation & { rate?: number };
    return JSON.stringify(rest);
  };
  it("no sound shares its parameters with another", () => {
    const all = SOUNDS.map((s) => params(s.sound));
    expect(new Set(all).size).toBe(all.length);
  });
  it("each new sound has its own parameters and its own acoustic signature", () => {
    expect(fresh.length).toBeGreaterThanOrEqual(11);
    const sigs = new Map(SOUNDS.map((s) => [s.id, signature(s.sound)]));
    for (const s of fresh) {
      for (const o of SOUNDS) {
        if (o.id === s.id) continue;
        expect(params(s.sound), `${s.id} / ${o.id}`).not.toBe(params(o.sound));
        expect(distance(sigs.get(s.id)!, sigs.get(o.id)!), `${s.id} sounds like ${o.id}`).toBeGreaterThan(0.1);
      }
    }
  });
});
